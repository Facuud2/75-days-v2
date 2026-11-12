import type { Metadata, Viewport } from 'next';
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
  applicationName: '75 Days Challenge',
  appleWebApp: {
    capable: true,
    title: '75 Days',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  other: {
    // iOS still reads the Apple-prefixed flag when installing from Safari.
    'apple-mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  colorScheme: 'dark light',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#050505' },
    { media: '(prefers-color-scheme: light)', color: '#f2f3f5' },
  ],
};

import AuthGuard from '@/components/AuthGuard';

// ... other imports ...

import { Toaster } from 'react-hot-toast';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100" suppressHydrationWarning>
        <AuthGuard>
          <AppLayout>{children}</AppLayout>
        </AuthGuard>
        <Toaster position="bottom-right" toastOptions={{
          style: {
            background: '#18181b', // hover:bg-zinc-900 equivalent mostly
            color: '#f4f4f5',
            border: '1px solid #27272a',
          }
        }} />
      </body>
    </html>
  );
}
