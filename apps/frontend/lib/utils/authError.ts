/**
 * The API returns English messages for the auth endpoints. Map the ones a
 * person can actually act on; leave anything else untouched rather than
 * hiding an unexpected server message.
 */
const KNOWN_MESSAGES: Array<[RegExp, string]> = [
  [/invalid credentials/i, 'Correo o contraseña incorrectos'],
  [
    /(email|user).*(already exists|already registered|in use)/i,
    'Ya existe una cuenta con ese correo electrónico',
  ],
  [/registration failed/i, 'No pudimos crear tu cuenta. Inténtalo de nuevo.'],
  [/login failed/i, 'No pudimos iniciar sesión. Inténtalo de nuevo.'],
  [
    /(failed to fetch|network error|networkerror)/i,
    'No pudimos conectar con el servidor. Revisa tu conexión.',
  ],
  [
    /api request failed with status 5\d\d/i,
    'Algo salió mal de nuestro lado. Inténtalo de nuevo.',
  ],
  [
    /too many (authentication )?attempts/i,
    'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  ],
];

export function formatAuthError(
  message: string | null | undefined
): string | null {
  if (!message) return null;

  for (const [pattern, replacement] of KNOWN_MESSAGES) {
    if (pattern.test(message)) return replacement;
  }

  return message;
}
