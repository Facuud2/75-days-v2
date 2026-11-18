import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { getCorePrisma } from '../../db';
import { ControllerRequest, ControllerResponse } from '../../http';
import { getServerConfig } from '../../config';
import { DEFAULT_GOALS } from '../../constants/defaultGoals';
import { localChallengeDate, parseTimezoneOffset } from '../../utils/challengeDate';

export function serializeAuthUser(user: {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  profileQuote?: string | null;
  age?: number | null;
  weight?: number | null;
  targetWeight?: number | null;
  height?: number | null;
  registeredAt: Date;
  onboardingCompleted: boolean;
  googleId?: string | null;
  passwordHash?: string | null;
}) {
  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    bannerUrl: user.bannerUrl ?? null,
    profileQuote: user.profileQuote ?? null,
    email: user.email,
    age: user.age ?? undefined,
    weight: user.weight ?? undefined,
    targetWeight: user.targetWeight ?? undefined,
    height: user.height ?? undefined,
    registeredAt: user.registeredAt,
    onboardingCompleted: user.onboardingCompleted,
    isGoogleUser: Boolean(user.googleId),
    hasPassword: Boolean(user.passwordHash),
  };
}

interface VerifiedGoogleIdentity {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string | null;
  age?: number | null;
}

function computeAgeFromBirthDate(year: number, month = 1, day = 1): number | null {
  const now = new Date();
  let age = now.getFullYear() - year;
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  if (currentMonth < month || (currentMonth === month && currentDay < day)) {
    age -= 1;
  }
  if (age < 12 || age > 110) return null;
  return age;
}

interface GooglePeopleBirthday {
  metadata?: {
    primary?: boolean;
    source?: {
      type?: string;
      id?: string;
    };
  };
  date?: {
    year?: number;
    month?: number;
    day?: number;
  };
  text?: string;
}

function parseAgeFromBirthdaysList(
  birthdays: GooglePeopleBirthday[] | undefined
): number | null {
  if (!Array.isArray(birthdays) || birthdays.length === 0) return null;

  const accountBirth = birthdays.find(
    (b) =>
      b.metadata?.source?.type === 'ACCOUNT' &&
      typeof b.date?.year === 'number' &&
      b.date.year > 1900
  );
  const birthWithYear =
    accountBirth ??
    birthdays.find((b) => typeof b.date?.year === 'number' && b.date.year > 1900);

  if (birthWithYear?.date?.year) {
    return computeAgeFromBirthDate(
      birthWithYear.date.year,
      birthWithYear.date.month ?? 1,
      birthWithYear.date.day ?? 1
    );
  }

  for (const b of birthdays) {
    if (typeof b.text === 'string') {
      const match = b.text.match(/\b(19\d{2}|20\d{2})\b/);
      if (match) {
        const parsedYear = Number(match[1]);
        const computed = computeAgeFromBirthDate(
          parsedYear,
          b.date?.month ?? 1,
          b.date?.day ?? 1
        );
        if (computed !== null) return computed;
      }
    }
  }

  return null;
}

async function fetchGoogleBirthdayAge(accessToken: string): Promise<number | null> {
  const endpoints = [
    'https://people.googleapis.com/v1/people/me?personFields=birthdays&sources=READ_SOURCE_TYPE_PROFILE',
    'https://people.googleapis.com/v1/people/me?personFields=birthdays',
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        birthdays?: GooglePeopleBirthday[];
      };
      const age = parseAgeFromBirthdaysList(data.birthdays);
      if (age !== null) return age;
    } catch {
      // Ignore People API errors and fall back
    }
  }

  return null;
}

