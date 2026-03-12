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
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-950 text-white">
      <div className="w-full max-w-xl bg-zinc-950 rounded-3xl p-10 relative border border-rose-500/20 shadow-[0_0_50px_-12px_rgba(244,63,94,0.15)] overflow-hidden">
        {/* Neon top glow line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-600 via-rose-400 to-rose-600 opacity-80"></div>
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-3">Create Account</h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400">Start your 75 Days challenge today</p>
        </div>

        {/* Server-side error (e.g. email already exists) */}
        {error && (
          <div className="mb-6 p-4 text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
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
              className={`w-full px-4 py-3 rounded-xl bg-zinc-900/50 border focus:ring-2 outline-none transition-all text-white ${errors.name
                ? 'border-red-400 focus:ring-red-300'
                : 'border-zinc-800 focus:border-rose-500 focus:ring-rose-500/30'
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
              className={`w-full px-4 py-3 rounded-xl bg-zinc-900/50 border focus:ring-2 outline-none transition-all text-white ${errors.email
                ? 'border-red-400 focus:ring-red-300'
                : 'border-zinc-800 focus:border-rose-500 focus:ring-rose-500/30'
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
              className={`w-full px-4 py-3 rounded-xl bg-zinc-900/50 border focus:ring-2 outline-none transition-all text-white ${errors.password
                ? 'border-red-400 focus:ring-red-300'
                : 'border-zinc-800 focus:border-rose-500 focus:ring-rose-500/30'
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
                className="mt-1 h-4 w-4 rounded border-zinc-600 accent-rose-500 cursor-pointer flex-shrink-0"
              />
              <span className="text-sm text-zinc-400 leading-relaxed">
                Acepto los{' '}
                <a href="#" className="text-rose-400 font-bold underline underline-offset-2 hover:opacity-70 transition-opacity">
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
            className="w-full py-3 px-4 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 focus:ring-4 focus:ring-rose-500/30 transition-all mt-6 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(244,63,94,0.3)] hover:shadow-[0_0_25px_rgba(244,63,94,0.45)]"
          >
            {isLoading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-zinc-400">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-rose-400 font-bold hover:text-rose-500 transition-colors">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
