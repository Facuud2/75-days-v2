'use client';

import { ChevronRight, Image as ImageIcon, PanelTop, Quote, UserRound } from 'lucide-react';
import BottomSheet from './BottomSheet';
import type { ProfileEditMode } from '@/components/EditProfileSheet';

interface ProfileEditMenuProps {
  open: boolean;
  onClose: () => void;
  onSelect: (mode: ProfileEditMode) => void;
}

const OPTIONS: { mode: ProfileEditMode; label: string; icon: typeof UserRound }[] = [
  { mode: 'name', label: 'Nombre', icon: UserRound },
  { mode: 'avatar', label: 'Foto de perfil', icon: ImageIcon },
  { mode: 'quote', label: 'Frase de perfil', icon: Quote },
  { mode: 'banner', label: 'Portada', icon: PanelTop },
];

export default function ProfileEditMenu({ open, onClose, onSelect }: ProfileEditMenuProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Editar perfil" description="Elige qué quieres cambiar.">
      <ul className="space-y-1">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <li key={option.mode}>
              <button
                type="button"
                onClick={() => onSelect(option.mode)}
                className="pv2-row pv2-row--interactive -mx-2"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: 'var(--surface-inset)', color: 'var(--accent-text)' }}
                  aria-hidden="true"
                >
                  <Icon size={20} strokeWidth={1.5} />
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {option.label}
                </span>
                <ChevronRight size={16} strokeWidth={1.5} className="shrink-0" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
