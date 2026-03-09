import type { Metadata } from 'next';
import './globals.css';
import AppLayout from '@/components/Layout';
import { Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: '75 Days Challenge',
  description: 'Track your 75 Days Challenge with ease.',
};

import AuthGuard from '@/components/AuthGuard';

// ... other imports ...

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100" suppressHydrationWarning>
        <AuthGuard>
          <AppLayout>{children}</AppLayout>
        </AuthGuard>
      </body>
    </html>
  );
}