async function verifyGoogleIdentity(params: {
  accessToken?: string;
  idToken?: string;
}): Promise<VerifiedGoogleIdentity> {
  const rawToken = params.accessToken || params.idToken || '';

  if (process.env.NODE_ENV !== 'production' && rawToken.startsWith('mock-google:')) {
    const jsonPart = rawToken.slice('mock-google:'.length);
    const parsed = JSON.parse(jsonPart) as Partial<VerifiedGoogleIdentity>;
    if (!parsed.googleId || !parsed.email) {
      throw new Error('Invalid mock Google token payload');
    }
    return {
      googleId: parsed.googleId,
      email: parsed.email.toLowerCase().trim(),
      emailVerified: parsed.emailVerified ?? true,
      name: parsed.name || parsed.email.split('@')[0],
      picture: parsed.picture ?? null,
      age: typeof parsed.age === 'number' ? parsed.age : null,
    };
  }

  if (params.accessToken) {
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${params.accessToken}` },
    });

    if (!userInfoRes.ok) {
      throw new Error('Invalid Google access token');
    }

    const profile = (await userInfoRes.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      given_name?: string;
      family_name?: string;
      picture?: string;
    };

    if (!profile.sub || !profile.email) {
      throw new Error('Google profile missing sub or email');
    }

    const age = await fetchGoogleBirthdayAge(params.accessToken);
    const fullName =
      profile.name?.trim() ||
      [profile.given_name, profile.family_name].filter(Boolean).join(' ').trim() ||
      profile.email.split('@')[0];

    return {
      googleId: profile.sub,
      email: profile.email.toLowerCase().trim(),
      emailVerified: Boolean(profile.email_verified),
      name: fullName,
      picture: profile.picture ?? null,
      age,
    };
  }

  if (params.idToken) {
    const tokenInfoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(params.idToken)}`
    );

    if (!tokenInfoRes.ok) {
      throw new Error('Invalid Google ID token');
    }

    const tokenInfo = (await tokenInfoRes.json()) as {
      sub?: string;
      email?: string;
      email_verified?: string | boolean;
      name?: string;
      picture?: string;
      aud?: string;
    };

    const { googleClientId } = getServerConfig();
    if (googleClientId && tokenInfo.aud && tokenInfo.aud !== googleClientId) {
      throw new Error('Google ID token audience mismatch');
    }

    if (!tokenInfo.sub || !tokenInfo.email) {
      throw new Error('Google ID token missing sub or email');
    }

    return {
      googleId: tokenInfo.sub,
      email: tokenInfo.email.toLowerCase().trim(),
      emailVerified: tokenInfo.email_verified === true || tokenInfo.email_verified === 'true',
      name: tokenInfo.name?.trim() || tokenInfo.email.split('@')[0],
      picture: tokenInfo.picture ?? null,
      age: null,
    };
  }

  throw new Error('Missing Google token');
}

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  difficulty: z.enum(['Soft', 'Medium', 'Hard', 'Custom']).default('Medium'),
  timezoneOffset: z.number().optional(),
  customGoalsTemplate: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        icon: z.string().optional(),
      })
    )
    .optional(),
});

