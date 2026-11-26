'use client';

import React, { useState } from 'react';
import { Check, Monitor, Moon, Palette, Sliders, Sun } from 'lucide-react';
import { startCircularReveal } from '@/lib/themeTransition';
import {
  AppearanceMode,
  ColorPalette,
  PALETTES,
  PaletteConfig,
  useThemeStore,
} from '@/store/useThemeStore';
import { SegmentedControl, SegmentedOption } from '../SegmentedControl';
import { SettingsGroup } from '../SettingsGroup';
import { SettingsRow } from '../SettingsRow';
import { SettingsSheet } from '../SettingsSheet';

const APPEARANCE_OPTIONS: SegmentedOption<AppearanceMode>[] = [
  { id: 'dark', label: 'Oscuro', icon: Moon },
  { id: 'light', label: 'Claro', icon: Sun },
  { id: 'system', label: 'Sistema', icon: Monitor },
];

function applyPaletteVariables(
  palette: ColorPalette,
  custom: { primary: string; secondary: string; accent: string }
) {
  const root = document.documentElement;
  const roseShades = ['400', '500', '600', '700', '900', '950'];
  root.setAttribute('data-palette', palette);
  if (palette === 'custom') {
    root.style.setProperty('--color-rose-400', custom.accent);
    root.style.setProperty('--color-rose-500', custom.primary);
    root.style.setProperty('--color-rose-600', custom.secondary);
    root.style.setProperty('--color-rose-700', custom.secondary);
    root.style.setProperty('--color-rose-900', custom.secondary);
    root.style.setProperty('--color-rose-950', custom.secondary);
  } else {
    roseShades.forEach((s) => root.style.removeProperty(`--color-rose-${s}`));
  }
}

