import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: '75 Days Challenge',
    short_name: '75 Days',
    description: 'Acompaña tu desafío de 75 días.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone'],
    background_color: '#050505',
    theme_color: '#050505',
    orientation: 'portrait-primary',
    lang: 'es',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
