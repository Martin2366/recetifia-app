import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatoReloj, tiemposDelPaso } from './tiempos';

const textos = (t: string, d?: number) => tiemposDelPaso(t, d).map((x) => x.texto);

test('lee minutos, horas y segundos', () => {
  assert.deepEqual(textos('Hornea durante 15 minutos'), ['15 min']);
  assert.deepEqual(textos('cocina 1 h 30 min'), ['1 h 30 min']);
  assert.deepEqual(textos('hierve 2 horas y 15 minutos'), ['2 h 15 min']);
  assert.deepEqual(textos('saltea por 30 segundos'), ['30 s']);
  assert.deepEqual(textos('Sofreír durante 1 minuto'), ['1 min']);
});

test('en un rango usa el mayor', () => {
  assert.deepEqual(textos('Hornea 10-12 min'), ['12 min']);
  assert.deepEqual(textos('Cocina durante 5 a 7 minutos'), ['7 min']);
  assert.deepEqual(textos('Hornear entre 15 y 20 minutos'), ['20 min']);
});

test('frases sin cifra', () => {
  assert.deepEqual(textos('Remojar el pan con la leche por media hora.'), ['30 min']);
  assert.deepEqual(textos('deja reposar un cuarto de hora'), ['15 min']);
});

test('"unos 3 minutos" no se confunde con segundos', () => {
  assert.deepEqual(textos('En una sartén sofreír la cebolla, por unos 3 minutos.'), ['3 min']);
});

test('sin tiempo no inventa nada', () => {
  assert.deepEqual(textos('Cocina por unos minutos hasta que esté dorada.'), []);
  assert.deepEqual(textos('Agrega una cebolla y 2 tazas de agua'), []);
  assert.deepEqual(textos('Calienta el aceite a 180 °C'), []);
});

test('duration_seconds del paso va primero y no se repite', () => {
  assert.deepEqual(textos('Hornea 20 minutos', 1200), ['20 min']);
  assert.deepEqual(textos('Hornea 20 minutos', 600), ['10 min', '20 min']);
});

test('reloj', () => {
  assert.equal(formatoReloj(65), '1:05');
  assert.equal(formatoReloj(3725), '1:02:05');
  assert.equal(formatoReloj(-3), '0:00');
});
