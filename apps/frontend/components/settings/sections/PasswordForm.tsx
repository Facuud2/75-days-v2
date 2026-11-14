'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { userService } from '@/lib/api/users';
import { PasswordFormValues, passwordSchema } from '../schemas';

interface PasswordFormProps {
  onSuccess?: () => void;
}

export function PasswordForm({ onSuccess }: PasswordFormProps) {
  const [showPasswords, setShowPasswords] = useState(false);
  const [serverAlert, setServerAlert] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    mode: 'onBlur',
  });

  const onSubmit = async (values: PasswordFormValues) => {
    setServerAlert(null);
    try {
      await userService.updatePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success('Contraseña actualizada');
      setServerAlert({
        type: 'success',
        message: '¡Contraseña actualizada correctamente!',
      });
      reset();
      onSuccess?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'No pudimos actualizar tu contraseña.';
      setServerAlert({ type: 'error', message });
    }
  };

  const inputBaseClass =
    'w-full min-h-[44px] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:outline-none focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]/20';

  const inputType = showPasswords ? 'text' : 'password';

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {serverAlert && (
        <div
          role="alert"
          className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm font-medium ${
            serverAlert.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-[var(--status-success)]'
              : 'border-red-500/30 bg-red-500/10 text-[var(--status-danger)]'
          }`}
        >
          {serverAlert.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{serverAlert.message}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--text-muted)]">
          Usá al menos 6 caracteres para mantener tu cuenta segura.
        </p>
        <button
          type="button"
          onClick={() => setShowPasswords((prev) => !prev)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-[var(--accent-text)] transition-colors hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          {showPasswords ? (
            <>
              <EyeOff className="h-3.5 w-3.5" />
              Ocultar
            </>
          ) : (
            <>
              <Eye className="h-3.5 w-3.5" />
              Mostrar
            </>
          )}
        </button>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="settings-current-password"
          className="block text-xs font-semibold text-[var(--text-secondary)]"
        >
          Contraseña actual
        </label>
        <input
          id="settings-current-password"
          type={inputType}
          autoComplete="current-password"
          placeholder="••••••••"
          aria-invalid={Boolean(errors.currentPassword)}
          className={inputBaseClass}
          {...register('currentPassword')}
        />
        {errors.currentPassword && (
          <p role="alert" className="text-xs text-[var(--status-danger)]">
            {errors.currentPassword.message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label
            htmlFor="settings-new-password"
            className="block text-xs font-semibold text-[var(--text-secondary)]"
          >
            Nueva contraseña
          </label>
          <input
            id="settings-new-password"
            type={inputType}
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={Boolean(errors.newPassword)}
            className={inputBaseClass}
            {...register('newPassword')}
          />
          {errors.newPassword && (
            <p role="alert" className="text-xs text-[var(--status-danger)]">
              {errors.newPassword.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="settings-confirm-password"
            className="block text-xs font-semibold text-[var(--text-secondary)]"
          >
            Confirmar contraseña
          </label>
          <input
            id="settings-confirm-password"
            type={inputType}
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={Boolean(errors.confirmPassword)}
            className={inputBaseClass}
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p role="alert" className="text-xs text-[var(--status-danger)]">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-fill)] px-6 py-2.5 text-sm font-semibold text-[var(--on-accent)] shadow-sm transition-colors hover:bg-[var(--accent-fill-hover)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)] sm:w-auto"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Actualizando...
            </>
          ) : (
            'Actualizar contraseña'
          )}
        </button>
      </div>
    </form>
  );
}
