import type { Metadata, Viewport } from 'next';
import LoginForm from './LoginForm';

export const metadata: Metadata = {
  title: 'Iniciar sesión · 75 Days Challenge',
  description: 'Entra a tu cuenta y continúa tu desafío de 75 días.',
};

// The auth hero is near-black on every appearance, so the browser chrome matches it.
export const viewport: Viewport = {
  themeColor: '#050505',
};

export default function LoginPage() {
  return <LoginForm />;
}
