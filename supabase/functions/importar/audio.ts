// Segunda pasada: el audio. El caption trae los ingredientes, pero el paso a
// paso casi siempre se dice en voz alta en el video (medido en la fase 0).
//
// Apify da el caption completo, la URL del video y, en TikTok, los subtitulos
// automaticos. Con subtitulos no hace falta Whisper; sin ellos, Groq transcribe.

import { httpGet, subtitulosATexto, type Fuente } from './util.ts';

const APIFY = 'https://api.apify.com/v2';
const MAX_VIDEO = 25 * 1024 * 1024; // limite de Groq

type DatosApify = {
  texto: string;
  video: string | null;
  miniatura: string | null;
  autor: string;
  subtitulos: { language?: string; downloadLink?: string }[];
};

// deno-lint-ignore no-explicit-any
type Item = any;

const ACTORES: Partial<Record<Fuente, { id: string; entrada: (url: string) => unknown; leer: (it: Item) => DatosApify }>> = {
  instagram: {
    id: 'apify~instagram-scraper',
    entrada: (url) => ({ directUrls: [url], resultsType: 'posts', resultsLimit: 1, addParentData: false }),
    leer: (it) => ({
      texto: it.caption || '',
      video: it.videoUrl || null,
      miniatura: it.displayUrl || null,
      autor: it.ownerUsername ? `@${it.ownerUsername}` : '',
      subtitulos: [],
    }),
  },
  tiktok: {
    id: 'clockworks~tiktok-scraper',
    entrada: (url) => ({
      postURLs: [url],
      resultsPerPage: 1,
      // El enlace directo de TikTok exige cookies; el video descargado por Apify no
      shouldDownloadVideos: true,
      shouldDownloadCovers: false,
      shouldDownloadAvatars: false,
      shouldDownloadSlideshowImages: false,
    }),
    leer: (it) => ({
      texto: it.text || '',
      video: it.mediaUrls?.[0] || it.videoMeta?.downloadAddr || null,
      miniatura: it.videoMeta?.coverUrl || null,
      autor: it.authorMeta?.name ? `@${it.authorMeta.name}` : '',
      subtitulos: it.videoMeta?.subtitleLinks || [],
    }),
  },
  facebook: {
    id: 'apify~facebook-posts-scraper',
    entrada: (url) => ({ startUrls: [{ url }], resultsLimit: 1 }),
    leer: (it) => ({
      texto: it.text || it.message || '',
      video: it.media?.[0]?.url || it.videoUrl || null,
      miniatura: it.media?.[0]?.thumbnail || null,
      autor: it.user?.name || '',
      subtitulos: [],
    }),
  },
};

/** Coste aproximado por llamada, en USD (tarifas de los actores). */
export const COSTE_APIFY: Partial<Record<Fuente, number>> = { instagram: 0.0027, tiktok: 0.0037, facebook: 0.005 };

export function apifySoporta(fuente: Fuente) {
  return Boolean(ACTORES[fuente]);
}

export async function datosDeApify(url: string, fuente: Fuente, token: string): Promise<DatosApify> {
  const actor = ACTORES[fuente];
  if (!actor) throw new Error(`sin actor para ${fuente}`);
  const res = await fetch(`${APIFY}/acts/${actor.id}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=90`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(actor.entrada(url)),
  });
  const cuerpo = await res.text();
  if (!res.ok) {
    let msg = `apify HTTP ${res.status}`;
    try {
      msg = JSON.parse(cuerpo)?.error?.message || msg;
    } catch {
      // no era JSON
    }
    throw new Error(msg);
  }
  const items = JSON.parse(cuerpo);
  if (!Array.isArray(items) || !items.length) throw new Error('apify no devolvio resultados');
  if (items[0].error) throw new Error(`apify: ${items[0].error}`);
  return actor.leer(items[0]);
}

/** TikTok publica subtitulos automaticos: una transcripcion ya hecha y gratis. */
export async function desdeSubtitulos(d: DatosApify): Promise<string | null> {
  const elegido = d.subtitulos.find((l) => /^(es|spa)/i.test(l.language ?? '')) ?? d.subtitulos[0];
  if (!elegido?.downloadLink) return null;
  const r = await httpGet(elegido.downloadLink);
  if (!r.ok) return null;
  const texto = subtitulosATexto(r.body);
  return texto.length >= 60 ? texto : null;
}

/** Los reels en HD pesan 30-60 MB: se aceptan hasta 120 MB (luego va a Gemini). */
const MAX_DESCARGA = 120 * 1024 * 1024;

export async function descargarVideo(urlVideo: string): Promise<Uint8Array> {
  const res = await fetch(urlVideo, { headers: { 'user-agent': 'RecetifiaBot/1.0' } });
  if (!res.ok) throw new Error(`descarga del video: HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > MAX_DESCARGA) throw new Error('video demasiado grande');
  if (bytes.byteLength < 10000) throw new Error('video vacio');
  return bytes;
}

/** Whisper en Groq solo acepta hasta 25 MB; por encima, lo ve Gemini. */
export function cabeEnWhisper(bytes: Uint8Array) {
  return bytes.byteLength <= MAX_VIDEO;
}

/** Transcribe con Whisper en Groq. Acepta el mp4 directamente, sin extraer el audio. */
export async function transcribir(bytes: Uint8Array, apiKey: string, modelo: string): Promise<string | null> {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'video/mp4' }), 'video.mp4');
  form.append('model', modelo);
  form.append('response_format', 'json');
  const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error?.message || `groq HTTP ${r.status}`);
  return (j?.text as string)?.trim() || null;
}
