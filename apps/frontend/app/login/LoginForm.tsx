'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { formatAuthError } from '@/lib/utils/authError';
import AuthShell from '@/components/auth/AuthShell';
import AuthField from '@/components/auth/AuthField';

type FieldErrors = {
  email?: string;
  password?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const { login, error, isLoading, clearError } = useAuthStore();
  const router = useRouter();
  const displayError = formatAuthError(error);

  // A failed login should not follow the person to the register screen.
  useEffect(() => {
    clearError();
  }, [clearError]);

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
      router.push('/dashboard');
    } catch {
      // The store exposes the server message through `error`, rendered below.
    }
  };

  return (
    <AuthShell
      variant="login"
      title="Iniciar sesión"
      footer={
        <>
          <span>¿No tienes una cuenta? </span>
          <Link href="/register" className="auth-footer-link">
            Regístrate
          </Link>
        </>
      }
    >
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
              setFieldErrors((current) => ({ ...current, email: undefined }));
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
    </AuthShell>
  );
}
