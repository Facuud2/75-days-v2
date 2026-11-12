import type { Metadata, Viewport } from 'next';
import RegisterForm from './RegisterForm';

export const metadata: Metadata = {
  title: 'Crear cuenta · 75 Days Challenge',
  description: 'Crea tu cuenta y empieza tu desafío de 75 días.',
};

// The auth hero is near-black on every appearance, so the browser chrome matches it.
export const viewport: Viewport = {
  themeColor: '#050505',
};

export default function RegisterPage() {
  return <RegisterForm />;
}
