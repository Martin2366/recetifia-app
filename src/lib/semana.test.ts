import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { diasDeSemana, etiquetaRelativa, lunesDe, nombreDia, rangoSemana, sumarDias } from './semana';

describe('lunesDe', () => {
  it('el lunes es su propio lunes', () => {
    assert.equal(lunesDe('2026-10-05'), '2026-10-05');
  });

  it('el domingo pertenece a la semana que termina', () => {
    assert.equal(lunesDe('2026-10-11'), '2026-10-05');
  });

  it('cruza meses y años', () => {
    assert.equal(lunesDe('2026-10-01'), '2026-09-28');
    assert.equal(lunesDe('2027-01-02'), '2026-12-28');
  });
});

describe('sumarDias y diasDeSemana', () => {
  it('pasa de mes y de año', () => {
    assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
    assert.equal(sumarDias('2026-03-01', -1), '2026-02-28');
  });

  it('da siete dias seguidos desde el lunes', () => {
    assert.deepEqual(diasDeSemana('2026-09-28'), [
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
  });
});

describe('textos', () => {
  it('rango dentro de un mes, entre meses y entre años', () => {
    assert.equal(rangoSemana('2026-10-05'), '5 – 11 oct');
    assert.equal(rangoSemana('2026-09-28'), '28 sept – 4 oct');
    assert.equal(rangoSemana('2026-12-28'), '28 dic 2026 – 3 ene 2027');
  });

  it('nombre del dia y etiqueta relativa', () => {
    assert.equal(nombreDia('2026-10-07'), 'Miércoles 7');
    assert.equal(etiquetaRelativa('2026-10-05', '2026-10-05'), 'Hoy');
    assert.equal(etiquetaRelativa('2026-10-06', '2026-10-05'), 'Mañana');
    assert.equal(etiquetaRelativa('2026-10-08', '2026-10-05'), null);
  });
});
