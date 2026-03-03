'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function Register() {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setApiError(null);
    try {
      await useAuthStore.getState().register(data);
      router.push('/onboarding');
    } catch (error: any) {
      console.error('Registration failed:', error);
      setApiError(error.message || 'An unexpected error occurred during registration.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-3xl shadow-xl p-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-3">Create Account</h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400">Start your 75 Days challenge today</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              {...register('name')}
              className={`w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border ${errors.name ? 'border-red-500' : 'border-transparent'
                } focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none transition-all`}
              placeholder="Your Name"
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              {...register('email')}
              className={`w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border ${errors.email ? 'border-red-500' : 'border-transparent'
                } focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none transition-all`}
              placeholder="you@example.com"
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              {...register('password')}
              className={`w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border ${errors.password ? 'border-red-500' : 'border-transparent'
                } focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none transition-all`}
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          {apiError && (
            <div className="p-3 mt-4 text-sm text-red-500 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800/30">
              {apiError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Signing up...' : 'Sign Up'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          Already have an account?{' '}
          <Link href="/login" className="text-zinc-900 dark:text-zinc-100 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
