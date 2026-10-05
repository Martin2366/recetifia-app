// Edge Function "descubrir": llena Descubrir solo, con lo que mas se ve en
// redes. La llama pg_cron cada 10 minutos (ver migracion 0018) y cada llamada
// avanza un poco, sin pasar nunca el limite de tiempo de una funcion:
//
//   1. una vez por semana lanza las busquedas por hashtag en Apify (asincronas)
//   2. recoge lo que encontraron: reels en espanol, recientes y con muchas
//      vistas, como mucho 3 por creador; quedan como candidatos
//   3. importa los mejores de a pocos con la funcion `importar` (la cuenta del
//      catalogo, sin cuota), con la cache y el freno de gasto de siempre
//   4. publica las recetas completas con sus numeros reales y etiquetas
//   5. completa la foto y los seguidores de los creadores nuevos
//
// Gasto acotado por ajustes.tope_descubrir_mes_usd (Apify + importaciones).

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { ETIQUETAS } from '../../../src/lib/etiquetas.ts';
import { CATEGORIAS, ingredientesDe } from '../../../src/lib/filtros.ts';

const ENV = {
  url: Deno.env.get('SUPABASE_URL')!,
  servicio: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  apify: Deno.env.get('APIFY_TOKEN') ?? '',
  gemini: Deno.env.get('GEMINI_API_KEY') ?? '',
  modelo: Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash',
  secreto: Deno.env.get('CATALOGO_SECRETO') ?? '',
  usuario: Deno.env.get('CATALOGO_USUARIO') ?? '',
};

type Plataforma = 'instagram' | 'tiktok';

/** Hashtags en espanol de LATAM y Espana; se rotan para variar cada semana. */
const HASHTAGS: Record<Plataforma, string[]> = {
  instagram: ['recetasfaciles', 'recetascaseras', 'recetaschilenas', 'recetasperuanas', 'recetasmexicanas', 'recetasargentinas', 'comidacasera', 'recetassaludables'],
  tiktok: ['recetasfaciles', 'recetascaseras', 'recetasmexicanas', 'recetasperuanas', 'comidachilena', 'recetascolombianas', 'recetasargentinas', 'recetasvenezolanas'],
};
const HASHTAGS_POR_BUSQUEDA = 5;
const RESULTADOS_POR_HASHTAG = 15;
/** Cuantas recetas nuevas por red y por semana. */
const POR_SEMANA = 18;
const MAX_POR_CREADOR = 3;
// Cada importacion lanza un actor de Apify de 4 GB y el plan tiene 16 GB en
// total, compartidos con las importaciones de las personas
const EN_PARALELO = 2;
/** Parte del saldo mensual de Apify que Descubrir puede usar: el resto es de la gente. */
const PARTE_APIFY = 0.6;
/** Fallas de un servicio (credito, cuotas), no de la receta: se reintenta despues. */
const FALLA_DE_SERVICIO = /prepayment|credits are depleted|memory limit|quota|rate limit|429|billing|exceed/i;
const DIAS_ENTRE_BUSQUEDAS = 6.5;
/** Solo lo reciente: "lo mas visto de la semana", no de hace un ano. */
const MAX_DIAS_PUBLICADO = 45;
const MIN_VISTAS: Record<Plataforma, number> = { instagram: 5_000, tiktok: 20_000 };

const ACTORES: Record<Plataforma, string> = {
  instagram: 'apify~instagram-hashtag-scraper',
  tiktok: 'clockworks~tiktok-scraper',
};
/** Costo aproximado por resultado de Apify, en USD (tarifas de los actores). */
const COSTE_RESULTADO: Record<Plataforma, number> = { instagram: 0.0026, tiktok: 0.004 };

