/**
 * Carga el catalogo de Descubrir con los reels de los creadores de
 * scripts/catalogo-creadores.json, usando el mismo motor que la app
 * (la funcion `importar`). Uso:
 *
 *   npx tsx scripts/catalogo.ts            importa lo que falte
 *   npx tsx scripts/catalogo.ts --probar   solo lista los reels, sin importar
 *
 * La primera vez crea la cuenta del catalogo (anonima) y pide marcarla con
 * es_catalogo = true por SQL: sin esa marca no puede escribir en el catalogo.
 * Costo aproximado: US$0,003 por reel listado en Apify y ~US$0,005 por receta.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ETIQUETAS } from '../src/lib/etiquetas';

type Plataforma = 'instagram' | 'tiktok';
type Creador = { plataforma: Plataforma; usuario: string; cantidad?: number };
type Reel = { url: string; titulo: string };
type Perfil = { nombre: string | null; foto: string | null };

const RAIZ = resolve(__dirname, '..');
const SESION = resolve(__dirname, '.catalogo-sesion.json');
const PROBAR = process.argv.includes('--probar');
const EN_PARALELO = 3;

function leerEnv(ruta: string): Record<string, string> {
  if (!existsSync(ruta)) return {};
  const pares = readFileSync(ruta, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]);
  return Object.fromEntries(pares);
}

const env = { ...leerEnv(resolve(RAIZ, 'spikes/extraction/.env')), ...leerEnv(resolve(RAIZ, '.env')) };
const URL_SUPABASE = env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const APIFY = env.APIFY_TOKEN;
const GEMINI = env.GEMINI_API_KEY;
const MODELO = env.GEMINI_MODEL || 'gemini-2.5-flash';

// La sesion vive en un archivo local ignorado por git
const almacen = {
  getItem: (k: string) => (existsSync(SESION) ? (JSON.parse(readFileSync(SESION, 'utf8'))[k] ?? null) : null),
  setItem: (k: string, v: string) => {
    const actual = existsSync(SESION) ? JSON.parse(readFileSync(SESION, 'utf8')) : {};
    writeFileSync(SESION, JSON.stringify({ ...actual, [k]: v }));
  },
  removeItem: (k: string) => {
    if (!existsSync(SESION)) return;
    const actual = JSON.parse(readFileSync(SESION, 'utf8'));
    delete actual[k];
    writeFileSync(SESION, JSON.stringify(actual));
  },
};

async function cuenta(): Promise<SupabaseClient> {
  const sb = createClient(URL_SUPABASE, ANON, { auth: { storage: almacen, persistSession: true, autoRefreshToken: true } });
  let { data } = await sb.auth.getSession();
  if (!data.session) {
    const r = await sb.auth.signInAnonymously();
    if (r.error) throw r.error;
    data = { session: r.data.session };
  }
  const id = data.session!.user.id;
  const { data: perfil } = await sb.from('profiles').select('es_catalogo').eq('id', id).single();
  if (!perfil?.es_catalogo) {
    console.log(`\nLa cuenta del catalogo es ${id}. Marcala y vuelve a correr el script:\n`);
    console.log(`  update public.profiles set es_catalogo = true where id = '${id}';\n`);
    process.exit(1);
  }
  return sb;
}

// ------------------------------------------------------------------ Apify

async function apify<T>(actor: string, entrada: unknown): Promise<T[]> {
  const res = await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${APIFY}&timeout=240`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(entrada),
  });
  if (!res.ok) throw new Error(`apify ${actor} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T[];
}

/** Ultimos reels con video y los datos del perfil, en una o dos llamadas. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function listar(c: Creador): Promise<{ perfil: Perfil; reels: Reel[] }> {
  const n = c.cantidad ?? 12;
  if (c.plataforma === 'instagram') {
    const url = `https://www.instagram.com/${c.usuario}/`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [detalle] = await apify<any>('apify~instagram-scraper', { directUrls: [url], resultsType: 'details', resultsLimit: 1 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const posts = await apify<any>('apify~instagram-scraper', { directUrls: [url], resultsType: 'posts', resultsLimit: n * 2, addParentData: false });
    return {
      perfil: { nombre: detalle?.fullName || null, foto: detalle?.profilePicUrlHD || detalle?.profilePicUrl || null },
      reels: posts
        .filter((p) => p.type === 'Video' && p.url)
        .slice(0, n)
        .map((p) => ({ url: String(p.url).replace(/\/p\//, '/reel/'), titulo: String(p.caption ?? '').slice(0, 60) })),
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const videos = await apify<any>('clockworks~tiktok-scraper', {
    profiles: [c.usuario],
    resultsPerPage: n,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadAvatars: false,
  });
  const autor = videos[0]?.authorMeta;
  return {
    perfil: { nombre: autor?.nickName || null, foto: autor?.avatar || null },
    reels: videos.filter((v) => v.webVideoUrl).map((v) => ({ url: v.webVideoUrl, titulo: String(v.text ?? '').slice(0, 60) })),
  };
}

// --------------------------------------------------------------- creador

async function guardarCreador(sb: SupabaseClient, c: Creador, p: Perfil): Promise<string> {
  let foto: string | null = null;
  if (p.foto) {
    try {
      const res = await fetch(p.foto);
      if (res.ok) {
        const ruta = `creadores/${c.plataforma}-${c.usuario.replace(/[^a-z0-9._-]/gi, '_')}.jpg`;
        const { error } = await sb.storage.from('recetas').upload(ruta, new Uint8Array(await res.arrayBuffer()), { contentType: 'image/jpeg', upsert: true });
        if (!error) foto = sb.storage.from('recetas').getPublicUrl(ruta).data.publicUrl;
        else console.warn(`  foto de ${c.usuario}: ${error.message}`);
      }
    } catch (e) {
      console.warn(`  foto de ${c.usuario}: ${(e as Error).message}`);
    }
  }
  const url = c.plataforma === 'instagram' ? `https://www.instagram.com/${c.usuario}` : `https://www.tiktok.com/@${c.usuario}`;
  const { data, error } = await sb
    .from('creadores')
    .upsert({ plataforma: c.plataforma, usuario: c.usuario, nombre: p.nombre, url, ...(foto ? { foto_path: foto } : {}) }, { onConflict: 'plataforma,usuario' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

// ------------------------------------------------------------- importar

async function importar(sb: SupabaseClient, url: string): Promise<{ extraccion: string; quality: string } | null> {
  const { data, error } = await sb.functions.invoke<{ jobId: string }>('importar', { body: { url } });
  if (error || !data?.jobId) throw new Error(`importar: ${error?.message ?? 'sin trabajo'}`);
  // Hasta 4 minutos: los videos largos pasan por Whisper o Gemini
  for (let i = 0; i < 160; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const { data: t } = await sb.from('import_jobs').select('status, extraction_id, quality, failure_reason').eq('id', data.jobId).single();
    if (t?.status === 'done') return t.extraction_id ? { extraccion: t.extraction_id, quality: t.quality ?? 'partial' } : null;
    if (t?.status === 'failed') {
      console.warn(`  fallo: ${t.failure_reason}`);
      return null;
    }
  }
  console.warn('  se acabo el tiempo de espera');
  return null;
}

/** Elige etiquetas de la lista fija con una llamada corta a Gemini. */
async function etiquetar(receta: unknown): Promise<string[]> {
  const ids = ETIQUETAS.map((e) => `${e.id} (${e.nombre})`).join(', ');
  const prompt = `Elige de 1 a 3 etiquetas para esta receta, SOLO de esta lista: ${ids}. "rapidas" solo si en total toma menos de 30 minutos. Responde un arreglo JSON de ids.\n\n${JSON.stringify(receta).slice(0, 6000)}`;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${GEMINI}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 },
      }),
    });
    const json = await res.json();
    const texto = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
    const validas = new Set(ETIQUETAS.map((e) => e.id));
    return (JSON.parse(texto) as string[]).filter((x) => validas.has(x)).slice(0, 3);
  } catch {
    return [];
  }
}

