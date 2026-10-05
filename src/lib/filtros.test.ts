import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { agrupar, CATEGORIAS, ingredientesDe, opcionDe } from './filtros';

describe('ingredientesDe', () => {
  it('reconoce el nombre de cada pais', () => {
    assert.deepEqual(ingredientesDe(['1 palta madura']), ['palta']);
    assert.deepEqual(ingredientesDe(['2 aguacates']), ['palta']);
    assert.deepEqual(ingredientesDe(['1 taza de granos de elote']), ['choclo']);
    assert.deepEqual(ingredientesDe(['Frijoles negros']), ['porotos']);
  });

  it('ignora tildes, mayusculas y plurales', () => {
    assert.deepEqual(ingredientesDe(['200 g de CHAMPIÑONES']), ['champinon']);
    assert.deepEqual(ingredientesDe(['3 limones']), ['limon']);
  });

  it('exige palabra completa', () => {
    assert.deepEqual(ingredientesDe(['1 papaya']), []);
    assert.deepEqual(ingredientesDe(['4 papas cocidas']), ['papa']);
  });

  it('junta varios ingredientes sin repetir', () => {
    assert.deepEqual(ingredientesDe(['1 pechuga de pollo', 'arroz', 'pollo desmenuzado']).sort(), ['arroz', 'pollo']);
  });
});

describe('filtros', () => {
  it('agrupa por categoria', () => {
    assert.deepEqual(agrupar(['ing:pollo', 'tipo:cena', 'ing:arroz']), [['ing:pollo', 'ing:arroz'], ['tipo:cena']]);
  });

  it('cada filtro tiene nombre y los ids no se repiten', () => {
    assert.equal(opcionDe('cocina:peruana')?.nombre, 'Peruana');
    for (const c of CATEGORIAS) {
      const ids = c.opciones.map((o) => o.id);
      assert.equal(new Set(ids).size, ids.length, c.id);
    }
  });
});
