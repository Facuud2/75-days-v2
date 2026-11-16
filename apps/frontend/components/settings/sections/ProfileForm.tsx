'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/useAuthStore';
import { UpdateProfilePayload, userService } from '@/lib/api/users';
import type { DevDataset } from '@/components/dev/DevDatasetPicker';
import { ProfileFormValues, profileSchema } from '../schemas';

const DEV_SAVE_ERRORS: Record<Exclude<DevDataset, 'demo'>, string> = {
  worst:
    'No pudimos guardar los cambios: el servidor rechazó el nombre porque excede el máximo de 120 caracteres permitido para tu plan.',
  empty: '',
  one: 'Ingresá tu contraseña actual.',
  thousand:
    'No pudimos guardar los cambios. El campo altura está fuera del rango permitido (100-250 cm).',
};

interface ProfileFormProps {
  devDataset: DevDataset;
  onResetDevDataset: () => void;
  onSuccess?: () => void;
}

function getDevValues(
  devDataset: DevDataset,
  user: ReturnType<typeof useAuthStore.getState>['user']
): ProfileFormValues {
  if (devDataset === 'worst') {
    return {
      name: 'Alejandra María de los Ángeles Wiśniewska-Kowalczyk',
      email: 'bartholomew.fitzgerald@northwind-industries-holdings.example.com',
      age: '999',
      weight: '1284',
      targetWeight: '78',
      height: '250',
    };
  }
  if (devDataset === 'one') {
    return {
      name: 'Jo',
      email: 'jo@b.co',
      age: '1',
      weight: '0',
      targetWeight: '0',
      height: '100',
    };
  }
  if (devDataset === 'empty') {
    return {
      name: '',
      email: '',
      age: '',
      weight: '',
      targetWeight: '',
      height: '',
    };
  }
  return {
    name: user?.name ?? '',
    email: user?.email ?? '',
    age: user?.age != null ? String(user.age) : '',
    weight: user?.weight != null ? String(user.weight) : '',
    targetWeight: user?.targetWeight != null ? String(user.targetWeight) : '',
    height: user?.height != null ? String(user.height) : '',
  };
}

