'use client';

import { LogOut } from 'lucide-react';
import BottomSheet from './BottomSheet';

interface LogoutConfirmSheetProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function LogoutConfirmSheet({ open, onClose, onConfirm }: LogoutConfirmSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Cerrar sesión"
      description="¿Seguro que quieres salir de tu cuenta en este dispositivo?"
      footer={
        <div className="flex flex-col gap-2">
          <button type="button" onClick={onConfirm} className="pv2-destructive w-full">
            <LogOut size={16} strokeWidth={1.5} aria-hidden="true" />
            Cerrar sesión
          </button>
          <button type="button" onClick={onClose} className="pv2-ghost w-full">
            Cancelar
          </button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Tus datos y tu progreso se conservan. Podrás volver a entrar cuando quieras.
      </p>
    </BottomSheet>
  );
}
