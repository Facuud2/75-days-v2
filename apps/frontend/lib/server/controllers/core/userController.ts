import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getCorePrisma, getHealthPrisma } from '../../db';
import { ControllerRequest, ControllerResponse } from '../../http';

export async function buildUserProfilePayload(userId: string) {
  const prisma = getCorePrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      challenges: {
        include: {
          dailyLogs: {
            select: {
              date: true,
              status: true,
              weight: true,
            },
          },
        },
      },
      sideQuests: true,
      achievements: true,
    },
  });

  if (!user) {
    return null;
  }

  let totalChallengesCompleted = 0;
  let totalDaysCompleted = 0;
  let totalWeightLost = 0;
  let maxStreak = 0;
  let weightLogsCount = 0;

  let bestWeight = user.weight || 0;
  const initialWeight = user.weight || 0;

  const weightHistory: Array<{ date: string; weight: number }> = [];

  if (initialWeight > 0) {
    weightHistory.push({ date: 'Inicio', weight: initialWeight });
  }

  for (const challenge of user.challenges) {
    totalChallengesCompleted += challenge.challengesCompleted;
    if (challenge.streak > maxStreak) {
      maxStreak = challenge.streak;
    }

    const successfulLogs = challenge.dailyLogs.filter((log) => log.status === 'success');
    totalDaysCompleted += successfulLogs.length;

    for (const log of challenge.dailyLogs) {
      if (log.weight) {
        weightLogsCount++;
        if (bestWeight === 0 || log.weight < bestWeight) {
          bestWeight = log.weight;
        }

        try {
          const fmtDate = log.date.substring(5).replace('-', '/');
          weightHistory.push({ date: fmtDate, weight: log.weight });
        } catch {
          weightHistory.push({ date: log.date.substring(5), weight: log.weight });
        }
      }
    }
  }

  totalWeightLost = Math.max(0, initialWeight - bestWeight);

  weightHistory.sort((a, b) => {
    if (a.date === 'Inicio') return -1;
    if (b.date === 'Inicio') return 1;
    return a.date.localeCompare(b.date);
  });

  const completedSideQuests = user.sideQuests.filter((sq) => sq.completed).length;

  const achievementDefinitions = [
    {
      id: '1',
      title: 'Primer Paso',
      description: 'Completar el primer día de un desafío.',
      icon: '🏆',
      color: 'bg-yellow-500/20 text-yellow-500',
      total: 1,
      currentProgress: totalDaysCompleted,
    },
    {
      id: '2',
      title: 'Constancia',
      description: 'Alcanzar una racha de 7 días.',
      icon: '🔥',
      color: 'bg-orange-500/20 text-orange-500',
      total: 7,
      currentProgress: maxStreak,
    },
    {
      id: '3',
      title: 'Disciplina',
      description: 'Completar un desafío de 75 días.',
      icon: '🎯',
      color: 'bg-rose-500/20 text-rose-500',
      total: 1,
      currentProgress: totalChallengesCompleted,
    },
    {
      id: '4',
      title: 'Fuerza de Voluntad',
      description: 'Registrar el peso durante 10 días.',
      icon: '⚖️',
      color: 'bg-blue-500/20 text-blue-500',
      total: 10,
      currentProgress: weightLogsCount,
    },
    {
      id: '5',
      title: 'Aventurero',
      description: 'Completar tu primera misión secundaria.',
      icon: '🗺️',
      color: 'bg-green-500/20 text-green-500',
      total: 1,
      currentProgress: completedSideQuests,
    },
    {
      id: '6',
      title: 'Transformación',
      description: 'Perder tus primeros 5 kg.',
      icon: '✨',
      color: 'bg-purple-500/20 text-purple-500',
      total: 5,
      currentProgress: totalWeightLost,
    },
  ];

  const updatedAchievements = await Promise.all(
    achievementDefinitions.map((def) => {
      const existing = user.achievements.find((a) => a.title === def.title);
      const progress = Math.min(Math.floor(def.currentProgress), def.total);
      const unlocked = progress >= def.total;

      if (existing) {
        if (existing.progress !== progress || existing.unlocked !== unlocked) {
          return prisma.achievement.update({
            where: { id: existing.id },
            data: {
              progress,
              unlocked,
              unlockedAt:
                unlocked && !existing.unlocked ? new Date() : existing.unlockedAt,
            },
          });
        }
        return Promise.resolve(existing);
      }

      return prisma.achievement.create({
        data: {
          userId,
          title: def.title,
          description: def.description,
          icon: def.icon,
          color: def.color,
          progress,
          total: def.total,
          unlocked,
          unlockedAt: unlocked ? new Date() : null,
        },
      });
    })
  );

  return {
    user: {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
      profileQuote: user.profileQuote,
      email: user.email,
      registeredAt: user.registeredAt,
      isGoogleUser: Boolean(user.googleId),
      hasPassword: Boolean(user.passwordHash),
      initialWeight,
      currentWeight: bestWeight || initialWeight,
      targetWeight: user.targetWeight || 0,
      height: user.height || 0,
      weightHistory,
      sideQuests: user.sideQuests.map((quest) => ({
        id: quest.id,
        title: quest.title,
        completionCount: quest.completionCount,
        completed: quest.completed,
      })),
    },
    stats: {
      totalChallengesCompleted,
      totalDaysCompleted,
      totalWeightLost,
    },
    achievements: updatedAchievements,
  };
}

