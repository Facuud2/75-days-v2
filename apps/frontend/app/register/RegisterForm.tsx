'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { formatAuthError } from '@/lib/utils/authError';
import AuthShell from '@/components/auth/AuthShell';
import AuthField from '@/components/auth/AuthField';

const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, 'Ingresa tu nombre'),
    lastName: z.string().trim().min(1, 'Ingresa tus apellidos'),
    email: z
      .string()
      .trim()
      .min(1, 'Ingresa tu correo electrónico')
      .email('Ingresa un correo electrónico válido'),
    password: z
      .string()
      .min(6, 'La contraseña debe tener al menos 6 caracteres'),
    confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
    acceptTerms: z
      .boolean()
      .refine((value) => value === true, 'Debes aceptar los términos'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden',
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterForm() {
  const { register: registerUser, isLoading, error, clearError } = useAuthStore();
  const router = useRouter();
  const displayError = formatAuthError(error);

  // A failed login should not follow the person to the register screen.
  useEffect(() => {
    clearError();
  }, [clearError]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await registerUser({
        name: `${data.firstName} ${data.lastName}`.trim(),
        email: data.email.trim(),
        password: data.password,
      });
      router.push('/onboarding');
    } catch {
      // The store exposes the server message through `error`, rendered below.
    }
  };

  return (
    <AuthShell
      variant="register"
      title="Crear cuenta"
      backHref="/login"
      footer={
        <>
          <span>¿Ya tienes una cuenta? </span>
          <Link href="/login" className="auth-footer-link">
            Inicia sesión
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
        onSubmit={handleSubmit(onSubmit)}
        onChange={() => {
          if (error) clearError();
        }}
        noValidate
        aria-busy={isLoading}
      >
        <AuthField
          id="register-first-name"
          label="Nombre"
          index={1}
          placeholder="Tu nombre"
          autoComplete="given-name"
          autoCapitalize="words"
          enterKeyHint="next"
          error={errors.firstName?.message}
          {...register('firstName')}
        />

        <AuthField
          id="register-last-name"
          label="Apellidos"
          index={2}
          placeholder="Tus apellidos"
          autoComplete="family-name"
          autoCapitalize="words"
          enterKeyHint="next"
          error={errors.lastName?.message}
          {...register('lastName')}
        />

        <AuthField
          id="register-email"
          label="Email"
          type="email"
          index={3}
          placeholder="tu@correo.com"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          error={errors.email?.message}
          {...register('email')}
        />

        <AuthField
          id="register-password"
          label="Contraseña"
          type="password"
          index={4}
          placeholder="Mínimo 6 caracteres"
          autoComplete="new-password"
          enterKeyHint="next"
          error={errors.password?.message}
          {...register('password')}
        />

        <AuthField
          id="register-confirm-password"
          label="Confirmar contraseña"
          type="password"
          index={5}
          placeholder="Repite tu contraseña"
          autoComplete="new-password"
          enterKeyHint="done"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <label
          className="auth-terms auth-rise"
          style={{ '--auth-i': 6 } as React.CSSProperties}
        >
          <input
            type="checkbox"
            {...register('acceptTerms')}
            aria-invalid={errors.acceptTerms ? true : undefined}
            aria-describedby={
              errors.acceptTerms ? 'register-terms-error' : undefined
            }
          />
          <span className="auth-check" aria-hidden="true">
            <Check size={12} strokeWidth={3.25} />
          </span>
          <span>
            Acepto los{' '}
            <a
              href="#"
              className="auth-terms-link"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              Términos y Condiciones
            </a>{' '}
            de uso de la aplicación.
          </span>
        </label>

        {errors.acceptTerms?.message && (
          <p
            id="register-terms-error"
            className="auth-error auth-terms-error"
            role="alert"
          >
            <AlertCircle size={13} strokeWidth={2} aria-hidden="true" />
            <span>{errors.acceptTerms.message}</span>
          </p>
        )}

        <button
          type="submit"
          className="auth-submit auth-rise"
          style={{ '--auth-i': 7 } as React.CSSProperties}
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
              Creando cuenta…
            </>
          ) : (
            'Crear cuenta'
          )}
        </button>
      </form>
    </AuthShell>
  );
}