function json(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (!ENV.secreto || req.headers.get('x-catalogo-secreto') !== ENV.secreto) return json({ error: 'no' }, 401);
  const cuerpo = await req.json().catch(() => ({}));
  const admin = createClient(ENV.url, ENV.servicio, { auth: { persistSession: false } });
  const log: string[] = [];
  const paso = async (nombre: string, f: () => Promise<void>) => {
    try {
      await f();
    } catch (e) {
      log.push(`${nombre}: ${(e as Error).message}`);
      console.error('descubrir', nombre, e);
    }
  };

  await paso('publicar', () => publicarTerminadas(admin, log));
  await paso('busquedas', () => revisarBusquedas(admin, log));
  await paso('importar', () => empezarImportaciones(admin, log));
  await paso('creadores', () => completarCreadores(admin, log));
  if (cuerpo?.buscar || (await tocaBuscar(admin, log))) await paso('buscar', () => buscar(admin, log));
  return json({ ok: true, log });
});

// ------------------------------------------------------------------ gasto

async function gastoDelMes(admin: SupabaseClient): Promise<number> {
  const inicio = new Date();
  inicio.setUTCDate(1);
  inicio.setUTCHours(0, 0, 0, 0);
  const [apify, imports] = await Promise.all([
    admin.from('gasto_ia').select('costo').eq('fuente', 'descubrir').gte('creado', inicio.toISOString()),
    admin.from('import_jobs').select('cost_usd').eq('user_id', ENV.usuario).gte('created_at', inicio.toISOString()),
  ]);
  const suma = (filas: { [k: string]: unknown }[] | null, k: string) => (filas ?? []).reduce((s, f) => s + Number(f[k] ?? 0), 0);
  return suma(apify.data, 'costo') + suma(imports.data, 'cost_usd');
}

/** Si Apify ya va cerca del limite del mes: entonces Descubrir espera. */
async function apifyAlLimite(log: string[]): Promise<boolean> {
  try {
    const r = await fetch(`https://api.apify.com/v2/users/me/limits?token=${ENV.apify}`);
    const d = (await r.json())?.data;
    const usado = Number(d?.current?.monthlyUsageUsd ?? 0);
    const maximo = Number(d?.limits?.maxMonthlyUsageUsd ?? 0);
    if (maximo && usado >= maximo * PARTE_APIFY) {
      log.push(`apify en ${usado.toFixed(2)} de ${maximo} USD: Descubrir espera`);
      return true;
    }
  } catch {
    // Sin respuesta de Apify no se frena: el tope propio en dolares sigue
  }
  return false;
}

/** Una pausa entre llamadas cuando un servicio fallo (credito agotado, limites). */
let servicioCaido = false;

async function tope(admin: SupabaseClient): Promise<number> {
  const { data } = await admin.from('ajustes').select('tope_descubrir_mes_usd').eq('id', true).single();
  return Number(data?.tope_descubrir_mes_usd ?? 6);
}

// ------------------------------------------------------------- 1. buscar

async function tocaBuscar(admin: SupabaseClient, log: string[]): Promise<boolean> {
  const { data: ultima } = await admin.from('descubrir_busquedas').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (ultima && Date.now() - new Date(ultima.created_at).getTime() < DIAS_ENTRE_BUSQUEDAS * 86_400_000) return false;
  const gasto = await gastoDelMes(admin);
  if (gasto >= (await tope(admin))) {
    log.push(`sin buscar: gasto del mes ${gasto.toFixed(2)} USD`);
    return false;
  }
  return !servicioCaido && !(await apifyAlLimite(log));
}