export const getProfile = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const userId = req.user!.id;
    const payload = await buildUserProfilePayload(userId);
    if (!payload) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json(payload);
  } catch (error) {
    console.error('[userController.getProfile]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  avatarUrl: z.string().max(2_000_000).nullable().optional(),
  bannerUrl: z.string().max(2_000_000).nullable().optional(),
  profileQuote: z.string().max(120).nullable().optional(),
  email: z.string().email().optional(),
  age: z.number().int().positive().optional(),
  weight: z.number().positive().optional(),
  targetWeight: z.number().positive().optional(),
  height: z.number().positive().optional(),
}).strict();

export const updateProfile = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const prisma = getCorePrisma();
    const userId = req.user!.id;
    const data = updateProfileSchema.parse(req.body);

    if (data.email) {
      const existing = await prisma.user.findFirst({
        where: { email: data.email, NOT: { id: userId } },
      });
      if (existing) {
        return res.status(400).json({ error: 'El email ya está en uso.' });
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
        ...(data.bannerUrl !== undefined && { bannerUrl: data.bannerUrl }),
        ...(data.profileQuote !== undefined && { profileQuote: data.profileQuote }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.age !== undefined && { age: data.age }),
        ...(data.weight !== undefined && { weight: data.weight }),
        ...(data.targetWeight !== undefined && { targetWeight: data.targetWeight }),
        ...(data.height !== undefined && { height: data.height }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        bannerUrl: true,
        profileQuote: true,
        age: true,
        weight: true,
        targetWeight: true,
        height: true,
        registeredAt: true,
        onboardingCompleted: true,
        googleId: true,
        passwordHash: true,
      },
    });

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        bannerUrl: user.bannerUrl,
        profileQuote: user.profileQuote,
        age: user.age,
        weight: user.weight,
        targetWeight: user.targetWeight,
        height: user.height,
        registeredAt: user.registeredAt,
        onboardingCompleted: user.onboardingCompleted,
        isGoogleUser: Boolean(user.googleId),
        hasPassword: Boolean(user.passwordHash),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: error.issues });
    }
    console.error('[userController.updateProfile]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
}).strict();