export const register = async (req: ControllerRequest, res: ControllerResponse) => {
  try {
    const prisma = getCorePrisma();
    const { jwtSecret } = getServerConfig();
    const validatedData = registerSchema.parse(req.body);
    const { name, email, password, difficulty, customGoalsTemplate, timezoneOffset } =
      validatedData;
    const normalizedEmail = email.toLowerCase().trim();

    if (
      difficulty === 'Custom' &&
      (!customGoalsTemplate || customGoalsTemplate.length === 0)
    ) {
      return res.status(400).json({
        error: 'Custom difficulty requires at least one goal in customGoalsTemplate',
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      if (existingUser.googleId) {
        return res.status(400).json({
          error: 'GOOGLE_ACCOUNT_EXISTS',
          code: 'GOOGLE_ACCOUNT_EXISTS',
        });
      }
      return res.status(400).json({ error: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { name, email: normalizedEmail, passwordHash },
      });

      const today = localChallengeDate(parseTimezoneOffset(timezoneOffset));
      const templatesToUse =
        difficulty === 'Custom' && customGoalsTemplate
          ? customGoalsTemplate
          : DEFAULT_GOALS[difficulty as keyof typeof DEFAULT_GOALS];

      const challenge = await tx.challenge.create({
        data: {
          userId: newUser.id,
          difficulty,
          customGoalsTemplate: {
            create: templatesToUse.map((g) => ({
              title: g.title,
              description: g.description,
              icon: g.icon,
            })),
          },
          dailyLogs: {
            create: {
              date: today,
              goals: {
                create: templatesToUse.map((g) => ({
                  title: g.title,
                  description: g.description,
                  icon: g.icon,
                })),
              },
            },
          },
        },
        include: {
          customGoalsTemplate: true,
          dailyLogs: { include: { goals: true } },
        },
      });

      return { newUser, challenge };
    });

    const token = jwt.sign({ id: user.newUser.id }, jwtSecret, { expiresIn: '7d' });

    return res.status(201).json({
      token,
      user: serializeAuthUser(user.newUser),
      challenge: user.challenge,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('[authController.register]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const login = async (req: ControllerRequest, res: ControllerResponse) => {
  try {
    const prisma = getCorePrisma();
    const { jwtSecret } = getServerConfig();
    const { email, password } = loginSchema.parse(req.body);
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.passwordHash) {
      return res.status(401).json({
        error: 'GOOGLE_ACCOUNT_EXISTS',
        code: 'GOOGLE_ACCOUNT_EXISTS',
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id }, jwtSecret, { expiresIn: '7d' });

    return res.json({
      token,
      user: serializeAuthUser(user),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(401).json({ error: 'Invalid credentials format' });
    }
    console.error('[authController.login]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const googleAuthSchema = z
  .object({
    accessToken: z.string().optional(),
    idToken: z.string().optional(),
    confirmLink: z.boolean().optional(),
    timezoneOffset: z.number().optional(),
  })
  .refine((data) => Boolean(data.accessToken || data.idToken), {
    message: 'Google token is required',
  });

export const googleAuth = async (req: ControllerRequest, res: ControllerResponse) => {
  try {
    const prisma = getCorePrisma();
    const { jwtSecret } = getServerConfig();
    const { accessToken, idToken, confirmLink, timezoneOffset } = googleAuthSchema.parse(
      req.body
    );

    let googleIdentity: VerifiedGoogleIdentity;
    try {
      googleIdentity = await verifyGoogleIdentity({ accessToken, idToken });
    } catch {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    if (!googleIdentity.emailVerified) {
      return res.status(400).json({ error: 'Google email is not verified' });
    }

    const existingGoogleUser = await prisma.user.findUnique({
      where: { googleId: googleIdentity.googleId },
    });

    if (existingGoogleUser) {
      const shouldSyncGoogleAge =
        googleIdentity.age != null &&
        (existingGoogleUser.age == null || !existingGoogleUser.onboardingCompleted);
      const shouldClearLegacyDefaultAge =
        googleIdentity.age == null &&
        !existingGoogleUser.onboardingCompleted &&
        existingGoogleUser.age === 25;

      const updatedUser =
        shouldSyncGoogleAge || shouldClearLegacyDefaultAge
          ? await prisma.user.update({
              where: { id: existingGoogleUser.id },
              data: {
                age: shouldSyncGoogleAge ? googleIdentity.age : null,
              },
            })
          : existingGoogleUser;

      const token = jwt.sign({ id: updatedUser.id }, jwtSecret, { expiresIn: '7d' });
      return res.status(200).json({
        token,
        user: serializeAuthUser(updatedUser),
        isNewUser: false,
      });
    }

    const existingEmailUser = await prisma.user.findUnique({
      where: { email: googleIdentity.email },
    });

    if (existingEmailUser) {
      if (!confirmLink) {
        return res.status(200).json({
          requiresLinkConfirmation: true,
          email: existingEmailUser.email,
          name: existingEmailUser.name,
        });
      }

      const linkedUser = await prisma.user.update({
        where: { id: existingEmailUser.id },
        data: {
          googleId: googleIdentity.googleId,
          ...(existingEmailUser.avatarUrl
            ? {}
            : { avatarUrl: googleIdentity.picture ?? null }),
          ...(existingEmailUser.age != null
            ? {}
            : googleIdentity.age != null
              ? { age: googleIdentity.age }
              : {}),
        },
      });

      const token = jwt.sign({ id: linkedUser.id }, jwtSecret, { expiresIn: '7d' });
      return res.status(200).json({
        token,
        user: serializeAuthUser(linkedUser),
        isNewUser: false,
      });
    }

    const created = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: googleIdentity.name,
          email: googleIdentity.email,
          googleId: googleIdentity.googleId,
          passwordHash: null,
          avatarUrl: googleIdentity.picture ?? null,
          age: googleIdentity.age ?? null,
          onboardingCompleted: false,
        },
      });

      const today = localChallengeDate(parseTimezoneOffset(timezoneOffset));
      const templatesToUse = DEFAULT_GOALS['Medium'];

      const challenge = await tx.challenge.create({
        data: {
          userId: newUser.id,
          difficulty: 'Medium',
          customGoalsTemplate: {
            create: templatesToUse.map((g) => ({
              title: g.title,
              description: g.description,
              icon: g.icon,
            })),
          },
          dailyLogs: {
            create: {
              date: today,
              goals: {
                create: templatesToUse.map((g) => ({
                  title: g.title,
                  description: g.description,
                  icon: g.icon,
                })),
              },
            },
          },
        },
        include: {
          customGoalsTemplate: true,
          dailyLogs: { include: { goals: true } },
        },
      });

      return { newUser, challenge };
    });

    const token = jwt.sign({ id: created.newUser.id }, jwtSecret, { expiresIn: '7d' });

    return res.status(201).json({
      token,
      user: serializeAuthUser(created.newUser),
      challenge: created.challenge,
      isNewUser: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('[authController.googleAuth]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMe = async (req: ControllerRequest, res: ControllerResponse) => {
  try {
    const prisma = getCorePrisma();
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({ user: serializeAuthUser(user) });
  } catch (error) {
    console.error('[authController.getMe]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getOnboardingStatus = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const prisma = getCorePrisma();
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingCompleted: true },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({ onboardingCompleted: user.onboardingCompleted });
  } catch (error) {
    console.error('[authController.getOnboardingStatus]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const completeOnboardingSchema = z.object({
  age: z.number().int().min(12).max(120).optional(),
  weight: z.number().min(20).max(500).optional(),
  targetWeight: z.number().min(20).max(500).optional(),
  height: z.number().min(80).max(260).optional(),
  name: z.string().min(2).max(120).optional(),
  avatarUrl: z.string().max(2_000_000).nullable().optional(),
  bannerUrl: z.string().max(2_000_000).nullable().optional(),
  profileQuote: z.string().max(120).nullable().optional(),
});

export const completeOnboarding = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const prisma = getCorePrisma();
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const bodyData = completeOnboardingSchema.parse(req.body ?? {});

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        onboardingCompleted: true,
        ...(bodyData.age !== undefined && { age: bodyData.age }),
        ...(bodyData.weight !== undefined && { weight: bodyData.weight }),
        ...(bodyData.height !== undefined && { height: bodyData.height }),
        ...(bodyData.targetWeight !== undefined && {
          targetWeight: bodyData.targetWeight,
        }),
        ...(bodyData.name !== undefined && { name: bodyData.name }),
        ...(bodyData.avatarUrl !== undefined && { avatarUrl: bodyData.avatarUrl }),
        ...(bodyData.bannerUrl !== undefined && { bannerUrl: bodyData.bannerUrl }),
        ...(bodyData.profileQuote !== undefined && {
          profileQuote: bodyData.profileQuote,
        }),
      },
    });

    return res.json({ user: serializeAuthUser(user) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('[authController.completeOnboarding]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