async function procesarReel(sb: SupabaseClient, creadorId: string, reel: Reel) {
  const r = await importar(sb, reel.url);
  if (!r) return 'fallo';
  if (r.quality !== 'complete') return 'incompleta';
  const { data: ext } = await sb.from('extractions').select('normalized_recipe').eq('id', r.extraccion).single();
  const n = ext?.normalized_recipe as { title?: string; ingredients?: unknown[]; image_path?: string | null } | undefined;
  if (!n?.ingredients?.length || !n.image_path) return 'incompleta';
  const etiquetas = await etiquetar({ title: n.title, ingredients: n.ingredients });
  const { error } = await sb
    .from('descubrir_recetas')
    .upsert({ extraction_id: r.extraccion, creador_id: creadorId, etiquetas }, { onConflict: 'extraction_id', ignoreDuplicates: true });
  if (error) throw error;
  console.log(`  ✓ ${n.title} [${etiquetas.join(', ')}]`);
  return 'ok';
}

async function main() {
  const creadores = JSON.parse(readFileSync(resolve(__dirname, 'catalogo-creadores.json'), 'utf8')) as Creador[];
  if (!creadores.length) throw new Error('scripts/catalogo-creadores.json esta vacio');
  const sb = PROBAR ? null : await cuenta();
  const resumen = { ok: 0, incompleta: 0, fallo: 0 };

  for (const c of creadores) {
    console.log(`\n${c.plataforma} @${c.usuario}`);
    let lista: Awaited<ReturnType<typeof listar>>;
    try {
      lista = await listar(c);
    } catch (e) {
      console.warn(`  no se pudo listar: ${(e as Error).message}`);
      continue;
    }
    console.log(`  ${lista.reels.length} reels${lista.perfil.nombre ? ` · ${lista.perfil.nombre}` : ''}`);
    if (PROBAR || !sb) {
      for (const r of lista.reels) console.log(`  - ${r.url}  ${r.titulo}`);
      continue;
    }
    const creadorId = await guardarCreador(sb, c, lista.perfil);
    // De a pocos: el servidor procesa en segundo plano y Apify tiene limites
    for (let i = 0; i < lista.reels.length; i += EN_PARALELO) {
      const tanda = lista.reels.slice(i, i + EN_PARALELO);
      const resultados = await Promise.all(
        tanda.map((r) => procesarReel(sb, creadorId, r).catch((e) => (console.warn(`  ${r.url}: ${(e as Error).message}`), 'fallo' as const)))
      );
      for (const x of resultados) resumen[x as keyof typeof resumen]++;
    }
  }
  if (!PROBAR) console.log(`\nListo: ${resumen.ok} publicadas, ${resumen.incompleta} incompletas (no entran), ${resumen.fallo} fallidas.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
