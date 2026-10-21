import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { agruparPorDia, textoDia } from './fechas';

const ahora = new Date(2026, 9, 21, 15, 0);
const en = (d: number, h = 12) => new Date(2026, 9, d, h).toISOString();

describe('textoDia', () => {
  it('hoy, ayer y fechas anteriores', () => {
    assert.equal(textoDia(en(21), ahora), 'Hoy, 21 de octubre de 2026');
    assert.equal(textoDia(en(20), ahora), 'Ayer, 20 de octubre de 2026');
    assert.equal(textoDia(new Date(2026, 4, 3, 9).toISOString(), ahora), '3 de mayo de 2026');
  });
});

describe('agruparPorDia', () => {
  it('pone un encabezado por dia y parte en filas de dos', () => {
    const recetas = [
      { id: 'a', created_at: en(21, 14) },
      { id: 'b', created_at: en(21, 10) },
      { id: 'c', created_at: en(21, 9) },
      { id: 'd', created_at: en(18) },
    ];
    const filas = agruparPorDia(recetas, 2, ahora);
    assert.deepEqual(
      filas.map((f) => (f.tipo === 'fecha' ? f.texto : f.recetas.map((r) => r.id).join(''))),
      ['Hoy, 21 de octubre de 2026', 'ab', 'c', '18 de octubre de 2026', 'd']
    );
  });

  it('sin recetas, sin filas', () => {
    assert.deepEqual(agruparPorDia([], 2, ahora), []);
  });
});