async function buscar(admin: SupabaseClient, log: string[]) {
  // Rota los hashtags: cada semana un grupo distinto
  const semana = Math.floor(Date.now() / (7 * 86_400_000));
  for (const plataforma of ['instagram', 'tiktok'] as Plataforma[]) {
    const lista = HASHTAGS[plataforma];
    const hashtags = Array.from({ length: HASHTAGS_POR_BUSQUEDA }, (_, i) => lista[(semana * HASHTAGS_POR_BUSQUEDA + i) % lista.length]);
    const entrada =
      plataforma === 'instagram'
        ? { hashtags, resultsLimit: RESULTADOS_POR_HASHTAG, resultsType: 'reels' }
        : { hashtags, resultsPerPage: RESULTADOS_POR_HASHTAG, shouldDownloadVideos: false, shouldDownloadCovers: false, shouldDownloadAvatars: false };
    const res = await fetch(`https://api.apify.com/v2/acts/${ACTORES[plataforma]}/runs?token=${ENV.apify}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(entrada),
    });
    if (!res.ok) throw new Error(`apify ${plataforma} ${res.status}`);
    const { data } = await res.json();
    await admin.from('descubrir_busquedas').insert({ plataforma, apify_run: data.id });
    await admin.from('gasto_ia').insert({ costo: hashtags.length * RESULTADOS_POR_HASHTAG * COSTE_RESULTADO[plataforma], fuente: 'descubrir' });
    log.push(`busqueda ${plataforma}: ${hashtags.join(', ')}`);
  }
}

// ---------------------------------------------------- 2. recoger resultados

type Candidato = {
  url: string;
  plataforma: Plataforma;
  usuario: string;
  nombre: string | null;
  avatar_url: string | null;
  seguidores: number | null;
  me_gusta: number | null;
  vistas: number | null;
  publicado_el: string | null;
  texto: string;
};

// deno-lint-ignore no-explicit-any
function normalizar(plataforma: Plataforma, it: any): Candidato | null {
  if (plataforma === 'instagram') {
    if (it.type !== 'Video' || !it.url || !it.ownerUsername) return null;
    return {
      url: String(it.url).replace('/p/', '/reel/'),
      plataforma,
      usuario: it.ownerUsername,
      nombre: it.ownerFullName || null,
      avatar_url: null,
      seguidores: null,
      me_gusta: it.likesCount ?? null,
      vistas: it.videoPlayCount ?? it.igPlayCount ?? it.videoViewCount ?? null,
      publicado_el: it.timestamp ?? null,
      texto: it.caption ?? '',
    };
  }
  if (!it.webVideoUrl || !it.authorMeta?.name) return null;
  return {
    url: it.webVideoUrl,
    plataforma,
    usuario: it.authorMeta.name,
    nombre: it.authorMeta.nickName || null,
    avatar_url: it.authorMeta.avatar || null,
    seguidores: it.authorMeta.fans ?? null,
    me_gusta: it.diggCount ?? null,
    vistas: it.playCount ?? null,
    publicado_el: it.createTimeISO ?? null,
    texto: it.text ?? '',
  };
}

const ES = /\b(receta|ingrediente|cucharad|taza|horno|sart[eé]n|sal|pimienta|ajo|cebolla|pollo|carne|minutos|preparaci[oó]n|delicios|f[aá]cil|rico|queda|para|con)\w*/gi;
const EN = /\b(the|and|recipe|with|cup|you|this|easy|how to)\b/gi;

/** Recetas en espanol: mas palabras de cocina en espanol que en ingles. */
export function enEspanol(texto: string): boolean {
  const es = texto.match(ES)?.length ?? 0;
  const en = texto.match(EN)?.length ?? 0;
  return es >= 3 && es > en * 2;
}

function puntaje(c: Candidato): number {
  const base = (c.vistas ?? (c.me_gusta ?? 0) * 25) / (c.plataforma === 'tiktok' ? 5 : 1);
  const dias = c.publicado_el ? (Date.now() - new Date(c.publicado_el).getTime()) / 86_400_000 : 30;
  return base / (1 + dias / 14);
}

async function revisarBusquedas(admin: SupabaseClient, log: string[]) {
  const { data: corriendo } = await admin.from('descubrir_busquedas').select('*').eq('estado', 'corriendo');
  for (const b of corriendo ?? []) {
    const r = await fetch(`https://api.apify.com/v2/actor-runs/${b.apify_run}?token=${ENV.apify}`);
    const estado = (await r.json())?.data?.status as string | undefined;
    if (estado === 'RUNNING' || estado === 'READY') continue;
    if (estado !== 'SUCCEEDED') {
      await admin.from('descubrir_busquedas').update({ estado: 'fallida' }).eq('id', b.id);
      log.push(`busqueda ${b.plataforma} ${estado}`);
      continue;
    }
    const items = await (await fetch(`https://api.apify.com/v2/actor-runs/${b.apify_run}/dataset/items?token=${ENV.apify}&clean=true`)).json();
    const plataforma = b.plataforma as Plataforma;
    const vistos = new Set<string>();
    const elegidos: (Candidato & { puntaje: number })[] = [];
    const porCreador = new Map<string, number>();
    const candidatos = (items as unknown[])
      .map((it) => normalizar(plataforma, it))
      .filter((c): c is Candidato => Boolean(c))
      .filter((c) => (c.vistas ?? 0) >= MIN_VISTAS[plataforma] || (c.me_gusta ?? 0) * 25 >= MIN_VISTAS[plataforma])
      .filter((c) => !c.publicado_el || Date.now() - new Date(c.publicado_el).getTime() < MAX_DIAS_PUBLICADO * 86_400_000)
      .filter((c) => enEspanol(c.texto))
      .map((c) => ({ ...c, puntaje: puntaje(c) }))
      .sort((a, b2) => b2.puntaje - a.puntaje);
    for (const c of candidatos) {
      if (vistos.has(c.url) || elegidos.length >= POR_SEMANA) continue;
      const n = porCreador.get(c.usuario) ?? 0;
      if (n >= MAX_POR_CREADOR) continue;
      vistos.add(c.url);
      porCreador.set(c.usuario, n + 1);
      elegidos.push(c);
    }
    if (elegidos.length) {
      const { error } = await admin
        .from('descubrir_candidatos')
        .upsert(elegidos.map(({ texto: _t, ...c }) => c), { onConflict: 'url', ignoreDuplicates: true });
      if (error) throw error;
    }
    await admin.from('descubrir_busquedas').update({ estado: 'lista', resultados: (items as unknown[]).length }).eq('id', b.id);
    log.push(`busqueda ${plataforma}: ${(items as unknown[]).length} resultados, ${elegidos.length} elegidos`);
  }
}

// ----------------------------------------------------------- 3. importar

async function empezarImportaciones(admin: SupabaseClient, log: string[]) {
  // Un trabajo trabado mas de 6 horas no va a terminar
  await admin
    .from('descubrir_candidatos')
    .update({ estado: 'descartada', motivo: 'tardo demasiado' })
    .eq('estado', 'importando')
    .lt('importando_desde', new Date(Date.now() - 6 * 3_600_000).toISOString());

  const { count } = await admin.from('descubrir_candidatos').select('id', { count: 'exact', head: true }).eq('estado', 'importando');
  const libres = EN_PARALELO - (count ?? 0);
  if (libres <= 0 || servicioCaido) return;
  if ((await gastoDelMes(admin)) >= (await tope(admin))) {
    log.push('sin importar: tope de gasto del mes');
    return;
  }
  if (await apifyAlLimite(log)) return;
  const { data: siguientes } = await admin
    .from('descubrir_candidatos')
    .select('id, url')
    .eq('estado', 'pendiente')
    .order('puntaje', { ascending: false })
    .limit(libres);
  for (const c of siguientes ?? []) {
    const res = await fetch(`${ENV.url}/functions/v1/importar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-catalogo-secreto': ENV.secreto },
      body: JSON.stringify({ url: c.url }),
    });
    const r = await res.json().catch(() => ({}));
    if (res.ok && r.jobId) {
      await admin.from('descubrir_candidatos').update({ estado: 'importando', job_id: r.jobId, importando_desde: new Date().toISOString() }).eq('id', c.id);
      log.push(`importando ${c.url}`);
    } else {
      await admin.from('descubrir_candidatos').update({ estado: 'descartada', motivo: `importar ${res.status}` }).eq('id', c.id);
    }
  }
}

// ------------------------------------------------------------- 4. publicar

type RecetaNormalizada = {
  title?: string;
  description?: string;
  image_path?: string | null;
  quality?: string;
  ingredients?: { raw_text?: string; name?: string }[];
  steps?: { text?: string }[];
  prep_minutes?: number | null;
  cook_minutes?: number | null;
};

async function publicarTerminadas(admin: SupabaseClient, log: string[]) {
  const { data: enCurso } = await admin.from('descubrir_candidatos').select('*').eq('estado', 'importando');
  for (const c of enCurso ?? []) {
    const { data: job } = await admin.from('import_jobs').select('status, extraction_id, failure_reason').eq('id', c.job_id).maybeSingle();
    if (!job || job.status === 'queued' || job.status === 'running') continue;
    if (job.status === 'failed' || !job.extraction_id) {
      const motivo = (job.failure_reason ?? 'fallo').slice(0, 200);
      if (FALLA_DE_SERVICIO.test(job.failure_reason ?? '')) {
        // No es culpa de la receta: vuelve a la cola y esta ronda no importa mas
        servicioCaido = true;
        await admin.from('descubrir_candidatos').update({ estado: 'pendiente', job_id: null, importando_desde: null, motivo }).eq('id', c.id);
        log.push(`servicio caido: ${motivo.slice(0, 80)}`);
        continue;
      }
      await admin.from('descubrir_candidatos').update({ estado: 'descartada', motivo }).eq('id', c.id);
      continue;
    }
    const { data: ext } = await admin.from('extractions').select('normalized_recipe').eq('id', job.extraction_id).single();
    const n = ext?.normalized_recipe as RecetaNormalizada | undefined;
    if (!n || n.quality !== 'complete' || !n.image_path || !n.ingredients?.length) {
      await admin.from('descubrir_candidatos').update({ estado: 'descartada', motivo: 'receta incompleta' }).eq('id', c.id);
      continue;
    }
    const { etiquetas, esReceta } = await etiquetar(n);
    // Los hashtags de recetas traen de todo: comida para mascotas, remedios, cosmetica
    if (!esReceta) {
      await admin.from('descubrir_candidatos').update({ estado: 'descartada', motivo: 'no es una receta de comida' }).eq('id', c.id);
      continue;
    }
    const creadorId = await guardarCreador(admin, c);
    const { error } = await admin.from('descubrir_recetas').upsert(
      {
        extraction_id: job.extraction_id,
        creador_id: creadorId,
        etiquetas,
        plataforma: c.plataforma,
        me_gusta: c.me_gusta,
        vistas: c.vistas,
        publicado_el: c.publicado_el,
        automatica: true,
        publicada: true,
      },
      { onConflict: 'extraction_id' }
    );
    if (error) throw error;
    await admin.from('descubrir_candidatos').update({ estado: 'publicada' }).eq('id', c.id);
    log.push(`publicada: ${n.title}`);
  }
}

async function guardarCreador(
  admin: SupabaseClient,
  c: { plataforma: string; usuario: string; nombre: string | null; avatar_url: string | null; seguidores: number | null }
): Promise<string> {
  const url = c.plataforma === 'instagram' ? `https://www.instagram.com/${c.usuario}` : `https://www.tiktok.com/@${c.usuario}`;
  const { data: existente } = await admin.from('creadores').select('id, foto_path').eq('plataforma', c.plataforma).eq('usuario', c.usuario).maybeSingle();
  const foto = existente?.foto_path ?? (c.avatar_url ? await guardarFotoCreador(admin, c.plataforma, c.usuario, c.avatar_url) : null);
  const { data, error } = await admin
    .from('creadores')
    .upsert(
      { plataforma: c.plataforma, usuario: c.usuario, nombre: c.nombre, url, seguidores: c.seguidores, foto_path: foto },
      { onConflict: 'plataforma,usuario' }
    )
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Copia la foto de perfil a Storage: las URLs de las redes caducan en dias. */
async function guardarFotoCreador(admin: SupabaseClient, plataforma: string, usuario: string, url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ruta = `creadores/${plataforma}-${usuario.replace(/[^a-z0-9._-]/gi, '_')}.jpg`;
    const { error } = await admin.storage
      .from('recetas')
      .upload(ruta, new Uint8Array(await res.arrayBuffer()), { contentType: res.headers.get('content-type') ?? 'image/jpeg', upsert: true });
    if (error) return null;
    return admin.storage.from('recetas').getPublicUrl(ruta).data.publicUrl;
  } catch {
    return null;
  }
}

/**
 * Etiquetas: los ingredientes por palabras clave (sin IA); los chips populares
 * y el resto de categorias, de Gemini eligiendo solo de las listas fijas.
 */
async function etiquetar(r: RecetaNormalizada): Promise<{ etiquetas: string[]; esReceta: boolean }> {
  const ingredientes = ingredientesDe((r.ingredients ?? []).map((i) => `${i.raw_text ?? ''} ${i.name ?? ''}`)).map((id) => `ing:${id}`);
  const listas = [
    `populares: ${ETIQUETAS.map((e) => `${e.id} (${e.nombre})`).join(', ')}`,
    ...CATEGORIAS.filter((c) => c.id !== 'ing').map((c) => `${c.id}: ${c.opciones.map((o) => `${o.id} (${o.nombre})`).join(', ')}`),
  ].join('\n');
  const prompt =
    'Clasifica esta receta. "es_receta": true solo si es un plato o bebida para personas (false si es comida para mascotas, un remedio casero, cosmetica o no es cocina). ' +
    'Para cada otra clave elige ids SOLO de su lista; deja el arreglo vacio si ninguno aplica de verdad. ' +
    'populares: 1 a 3. tipo: 1 o 2. dieta: solo si la receta la cumple entera (vegetariana = sin carne ni pescado). ' +
    'cocina: el origen del plato, 0 o 1. ocasion: 0 a 2. metodo: los que usa la preparacion. ' +
    '"rapidas" solo si en total toma menos de 30 minutos.\n' +
    'Responde JSON: {"es_receta":true,"populares":[],"tipo":[],"dieta":[],"cocina":[],"ocasion":[],"metodo":[]}\n\nListas:\n' +
    listas +
    '\n\nReceta:\n' +
    JSON.stringify({
      title: r.title,
      description: r.description,
      ingredients: r.ingredients?.map((i) => i.raw_text),
      steps: r.steps?.map((p) => p.text),
      prep_minutes: r.prep_minutes,
      cook_minutes: r.cook_minutes,
    }).slice(0, 8000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${ENV.modelo}:generateContent?key=${ENV.gemini}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0 } }),
    });
    const j = await res.json();
    const r2 = JSON.parse(j?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}') as Record<string, string[]> & { es_receta?: boolean };
    const populares = new Set(ETIQUETAS.map((e) => e.id));
    const salida = (r2.populares ?? []).filter((x) => populares.has(x)).slice(0, 3);
    for (const c of CATEGORIAS) {
      if (c.id === 'ing') continue;
      const validas = new Set(c.opciones.map((o) => o.id));
      for (const x of r2[c.id] ?? []) if (validas.has(x)) salida.push(`${c.id}:${x}`);
    }
    return { etiquetas: [...salida, ...ingredientes], esReceta: r2.es_receta !== false };
  } catch {
    return { etiquetas: ingredientes, esReceta: true };
  }
}