export const updatePassword = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const prisma = getCorePrisma();
    const userId = req.user!.id;
    const { currentPassword, newPassword } = updatePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.googleId || !user.passwordHash) {
      return res
        .status(400)
        .json({ error: 'Las cuentas de Google no permiten cambiar la contraseña.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    return res.json({ message: 'Contraseña actualizada correctamente.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: error.issues });
    }
    console.error('[userController.updatePassword]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const exportUserData = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const corePrisma = getCorePrisma();
    const healthPrisma = getHealthPrisma();
    const userId = req.user!.id;

    const user = await corePrisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        profileQuote: true,
        age: true,
        weight: true,
        targetWeight: true,
        height: true,
        registeredAt: true,
        onboardingCompleted: true,
        challenges: {
          include: {
            customGoalsTemplate: true,
            dailyLogs: { include: { goals: true }, orderBy: { date: 'desc' } },
            periodGoals: true,
          },
        },
        sideQuests: {
          include: {
            runs: { include: { tasks: true }, orderBy: { runNumber: 'desc' } },
          },
        },
        achievements: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [healthProfile, meals, workouts, customFoods, workoutRoutines, customExercises] =
      await Promise.all([
        healthPrisma.userHealthProfile.findUnique({
          where: { userId },
          select: {
            id: true,
            userId: true,
            dailyCalorieGoal: true,
            proteinGoalG: true,
            carbGoalG: true,
            fatGoalG: true,
            weightKg: true,
            heightCm: true,
            stravaAthleteId: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        healthPrisma.mealEntry.findMany({
          where: { userId },
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        }),
        healthPrisma.workoutEntry.findMany({
          where: { userId },
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          include: {
            exercises: {
              orderBy: { order: 'asc' },
              include: { sets: { orderBy: { setNumber: 'asc' } } },
            },
          },
        }),
        healthPrisma.customFood.findMany({
          where: { userId },
          include: { ingredients: { include: { ingredient: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        healthPrisma.workoutRoutine.findMany({
          where: { userId },
          include: { exercises: { orderBy: { order: 'asc' } } },
          orderBy: { updatedAt: 'desc' },
        }),
        healthPrisma.customExercise.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="75days-mis-datos.json"'
    );
    return res.json({
      exportedAt: new Date().toISOString(),
      schemaVersion: '1.1',
      account: {
        id: user.id,
        name: user.name,
        email: user.email,
        profileQuote: user.profileQuote,
        age: user.age,
        weight: user.weight,
        targetWeight: user.targetWeight,
        height: user.height,
        registeredAt: user.registeredAt,
        onboardingCompleted: user.onboardingCompleted,
      },
      core: {
        challenges: user.challenges,
        sideQuests: user.sideQuests,
        achievements: user.achievements,
      },
      health: {
        profile: healthProfile,
        meals,
        workouts,
        customFoods,
        workoutRoutines,
        customExercises,
      },
    });
  } catch (error) {
    console.error('[userController.exportUserData]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteAccount = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const prisma = getCorePrisma();
    const healthPrisma = getHealthPrisma();
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Purge health DB first so no orphaned meals/workouts/routines/Strava tokens remain
    await healthPrisma.$transaction(async (htx) => {
      await htx.customFoodIngredient.deleteMany({
        where: { customFood: { userId } },
      });
      await htx.customFood.deleteMany({ where: { userId } });
      await htx.mealEntry.deleteMany({ where: { userId } });
      await htx.workoutSet.deleteMany({
        where: { workoutExercise: { workout: { userId } } },
      });
      await htx.workoutExercise.deleteMany({
        where: { workout: { userId } },
      });
      await htx.workoutEntry.deleteMany({ where: { userId } });
      await htx.routineExercise.deleteMany({
        where: { routine: { userId } },
      });
      await htx.workoutRoutine.deleteMany({ where: { userId } });
      await htx.customExercise.deleteMany({ where: { userId } });
      await htx.userHealthProfile.deleteMany({ where: { userId } });
    });

    await prisma.$transaction(async (tx) => {
      await tx.dailyGoal.deleteMany({
        where: { dailyLog: { challenge: { userId } } },
      });
      await tx.dailyLog.deleteMany({
        where: { challenge: { userId } },
      });
      await tx.periodGoalProgress.deleteMany({
        where: { challenge: { userId } },
      });
      await tx.goalTemplate.deleteMany({
        where: { challenge: { userId } },
      });
      await tx.challenge.deleteMany({
        where: { userId },
      });
      await tx.sideQuest.deleteMany({
        where: { userId },
      });
      await tx.achievement.deleteMany({
        where: { userId },
      });
      await tx.user.delete({
        where: { id: userId },
      });
    });

    return res.json({ message: 'Cuenta eliminada y desvinculada correctamente.' });
  } catch (error) {
    console.error('[userController.deleteAccount]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
