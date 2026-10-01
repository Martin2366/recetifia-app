// Edge Function "importar": enlace de una receta → receta estructurada.
//
// Responde enseguida con el id del trabajo y procesa en segundo plano. La app
// consulta la fila de import_jobs para pintar el progreso (leyendo →
// escuchando → ordenando → guardando) y, al terminar, lee la receta de la
// cache compartida (extractions).
//
// Orden del pipeline, del mas barato al mas caro (medido en la fase 0):
//   1. cache compartida por URL canonica        → coste 0, instantaneo
//   2. pagina publica: caption o JSON-LD        → gratis
//   3. web del creador enlazada en el caption   → gratis y exacta
//   4. Gemini estructura el texto
//   5. ¿faltan los pasos? Apify → subtitulos, Whisper (≤25 MB) o Gemini ve el video
//   6. foto a Storage (las de las redes caducan) y a la cache

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { apifySoporta, cabeEnWhisper, COSTE_APIFY, datosDeApify, descargarVideo, desdeSubtitulos, transcribir } from './audio.ts';
import { borrarVideo, descargarImagenes, estructurar, estructurarImagenes, estructurarVideo, estructurarYoutube, subirVideo, type RecetaIa } from './ia.ts';
import { obtenerContenido, type Contenido } from './obtener.ts';
import { BROWSER_UA, canonicalizar, detectarFuente, jsonLdSuficiente, sha256, urlsEnTexto, type Fuente } from './util.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const ENV = {
  url: Deno.env.get('SUPABASE_URL')!,
  servicio: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  gemini: Deno.env.get('GEMINI_API_KEY') ?? '',
  modelo: Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash',
  groq: Deno.env.get('GROQ_API_KEY') ?? '',
  modeloGroq: Deno.env.get('GROQ_MODEL') ?? 'whisper-large-v3-turbo',
  apify: Deno.env.get('APIFY_TOKEN') ?? '',
  precioEntrada: Number(Deno.env.get('PRICE_IN_PER_M') ?? 0.3),
  precioSalida: Number(Deno.env.get('PRICE_OUT_PER_M') ?? 2.5),
};

// Plan gratis: guardar, escribir y organizar no tienen tope. Solo se limita lo
// que nos cuesta dinero, importar con IA desde videos e imagenes. Las webs no
// cuentan: casi siempre traen la receta publicada y salen gratis. Los topes
// (10 en total gratis, 120 al mes con Plus) viven en public.ajustes.
const FUENTES_CON_LIMITE: Fuente[] = ['instagram', 'tiktok', 'youtube', 'facebook', 'pinterest', 'image'];

// Fotos desde la galeria o la camara: hasta 4 (una receta a doble pagina, varias
// capturas). La app las manda ya comprimidas; esto es solo un tope de seguridad.
const MAX_FOTOS = 4;
const MAX_FOTO_BASE64 = 6 * 1024 * 1024;
type Foto = { data: string; mime: string };

// Freno de gasto: el presupuesto de validacion es de 30 USD al mes. Pasado este
// tope la importacion no se corta: sigue con lo barato (caption y web) y se
// salta lo caro (Apify, Whisper y Gemini mirando el video).
const TOPE_GASTO_MES = Number(Deno.env.get('TOPE_GASTO_MES_USD') ?? 25);
const MIN_TEXTO = 120; // por debajo no merece la pena llamar a la IA

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
};

