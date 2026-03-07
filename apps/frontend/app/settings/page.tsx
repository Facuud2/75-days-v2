'use client';

import { useState } from 'react';
import { startCircularReveal } from '@/lib/themeTransition';
import { useThemeStore, ColorPalette, AppearanceMode, PALETTES, PaletteConfig } from '@/store/useThemeStore';
import { useAuthStore } from '@/store/useAuthStore';
import {
  Moon, Sun, Monitor, Palette,
  User, Lock, Bell, Crown,
  Check, ChevronDown, ChevronUp,
  Shield, Zap, Infinity,
  Loader2, CheckCircle2, AlertCircle,
  Sliders,
} from 'lucide-react';
import { userService, UpdateProfilePayload } from '@/lib/api/users';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type AlertState = { type: 'success' | 'error'; message: string } | null;

// ─────────────────────────────────────────────
// Reusable section wrapper
// ─────────────────────────────────────────────
function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800/70 rounded-2xl overflow-hidden shadow-lg">
      {children}
    </div>
  );
}

function SectionHeader({
  icon: Icon, title, subtitle,
  iconColor = 'text-rose-400', iconBg = 'bg-rose-500/15',
}: {
  icon: React.ElementType; title: string; subtitle?: string;
  iconColor?: string; iconBg?: string;
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
// Input helper
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
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '—'} min={min} max={max} step={step}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition-colors"
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// Toggle switch
// ─────────────────────────────────────────────
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${on ? 'bg-rose-500' : 'bg-zinc-700'}`}
      aria-checked={on} role="switch"
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${on ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

// ─────────────────────────────────────────────
// Main Settings Page
// ─────────────────────────────────────────────
export default function SettingsPage() {
  // ── Stores ──────────────────────────────────────────────────────────────
  const {
    appearance, colorPalette, customPalette,
    setAppearance, setColorPalette, setCustomPalette,
  } = useThemeStore();
  const { user, updateProfile: updateAuthUser } = useAuthStore();

  // ── Animated appearance switch ───────────────────────────────────────────
  const switchAppearance = (mode: AppearanceMode, e: React.MouseEvent) => {
    const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    startCircularReveal(e, () => {
      const root = document.documentElement;
      isDark ? root.classList.add('dark') : root.classList.remove('dark');
      root.setAttribute('data-appearance', isDark ? 'dark' : 'light');
      setAppearance(mode);
    });
  };

  // ── Animated palette switch (View Transitions API) ────────────────────────
  const switchPalette = (palette: ColorPalette, e: React.MouseEvent) => {
    const roseShades = ['400', '500', '600', '700', '900', '950'];
    startCircularReveal(e, () => {
      const root = document.documentElement;
      root.setAttribute('data-palette', palette);
      if (palette === 'custom') {
        root.style.setProperty('--color-rose-400', customPalette.accent);
        root.style.setProperty('--color-rose-500', customPalette.primary);
        root.style.setProperty('--color-rose-600', customPalette.secondary);
        root.style.setProperty('--color-rose-700', customPalette.secondary);
        root.style.setProperty('--color-rose-900', customPalette.secondary);
        root.style.setProperty('--color-rose-950', customPalette.secondary);
      } else {
        roseShades.forEach((s) => root.style.removeProperty(`--color-rose-${s}`));
      }
      setColorPalette(palette);
    });
  };

  // ── Profile fields ───────────────────────────────────────────────────────
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [age, setAge] = useState(user?.age != null ? String(user.age) : '');
  const [weight, setWeight] = useState(user?.weight != null ? String(user.weight) : '');
  const [targetWeight, setTargetWeight] = useState(user?.targetWeight != null ? String(user.targetWeight) : '');
  const [height, setHeight] = useState(user?.height != null ? String(user.height) : '');

  // ── Password ─────────────────────────────────────────────────────────────
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ── Save state ────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);

  // ── Notifications ─────────────────────────────────────────────────────────
  const [notifDaily, setNotifDaily] = useState(true);
  const [notifStreak, setNotifStreak] = useState(true);
  const [notifAchievements, setNotifAchievements] = useState(false);
  const [notifWeekly, setNotifWeekly] = useState(false);

  // ── Save handler ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    setAlert(null);
    if (showPassword && (currentPassword || newPassword || confirmPassword)) {
      if (!currentPassword) { setAlert({ type: 'error', message: 'Ingresá tu contraseña actual.' }); return; }
      if (newPassword.length < 6) { setAlert({ type: 'error', message: 'La nueva contraseña debe tener al menos 6 caracteres.' }); return; }
      if (newPassword !== confirmPassword) { setAlert({ type: 'error', message: 'Las contraseñas nuevas no coinciden.' }); return; }
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

  // ── Premium plans ──────────────────────────────────────────────────────────
  const plans = [
    {
      id: 'free', name: 'Gratuito', price: 'Gratis', icon: Shield,
      iconColor: 'text-zinc-400', iconBg: 'bg-zinc-700/40', badge: null,
      features: ['1 desafío activo', '3 planes predefinidos', 'Estadísticas básicas'],
      current: true,
    },
    {
      id: 'pro', name: 'Pro', price: '$4.99/mes', icon: Zap,
      iconColor: 'text-amber-400', iconBg: 'bg-amber-500/15', badge: 'Popular',
      features: ['Desafíos ilimitados', 'Plan personalizado', 'Estadísticas avanzadas', 'Sin anuncios'],
      current: false,
    },
    {
      id: 'elite', name: 'Elite', price: '$9.99/mes', icon: Infinity,
      iconColor: 'text-rose-400', iconBg: 'bg-rose-500/15', badge: null,
      features: ['Todo lo de Pro', 'Coach IA personalizado', 'Exportar datos', 'Acceso anticipado'],
      current: false,
    },
  ];

  // ── Appearance options ─────────────────────────────────────────────────────
  const appearanceOptions: { id: AppearanceMode; label: string; icon: React.ElementType; desc: string }[] = [
    { id: 'dark', label: 'Oscuro', icon: Moon, desc: 'Discord dark' },
    { id: 'light', label: 'Claro', icon: Sun, desc: 'Discord light' },
    { id: 'system', label: 'Sistema', icon: Monitor, desc: 'Auto' },
  ];

  // ── Preset palette entries (excludes 'custom') ────────────────────────────
  const presetEntries = Object.entries(PALETTES) as [Exclude<ColorPalette, 'custom'>, PaletteConfig][];

  // ── Custom palette colour pickers ─────────────────────────────────────────
  const colorKeys: { key: keyof typeof customPalette; label: string }[] = [
    { key: 'primary', label: 'Primary' },
    { key: 'secondary', label: 'Secondary' },
    { key: 'accent', label: 'Accent' },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto space-y-6 animate-in fade-in bg-zinc-950 min-h-screen text-zinc-100">

      {/* ── Page Header ── */}
      <header className="mb-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="text-zinc-500 text-sm mt-1">Personalizá tu experiencia en 75 Days</p>
      </header>

      {/* ═══════════════════════════════════════════
          1. PERFIL Y SEGURIDAD
      ═══════════════════════════════════════════ */}
      <Section>
        <SectionHeader icon={User} title="Perfil y Seguridad" subtitle="Información personal y contraseña" />

        <div className="px-6 py-5 space-y-5">
          {alert && (
            <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium ${alert.type === 'success' ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
              {alert.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {alert.message}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre" value={name} onChange={setName} placeholder="Tu nombre" />
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="tu@email.com" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Edad" type="number" value={age} onChange={setAge} min={10} max={120} />
            <Field label="Peso (kg)" type="number" value={weight} onChange={setWeight} min={20} step={0.1} />
            <Field label="Meta (kg)" type="number" value={targetWeight} onChange={setTargetWeight} min={20} step={0.1} />
            <Field label="Altura (cm)" type="number" value={height} onChange={setHeight} min={100} max={250} />
          </div>
          <div className="border border-zinc-800 rounded-xl overflow-hidden">
            <button
              type="button" onClick={() => setShowPassword(!showPassword)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
            >
              <span className="flex items-center gap-2"><Lock className="w-4 h-4" />Cambiar contraseña</span>
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
          <div className="flex justify-end pt-1">
            <button
              onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-rose-900/30"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════
          2. TEMAS
      ═══════════════════════════════════════════ */}
      <Section>
        <SectionHeader
          icon={Palette} title="Temas"
          subtitle="Paleta de colores y apariencia visual"
          iconColor="text-violet-400" iconBg="bg-violet-500/15"
        />

        <div className="px-6 py-6 space-y-7">

          {/* ── 2A: Colour Palettes (preset cards + custom card) ── */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Paleta de colores</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Preset palettes */}
              {presetEntries.map(([id, palette]) => {
                const active = colorPalette === id;
                return (
                  <button
                    key={id}
                    onClick={(e) => switchPalette(id, e)}
                    className={`relative flex flex-col items-start gap-3 p-4 rounded-2xl border-2 transition-all text-left ${active
                      ? 'border-white/30 bg-white/5 shadow-md'
                      : 'border-zinc-800 bg-zinc-800/30 hover:bg-zinc-800/60 hover:border-zinc-700'
                      }`}
                  >
                    {active && (
                      <span className="absolute top-2.5 right-2.5 w-4 h-4 bg-white/20 border border-white/30 rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                      </span>
                    )}
                    {/* Colour swatches */}
                    <div className="flex gap-1.5">
                      {palette.preview.map((color: string, i: number) => (
                        <span
                          key={i}
                          className="w-4 h-4 rounded-full border border-white/10 shadow-sm"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <div>
                      <p className={`text-xs font-semibold leading-tight ${active ? 'text-white' : 'text-zinc-300'}`}>
                        {palette.label}
                      </p>
                    </div>
                  </button>
                );
              })}

              {/* Custom palette card */}
              {(() => {
                const active = colorPalette === 'custom';
                return (
                  <button
                    onClick={(e) => switchPalette('custom', e)}
                    className={`relative flex flex-col items-start gap-3 p-4 rounded-2xl border-2 transition-all text-left ${active
                      ? 'border-white/30 bg-white/5 shadow-md'
                      : 'border-zinc-800 bg-zinc-800/30 hover:bg-zinc-800/60 hover:border-zinc-700'
                      }`}
                  >
                    {active && (
                      <span className="absolute top-2.5 right-2.5 w-4 h-4 bg-white/20 border border-white/30 rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                      </span>
                    )}
                    {/* Show current custom swatches */}
                    <div className="flex gap-1.5">
                      {Object.values(customPalette).map((color, i) => (
                        <span
                          key={i}
                          className="w-4 h-4 rounded-full border border-white/10 shadow-sm"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Sliders className={`w-3 h-3 ${active ? 'text-violet-400' : 'text-zinc-500'}`} />
                      <p className={`text-xs font-semibold leading-tight ${active ? 'text-white' : 'text-zinc-300'}`}>
                        Custom
                      </p>
                    </div>
                  </button>
                );
              })()}
            </div>

            {/* Custom colour pickers — shown only when 'custom' is active */}
            {colorPalette === 'custom' && (
              <div className="mt-4 p-4 bg-zinc-800/30 border border-zinc-700/50 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2">
                <p className="text-xs font-semibold text-zinc-400 flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-violet-400" />
                  Personalizá tus colores
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {colorKeys.map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-xs text-zinc-500 mb-2 font-medium">{label}</label>
                      <div className="flex items-center gap-3 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 cursor-pointer hover:border-zinc-600 transition-colors"
                        onClick={() => document.getElementById(`picker-${key}`)?.click()}
                      >
                        <div className="relative">
                          <span
                            className="w-7 h-7 rounded-lg border border-white/20 shadow block cursor-pointer"
                            style={{ backgroundColor: customPalette[key] }}
                          />
                          <input
                            id={`picker-${key}`}
                            type="color"
                            value={customPalette[key]}
                            onChange={(e) => setCustomPalette({ [key]: e.target.value })}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                          />
                        </div>
                        <span className="text-xs font-mono text-zinc-300 uppercase tracking-wider">
                          {customPalette[key]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Live preview strip */}
                <div className="flex rounded-xl overflow-hidden h-3 shadow-inner">
                  <div className="flex-1" style={{ backgroundColor: customPalette.primary }} />
                  <div className="flex-1" style={{ backgroundColor: customPalette.secondary }} />
                  <div className="flex-1" style={{ backgroundColor: customPalette.accent }} />
                </div>
              </div>
            )}
          </div>

          {/* ── Divider ── */}
          <div className="border-t border-zinc-800/60" />

          {/* ── 2B: Appearance (Dark / Light / System) ── */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Apariencia</p>
            <div className="grid grid-cols-3 gap-3">
              {appearanceOptions.map(({ id, label, icon: Icon, desc }) => {
                const active = appearance === id;
                return (
                  <button
                    key={id}
                    onClick={(e) => switchAppearance(id, e)}
                    className={`relative flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border-2 transition-all ${active
                      ? 'border-white/30 bg-white/5 shadow-md'
                      : 'border-zinc-800 bg-zinc-800/30 hover:bg-zinc-800/60 hover:border-zinc-700'
                      }`}
                  >
                    {active && (
                      <span className="absolute top-2 right-2 w-4 h-4 bg-white/20 border border-white/30 rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                      </span>
                    )}
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center ${id === 'dark' ? 'bg-[#313338] border-zinc-600'
                      : id === 'light' ? 'bg-[#f2f3f5] border-zinc-400'
                        : 'bg-gradient-to-br from-[#313338] to-[#f2f3f5] border-zinc-600'
                      }`}>
                      <Icon className={`w-4 h-4 ${id === 'light' ? 'text-zinc-800' : 'text-zinc-200'}`} />
                    </div>
                    <div className="text-center">
                      <p className={`text-sm font-semibold leading-tight ${active ? 'text-white' : 'text-zinc-300'}`}>{label}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </Section>

      {/* ═══════════════════════════════════════════
          3. NOTIFICACIONES
      ═══════════════════════════════════════════ */}
      <Section>
        <SectionHeader icon={Bell} title="Notificaciones" subtitle="Controlá qué alertas recibís" iconColor="text-sky-400" iconBg="bg-sky-500/15" />
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

      {/* ═══════════════════════════════════════════
          4. MEMBRESÍA PREMIUM
      ═══════════════════════════════════════════ */}
      <Section>
        <SectionHeader icon={Crown} title="Membresía Premium" subtitle="Desbloqueá el máximo potencial" iconColor="text-amber-400" iconBg="bg-amber-500/15" />
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const Icon = plan.icon;
              return (
                <div key={plan.id} className={`relative flex flex-col rounded-2xl border p-5 transition-all ${plan.current ? 'border-rose-500/50 bg-rose-500/5' : 'border-zinc-800 bg-zinc-800/30 hover:border-zinc-700 hover:bg-zinc-800/50'}`}>
                  {plan.badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-amber-500 text-zinc-900 text-[10px] font-bold rounded-full uppercase tracking-wider shadow">{plan.badge}</span>
                  )}
                  {plan.current && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full uppercase tracking-wider shadow">Actual</span>
                  )}
                  <div className={`${plan.iconBg} w-10 h-10 rounded-xl flex items-center justify-center mb-3`}>
                    <Icon className={`w-5 h-5 ${plan.iconColor}`} />
                  </div>
                  <h3 className="text-sm font-bold text-zinc-100">{plan.name}</h3>
                  <p className={`text-xl font-extrabold mt-1 mb-3 ${plan.current ? 'text-rose-400' : 'text-zinc-200'}`}>{plan.price}</p>
                  <ul className="space-y-1.5 flex-1 mb-4">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-zinc-400">
                        <Check className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />{f}
                      </li>
                    ))}
                  </ul>
                  {plan.current ? (
                    <div className="text-xs text-center py-2 px-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 font-medium">Plan actual</div>
                  ) : (
                    <button className="w-full text-xs py-2 px-4 bg-zinc-700 hover:bg-zinc-600 border border-zinc-600 rounded-xl text-zinc-200 font-semibold transition-colors">Elegir plan</button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-center text-xs text-zinc-600 mt-2">Los pagos son procesados de forma segura. Podés cancelar en cualquier momento.</p>
        </div>
      </Section>

    </div>
  );
}
