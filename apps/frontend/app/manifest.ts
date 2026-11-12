import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '75 Days Challenge',
    short_name: '75 Days',
    description: 'Acompaña tu desafío de 75 días.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#050505',
    theme_color: '#050505',
    orientation: 'portrait-primary',
    lang: 'es',
  };
}
