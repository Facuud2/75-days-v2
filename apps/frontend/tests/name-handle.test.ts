import { describe, expect, it } from 'vitest';
import { getNameHandle, getInitial } from '@/lib/utils/display';

describe('getNameHandle', () => {
  it('normaliza el nombre a una arroba legible', () => {
    expect(getNameHandle('Luna Prueba')).toBe('lunaprueba');
    expect(getNameHandle('  Facu  ')).toBe('facu');
    expect(getNameHandle('Ñandú Marín')).toBe('nandumarin');
    expect(getNameHandle('Luna_75')).toBe('luna75');
  });

  it('recorta a 15 caracteres como Twitter', () => {
    expect(getNameHandle('a'.repeat(40))).toHaveLength(15);
  });

  it('devuelve null cuando no queda nada usable', () => {
    expect(getNameHandle('')).toBeNull();
    expect(getNameHandle(null)).toBeNull();
    expect(getNameHandle('   ')).toBeNull();
    expect(getNameHandle('🎉🎉')).toBeNull();
  });

  it('sigue dando una inicial para un nombre sin letras ASCII', () => {
    expect(getInitial('🎉')).toBeTruthy();
  });
});
