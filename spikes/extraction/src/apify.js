// Obtencion de contenido via Apify, para lo que no se puede leer gratis:
// Instagram, TikTok y Facebook. Devuelve caption Y la URL del video, que es
// lo que de verdad nos hacia falta: el paso a paso esta en el audio.

const API = 'https://api.apify.com/v2';

/** Cada fuente tiene su actor y su forma de nombrar las cosas. */
const ACTORES = {
  instagram: {
    id: 'apify/instagram-scraper',
    input: (url) => ({ directUrls: [url], resultsType: 'posts', resultsLimit: 1, addParentData: false }),
    lee: (it) => ({
      texto: it.caption || '',
      video: it.videoUrl || null,
      miniatura: it.displayUrl || null,
      autor: it.ownerUsername || '',
      subtitulos: [],
      duracion: it.videoDuration || null,
    }),
  },
  tiktok: {
    id: 'clockworks/tiktok-scraper',
    input: (url) => ({
      postURLs: [url], resultsPerPage: 1,
      shouldDownloadVideos: false, shouldDownloadCovers: false,
      shouldDownloadAvatars: false, shouldDownloadSlideshowImages: false,
    }),
    lee: (it) => ({
      texto: it.text || '',
      video: it.mediaUrls?.[0] || it.videoMeta?.downloadAddr || null,
      miniatura: it.videoMeta?.coverUrl || null,
      autor: it.authorMeta?.name || '',
      // TikTok publica sus propios subtitulos automaticos: transcripcion gratis.
      subtitulos: it.videoMeta?.subtitleLinks || [],
      duracion: it.videoMeta?.duration || null,
    }),
  },
  facebook: {
    id: 'apify/facebook-posts-scraper',
    input: (url) => ({ startUrls: [{ url }], resultsLimit: 1 }),
    lee: (it) => ({
      texto: it.text || it.message || '',
      video: it.media?.[0]?.url || it.videoUrl || null,
      miniatura: it.media?.[0]?.thumbnail || null,
      autor: it.user?.name || '',
      subtitulos: [],
      duracion: null,
    }),
  },
};

export function apifySoporta(source) {
  return Boolean(ACTORES[source]);
}

/**
 * Ejecuta el actor y espera el resultado en la misma peticion.
 * Para un solo enlace es lo mas simple: nada de colas ni sondeos.
 */
export async function fetchViaApify(url, source, token, { timeoutSec = 180 } = {}) {
  const actor = ACTORES[source];
  if (!actor) throw new Error(`sin actor para "${source}"`);

  const endpoint = `${API}/acts/${actor.id.replace('/', '~')}/run-sync-get-dataset-items`
    + `?token=${encodeURIComponent(token)}&timeout=${timeoutSec}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(actor.input(url)),
  });

  const cuerpo = await res.text();
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { msg = JSON.parse(cuerpo)?.error?.message || msg; } catch { /* respuesta no JSON */ }
    throw new Error(msg);
  }

  let items;
  try { items = JSON.parse(cuerpo); } catch { throw new Error('el dataset no era JSON'); }
  if (!Array.isArray(items) || !items.length) throw new Error('el actor no devolvio resultados');

  // Algunos actores devuelven un item de error en lugar de fallar
  const it = items[0];
  if (it.error) throw new Error(`${it.error}: ${it.errorDescription || ''}`.trim());

  const datos = actor.lee(it);
  return { ...datos, actor: actor.id, crudo: it };
}
