'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, error, isLoading } = useAuthStore();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { email: email.trim(), password };
      console.log('Sending login payload:', payload);
      await login(payload);
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Login failed block raw error:', error);
      // NOTE: Here you could add a toast notification using useUIStore in the future
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white dark:bg-zinc-950 rounded-3xl p-10 relative border border-zinc-200 dark:border-rose-500/20 shadow-2xl dark:shadow-[0_0_50px_-12px_rgba(244,63,94,0.15)] overflow-hidden">
        {/* Neon top glow line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-600 via-rose-400 to-rose-600 opacity-80"></div>
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-3">Welcome Back</h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400">Continue your 75 Days journey</p>
        </div>

        {error && (
          <div className="mb-6 p-4 text-sm font-medium text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 outline-none transition-all dark:text-white"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 flex items-center justify-between">
              <span>Password</span>
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 outline-none transition-all dark:text-white"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 focus:ring-4 focus:ring-rose-500/30 transition-all mt-6 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(244,63,94,0.3)] hover:shadow-[0_0_25px_rgba(244,63,94,0.45)]"
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-rose-600 dark:text-rose-400 font-bold hover:text-rose-500 transition-colors">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
