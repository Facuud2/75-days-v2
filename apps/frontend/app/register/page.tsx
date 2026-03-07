'use client';

import { useAuthStore } from '@/store/useAuthStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// --- Validation Schema (mirrors backend constraints) ---
const registerSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Ingresa un correo electrónico válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: 'Debes aceptar los términos y condiciones',
  }),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function Register() {
  const { register: registerUser, isLoading, error } = useAuthStore();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await registerUser(data);
      router.push('/onboarding');
    } catch {
      // Error is already stored in useAuthStore's `error` field and displayed below
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-3xl shadow-xl p-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-3">Create Account</h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400">Start your 75 Days challenge today</p>
        </div>

        {/* Server-side error (e.g. email already exists) */}
        {error && (
          <div className="mb-6 p-4 text-sm font-medium text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1">Nombre</label>
            <input
              type="text"
              {...register('name')}
              className={`w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border focus:ring-2 outline-none transition-all ${errors.name
                ? 'border-red-400 focus:ring-red-300'
                : 'border-transparent focus:ring-zinc-900 dark:focus:ring-zinc-100'
                }`}
              placeholder="Tu nombre"
            />
            {errors.name && (
              <p className="mt-1.5 text-xs text-red-500">Ingresa tu nombre completo (al menos 2 caracteres).</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              {...register('email')}
              className={`w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border focus:ring-2 outline-none transition-all ${errors.email
                ? 'border-red-400 focus:ring-red-300'
                : 'border-transparent focus:ring-zinc-900 dark:focus:ring-zinc-100'
                }`}
              placeholder="tu@correo.com"
            />
            {errors.email && (
              <p className="mt-1.5 text-xs text-red-500">Ingresa un correo electrónico válido (ej: tu@correo.com).</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium mb-1">Contraseña</label>
            <input
              type="password"
              {...register('password')}
              className={`w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border focus:ring-2 outline-none transition-all ${errors.password
                ? 'border-red-400 focus:ring-red-300'
                : 'border-transparent focus:ring-zinc-900 dark:focus:ring-zinc-100'
                }`}
              placeholder="Mínimo 6 caracteres"
            />
            {errors.password && (
              <p className="mt-1.5 text-xs text-red-500">La contraseña debe tener al menos 6 caracteres.</p>
            )}
          </div>

          {/* Terms and Conditions */}
          <div className="pt-2">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                {...register('acceptTerms')}
                className="mt-1 h-4 w-4 rounded border-zinc-300 dark:border-zinc-600 accent-zinc-900 dark:accent-zinc-100 cursor-pointer flex-shrink-0"
              />
              <span className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Acepto los{' '}
                <a href="#" className="text-zinc-900 dark:text-zinc-100 font-medium underline underline-offset-2 hover:opacity-70 transition-opacity">
                  Términos y Condiciones
                </a>{' '}de uso de la aplicación.
              </span>
            </label>
            {errors.acceptTerms && (
              <p className="mt-1.5 text-xs text-red-500 pl-7">Debes aceptar los términos y condiciones para continuar.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-zinc-900 dark:text-zinc-100 font-medium hover:underline">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