// -------------------------------------------------- 5. fotos de creadores

/** Instagram no da la foto de perfil en la busqueda: se pide aparte, de a 8. */
async function completarCreadores(admin: SupabaseClient, log: string[]) {
  const { data: sinFoto } = await admin.from('creadores').select('id, usuario').eq('plataforma', 'instagram').is('foto_path', null).limit(8);
  if (!sinFoto?.length) return;
  const res = await fetch(`https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${ENV.apify}&timeout=90`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ directUrls: sinFoto.map((c) => `https://www.instagram.com/${c.usuario}/`), resultsType: 'details', resultsLimit: 1 }),
  });
  if (!res.ok) throw new Error(`apify perfiles ${res.status}`);
  // deno-lint-ignore no-explicit-any
  const perfiles = (await res.json()) as any[];
  await admin.from('gasto_ia').insert({ costo: sinFoto.length * COSTE_RESULTADO.instagram, fuente: 'descubrir' });
  for (const c of sinFoto) {
    const p = perfiles.find((x) => String(x.username ?? '').toLowerCase() === c.usuario.toLowerCase());
    const pic = p?.profilePicUrlHD || p?.profilePicUrl;
    const foto = pic ? await guardarFotoCreador(admin, 'instagram', c.usuario, pic) : null;
    // Sin foto se marca igual (cadena vacia) para no pedirla de nuevo cada vez
    await admin
      .from('creadores')
      .update({ foto_path: foto ?? '', seguidores: p?.followersCount ?? null, ...(p?.fullName ? { nombre: p.fullName } : {}) })
      .eq('id', c.id);
  }
  log.push(`fotos de ${sinFoto.length} creadores`);
}
