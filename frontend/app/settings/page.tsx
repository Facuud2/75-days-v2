'use client';

import { useState } from 'react';
import { useThemeStore, ThemeType } from '@/store/useThemeStore';
import { useAuthStore } from '@/store/useAuthStore';
import {
  Moon, Sun, Monitor, Palette,
  User, Lock, Bell, Crown,
  Check, ChevronDown, ChevronUp,
  Shield, Zap, Infinity, Star,
  Loader2, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { userService, UpdateProfilePayload } from '@/lib/api/users';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type AlertState = { type: 'success' | 'error'; message: string } | null;

// ─────────────────────────────────────────────
// Section wrapper
// ─────────────────────────────────────────────
function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800/70 rounded-2xl overflow-hidden shadow-lg">
      {children}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  iconColor = 'text-rose-400',
  iconBg = 'bg-rose-500/15',
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  iconColor?: string;
  iconBg?: string;
}) {
  return (
    <div className="flex items-center gap-4 px-6 py-5 border-b border-zinc-800/60">
      <div className={`${iconBg} p-2.5 rounded-xl`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <h2 className="text-base font-bold text-zinc-100 leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Input field helper
// ─────────────────────────────────────────────
function Field({
  label, type = 'text', value, onChange, placeholder, min, max, step,
}: {
  label: string; type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; min?: number; max?: number; step?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '—'}
        min={min} max={max} step={step}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition-colors"
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function SettingsPage() {
  // ── Stores ──
  const { theme, customColors, setTheme, setCustomColors } = useThemeStore();
  const { user, updateProfile: updateAuthUser } = useAuthStore();

  // ── Profile fields ──
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [age, setAge] = useState(user?.age != null ? String(user.age) : '');
  const [weight, setWeight] = useState(user?.weight != null ? String(user.weight) : '');
  const [targetWeight, setTargetWeight] = useState(user?.targetWeight != null ? String(user.targetWeight) : '');
  const [height, setHeight] = useState(user?.height != null ? String(user.height) : '');

  // ── Password ──
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ── Save state ──
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);

  // ── Notifications toggles ──
  const [notifDaily, setNotifDaily] = useState(true);
  const [notifStreak, setNotifStreak] = useState(true);
  const [notifAchievements, setNotifAchievements] = useState(false);
  const [notifWeekly, setNotifWeekly] = useState(false);

  // ─────────────────────── Save handler ───────────────────────
  const handleSave = async () => {
    setAlert(null);

    if (showPassword && (currentPassword || newPassword || confirmPassword)) {
      if (!currentPassword) {
        setAlert({ type: 'error', message: 'Ingresá tu contraseña actual.' });
        return;
      }
      if (newPassword.length < 6) {
        setAlert({ type: 'error', message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
        return;
      }
      if (newPassword !== confirmPassword) {
        setAlert({ type: 'error', message: 'Las contraseñas nuevas no coinciden.' });
        return;
      }
    }

    setSaving(true);
    try {
      const payload: UpdateProfilePayload = {};
      if (name.trim()) payload.name = name.trim();
      if (email.trim()) payload.email = email.trim();
      if (age !== '') payload.age = Number(age);
      if (weight !== '') payload.weight = Number(weight);
      if (targetWeight !== '') payload.targetWeight = Number(targetWeight);
      if (height !== '') payload.height = Number(height);

      await userService.updateProfile(payload);

      if (showPassword && currentPassword && newPassword) {
        await userService.updatePassword({ currentPassword, newPassword });
      }

      updateAuthUser({
        ...(payload.name !== undefined && { name: payload.name }),
        ...(payload.email !== undefined && { email: payload.email }),
        ...(payload.age !== undefined && { age: payload.age }),
        ...(payload.weight !== undefined && { weight: payload.weight }),
        ...(payload.targetWeight !== undefined && { targetWeight: payload.targetWeight }),
        ...(payload.height !== undefined && { height: payload.height }),
      });

      setAlert({ type: 'success', message: '¡Cambios guardados correctamente!' });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setTimeout(() => setAlert(null), 3000);
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Error al guardar los cambios.' });
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────── Theme config ───────────────────────
  const themes: { id: ThemeType; label: string; icon: React.ElementType; desc: string }[] = [
    { id: 'light', label: 'Claro', icon: Sun, desc: 'Fondo blanco' },
    { id: 'dark', label: 'Oscuro', icon: Moon, desc: 'Fondo negro' },
    { id: 'system', label: 'Sistema', icon: Monitor, desc: 'Auto' },
    { id: 'custom', label: 'Custom', icon: Palette, desc: 'Tu elección' },
  ];

  // ─────────────────────── Notification toggle ───────────────────────
  function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
    return (
      <button
        onClick={onToggle}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${on ? 'bg-rose-500' : 'bg-zinc-700'}`}
        aria-checked={on}
        role="switch"
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${on ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
    );
  }

  // ─────────────────────── Premium plan config ───────────────────────
  const plans = [
    {
      id: 'free',
      name: 'Gratuito',
      price: 'Gratis',
      icon: Shield,
      iconColor: 'text-zinc-400',
      iconBg: 'bg-zinc-700/40',
      badge: null,
      features: ['1 desafío activo', '3 planes predefinidos', 'Estadísticas básicas'],
      current: true,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$4.99/mes',
      icon: Zap,
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/15',
      badge: 'Popular',
      features: ['Desafíos ilimitados', 'Plan personalizado', 'Estadísticas avanzadas', 'Sin anuncios'],
      current: false,
    },
    {
      id: 'elite',
      name: 'Elite',
      price: '$9.99/mes',
      icon: Infinity,
      iconColor: 'text-rose-400',
      iconBg: 'bg-rose-500/15',
      badge: null,
      features: ['Todo lo de Pro', 'Coach IA personalizado', 'Exportar datos', 'Acceso anticipado'],
      current: false,
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto space-y-6 animate-in fade-in bg-zinc-950 min-h-screen text-zinc-100">

      {/* ── Page Header ── */}
      <header className="mb-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="text-zinc-500 text-sm mt-1">Personalizá tu experiencia en 75 Days</p>
      </header>

      {/* ════════════════════════════════════════
          1. PERFIL Y SEGURIDAD
      ════════════════════════════════════════ */}
      <Section>
        <SectionHeader
          icon={User}
          title="Perfil y Seguridad"
          subtitle="Información personal y contraseña"
          iconColor="text-rose-400"
          iconBg="bg-rose-500/15"
        />

        <div className="px-6 py-5 space-y-5">

          {/* Alert */}
          {alert && (
            <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium ${alert.type === 'success'
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}>
              {alert.type === 'success'
                ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                : <AlertCircle className="w-4 h-4 shrink-0" />}
              {alert.message}
            </div>
          )}

          {/* Name + Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre" value={name} onChange={setName} placeholder="Tu nombre" />
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="tu@email.com" />
          </div>

          {/* Biometrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Edad" type="number" value={age} onChange={setAge} min={10} max={120} />
            <Field label="Peso (kg)" type="number" value={weight} onChange={setWeight} min={20} step={0.1} />
            <Field label="Meta (kg)" type="number" value={targetWeight} onChange={setTargetWeight} min={20} step={0.1} />
            <Field label="Altura (cm)" type="number" value={height} onChange={setHeight} min={100} max={250} />
          </div>

          {/* Password accordion */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Cambiar contraseña
              </span>
              {showPassword ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showPassword && (
              <div className="px-4 pb-4 pt-2 space-y-3 bg-zinc-800/20 border-t border-zinc-800">
                <Field label="Contraseña actual" type="password" value={currentPassword} onChange={setCurrentPassword} placeholder="••••••••" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Nueva contraseña" type="password" value={newPassword} onChange={setNewPassword} placeholder="••••••••" />
                  <Field label="Confirmar" type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder="••••••••" />
                </div>
              </div>
            )}
          </div>

          {/* Save button */}
          <div className="flex justify-end pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-rose-900/30"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </Section>

      {/* ════════════════════════════════════════
          2. TEMAS
      ════════════════════════════════════════ */}
      <Section>
        <SectionHeader
          icon={Palette}
          title="Temas"
          subtitle="Elegí el aspecto visual de la app"
          iconColor="text-violet-400"
          iconBg="bg-violet-500/15"
        />

        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {themes.map((t) => {
              const Icon = t.icon;
              const active = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all ${active
                    ? 'border-rose-500 bg-rose-500/10 shadow-md shadow-rose-900/20'
                    : 'border-zinc-800 bg-zinc-800/40 hover:bg-zinc-800 hover:border-zinc-700'
                    }`}
                >
                  {active && (
                    <span className="absolute top-2 right-2 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                    </span>
                  )}
                  <Icon size={22} className={active ? 'text-rose-400' : 'text-zinc-400'} />
                  <div className="text-center">
                    <div className={`text-sm font-semibold ${active ? 'text-rose-300' : 'text-zinc-200'}`}>{t.label}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{t.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom colors panel */}
          {theme === 'custom' && (
            <div className="space-y-4 pt-4 border-t border-zinc-800/60 animate-in fade-in slide-in-from-top-2">
              <h3 className="text-sm font-semibold text-zinc-300">Colores personalizados</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(['primary', 'secondary', 'accent'] as const).map((key) => (
                  <div key={key}>
                    <label className="block text-xs text-zinc-500 mb-1.5 capitalize">{key}</label>
                    <div className="flex items-center gap-3 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2">
                      <input
                        type="color"
                        value={customColors[key]}
                        onChange={(e) => setCustomColors({ [key]: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                      />
                      <span className="text-sm font-mono text-zinc-300 uppercase">{customColors[key]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* ════════════════════════════════════════
          3. NOTIFICACIONES
      ════════════════════════════════════════ */}
      <Section>
        <SectionHeader
          icon={Bell}
          title="Notificaciones"
          subtitle="Controlá qué alertas recibís"
          iconColor="text-sky-400"
          iconBg="bg-sky-500/15"
        />

        <div className="divide-y divide-zinc-800/60">
          {[
            { label: 'Recordatorio diario', desc: 'Recibí un aviso cada día para completar tus tareas', on: notifDaily, toggle: () => setNotifDaily(!notifDaily) },
            { label: 'Racha en peligro', desc: 'Alerta cuando tu racha esté por romperse', on: notifStreak, toggle: () => setNotifStreak(!notifStreak) },
            { label: 'Nuevos logros', desc: 'Sé el primero en saber cuando desbloqueás un logro', on: notifAchievements, toggle: () => setNotifAchievements(!notifAchievements) },
            { label: 'Resumen semanal', desc: 'Un recap de tu progreso cada domingo', on: notifWeekly, toggle: () => setNotifWeekly(!notifWeekly) },
          ].map(({ label, desc, on, toggle }) => (
            <div key={label} className="flex items-center justify-between px-6 py-4 hover:bg-zinc-800/20 transition-colors">
              <div>
                <p className="text-sm font-medium text-zinc-200">{label}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
              </div>
              <Toggle on={on} onToggle={toggle} />
            </div>
          ))}
        </div>
      </Section>

      {/* ════════════════════════════════════════
          4. MEMBRESÍA PREMIUM
      ════════════════════════════════════════ */}
      <Section>
        <SectionHeader
          icon={Crown}
          title="Membresía Premium"
          subtitle="Desbloqueá el máximo potencial"
          iconColor="text-amber-400"
          iconBg="bg-amber-500/15"
        />

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const Icon = plan.icon;
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl border p-5 transition-all ${plan.current
                    ? 'border-rose-500/50 bg-rose-500/5'
                    : 'border-zinc-800 bg-zinc-800/30 hover:border-zinc-700 hover:bg-zinc-800/50'
                    }`}
                >
                  {plan.badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-amber-500 text-zinc-900 text-[10px] font-bold rounded-full uppercase tracking-wider shadow">
                      {plan.badge}
                    </span>
                  )}
                  {plan.current && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full uppercase tracking-wider shadow">
                      Actual
                    </span>
                  )}

                  <div className={`${plan.iconBg} w-10 h-10 rounded-xl flex items-center justify-center mb-3`}>
                    <Icon className={`w-5 h-5 ${plan.iconColor}`} />
                  </div>

                  <h3 className="text-sm font-bold text-zinc-100">{plan.name}</h3>
                  <p className={`text-xl font-extrabold mt-1 mb-3 ${plan.current ? 'text-rose-400' : 'text-zinc-200'}`}>{plan.price}</p>

                  <ul className="space-y-1.5 flex-1 mb-4">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-zinc-400">
                        <Check className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {plan.current ? (
                    <div className="text-xs text-center py-2 px-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 font-medium">
                      Plan actual
                    </div>
                  ) : (
                    <button className="w-full text-xs py-2 px-4 bg-zinc-700 hover:bg-zinc-600 border border-zinc-600 rounded-xl text-zinc-200 font-semibold transition-colors">
                      Elegir plan
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-center text-xs text-zinc-600 mt-2">
            Los pagos son procesados de forma segura. Podés cancelar en cualquier momento.
          </p>
        </div>
      </Section>

    </div>
  );
}