function json(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'content-type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'metodo' }, 405);

  const admin = createClient(ENV.url, ENV.servicio, { auth: { persistSession: false } });
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: sesion } = await admin.auth.getUser(token);
  const usuario = sesion?.user;
  if (!usuario) return json({ error: 'sesion' }, 401);

  const cuerpo = await req.json().catch(() => ({}));
  const fotos: Foto[] = (Array.isArray(cuerpo?.imagenes) ? cuerpo.imagenes : [])
    .filter((f: Foto) => typeof f?.data === 'string' && f.data.length > 1000 && f.data.length < MAX_FOTO_BASE64 && String(f?.mime ?? '').startsWith('image/'))
    .slice(0, MAX_FOTOS);
  const entrada = String(cuerpo?.url ?? '').trim();
  // Lo compartido desde una app suele ser "Mira este reel https://..."
  const url = fotos.length ? '' : (urlsEnTexto(entrada)[0] ?? entrada);
  const fuente: Fuente | null = fotos.length ? 'image' : detectarFuente(url);
  if (!fuente) return json({ error: 'enlace' }, 400);

  // El mismo enlace dos veces en dos minutos es un doble toque o un doble
  // aviso de "Compartir": se devuelve el trabajo que ya esta en marcha, sin
  // cobrar otra vez la IA ni gastar otra importacion de la cuota.
  const { data: reciente } = fotos.length ? { data: null } : await admin
    .from('import_jobs')
    .select('id')
    .eq('user_id', usuario.id)
    .eq('source_url', url)
    .in('status', ['queued', 'running', 'done'])
    .gte('created_at', new Date(Date.now() - 120_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (reciente) return json({ jobId: reciente.id });

  // Cuota del plan gratis, contada en el servidor y por cuenta. Solo cuentan las
  // importaciones que salieron bien: las fallidas no gastan nada.
  // Plus (segun el webhook de RevenueCat) tiene su propio tope mensual contra abusos.
  if (FUENTES_CON_LIMITE.includes(fuente)) {
    const { data: cuota, error: errorCuota } = await admin.rpc('cuota_de', { quien: usuario.id });
    if (errorCuota) console.error('cuota_de', errorCuota.message);
    else if (cuota && cuota.restantes <= 0) return json({ error: cuota.plus ? 'limite_plus' : 'limite' }, 402);
  }

  // Las fotos se reconocen por su contenido: la misma foto dos veces sale de la cache
  const canonica = fotos.length ? `foto:${await sha256(fotos.map((f) => f.data).join(''))}` : canonicalizar(url);
  const hash = await sha256(canonica);

  // Si alguien ya importo este enlace, se reutiliza: coste 0 e instantaneo
  const { data: previa } = await admin.from('extractions').select('id, normalized_recipe').eq('source_url_hash', hash).maybeSingle();
  if (previa?.normalized_recipe) {
    const r = previa.normalized_recipe as { quality?: string; origin?: string };
    const { data: job } = await admin
      .from('import_jobs')
      .insert({
        user_id: usuario.id,
        source_url: url || null,
        source_type: fuente,
        status: 'done',
        stage: 'cache',
        extraction_id: previa.id,
        quality: r.quality ?? 'complete',
        origin: r.origin ?? 'cache',
        duration_ms: 0,
        finished_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    return json({ jobId: job?.id });
  }

  const { data: job, error } = await admin
    .from('import_jobs')
    .insert({ user_id: usuario.id, source_url: url || null, source_type: fuente, status: 'running', stage: 'leyendo' })
    .select('id')
    .single();
  if (error || !job) return json({ error: 'interno' }, 500);

  const ahorro = await enModoAhorro(admin);
  EdgeRuntime.waitUntil(procesar(admin, job.id, url, canonica, hash, fuente, ahorro, fotos));
  return json({ jobId: job.id });
});

/** Si el gasto en IA del mes ya paso el tope. Ante la duda, no frena. */
async function enModoAhorro(admin: SupabaseClient): Promise<boolean> {
  const { data, error } = await admin.rpc('gasto_ia_del_mes');
  if (error) {
    console.error('gasto_ia_del_mes', error.message);
    return false;
  }
  return Number(data ?? 0) >= TOPE_GASTO_MES;
}

async function procesar(
  admin: SupabaseClient,
  jobId: string,
  url: string,
  canonica: string,
  hash: string,
  fuente: Fuente,
  ahorro: boolean,
  fotos: Foto[] = []
) {
  const t0 = Date.now();
  let coste = 0;
  let origen = 'caption';
  // Lo que salio mal por el camino sin tumbar la importacion; queda en el trabajo
  const notas: string[] = [];
  const etapa = (stage: string) => admin.from('import_jobs').update({ stage }).eq('id', jobId);
  const sumar = (r: { tokensEntrada: number; tokensSalida: number }) => {
    coste += (r.tokensEntrada / 1e6) * ENV.precioEntrada + (r.tokensSalida / 1e6) * ENV.precioSalida;
  };
  // El gasto se anota aparte: import_jobs se borra con la cuenta y el freno lo perderia
  const anotarGasto = async () => {
    if (coste > 0) await admin.from('gasto_ia').insert({ costo: coste, fuente });
  };

  // Lo encontrado por el camino: si la IA no arma la receta, la app abre el
  // editor con esto en vez de dejar a la persona con las manos vacias
  let contenido: Contenido | null = null;
  let receta: RecetaIa | null = null;
  // Mas platos en la misma publicacion (carruseles con varias recetas)
  let otras: RecetaIa[] = [];

  try {
    const c: Contenido = fuente === 'image'
      ? { titulo: '', autor: '', miniatura: null, texto: '', jsonLd: null, blog: null, via: ['foto'] }
      : await obtenerContenido(url, fuente);
    contenido = c;

    if (ahorro) notas.push('modo ahorro: sin audio ni video');

    if (fuente === 'image') {
      // Foto de un libro, un cuaderno o una captura: Gemini la lee igual que un
      // carrusel, y si trae varios platos salen por separado
      await etapa('ordenando');
      const r = await estructurarImagenes(ENV.gemini, ENV.modelo, fotos, '');
      sumar(r);
      receta = r.receta;
      otras = r.otras;
      origen = 'foto';
    } else if (fuente === 'youtube' && !ahorro) {
      await etapa('escuchando');
      const r = await estructurarYoutube(ENV.gemini, ENV.modelo, url, c.texto);
      sumar(r);
      receta = r.receta;
      origen = 'youtube';
    } else {
      const texto = textoBase(c);
      if (jsonLdSuficiente(c.jsonLd)) origen = c.blog ? 'web_creador' : 'web';

      if (texto.length >= MIN_TEXTO) {
        await etapa('ordenando');
        const r = await estructurar(ENV.gemini, ENV.modelo, texto, { titulo: c.titulo, autor: c.autor });
        sumar(r);
        receta = r.receta;
      }

      // El caption casi nunca trae el procedimiento: se dice en voz alta en el video
      if ((!receta || receta.pasos.length < 2) && !ahorro && apifySoporta(fuente) && ENV.apify && ENV.groq) {
        await etapa('escuchando');
        try {
          const a = await datosDeApify(url, fuente, ENV.apify);
          coste += COSTE_APIFY[fuente] ?? 0;
          if (a.texto.length > c.texto.length) c.texto = a.texto;
          c.miniatura ||= a.miniatura;
          c.autor ||= a.autor;

          // Camino barato: subtitulos de TikTok, o Whisper si el video pesa poco.
          // Si el video es grande (reels en HD), lo ve Gemini directamente.
          const subtitulos = await desdeSubtitulos(a);
          let transcripcion = subtitulos;
          let video: Uint8Array | null = null;
          if (!transcripcion && a.video) {
            video = await descargarVideo(a.video);
            if (cabeEnWhisper(video)) {
              try {
                transcripcion = await transcribir(video, ENV.groq, ENV.modeloGroq);
              } catch (e) {
                notas.push(`whisper: ${(e as Error).message}`);
              }
            }
          }

          let r: Awaited<ReturnType<typeof estructurar>> | null = null;
          if (transcripcion) {
            await etapa('ordenando');
            const completo = `${textoBase(c)}\n\n[Transcripción del audio del video]\n${transcripcion}`;
            r = await estructurar(ENV.gemini, ENV.modelo, completo, { titulo: c.titulo, autor: c.autor });
            origen = subtitulos ? 'subtitulos' : 'audio';
          } else if (video) {
            const subido = await subirVideo(ENV.gemini, video);
            try {
              await etapa('ordenando');
              r = await estructurarVideo(ENV.gemini, ENV.modelo, subido, textoBase(c));
              origen = 'video';
            } finally {
              borrarVideo(ENV.gemini, subido.nombre);
            }
          } else if (a.imagenes.length) {
            // Carrusel de fotos: la receta va escrita dentro de las imagenes
            const imagenes = await descargarImagenes(a.imagenes);
            if (imagenes.length) {
              await etapa('ordenando');
              const ri = await estructurarImagenes(ENV.gemini, ENV.modelo, imagenes, textoBase(c));
              r = ri;
              otras = ri.otras;
              origen = 'imagenes';
            } else {
              notas.push('no se pudieron descargar las fotos del carrusel');
            }
          } else {
            notas.push('apify no dio video, subtitulos ni fotos');
          }

          if (r) {
            sumar(r);
            // Se queda con la version mas completa de las dos
            if (!receta || r.receta.pasos.length >= receta.pasos.length) receta = r.receta;
            else origen = 'caption';
          }

          // Hay audio (o subtitulos) pero los pasos no estaban ahi: videos con
          // musica donde todo va escrito en pantalla. Gemini mira el video.
          if ((!receta || receta.pasos.length < 2) && transcripcion && a.video) {
            try {
              video ??= await descargarVideo(a.video);
              const subido = await subirVideo(ENV.gemini, video);
              try {
                await etapa('ordenando');
                const rv = await estructurarVideo(ENV.gemini, ENV.modelo, subido, textoBase(c));
                sumar(rv);
                if (!receta || rv.receta.pasos.length > receta.pasos.length) {
                  receta = rv.receta;
                  origen = 'video';
                }
              } finally {
                borrarVideo(ENV.gemini, subido.nombre);
              }
            } catch (e) {
              notas.push(`video: ${(e as Error).message}`);
            }
          }
        } catch (e) {
          notas.push(`audio: ${(e as Error).message}`);
        }
      }
    }

    const sinReceta = !receta || (!receta.ingredientes?.length && !receta.pasos?.length);
    if (sinReceta || (receta!.confianza === 'baja' && !receta!.ingredientes?.length)) {
      throw new Error('no encontramos una receta en ese enlace');
    }

    await etapa('guardando');
    const foto =
      fuente === 'image' ? await guardarFotoSubida(admin, fotos[0], hash) : await guardarFoto(admin, c.miniatura ?? c.jsonLd?.imagen ?? null, hash);
    const normalizar = (r: RecetaIa) => {
      const n = r.nutricion_por_porcion;
      return {
        title: r.titulo || c.titulo || 'Receta sin título',
        description: r.descripcion || null,
        image_path: foto,
        servings: r.porciones || c.jsonLd?.porciones || null,
        prep_minutes: r.tiempo_preparacion_min || c.jsonLd?.prep || null,
        cook_minutes: r.tiempo_coccion_min || c.jsonLd?.coccion || null,
        source_type: fuente,
        source_url: url || null,
        source_author: c.autor || c.jsonLd?.autor || null,
        ingredients: r.ingredientes.map((i) => ({
          raw_text: i.texto_original,
          // "Limon al gusto" llegaba con cantidad 0 y la app mostraba "0 limon"
          quantity: i.cantidad && i.cantidad > 0 ? i.cantidad : null,
          unit: i.unidad || null,
          name: i.nombre,
          group_label: i.grupo || null,
          emoji: i.emoji || null,
        })),
        steps: r.pasos.map((text) => ({ text })),
        nutrition: n?.calorias ? n : null,
        confianza: r.confianza,
        motivo: r.motivo,
        blog_url: c.blog,
        origin: origen,
        quality: r.ingredientes.length > 0 && r.pasos.length >= 2 ? 'complete' : 'partial',
      };
    };

    // La app ofrece guardar los demas platos como recetas aparte
    const normalizada = { ...normalizar(receta!), otras: otras.map(normalizar) };

    const { data: ext, error } = await admin
      .from('extractions')
      .upsert(
        {
          source_url_hash: hash,
          source_url: canonica,
          source_type: fuente,
          raw_payload: { texto: c.texto.slice(0, 20000), via: c.via, blog: c.blog },
          normalized_recipe: normalizada,
          audio_origin: ['audio', 'subtitulos', 'youtube', 'video'].includes(origen) ? origen : null,
          model_used: ENV.modelo,
          cost_usd: coste,
        },
        { onConflict: 'source_url_hash' }
      )
      .select('id')
      .single();
    if (error) throw error;

    await admin
      .from('import_jobs')
      .update({
        status: 'done',
        stage: 'listo',
        extraction_id: ext.id,
        quality: normalizada.quality,
        failure_reason: notas.join(' | ').slice(0, 300) || null,
        origin: origen,
        cost_usd: coste,
        duration_ms: Date.now() - t0,
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobId);
    await anotarGasto();
  } catch (e) {
    console.error('importar', jobId, (e as Error).message);
    const rescate = await armarRescate(admin, contenido, receta, hash);
    await admin
      .from('import_jobs')
      .update({
        status: 'failed',
        rescate,
        failure_reason: [String((e as Error).message ?? e), ...notas].join(' | ').slice(0, 300),
        cost_usd: coste,
        duration_ms: Date.now() - t0,
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobId);
    await anotarGasto();
  }
}

/** Lo que se pudo sacar aunque la IA no armara la receta. Null si no hay nada util. */
async function armarRescate(admin: SupabaseClient, c: Contenido | null, receta: RecetaIa | null, hash: string) {
  if (!c && !receta) return null;
  const texto = c ? textoBase(c).slice(0, 6000) : '';
  const titulo = receta?.titulo || c?.titulo || '';
  if (!texto.trim() && !titulo.trim()) return null;
  let foto: string | null = null;
  try {
    foto = await guardarFoto(admin, c?.miniatura ?? c?.jsonLd?.imagen ?? null, hash);
  } catch {
    // Sin foto el rescate sirve igual
  }
  return {
    titulo,
    autor: c?.autor || c?.jsonLd?.autor || '',
    foto,
    texto,
    ingredientes: receta?.ingredientes?.map((i) => i.texto_original) ?? [],
    pasos: receta?.pasos ?? [],
  };
}

/** Texto para la IA: el JSON-LD (si hay) delante, marcado como exacto, y despues el resto. */
function textoBase(c: Contenido): string {
  const partes: string[] = [];
  if (c.jsonLd) {
    const j = c.jsonLd;
    partes.push(
      [
        '[Receta publicada en la web; respeta sus ingredientes y pasos tal cual]',
        j.titulo,
        j.porciones ? `Porciones: ${j.porciones}` : '',
        'Ingredientes:',
        ...j.ingredientes.map((i) => `- ${i}`),
        'Pasos:',
        ...j.pasos.map((p, k) => `${k + 1}. ${p}`),
      ]
        .filter(Boolean)
        .join('\n')
    );
  }
  if (c.texto) partes.push(c.texto);
  return partes.join('\n\n');
}

/** Copia la foto a Storage: las URLs de Instagram y TikTok caducan en pocos dias. */
/** La primera foto que subio la persona queda como foto de la receta (se cambia en el editor). */
async function guardarFotoSubida(admin: SupabaseClient, f: Foto | undefined, hash: string): Promise<string | null> {
  if (!f) return null;
  try {
    const bytes = Uint8Array.from(atob(f.data), (ch) => ch.charCodeAt(0));
    const ruta = `importadas/${hash}.${f.mime.includes('png') ? 'png' : f.mime.includes('webp') ? 'webp' : 'jpg'}`;
    const { error } = await admin.storage.from('recetas').upload(ruta, bytes, { contentType: f.mime, upsert: true });
    if (error) return null;
    return admin.storage.from('recetas').getPublicUrl(ruta).data.publicUrl;
  } catch {
    return null;
  }
}

async function guardarFoto(admin: SupabaseClient, url: string | null, hash: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { headers: { 'user-agent': BROWSER_UA } });
    const tipo = res.headers.get('content-type') ?? '';
    if (!res.ok || !tipo.startsWith('image/')) return url;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > 6 * 1024 * 1024) return url;
    const ruta = `importadas/${hash}.${tipo.includes('png') ? 'png' : tipo.includes('webp') ? 'webp' : 'jpg'}`;
    const { error } = await admin.storage.from('recetas').upload(ruta, bytes, { contentType: tipo, upsert: true });
    if (error) return url;
    return admin.storage.from('recetas').getPublicUrl(ruta).data.publicUrl;
  } catch {
    return url;
  }
}
