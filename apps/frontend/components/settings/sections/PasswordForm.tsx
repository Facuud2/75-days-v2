'use client';

import React, { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/useAuthStore';
import { userService } from '@/lib/api/users';
import { PasswordFormValues, passwordSchema } from '../schemas';

interface PasswordFormProps {
  onSuccess?: () => void;
}

export function PasswordForm({ onSuccess }: PasswordFormProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const isGoogleUser = Boolean(user?.isGoogleUser);
  const currentPwId = useId();
  const newPwId = useId();
  const confirmPwId = useId();

  const [showPasswords, setShowPasswords] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
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

  const handleExportData = async () => {
    setServerAlert(null);
    setIsExporting(true);
    try {
      const data = await userService.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `75days-mis-datos-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success('Datos exportados en JSON');
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'No pudimos exportar tus datos. Intentá de nuevo.';
      setServerAlert({ type: 'error', message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setServerAlert(null);
    setIsDeleting(true);
    try {
      await userService.deleteAccount();
      onSuccess?.();
      logout();
      router.replace('/login');
    } catch (err: unknown) {
      setIsDeleting(false);
      setConfirmDelete(false);
      const message =
        err instanceof Error
          ? err.message
          : 'No pudimos eliminar tu cuenta. Inténtalo de nuevo.';
      setServerAlert({ type: 'error', message });
    }
  };

  if (isGoogleUser) {
    return (
      <div className="space-y-4">
        {serverAlert && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm font-medium text-[var(--status-danger)]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{serverAlert.message}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Cuenta vinculada con Google
          </h3>
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            Iniciaste sesión con Google, por lo que no utilizás contraseña en la
            aplicación. Podés descargar una copia de tus datos o eliminar tu cuenta y
            todos tus registros de forma permanente.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            disabled={isExporting}
            onClick={handleExportData}
            className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-60 sm:w-auto"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" aria-hidden="true" />
                Descargar mis datos (JSON)
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isDeleting}
            onClick={handleDeleteAccount}
            className="pv2-destructive flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors cursor-pointer sm:w-auto"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Eliminando cuenta...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Eliminar cuenta
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

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
          htmlFor={currentPwId}
          className="block text-xs font-semibold text-[var(--text-secondary)]"
        >
          Contraseña actual
        </label>
        <input
          id={currentPwId}
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
            htmlFor={newPwId}
            className="block text-xs font-semibold text-[var(--text-secondary)]"
          >
            Nueva contraseña
          </label>
          <input
            id={newPwId}
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
            htmlFor={confirmPwId}
            className="block text-xs font-semibold text-[var(--text-secondary)]"
          >
            Confirmar contraseña
          </label>
          <input
            id={confirmPwId}
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

      <div className="mt-6 space-y-3 border-t border-[var(--border-subtle)] pt-5">
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Privacidad y tus datos
          </h3>
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            Descargá una copia completa de tu progreso en JSON o eliminá tu cuenta y
            todos tus registros de forma definitiva.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={isExporting}
            onClick={handleExportData}
            className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-60 sm:w-auto"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Descargar mis datos (JSON)
              </>
            )}
          </button>

          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="pv2-destructive flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors cursor-pointer sm:w-auto"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Eliminar cuenta
            </button>
          ) : (
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteAccount}
                className="pv2-destructive flex min-h-[42px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  'Confirmar eliminación'
                )}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setConfirmDelete(false)}
                className="min-h-[42px] rounded-xl px-3 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
