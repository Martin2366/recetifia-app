// Smoke test de la capa de obtencion. No usa IA ni gasta credito.
// Comprueba que oEmbed, Open Graph y JSON-LD responden como esperamos.

import { fetchContent } from './src/fetchers.js';
import { detectSource, canonicalizeUrl, truncate } from './src/util.js';

const CASOS = [
  ['youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
  ['blog con JSON-LD completo', 'https://www.paulinacocina.net/arroz-con-pollo/'],
  ['blog que bloquea bots', 'https://www.allrecipes.com/recipe/223042/chicken-parmesan/'],
  ['canonicalizacion', 'https://www.tiktok.com/@x/video/123?is_from_webapp=1&sender_device=pc&utm_source=x'],
];

console.log('\nSmoke test de fetchers (sin IA)\n');

for (const [etiqueta, url] of CASOS) {
  const canon = canonicalizeUrl(url);
  const src = detectSource(canon);
  console.log(`- ${etiqueta}`);
  console.log(`  source detectado: ${src}`);
  if (canon !== url) console.log(`  canonicalizada:   ${canon}`);

  if (etiqueta === 'canonicalizacion') { console.log(''); continue; }

  const t0 = Date.now();
  const r = await fetchContent(canon, src);
  console.log(`  via:      ${r.via.join(' + ') || 'nada'}`);
  console.log(`  titulo:   ${truncate(r.titulo, 60) || '(ninguno)'}`);
  console.log(`  texto:    ${r.texto.length} chars`);
  console.log(`  json-ld:  ${r.jsonLdRecipe ? `SI (${r.jsonLdRecipe.ingredientes_texto.length} ing, ${r.jsonLdRecipe.pasos.length} pasos)` : 'no'}`);
  if (r.notas.length) console.log(`  notas:    ${r.notas.join(' | ')}`);
  console.log(`  ${Date.now() - t0} ms\n`);
}
