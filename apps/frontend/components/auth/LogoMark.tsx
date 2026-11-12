type LogoMarkProps = {
  className?: string;
};

/**
 * The 75 Days mark: a bold "7" on a soft cream tile. The glyph uses the
 * palette accent so the mark follows the app's colour theme.
 */
export default function LogoMark({ className = '' }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 56 56"
      role="img"
      aria-label="75 Days Challenge"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="56" height="56" rx="16" fill="var(--auth-logo-bg)" />
      <path
        d="M16 18h24L28 43"
        fill="none"
        stroke="var(--auth-logo-glyph)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
