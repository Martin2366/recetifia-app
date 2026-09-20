#!/usr/bin/env node
// Genera out/VERIFICAR.md: una hoja corta para comprobar a mano si los pasos
// que saco la IA del audio son reales o inventados. No llama a ninguna API.
//
//   node verificar.js [cuantas]

import { readFile, writeFile } from 'node:fs/promises';

const CUANTAS = Number(process.argv[2]) || 8;

const d = JSON.parse(await readFile('out/resultados.json', 'utf8'));

// Solo las que vinieron del audio: son las unicas donde cabe que la IA invente.
const candidatas = d.filter(({ fila }) =>
  (fila.transcripcion_chars > 0 || fila.origen_audio) && fila.pasos >= 2);

// Mezcla equilibrada: las tres vias de audio tienen riesgos distintos.
const porFuente = { instagram: [], tiktok: [], youtube: [] };
for (const r of candidatas) porFuente[r.fila.source]?.push(r);

const elegidas = [];
const cupo = { instagram: 3, tiktok: 3, youtube: 2 };
for (const [fuente, n] of Object.entries(cupo)) elegidas.push(...(porFuente[fuente] || []).slice(0, n));
for (const r of candidatas) {
  if (elegidas.length >= CUANTAS) break;
  if (!elegidas.includes(r)) elegidas.push(r);
}
elegidas.length = Math.min(elegidas.length, CUANTAS);

const VIA = {
  whisper: 'audio del video transcrito con Whisper',
  subtitulos: 'subtitulos automaticos de TikTok',
  gemini: 'Gemini escuchando el video de YouTube',
};

const out = [
  '# Verificacion — ¿los pasos son reales o inventados?',
  '',
  `Son ${elegidas.length} recetas. Todas salieron **del audio del video**, que es el unico`,
  'sitio donde la IA podria haberse inventado algo.',
  '',
  '## Que tienes que hacer',
  '',
  '1. Abre el enlace y **mira el video**.',
  '2. Lee los pasos de abajo.',
  '3. En la linea `RESPUESTA:` borra los `???` y escribe **OK** o **INVENTADO**.',
  '4. Si pones INVENTADO, escribe al lado en una frase que se invento.',
  '',
  'Ejemplo de como queda una vez respondida:',
  '',
  '```',
  'RESPUESTA: OK',
  'RESPUESTA: INVENTADO — dice 20 minutos al horno y en el video son 40',
  '```',
  '',
  'No hay notas del 1 al 5. Solo OK o INVENTADO.',
  '',
  'Guarda el archivo cuando acabes y avisame.',
  '',
  '---',
  '',
];

elegidas.forEach((r, i) => {
  const f = r.fila;
  const via = VIA[(f.origen_audio || 'whisper').split(':')[0]] || 'audio';

  out.push(`## ${i + 1} de ${elegidas.length} · ${f.titulo}`);
  out.push('');
  out.push(`**Mira el video:** ${f.url}`);
  out.push('');
  out.push(`*Fuente: ${f.source} · los pasos salieron de: ${via}*`);
  out.push('');
  out.push('**Pasos que extrajo la IA:**');
  out.push('');
  (r.receta?.pasos || []).forEach((p, k) => out.push(`${k + 1}. ${p}`));
  out.push('');
  out.push('**Ingredientes:**');
  out.push('');
  const ings = r.receta?.ingredientes_texto
    || (r.receta?.ingredientes || []).map((x) => x.texto_original || x.nombre);
  ings.forEach((x) => out.push(`- ${x}`));
  out.push('');
  out.push('```');
  out.push('RESPUESTA: ???');
  out.push('```');
  out.push('');
  out.push('---');
  out.push('');
});

out.push('## Cuando termines');
out.push('');
out.push('| Resultado | Que hacemos |');
out.push('|---|---|');
out.push('| 7 u 8 OK | Arrancamos la app |');
out.push('| 2 o mas INVENTADO | Endurecemos el prompt antes de construir nada |');
out.push('');

await writeFile('out/VERIFICAR.md', out.join('\n'), 'utf8');

console.log(`\nEscrito: out/VERIFICAR.md con ${elegidas.length} recetas\n`);
for (const r of elegidas) {
  console.log(`  ${r.fila.source.padEnd(10)} ${r.fila.pasos} pasos · ${r.fila.titulo.slice(0, 45)}`);
}
console.log('');
