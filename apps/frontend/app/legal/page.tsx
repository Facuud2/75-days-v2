import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'Términos de Uso y Privacidad | 75 Days Challenge',
  description:
    'Términos de uso, política de privacidad y derechos sobre tus datos en 75 Days Challenge.',
};

export default function LegalPage() {
  return (
    <main className="min-h-dvh bg-[var(--surface-page,#09090b)] px-5 py-10 text-[var(--text-primary,#f4f4f5)]">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3.5 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver
          </Link>
          <span className="text-xs text-zinc-500">Versión 1.0 · Noviembre 2026</span>
        </div>

        <header className="space-y-3 border-b border-zinc-800 pb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Privacidad y Transparencia
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Términos de Uso y Política de Privacidad
          </h1>
          <p className="text-sm leading-relaxed text-zinc-400">
            Resumen claro y sin letra chica de cómo tratamos tu cuenta, tus registros
            de hábitos y tus derechos sobre tus datos.
          </p>
        </header>

        <section className="space-y-3" aria-labelledby="legal-privacy">
          <h2 id="legal-privacy" className="text-lg font-semibold">
            1. Qué datos guardamos y para qué
          </h2>
          <p className="text-sm leading-relaxed text-zinc-300">
            Guardamos únicamente los datos necesarios para el funcionamiento del reto:
            nombre, correo electrónico, métricas que elijas registrar (peso, altura,
            comidas, entrenamientos, metas y misiones) y, si decidís vincularlo
            voluntariamente, tu conexión OAuth con Strava (almacenada cifrada).
          </p>
          <p className="text-sm leading-relaxed text-zinc-300">
            No vendemos tus datos ni utilizamos rastreadores publicitarios de terceros.
            El almacenamiento local del navegador se utiliza exclusivamente para mantener
            tu sesión activa, tu preferencia de tema y la caché de rendimiento de tu reto.
          </p>
        </section>

        <section className="space-y-3" aria-labelledby="legal-rights">
          <h2 id="legal-rights" className="text-lg font-semibold">
            2. Portabilidad y borrado total de tu cuenta
          </h2>
          <p className="text-sm leading-relaxed text-zinc-300">
            En cualquier momento podés descargar una copia completa de tus datos en
            formato JSON desde <strong>Ajustes → Seguridad y datos</strong> o eliminar
            tu cuenta de forma permanente. Al eliminar tu cuenta se purgan todos tus
            registros tanto del servicio principal de retos como del servicio de salud,
            nutrición, entrenamientos y tokens vinculados.
          </p>
        </section>

        <section className="space-y-3" aria-labelledby="legal-ai">
          <h2 id="legal-ai" className="text-lg font-semibold">
            3. Asistencia con Inteligencia Artificial y salud
          </h2>
          <p className="text-sm leading-relaxed text-zinc-300">
            Las sugerencias de planes personalizados o misiones secundarias generadas con
            IA son orientativas y no constituyen asesoramiento médico ni nutricional
            profesional. Revisá siempre tus metas según tu estado físico y consultá a un
            profesional de la salud ante cualquier duda.
          </p>
        </section>

        <section className="space-y-3" aria-labelledby="legal-terms">
          <h2 id="legal-terms" className="text-lg font-semibold">
            4. Condiciones de uso y disponibilidad
          </h2>
          <p className="text-sm leading-relaxed text-zinc-300">
            El servicio se ofrece tal cual (&ldquo;best-effort&rdquo;) y está destinado a
            personas mayores de 16 años. Sos responsable de mantener la confidencialidad
            de tus credenciales de acceso.
          </p>
        </section>
      </div>
    </main>
  );
}
