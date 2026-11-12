/**
 * Decorative geometric pattern for the auth hero.
 * Circles anchored to the tile corners repeat seamlessly; triangles sit
 * inside the tile so the texture reads as oversized shapes, not a grid.
 * The rose glow comes from the live palette accent, so it follows the theme.
 */
export default function PatternBackdrop() {
  return (
    <svg
      className="auth-pattern"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern
          id="auth-geometry"
          width="168"
          height="168"
          patternUnits="userSpaceOnUse"
        >
          <rect width="168" height="168" fill="var(--auth-hero-bg)" />
          <circle cx="0" cy="0" r="58" fill="var(--auth-pattern)" />
          <circle cx="168" cy="0" r="58" fill="var(--auth-pattern)" />
          <circle cx="0" cy="168" r="58" fill="var(--auth-pattern)" />
          <circle cx="168" cy="168" r="58" fill="var(--auth-pattern)" />
          <circle cx="84" cy="84" r="46" fill="var(--auth-pattern)" />
          <path d="M84 12 112 60H56L84 12Z" fill="var(--auth-pattern)" />
          <path d="M12 84 60 112V56L12 84Z" fill="var(--auth-pattern)" />
          <path d="M156 84 108 112V56L156 84Z" fill="var(--auth-pattern)" />
          <path d="M84 156 56 108h56l-28 48Z" fill="var(--auth-pattern)" />
        </pattern>
        <radialGradient id="auth-sheen" cx="50%" cy="0%" r="92%">
          <stop
            offset="0%"
            stopColor="var(--color-rose-500)"
            stopOpacity="0.26"
          />
          <stop
            offset="55%"
            stopColor="var(--color-rose-500)"
            stopOpacity="0"
          />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#auth-geometry)" />
      <rect width="100%" height="100%" fill="url(#auth-sheen)" />
    </svg>
  );
}
