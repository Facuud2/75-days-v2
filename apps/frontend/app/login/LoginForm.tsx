'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Loader2, Mail } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import {
  formatAuthError,
  isGoogleAccountExistsError,
} from '@/lib/utils/authError';
import AuthShell from '@/components/auth/AuthShell';
import AuthField from '@/components/auth/AuthField';
import { navigateAuthWithTransition } from '@/lib/authTransition';
import {
  requestGoogleAccessToken,
  type GoogleTokenRequestHandle,
} from '@/lib/googleOAuth';

type FieldErrors = {
  email?: string;
  password?: string;
};

type LoginStep = 'select' | 'email' | 'google';

type PendingLinkConfirmation = {
  accessToken: string;
  email: string;
  name: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function GoogleLogo({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      className={className}
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function LoginForm() {
  const [step, setStep] = useState<LoginStep>('select');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [isGooglePending, setIsGooglePending] = useState(false);
  const [pendingLink, setPendingLink] = useState<PendingLinkConfirmation | null>(
    null
  );
  const tokenHandleRef = useRef<GoogleTokenRequestHandle | null>(null);

  const {
    login,
    loginWithGoogle,
    cancelAuth,
    error,
    isLoading,
    clearError,
  } = useAuthStore();
  const router = useRouter();
  const displayError = formatAuthError(error);
  const isGoogleExistingAccountError = isGoogleAccountExistsError(error);

  // Clear stale errors when mounting login
  useEffect(() => {
    clearError();
    return () => {
      tokenHandleRef.current?.cancel();
    };
  }, [clearError]);

  // Support direct link `?google=1` from the inline notice in /register
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('google') === '1') {
      const timer = window.setTimeout(() => {
        window.history.replaceState({}, '', '/login');
        void handleStartGoogleAuth();
      }, 0);
      return () => window.clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReturnToSelect = () => {
    tokenHandleRef.current?.cancel();
    tokenHandleRef.current = null;
    cancelAuth();
    clearError();
    setGoogleError(null);
    setIsGooglePending(false);
    setPendingLink(null);
    setFieldErrors({});
    setStep('select');
  };

  const handleStartGoogleAuth = async () => {
    clearError();
    setGoogleError(null);
    setPendingLink(null);
    setStep('google');
    setIsGooglePending(true);

    const handle = requestGoogleAccessToken();
    tokenHandleRef.current = handle;

    try {
      const accessToken = await handle.promise;
      tokenHandleRef.current = null;

      const res = await loginWithGoogle({ accessToken });
      setIsGooglePending(false);

      if (res.requiresLinkConfirmation) {
        setPendingLink({
          accessToken,
          email: res.email,
          name: res.name,
        });
        return;
      }

      if (res.user.onboardingCompleted) {
        router.push('/dashboard');
      } else {
        router.push('/onboarding');
      }
    } catch (err: any) {
      tokenHandleRef.current = null;
      setIsGooglePending(false);
      if (err?.message === 'GOOGLE_AUTH_CANCELLED') {
        return;
      }
      setGoogleError(
        formatAuthError(err?.message) ||
          err?.message ||
          'No pudimos iniciar sesión con Google.'
      );
    }
  };

  const handleConfirmLinkAccount = async () => {
    if (!pendingLink) return;
    setGoogleError(null);
    setIsGooglePending(true);

    try {
      const res = await loginWithGoogle({
        accessToken: pendingLink.accessToken,
        confirmLink: true,
      });
      setIsGooglePending(false);
      setPendingLink(null);

      if (!res.requiresLinkConfirmation) {
        if (res.user.onboardingCompleted) {
          router.push('/dashboard');
        } else {
          router.push('/onboarding');
        }
      }
    } catch (err: any) {
      setIsGooglePending(false);
      setGoogleError(
        formatAuthError(err?.message) ||
          err?.message ||
          'No pudimos vincular tu cuenta de Google.'
      );
    }
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedEmail = email.trim();
    const nextErrors: FieldErrors = {};

    if (!trimmedEmail) {
      nextErrors.email = 'Ingresa tu correo electrónico';
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      nextErrors.email = 'Ingresa un correo electrónico válido';
    }

    if (!password) {
      nextErrors.password = 'Ingresa tu contraseña';
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      await login({ email: trimmedEmail, password });
      const currentUser = useAuthStore.getState().user;
      if (currentUser && !currentUser.onboardingCompleted) {
        router.push('/onboarding');
      } else {
        router.push('/dashboard');
      }
    } catch {
      // The store exposes the server message through `error`, rendered below.
    }
  };

  const renderFooter = () => {
    if (step === 'email') {
      return (
        <>
          <span>¿No tienes una cuenta? </span>
          <Link
            href="/register"
            className="auth-footer-link"
            onClick={(event) => {
              if (
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey ||
                event.button !== 0
              ) {
                return;
              }
              event.preventDefault();
              navigateAuthWithTransition(router, '/register', 'forward');
            }}
          >
            Regístrate
          </Link>
        </>
      );
    }

    return (
      <p className="auth-terms-caption">
        Al continuar, aceptás los{' '}
        <a
          href="#terminos"
          className="auth-terms-link"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          Términos y Condiciones
        </a>{' '}
        de uso de la aplicación.
      </p>
    );
  };

  return (
    <AuthShell
      variant="login"
      title="Iniciar sesión"
      onBack={step !== 'select' ? handleReturnToSelect : undefined}
      backLabel="Volver a las opciones de inicio de sesión"
      footer={renderFooter()}
    >
      {/* ── PASO 1: Dos únicos botones iniciales ── */}
      {step === 'select' && (
        <div className="auth-provider-stack">
          <button
            type="button"
            className="auth-provider-btn auth-provider-btn--google auth-rise"
            style={{ '--auth-i': 1 } as React.CSSProperties}
            onClick={handleStartGoogleAuth}
          >
            <GoogleLogo />
            <span>Continuar con Google</span>
          </button>

          <button
            type="button"
            className="auth-provider-btn auth-provider-btn--email auth-rise"
            style={{ '--auth-i': 2 } as React.CSSProperties}
            onClick={() => {
              clearError();
              setFieldErrors({});
              setStep('email');
            }}
          >
            <Mail size={19} strokeWidth={2} aria-hidden="true" />
            <span>Continuar con email</span>
          </button>
        </div>
      )}

      {/* ── PASO 2A: Bloque de Google (con botón de flecha arriba para volver/cancelar) ── */}
      {step === 'google' && (
        <div
          className="auth-google-block auth-rise"
          style={{ '--auth-i': 1 } as React.CSSProperties}
        >
          <div className="auth-google-block__header">
            <button
              type="button"
              onClick={handleReturnToSelect}
              className="auth-google-block__back"
              aria-label="Volver atrás y cancelar autenticación con Google"
            >
              <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
              <span>Volver</span>
            </button>
            <GoogleLogo />
          </div>

          {pendingLink ? (
            <div className="auth-google-block__body">
              <h2 className="auth-google-block__title">
                Vincular cuenta existente
              </h2>
              <p className="auth-google-block__desc">
                Encontramos una cuenta registrada con{' '}
                <strong>{pendingLink.email}</strong>. ¿Querés vincularla con tu
                cuenta de Google para iniciar sesión automáticamente?
              </p>
              <div className="auth-google-block__actions">
                <button
                  type="button"
                  className="auth-submit"
                  disabled={isGooglePending || isLoading}
                  onClick={handleConfirmLinkAccount}
                >
                  {isGooglePending || isLoading ? (
                    <>
                      <Loader2
                        className="auth-spinner"
                        size={18}
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      Vinculando…
                    </>
                  ) : (
                    'Confirmar y vincular'
                  )}
                </button>
                <button
                  type="button"
                  className="auth-secondary-btn"
                  disabled={isGooglePending || isLoading}
                  onClick={handleReturnToSelect}
                >
                  No vincular y volver
                </button>
              </div>
            </div>
          ) : (
            <div className="auth-google-block__body">
              {isGooglePending || isLoading ? (
                <div className="auth-google-block__status">
                  <Loader2
                    className="auth-spinner"
                    size={22}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <p className="auth-google-block__desc">
                    Conectando con Google… Seleccioná tu cuenta en la ventana
                    emergente o tocá la flecha para cancelar.
                  </p>
                </div>
              ) : googleError ? (
                <div className="auth-google-block__status">
                  <p className="auth-google-block__error">{googleError}</p>
                  <button
                    type="button"
                    className="auth-submit"
                    onClick={handleStartGoogleAuth}
                  >
                    Reintentar con Google
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* ── PASO 2B: Panel de Login con Email ── */}
      {step === 'email' && (
        <>
          {isGoogleExistingAccountError && (
            <p
              className="auth-google-notice auth-rise"
              style={{ '--auth-i': 0 } as React.CSSProperties}
            >
              Esta cuenta ya fue creada con Google. Por favor,{' '}
              <a
                href="/login?google=1"
                className="auth-terms-link"
                onClick={(event) => {
                  event.preventDefault();
                  void handleStartGoogleAuth();
                }}
              >
                iniciá sesión con Google
              </a>{' '}
              para continuar.
            </p>
          )}

          {displayError && (
            <div
              className="auth-alert auth-rise"
              role="alert"
              style={{ '--auth-i': 0 } as React.CSSProperties}
            >
              <AlertCircle size={16} strokeWidth={2} aria-hidden="true" />
              <span>{displayError}</span>
            </div>
          )}

          <form
            className="auth-form"
            onSubmit={handleLogin}
            onChange={() => {
              if (error) clearError();
            }}
            noValidate
            aria-busy={isLoading}
          >
            <AuthField
              id="login-email"
              label="Email"
              type="email"
              index={1}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((current) => ({
                    ...current,
                    email: undefined,
                  }));
                }
              }}
              placeholder="tu@correo.com"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              error={fieldErrors.email}
            />

            <AuthField
              id="login-password"
              label="Contraseña"
              type="password"
              index={2}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((current) => ({
                    ...current,
                    password: undefined,
                  }));
                }
              }}
              placeholder="Tu contraseña"
              autoComplete="current-password"
              enterKeyHint="go"
              error={fieldErrors.password}
            />

            <button
              type="submit"
              className="auth-submit auth-rise"
              style={{ '--auth-i': 3 } as React.CSSProperties}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2
                    className="auth-spinner"
                    size={18}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  Entrando…
                </>
              ) : (
                'Iniciar sesión'
              )}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
