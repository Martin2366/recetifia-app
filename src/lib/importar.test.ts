import assert from 'node:assert/strict';
import { test } from 'node:test';

import { esEnlace, esRedSocial, RecetaNoEncontrada, recetaDesdeHtml, recetaDesdeTexto } from './importar';

test('texto con cabeceras: separa ingredientes y pasos', () => {
  const r = recetaDesdeTexto(`Queque de plátano

Ingredientes:
- 3 plátanos maduros
- 2 huevos
- Sal al gusto

Preparación:
1. Moler los plátanos con un tenedor.
2. Mezclar con los huevos y hornear 40 minutos.`);

  assert.equal(r.title, 'Queque de plátano');
  assert.deepEqual(
    r.ingredients?.map((i) => i.raw_text),
    ['3 plátanos maduros', '2 huevos', 'Sal al gusto']
  );
  assert.deepEqual(
    r.steps?.map((s) => s.text),
    ['Moler los plátanos con un tenedor.', 'Mezclar con los huevos y hornear 40 minutos.']
  );
  assert.equal(r.status, 'complete');
  assert.equal(r.source_type, 'text');
});

test('texto sin cabeceras: adivina por la forma de cada linea', () => {
  const r = recetaDesdeTexto(`Arroz graneado
2 tazas de arroz
1 diente de ajo
Sofreír el ajo en aceite y luego agregar el arroz lavado.`);

  assert.deepEqual(r.ingredients?.map((i) => i.raw_text), ['2 tazas de arroz', '1 diente de ajo']);
  assert.equal(r.steps?.length, 1);
});

test('texto sin pasos queda por revisar', () => {
  assert.equal(recetaDesdeTexto('Solo un título\n2 huevos').status, 'needs_review');
});

test('json-ld dentro de @graph, con HowToStep y tiempos ISO', () => {
  const html = `<html><head>
    <script type="application/ld+json">{"@context":"https://schema.org","@graph":[
      {"@type":"WebSite","name":"Blog"},
      {"@type":["Recipe"],"name":"Pie de limón &amp; merengue","recipeYield":["8 porciones"],
       "prepTime":"PT20M","cookTime":"PT1H","image":[{"url":"https://x.cl/pie.jpg"}],
       "author":{"@type":"Person","name":"Ana"},
       "recipeIngredient":["1 lata de leche condensada","4 limones"],
       "recipeInstructions":[{"@type":"HowToSection","itemListElement":[
         {"@type":"HowToStep","text":"Mezclar la leche con el jugo."},
         {"@type":"HowToStep","text":"Hornear 15 minutos."}]}]}
    ]}</script></head></html>`;

  const r = recetaDesdeHtml(html, 'https://x.cl/pie');
  assert.equal(r.title, 'Pie de limón & merengue');
  assert.equal(r.servings, 8);
  assert.equal(r.prep_minutes, 20);
  assert.equal(r.cook_minutes, 60);
  assert.equal(r.image_path, 'https://x.cl/pie.jpg');
  assert.equal(r.source_author, 'Ana');
  assert.equal(r.ingredients?.length, 2);
  assert.deepEqual(r.steps?.map((s) => s.text), ['Mezclar la leche con el jugo.', 'Hornear 15 minutos.']);
});

test('pagina sin receta lanza RecetaNoEncontrada', () => {
  assert.throws(() => recetaDesdeHtml('<html><body>Hola</body></html>', 'https://x.cl'), RecetaNoEncontrada);
});

test('enlaces y redes sociales', () => {
  assert.ok(esEnlace('recetasgratis.net/receta-de-pan'));
  assert.ok(!esEnlace('pan amasado'));
  assert.ok(esRedSocial('https://www.instagram.com/reel/abc'));
  assert.ok(!esRedSocial('https://www.recetasgratis.net/x'));
});
