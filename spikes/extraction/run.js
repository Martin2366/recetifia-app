#!/usr/bin/env node
// Fase 0 de Recetifia: mide si se puede sacar una receta utilizable desde enlaces reales.
// No es codigo de produccion. Es la prueba que decide si construimos la app o cambiamos de plan.

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { canonicalizeUrl, detectSource, truncate, jsonLdEsSuficiente } from './src/util.js';
import { fetchContent } from './src/fetchers.js';
import { listModels, structureRecipe, estimateCost } from './src/structure.js';
import { transcribeFile } from './src/transcribe.js';

try { process.loadEnvFile('.env'); } catch { /* sin .env: usamos el entorno tal cual */ }

const ENV = {
  geminiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || '',
  groqKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'whisper-large-v3-turbo',
  priceIn: Number(process.env.PRICE_IN_PER_M || 0.3),
  priceOut: Number(process.env.PRICE_OUT_PER_M || 2.5),
  delayMs: Number(process.env.GEMINI_DELAY_MS || 4500), // tier gratuito ~15 req/min
};

const MIN_TEXTO = 120; // por debajo de esto no merece la pena gastar una llamada a la IA

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- carga de URLs -----------------------------------------------------

async function loadUrls(file) {
  if (!existsSync(file)) {
    console.error(`${C.red}No existe ${file}.${C.reset}`);
    console.error('Crealo copiando urls.sample.txt y pon tus enlaces reales, uno por linea.');
    process.exit(1);
  }
  const raw = await readFile(file, 'utf8');
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((linea) => {
      // Formato: <url>  |  <ruta opcional a un archivo de audio/video local>
      const [url, media] = linea.split('|').map((s) => (s || '').trim());
      return { url, media: media || null };
    })
    .filter((e) => /^https?:\/\//i.test(e.url));
}

// --- procesado de un enlace -------------------------------------------

async function procesar(entrada, i, total) {
  const t0 = Date.now();
  const url = canonicalizeUrl(entrada.url);
  const source = detectSource(url);

  const fila = {
    n: i + 1, url, source,
    via: '', ruta: '', texto_chars: 0,
    ingredientes: 0, pasos: 0, confianza: '', motivo: '',
    tokens_in: 0, tokens_out: 0, coste_usd: 0,
    ms: 0, error: '', titulo: '', necesita_audio: false,
  };

  process.stdout.write(`${C.dim}[${i + 1}/${total}]${C.reset} ${C.cyan}${source}${C.reset} ${truncate(url, 70)}\n`);

  let contenido;
  try {
    // Pedimos la URL original: la canonica es solo la clave de cache, y quitarle
    // la barra final hace que algunos sitios devuelvan 404.
    contenido = await fetchContent(entrada.url, source);
  } catch (err) {
    fila.error = `fetch: ${String(err?.message || err)}`;
    fila.ms = Date.now() - t0;
    return { fila, receta: null, contenido: null };
  }

  fila.via = contenido.via.join(' + ') || 'nada';
  fila.texto_chars = contenido.texto.length;
  fila.titulo = contenido.titulo || '';

  // Camino 1: el blog traia un schema.org/Recipe COMPLETO. Exacto, gratis, sin IA.
  if (jsonLdEsSuficiente(contenido.jsonLdRecipe)) {
    const r = contenido.jsonLdRecipe;
    fila.ruta = 'json-ld';
    fila.titulo = r.titulo || fila.titulo;
    fila.ingredientes = r.ingredientes_texto.length;
    fila.pasos = r.pasos.length;
    fila.confianza = 'alta';
    fila.ms = Date.now() - t0;
    console.log(`   ${C.green}JSON-LD${C.reset} ${fila.ingredientes} ingredientes, ${fila.pasos} pasos, coste 0`);
    return { fila, receta: r, contenido };
  }

  // Habia JSON-LD pero venia pobre (ingredientes en una sola cadena, sin pasos...).
  // No lo tiramos: se lo pasamos a la IA como pista adicional.
  if (contenido.jsonLdRecipe) {
    const r = contenido.jsonLdRecipe;
    contenido.texto += `\n\n[Datos estructurados incompletos de la pagina]\n${JSON.stringify(r)}`;
    fila.via += ' + jsonld-parcial';
    fila.texto_chars = contenido.texto.length;
  }

  // Camino 2: no hay texto suficiente. Aqui es donde haria falta el audio.
  if (contenido.texto.length < MIN_TEXTO) {
    if (entrada.media && ENV.groqKey) {
      try {
        const tr = await transcribeFile(entrada.media, { apiKey: ENV.groqKey, model: ENV.groqModel });
        contenido.texto += `\n[Transcripcion del audio]\n${tr.texto}`;
        fila.via += ' + audio';
        fila.texto_chars = contenido.texto.length;
      } catch (err) {
        fila.error = `transcripcion: ${String(err?.message || err)}`;
      }
    }
    if (contenido.texto.length < MIN_TEXTO) {
      fila.ruta = 'texto-insuficiente';
      fila.necesita_audio = true;
      fila.confianza = 'baja';
      fila.motivo = `solo ${contenido.texto.length} caracteres de texto publico`;
      fila.ms = Date.now() - t0;
      console.log(`   ${C.yellow}TEXTO INSUFICIENTE${C.reset} (${contenido.texto.length} chars) -> necesitaria audio o captura`);
      return { fila, receta: null, contenido };
    }
  }

  // Camino 3: hay texto. Se lo damos a la IA.
  fila.ruta = fila.via.includes('audio') ? 'audio+ia' : 'texto+ia';
  try {
    const { receta, usage } = await structureRecipe({
      apiKey: ENV.geminiKey,
      model: ENV.geminiModel,
      texto: contenido.texto,
      contexto: { titulo: contenido.titulo, autor: contenido.autor },
    });
    fila.tokens_in = usage.in;
    fila.tokens_out = usage.out;
    fila.coste_usd = estimateCost(usage, ENV.priceIn, ENV.priceOut);
    fila.titulo = receta.titulo || fila.titulo;
    fila.ingredientes = receta.ingredientes?.length || 0;
    fila.pasos = receta.pasos?.length || 0;
    fila.confianza = receta.confianza || '';
    fila.motivo = receta.motivo || '';
    fila.ms = Date.now() - t0;

    const color = fila.confianza === 'alta' ? C.green : fila.confianza === 'media' ? C.yellow : C.red;
    console.log(`   ${color}${fila.confianza.toUpperCase()}${C.reset} "${truncate(fila.titulo, 50)}" · ${fila.ingredientes} ing · ${fila.pasos} pasos · $${fila.coste_usd.toFixed(5)}`);
    return { fila, receta, contenido };
  } catch (err) {
    fila.error = `gemini: ${String(err?.message || err)}`;
    fila.ms = Date.now() - t0;
    console.log(`   ${C.red}ERROR${C.reset} ${fila.error}`);
    return { fila, receta: null, contenido };
  }
}

// --- salidas -----------------------------------------------------------

function toCsv(filas) {
  const cols = ['n', 'source', 'ruta', 'via', 'texto_chars', 'titulo', 'ingredientes', 'pasos',
    'confianza', 'motivo', 'tokens_in', 'tokens_out', 'coste_usd', 'ms', 'necesita_audio', 'error', 'url'];
  const esc = (v) => {
    const s = String(v ?? '').replace(/"/g, '""');
    return /[",\n;]/.test(s) ? `"${s}"` : s;
  };
  return [cols.join(','), ...filas.map((f) => cols.map((c) => esc(f[c])).join(','))].join('\n');
}

function toRevision(resultados) {
  const out = [
    '# Revision manual — Fase 0', '',
    'Puntua cada receta de 1 a 5 sustituyendo la interrogacion en la fila NOTA.', '',
    '- **5**: la cocinaria tal cual',
    '- **4**: utilizable con un retoque menor',
    '- **3**: sirve de base pero hay que trabajarla',
    '- **2**: mas rapido escribirla a mano',
    '- **1**: inservible, o no era una receta',
    '', '---', '',
  ];

  for (const { fila, receta } of resultados) {
    out.push(`## ${fila.n}. ${fila.titulo || '(sin titulo)'}`, '');
    out.push('| | |', '|---|---|');
    out.push(`| Fuente | ${fila.source} |`);
    out.push(`| Ruta | ${fila.ruta || '—'} |`);
    out.push(`| Obtenido via | ${fila.via} |`);
    out.push(`| Confianza IA | ${fila.confianza || '—'}${fila.motivo ? ` (${fila.motivo})` : ''} |`);
    out.push(`| Coste | $${(fila.coste_usd || 0).toFixed(5)} |`);
    out.push(`| Tiempo | ${(fila.ms / 1000).toFixed(1)} s |`);
    out.push(`| Enlace | ${fila.url} |`);
    out.push('| **NOTA (1-5)** | **?** |', '');

    if (fila.error) out.push(`> ERROR: ${fila.error}`, '');

    if (receta) {
      const ings = receta.ingredientes_texto
        || (receta.ingredientes || []).map((i) => i.texto_original || i.nombre);
      if (ings?.length) {
        out.push('**Ingredientes**', '');
        ings.forEach((i) => out.push(`- ${i}`));
        out.push('');
      }
      if (receta.pasos?.length) {
        out.push('**Pasos**', '');
        receta.pasos.forEach((p, k) => out.push(`${k + 1}. ${p}`));
        out.push('');
      }
    }
    out.push('---', '');
  }
  return out.join('\n');
}

function resumen(filas) {
  const total = filas.length;
  const utilizable = (f) => !f.error && (f.confianza === 'alta' || (f.ingredientes >= 3 && f.pasos >= 2));
  const ok = filas.filter(utilizable).length;
  const pct = total ? (ok / total) * 100 : 0;
  const coste = filas.reduce((a, f) => a + (f.coste_usd || 0), 0);
  const ms = filas.reduce((a, f) => a + f.ms, 0) / (total || 1);

  const porFuente = {};
  for (const f of filas) {
    porFuente[f.source] ??= { total: 0, ok: 0 };
    porFuente[f.source].total++;
    if (utilizable(f)) porFuente[f.source].ok++;
  }

  console.log(`\n${C.bold}== RESULTADO ==${C.reset}\n`);
  console.log(`  Enlaces procesados     ${total}`);
  console.log(`  Utilizables (auto)     ${ok}  (${pct.toFixed(0)}%)`);
  console.log(`  Coste total            $${coste.toFixed(4)}`);
  console.log(`  Coste medio            $${(coste / (total || 1)).toFixed(5)} por importacion`);
  console.log(`  Tiempo medio           ${(ms / 1000).toFixed(1)} s`);
  console.log(`  Sin texto suficiente   ${filas.filter((f) => f.necesita_audio).length}`);
  console.log(`  Resueltos por JSON-LD  ${filas.filter((f) => f.ruta === 'json-ld').length}  ${C.dim}(gratis, sin IA)${C.reset}`);
  console.log(`  Errores                ${filas.filter((f) => f.error).length}`);

  console.log(`\n  ${C.bold}Por fuente${C.reset}`);
  for (const [src, v] of Object.entries(porFuente)) {
    const p = (v.ok / v.total) * 100;
    const col = p >= 70 ? C.green : p >= 40 ? C.yellow : C.red;
    console.log(`    ${src.padEnd(12)} ${col}${v.ok}/${v.total}${C.reset}  (${p.toFixed(0)}%)`);
  }

  console.log(`\n  ${C.bold}Puerta de decision${C.reset} ${C.dim}(fijada antes de mirar los datos)${C.reset}`);
  if (pct >= 70) console.log(`    ${C.green}>= 70%: seguimos con la arquitectura prevista.${C.reset}`);
  else if (pct >= 40) console.log(`    ${C.yellow}40-70%: seguimos, pero el fallback de captura/video pasa a primer plano en la UI.${C.reset}`);
  else console.log(`    ${C.red}< 40%: parar y replantear (proveedor de pago, o pivotar a "captura primero").${C.reset}`);

  console.log(`\n  ${C.dim}Esto es la puntuacion automatica. La que manda es tu nota manual en out/revision.md${C.reset}\n`);
}

// --- main --------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--list-models')) {
    if (!ENV.geminiKey) { console.error('Falta GEMINI_API_KEY en .env'); process.exit(1); }
    const models = await listModels(ENV.geminiKey);
    console.log(`\nModelos disponibles para tu clave (${models.length}):\n`);
    for (const m of models) console.log(`  ${m.name.padEnd(42)} ${C.dim}${m.display}${C.reset}`);
    console.log('\nElige uno y ponlo en GEMINI_MODEL dentro de .env.');
    console.log('Para este spike interesa un Flash: barato y suficiente.\n');
    return;
  }

  if (!ENV.geminiKey) { console.error(`${C.red}Falta GEMINI_API_KEY en .env${C.reset}`); process.exit(1); }
  if (!ENV.geminiModel) {
    console.error(`${C.red}Falta GEMINI_MODEL en .env.${C.reset} Ejecuta primero: npm run models`);
    process.exit(1);
  }

  const file = args.find((a) => !a.startsWith('--')) || 'urls.txt';
  const entradas = await loadUrls(file);

  console.log(`\n${C.bold}Fase 0 — spike de extraccion${C.reset}`);
  console.log(`${C.dim}${entradas.length} enlaces · modelo ${ENV.geminiModel} · audio ${ENV.groqKey ? 'activado' : 'desactivado'}${C.reset}\n`);

  const resultados = [];
  for (let i = 0; i < entradas.length; i++) {
    const r = await procesar(entradas[i], i, entradas.length);
    resultados.push(r);
    if (r.fila.ruta.includes('ia') && i < entradas.length - 1) await sleep(ENV.delayMs);
  }

  const filas = resultados.map((r) => r.fila);
  await writeFile('out/resultados.json', JSON.stringify(resultados, null, 2), 'utf8');
  await writeFile('out/resultados.csv', toCsv(filas), 'utf8');
  await writeFile('out/revision.md', toRevision(resultados), 'utf8');

  resumen(filas);
  console.log('  Escrito: out/resultados.csv · out/resultados.json · out/revision.md\n');
}

main().catch((err) => { console.error(err); process.exit(1); });
