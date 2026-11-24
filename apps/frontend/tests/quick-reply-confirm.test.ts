import { describe, expect, it } from 'vitest';
import { isConfirmationQuickReply } from '../components/onboarding/QuickReplyOptionsCard';

describe('isConfirmationQuickReply', () => {
  it('matches explicit confirmation and save quick replies', () => {
    expect(isConfirmationQuickReply('Confirmar')).toBe(true);
    expect(isConfirmationQuickReply('Confirmar plan')).toBe(true);
    expect(isConfirmationQuickReply('Confirmar misión')).toBe(true);
    expect(isConfirmationQuickReply('Confirmar mision secundaria')).toBe(true);
    expect(isConfirmationQuickReply('Confirmar creación')).toBe(true);
    expect(isConfirmationQuickReply('Confirmar y guardar')).toBe(true);
    expect(isConfirmationQuickReply('Sí, confirmar')).toBe(true);
    expect(isConfirmationQuickReply('Listo, guardar')).toBe(true);
    expect(isConfirmationQuickReply('Guardar plan')).toBe(true);
    expect(isConfirmationQuickReply('Aceptar y guardar!')).toBe(true);
  });

  it('rejects non-confirmation, partial, or multi-select replies', () => {
    expect(isConfirmationQuickReply('')).toBe(false);
    expect(isConfirmationQuickReply('Confirmar · Cambiar duración')).toBe(false);
    expect(isConfirmationQuickReply('Confirmar horario de 19:30')).toBe(false);
    expect(isConfirmationQuickReply('Cambiar a 21 días')).toBe(false);
    expect(isConfirmationQuickReply('Sí, pero agregá lectura')).toBe(false);
  });
});
