import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import LogoMark from './LogoMark';
import PatternBackdrop from './PatternBackdrop';
import AuthThemeToggle from './AuthThemeToggle';

type AuthShellProps = {
  variant: 'login' | 'register';
  title: string;
  backHref?: string;
  footer: ReactNode;
  children: ReactNode;
};

/**
 * Shared login / register frame:
 * black patterned hero, a sheet in the app surface colour that overlaps the
 * hero with a rounded top-left corner, and a scroll area that flows the footer
 * after the CTA so it stays reachable at any text size (and at the bottom of
 * short screens).
 */
export default function AuthShell({
  variant,
  title,
  backHref,
  footer,
  children,
}: AuthShellProps) {
  return (
    <main className="auth-viewport">
      <section
        className={`auth-card auth-card--${variant}`}
        aria-labelledby="auth-title"
      >
        <header className="auth-hero">
          <PatternBackdrop />
          <div className="auth-hero-inner">
            {variant === 'login' ? (
              <>
                <span className="auth-back-spacer" aria-hidden="true" />
                <LogoMark className="auth-logo" />
                <AuthThemeToggle />
              </>
            ) : (
              <>
                {backHref ? (
                  <Link
                    href={backHref}
                    className="auth-back"
                    aria-label="Volver a iniciar sesión"
                  >
                    <ArrowLeft size={21} strokeWidth={1.75} aria-hidden="true" />
                  </Link>
                ) : (
                  <span className="auth-back-spacer" aria-hidden="true" />
                )}
                <h1 id="auth-title" className="auth-hero-title">
                  {title}
                </h1>
                <AuthThemeToggle />
              </>
            )}
          </div>
        </header>

        <div className="auth-sheet">
          <div className="auth-scroll">
            <div className="auth-content">
              {variant === 'login' && (
                <h1 id="auth-title" className="auth-title">
                  {title}
                </h1>
              )}
              {children}
              <div className="auth-spacer" aria-hidden="true" />
              <footer className="auth-footer">{footer}</footer>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