export function AppearanceSection() {
  const {
    appearance,
    colorPalette,
    customPalette,
    setAppearance,
    setColorPalette,
    setCustomPalette,
  } = useThemeStore();

  const [customDraft, setCustomDraft] = useState(customPalette);
  const [isCustomSheetOpen, setIsCustomSheetOpen] = useState(false);

  const switchAppearance = (
    mode: AppearanceMode,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    const isDark =
      mode === 'dark' ||
      (mode === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    startCircularReveal(e, () => {
      const root = document.documentElement;
      isDark ? root.classList.add('dark') : root.classList.remove('dark');
      root.setAttribute('data-appearance', isDark ? 'dark' : 'light');
      root.style.colorScheme = isDark ? 'dark' : 'light';
      setAppearance(mode);
    });
  };

  const switchPalette = (
    palette: ColorPalette,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    startCircularReveal(e, () => {
      applyPaletteVariables(palette, customPalette);
      setColorPalette(palette);
    });
  };

  const openCustomEditor = () => {
    setCustomDraft(customPalette);
    setIsCustomSheetOpen(true);
  };

  const saveCustomPalette = (e: React.MouseEvent<HTMLButtonElement>) => {
    startCircularReveal(e, () => {
      applyPaletteVariables('custom', customDraft);
      setCustomPalette(customDraft);
      setColorPalette('custom');
      setIsCustomSheetOpen(false);
    });
  };

  const presetEntries = Object.entries(PALETTES) as [
    Exclude<ColorPalette, 'custom'>,
    PaletteConfig,
  ][];

  const colorKeys: { key: keyof typeof customPalette; label: string }[] = [
    { key: 'primary', label: 'Primary' },
    { key: 'secondary', label: 'Secondary' },
    { key: 'accent', label: 'Accent' },
  ];

  const activePaletteLabel =
    colorPalette === 'custom'
      ? 'Personalizada'
      : PALETTES[colorPalette]?.label ?? 'Pink Neon';

  return (
    <div className="space-y-5">
      <SettingsGroup
        title="Apariencia"
        footer="El modo Sistema se sincroniza automáticamente con la configuración de tu dispositivo."
      >
        <div className="p-3.5">
          <SegmentedControl
            ariaLabel="Modo de apariencia"
            options={APPEARANCE_OPTIONS}
            value={appearance}
            onChange={switchAppearance}
          />
        </div>

        {/* Quick toggle row for easy access */}
        {(() => {
          const isEffectiveDark =
            appearance === 'dark' ||
            (appearance === 'system' &&
              typeof window !== 'undefined' &&
              window.matchMedia('(prefers-color-scheme: dark)').matches);
          return (
            <div className="px-3.5 pb-3.5">
              <SettingsRow
                icon={isEffectiveDark ? Sun : Moon}
                iconBgClass="bg-rose-500/15"
                iconColorClass="text-[var(--accent-text)]"
                title={isEffectiveDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                detail={appearance === 'system' ? 'Sincronizado con el sistema' : undefined}
                onClick={(e) => {
                  const next: AppearanceMode = isEffectiveDark ? 'light' : 'dark';
                  switchAppearance(next, e);
                }}
              />
            </div>
          );
        })()}
      </SettingsGroup>

      <SettingsGroup
        title="Paleta de colores"
        footer="Los acentos, interruptores y badges de la app se adaptan al tema seleccionado."
      >
        <div className="p-3.5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {presetEntries.map(([id, palette]) => {
              const active = colorPalette === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={(e) => switchPalette(id, e)}
                  aria-pressed={active}
                  className={`relative flex min-h-[82px] flex-col items-start justify-between rounded-xl border p-3 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                    active
                      ? 'border-[var(--accent-fill)] bg-rose-500/10 shadow-sm'
                      : 'border-[var(--border-subtle)] bg-[var(--surface-inset)] hover:bg-[var(--surface-raised)]'
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="flex gap-1">
                      {palette.preview.map((color, i) => (
                        <span
                          key={i}
                          className="h-3.5 w-3.5 rounded-full border border-black/15 dark:border-white/15"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    {active && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent-fill)] text-[var(--on-accent)]">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-[var(--text-primary)]">
                    {palette.label}
                  </p>
                </button>
              );
            })}

            {/* Custom palette trigger */}
            {(() => {
              const active = colorPalette === 'custom';
              return (
                <button
                  type="button"
                  onClick={openCustomEditor}
                  aria-pressed={active}
                  className={`relative flex min-h-[82px] flex-col items-start justify-between rounded-xl border p-3 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                    active
                      ? 'border-[var(--accent-fill)] bg-rose-500/10 shadow-sm'
                      : 'border-[var(--border-subtle)] bg-[var(--surface-inset)] hover:bg-[var(--surface-raised)]'
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="flex gap-1">
                      {Object.values(customPalette).map((color, i) => (
                        <span
                          key={i}
                          className="h-3.5 w-3.5 rounded-full border border-black/15 dark:border-white/15"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    {active && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent-fill)] text-[var(--on-accent)]">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
                    <Sliders
                      className="h-3 w-3 text-[var(--accent-text)]"
                      aria-hidden="true"
                    />
                    Custom
                  </span>
                </button>
              );
            })()}
          </div>
        </div>

        <SettingsRow
          icon={Palette}
          iconBgClass="bg-rose-500/15"
          iconColorClass="text-[var(--accent-text)]"
          title="Personalizar colores"
          detail={activePaletteLabel}
          onClick={openCustomEditor}
        />
      </SettingsGroup>

      <SettingsSheet
        isOpen={isCustomSheetOpen}
        onClose={() => setIsCustomSheetOpen(false)}
        title="Paleta personalizada"
        subtitle="Elegí tus 3 colores y previsualizalos antes de aplicar"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {colorKeys.map(({ key, label }) => (
              <div key={key} className="space-y-1.5">
                <label
                  htmlFor={`picker-${key}`}
                  className="block text-xs font-semibold text-[var(--text-secondary)]"
                >
                  {label}
                </label>
                <label
                  htmlFor={`picker-${key}`}
                  className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3 py-2 transition-colors hover:bg-[var(--surface-raised)]"
                >
                  <span className="relative h-7 w-7 shrink-0">
                    <span
                      className="block h-7 w-7 rounded-lg border border-black/15 dark:border-white/20 shadow-sm"
                      style={{ backgroundColor: customDraft[key] }}
                    />
                    <input
                      id={`picker-${key}`}
                      type="color"
                      aria-label={`Color ${label}`}
                      value={customDraft[key]}
                      onChange={(e) =>
                        setCustomDraft((draft) => ({
                          ...draft,
                          [key]: e.target.value,
                        }))
                      }
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </span>
                  <span className="font-mono text-xs uppercase text-[var(--text-primary)]">
                    {customDraft[key]}
                  </span>
                </label>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-[var(--text-muted)]">
              Vista previa
            </p>
            <div className="flex h-3.5 overflow-hidden rounded-full border border-[var(--border-subtle)]">
              <div
                className="flex-1"
                style={{ backgroundColor: customDraft.primary }}
              />
              <div
                className="flex-1"
                style={{ backgroundColor: customDraft.secondary }}
              />
              <div
                className="flex-1"
                style={{ backgroundColor: customDraft.accent }}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setIsCustomSheetOpen(false)}
              className="min-h-[44px] rounded-xl px-4 py-2 text-sm font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-inset)] hover:text-[var(--text-primary)]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={saveCustomPalette}
              className="min-h-[44px] rounded-xl bg-[var(--accent-fill)] px-5 py-2 text-sm font-semibold text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-fill-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              Guardar colores
            </button>
          </div>
        </div>
      </SettingsSheet>
    </div>
  );
}
