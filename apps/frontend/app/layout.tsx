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
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
    { media: '(prefers-color-scheme: light)', color: '#f6f5f3' },
  ],
};

import AuthGuard from '@/components/AuthGuard';

// ... other imports ...

import StackedToaster from '@/components/StackedToaster';

function extractOrigin(url: string | undefined): string | null {
  if (!url || url.includes('onrender.com')) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const apiOrigins = Array.from(
    new Set(
      [
        extractOrigin(process.env.NEXT_PUBLIC_API_URL),
        extractOrigin(process.env.NEXT_PUBLIC_HEALTH_API_URL),
      ].filter((origin): origin is string => Boolean(origin))
    )
  );

  return (
    <html lang="es" className={`${inter.variable} ${jetbrainsMono.variable} font-sans`}>
      <head>
        {apiOrigins.map((origin) => (
          <link key={`preconnect-${origin}`} rel="preconnect" href={origin} crossOrigin="anonymous" />
        ))}
        {apiOrigins.map((origin) => (
          <link key={`dns-${origin}`} rel="dns-prefetch" href={origin} />
        ))}
      </head>
      <body className="antialiased bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100" suppressHydrationWarning>
        <AuthGuard>
          <AppLayout>{children}</AppLayout>
        </AuthGuard>
        <StackedToaster />
      </body>
    </html>
  );
}