export function ProfileForm({
  devDataset,
  onResetDevDataset,
  onSuccess,
}: ProfileFormProps) {
  const { user, updateProfile: updateAuthUser } = useAuthStore();
  const isGoogleUser = Boolean(user?.isGoogleUser);
  const [serverAlert, setServerAlert] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const isDevDataset =
    process.env.NODE_ENV === 'development' && devDataset !== 'demo';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: getDevValues(devDataset, user),
    mode: 'onBlur',
  });

  useEffect(() => {
    reset(getDevValues(devDataset, user));
  }, [devDataset, user, reset]);

  const handleFieldInput = () => {
    if (isDevDataset) {
      onResetDevDataset();
    }
    if (serverAlert) {
      setServerAlert(null);
    }
  };

  const onSubmit = async (values: ProfileFormValues) => {
    setServerAlert(null);

    if (
      isDevDataset &&
      DEV_SAVE_ERRORS[devDataset as Exclude<DevDataset, 'demo'>]
    ) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      setServerAlert({
        type: 'error',
        message: DEV_SAVE_ERRORS[devDataset as Exclude<DevDataset, 'demo'>],
      });
      return;
    }

    try {
      const payload: UpdateProfilePayload = {};
      if (values.name.trim()) payload.name = values.name.trim();
      if (!isGoogleUser && values.email.trim()) payload.email = values.email.trim();
      if (values.age.trim() !== '') payload.age = Number(values.age);
      if (values.weight.trim() !== '') payload.weight = Number(values.weight);
      if (values.targetWeight.trim() !== '')
        payload.targetWeight = Number(values.targetWeight);
      if (values.height.trim() !== '') payload.height = Number(values.height);

      await userService.updateProfile(payload);
      updateAuthUser({
        ...(payload.name !== undefined && { name: payload.name }),
        ...(payload.email !== undefined && { email: payload.email }),
        ...(payload.age !== undefined && { age: payload.age }),
        ...(payload.weight !== undefined && { weight: payload.weight }),
        ...(payload.targetWeight !== undefined && {
          targetWeight: payload.targetWeight,
        }),
        ...(payload.height !== undefined && { height: payload.height }),
      });

      toast.success('Perfil actualizado');
      setServerAlert({
        type: 'success',
        message: '¡Cambios guardados correctamente!',
      });
      onSuccess?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error al guardar los cambios.';
      setServerAlert({ type: 'error', message });
    }
  };

  const inputBaseClass =
    'w-full min-h-[44px] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:outline-none focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]/20';

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
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

      <div className="space-y-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Información personal
        </p>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label
              htmlFor="settings-name"
              className="block text-xs font-semibold text-[var(--text-secondary)]"
            >
              Nombre
            </label>
            <input
              id="settings-name"
              type="text"
              autoComplete="name"
              placeholder="Tu nombre"
              aria-invalid={Boolean(errors.name)}
              className={inputBaseClass}
              {...register('name', { onChange: handleFieldInput })}
            />
            {errors.name && (
              <p role="alert" className="text-xs text-[var(--status-danger)]">
                {errors.name.message}
              </p>
            )}
          </div>

          {!isGoogleUser && (
            <div className="space-y-1.5">
              <label
                htmlFor="settings-email"
                className="block text-xs font-semibold text-[var(--text-secondary)]"
              >
                Email
              </label>
              <input
                id="settings-email"
                type="email"
                autoComplete="email"
                placeholder="tu@email.com"
                aria-invalid={Boolean(errors.email)}
                className={inputBaseClass}
                {...register('email', { onChange: handleFieldInput })}
              />
              {errors.email && (
                <p role="alert" className="text-xs text-[var(--status-danger)]">
                  {errors.email.message}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3.5 pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Métricas físicas
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <label
              htmlFor="settings-age"
              className="block text-xs font-semibold text-[var(--text-secondary)]"
            >
              Edad
            </label>
            <input
              id="settings-age"
              type="number"
              inputMode="numeric"
              placeholder="—"
              aria-invalid={Boolean(errors.age)}
              className={inputBaseClass}
              {...register('age', { onChange: handleFieldInput })}
            />
            {errors.age && (
              <p role="alert" className="text-xs text-[var(--status-danger)]">
                {errors.age.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="settings-weight"
              className="block text-xs font-semibold text-[var(--text-secondary)]"
            >
              Peso (kg)
            </label>
            <input
              id="settings-weight"
              type="number"
              step="0.1"
              inputMode="decimal"
              placeholder="—"
              aria-invalid={Boolean(errors.weight)}
              className={inputBaseClass}
              {...register('weight', { onChange: handleFieldInput })}
            />
            {errors.weight && (
              <p role="alert" className="text-xs text-[var(--status-danger)]">
                {errors.weight.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="settings-target-weight"
              className="block text-xs font-semibold text-[var(--text-secondary)]"
            >
              Meta (kg)
            </label>
            <input
              id="settings-target-weight"
              type="number"
              step="0.1"
              inputMode="decimal"
              placeholder="—"
              aria-invalid={Boolean(errors.targetWeight)}
              className={inputBaseClass}
              {...register('targetWeight', { onChange: handleFieldInput })}
            />
            {errors.targetWeight && (
              <p role="alert" className="text-xs text-[var(--status-danger)]">
                {errors.targetWeight.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="settings-height"
              className="block text-xs font-semibold text-[var(--text-secondary)]"
            >
              Altura (cm)
            </label>
            <input
              id="settings-height"
              type="number"
              inputMode="numeric"
              placeholder="—"
              aria-invalid={Boolean(errors.height)}
              className={inputBaseClass}
              {...register('height', { onChange: handleFieldInput })}
            />
            {errors.height && (
              <p role="alert" className="text-xs text-[var(--status-danger)]">
                {errors.height.message}
              </p>
            )}
          </div>
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
              Guardando...
            </>
          ) : (
            'Guardar cambios'
          )}
        </button>
      </div>
    </form>
  );
}
