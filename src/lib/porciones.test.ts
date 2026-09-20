import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { escalarCantidad, formatearCantidad, textoIngredienteEscalado } from './porciones';

describe('escalarCantidad', () => {
  it('escala de forma proporcional', () => {
    assert.equal(escalarCantidad(200, 2, 4), 400);
    assert.equal(escalarCantidad(200, 4, 2), 100);
  });

  it('deja la cantidad intacta si faltan las porciones', () => {
    assert.equal(escalarCantidad(200, null, 4), 200);
    assert.equal(escalarCantidad(200, 2, null), 200);
  });

  it('no divide por cero ni acepta porciones negativas', () => {
    assert.equal(escalarCantidad(200, 0, 4), 200);
    assert.equal(escalarCantidad(200, 2, -1), 200);
  });

  it('devuelve null cuando no hay cantidad', () => {
    assert.equal(escalarCantidad(null, 2, 4), null);
    assert.equal(escalarCantidad(undefined, 2, 4), null);
  });
});

describe('formatearCantidad', () => {
  it('usa fracciones de cocina', () => {
    assert.equal(formatearCantidad(0.5), '½');
    assert.equal(formatearCantidad(0.25), '¼');
    assert.equal(formatearCantidad(1.5), '1½');
    assert.equal(formatearCantidad(2.75), '2¾');
    assert.equal(formatearCantidad(0.333), '⅓');
  });

  it('no inventa fracciones donde no las hay', () => {
    assert.equal(formatearCantidad(1), '1');
    assert.equal(formatearCantidad(3), '3');
  });

  it('redondea los pesos, que nadie mide 133,333 g', () => {
    assert.equal(formatearCantidad(133.333, 'g'), '133');
    assert.equal(formatearCantidad(266.666, 'ml'), '267');
  });

  it('cae a un decimal cuando no hay fraccion limpia', () => {
    assert.equal(formatearCantidad(1.7), '1.7');
  });

  it('devuelve cadena vacia sin cantidad', () => {
    assert.equal(formatearCantidad(null), '');
  });
});

describe('textoIngredienteEscalado', () => {
  const base = { raw_text: '- 2 tazas de harina', quantity: 2, unit: 'taza', name_normalized: 'harina' };

  it('reconstruye la linea con la cantidad escalada', () => {
    assert.equal(textoIngredienteEscalado(base, 2, 4), '4 taza harina');
    assert.equal(textoIngredienteEscalado(base, 2, 1), '1 taza harina');
  });

  it('conserva el texto original cuando no se pudo parsear la cantidad', () => {
    const sinCantidad = { raw_text: 'Sal al gusto', quantity: null, unit: null, name_normalized: 'sal' };
    assert.equal(textoIngredienteEscalado(sinCantidad, 2, 4), 'Sal al gusto');
  });

  it('conserva el texto original si falta el nombre normalizado', () => {
    const sinNombre = { raw_text: '1 chorrito de aceite', quantity: 1, unit: null, name_normalized: null };
    assert.equal(textoIngredienteEscalado(sinNombre, 2, 4), '1 chorrito de aceite');
  });

  it('parte a la mitad con fracciones legibles', () => {
    const huevos = { raw_text: '3 huevos', quantity: 3, unit: null, name_normalized: 'huevos' };
    assert.equal(textoIngredienteEscalado(huevos, 4, 2), '1½ huevos');
  });
});
