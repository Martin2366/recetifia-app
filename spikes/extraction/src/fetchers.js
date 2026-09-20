// Obtencion de contenido publico. Cada fetcher intenta lo barato primero.
// Devuelve siempre: { titulo, autor, miniatura, texto, via[], notas[], blogUrl }

import {
  httpGet, httpGetJson, extractMetaTags, extractRecipeJsonLd, recipeFromJsonLd,
  extractUrlsFromText, extractReadableText, decodeHtml, detectSource,
} from './util.js';

const GRAPH_VERSIONS = (process.env.GRAPH_API_VERSION || 'v23.0,v20.0,v16.0').split(',');

function empty() {
  return { titulo: '', autor: '', miniatura: null, texto: '', via: [], notas: [], blogUrl: null, jsonLdRecipe: null };
}

function addMeta(acc, meta) {
  if (!acc.titulo) acc.titulo = meta['og:title'] || meta['twitter:title'] || meta['<title>'] || '';
  if (!acc.miniatura) acc.miniatura = meta['og:image'] || meta['twitter:image'] || null;
  const desc = meta['og:description'] || meta['twitter:description'] || meta['description'] || '';
  if (desc) acc.texto += (acc.texto ? '\n' : '') + desc;
}

// --- oEmbed ------------------------------------------------------------

async function oembed(endpoint, acc, label) {
  const r = await httpGetJson(endpoint);
  if (!r.json) {
    acc.notas.push(`${label}: fallo (${r.status || r.error || 'sin respuesta'})`);
    return false;
  }
  const j = r.json;
  // En TikTok e Instagram el caption suele venir en `title`.
  if (j.title) acc.texto += (acc.texto ? '\n' : '') + decodeHtml(String(j.title));
  if (!acc.titulo && j.title) acc.titulo = decodeHtml(String(j.title));
  if (j.author_name) acc.autor = j.author_name;
  if (j.thumbnail_url) acc.miniatura = j.thumbnail_url;
  acc.via.push(label);
  return Boolean(j.title || j.author_name);
}

async function scrapeOg(url, acc, label) {
  const r = await httpGet(url);
  if (!r.ok || !r.body) {
    acc.notas.push(`${label}: fallo (${r.status || r.error})`);
    return false;
  }
  const before = acc.texto.length;
  addMeta(acc, extractMetaTags(r.body));

  const recipe = extractRecipeJsonLd(r.body);
  if (recipe) {
    acc.jsonLdRecipe = recipeFromJsonLd(recipe);
    acc.via.push(`${label}+jsonld`);
  }

  // Siempre guardamos el texto del cuerpo: si el JSON-LD viene pobre (pasa a menudo),
  // es lo que le permite a la IA rescatar la receta.
  if (esPaginaWeb(label)) {
    const cuerpo = extractReadableText(r.body);
    if (cuerpo.length > 200) {
      acc.texto += (acc.texto ? '\n\n' : '') + cuerpo;
      acc.via.push(`${label}:cuerpo`);
    }
  }

  if (acc.jsonLdRecipe || acc.texto.length > before) return true;

  acc.notas.push(`${label}: sin metadatos utiles`);
  return false;
}

// En las redes sociales el HTML es una carcasa de JavaScript: extraer su cuerpo
// solo genera ruido. En blogs y webs si merece la pena.
function esPaginaWeb(label) {
  return label === 'web' || label === 'blog' || label.startsWith('og:pinterest');
}

// --- Por plataforma ----------------------------------------------------

async function fromTiktok(url, acc) {
  await oembed(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, acc, 'oembed:tiktok');
  if (acc.texto.length < 80) await scrapeOg(url, acc, 'og:tiktok');
}

async function fromInstagram(url, acc) {
  // Desde junio de 2026 el oEmbed de Meta vuelve a funcionar sin token.
  // Probamos varias versiones de Graph porque el numero cambia cada pocos meses.
  for (const v of GRAPH_VERSIONS) {
    const ep = `https://graph.facebook.com/${v.trim()}/instagram_oembed?omitscript=true&url=${encodeURIComponent(url)}`;
    if (await oembed(ep, acc, `oembed:ig(${v.trim()})`)) break;
  }
  if (acc.texto.length < 80) await scrapeOg(url, acc, 'og:instagram');
}

async function fromFacebook(url, acc) {
  for (const v of GRAPH_VERSIONS) {
    const ep = `https://graph.facebook.com/${v.trim()}/oembed_post?omitscript=true&url=${encodeURIComponent(url)}`;
    if (await oembed(ep, acc, `oembed:fb(${v.trim()})`)) break;
  }
  if (acc.texto.length < 80) await scrapeOg(url, acc, 'og:facebook');
}

async function fromPinterest(url, acc) {
  await oembed(`https://www.pinterest.com/oembed.json?url=${encodeURIComponent(url)}`, acc, 'oembed:pinterest');
  // En Pinterest lo valioso casi nunca es el pin: es el enlace al blog de origen.
  await scrapeOg(url, acc, 'og:pinterest');
}

async function fromYoutube(url, acc) {
  await oembed(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, acc, 'oembed:youtube');
  // La descripcion del video es donde vive la receta; hay que sacarla de la pagina.
  const r = await httpGet(url);
  if (r.ok && r.body) {
    const m = /"shortDescription":"([\s\S]*?)","/.exec(r.body);
    if (m) {
      try {
        const desc = JSON.parse(`"${m[1]}"`);
        if (desc) {
          acc.texto += (acc.texto ? '\n' : '') + desc;
          acc.via.push('descripcion:youtube');
        }
      } catch { /* descripcion ilegible, seguimos */ }
    }
    addMeta(acc, extractMetaTags(r.body));
  }
}

// --- Punto de entrada --------------------------------------------------

export async function fetchContent(url, source) {
  const acc = empty();
  try {
    if (source === 'tiktok') await fromTiktok(url, acc);
    else if (source === 'instagram') await fromInstagram(url, acc);
    else if (source === 'facebook') await fromFacebook(url, acc);
    else if (source === 'pinterest') await fromPinterest(url, acc);
    else if (source === 'youtube') await fromYoutube(url, acc);
    else await scrapeOg(url, acc, 'web');
  } catch (err) {
    acc.notas.push(`excepcion: ${String(err?.message || err)}`);
  }

  // Paso clave: si el texto enlaza a un blog, ahi puede estar la receta exacta y gratis.
  if (!acc.jsonLdRecipe) {
    const candidatos = extractUrlsFromText(acc.texto).filter((u) => detectSource(u) === 'web').slice(0, 2);
    for (const blog of candidatos) {
      const sub = empty();
      const ok = await scrapeOg(blog, sub, 'blog');
      if (!ok) continue;

      // Nos quedamos con las dos cosas: el JSON-LD por si basta, y el texto por si no.
      if (sub.jsonLdRecipe) acc.jsonLdRecipe = sub.jsonLdRecipe;
      if (sub.texto.length > 200) {
        acc.texto += `\n\n[Contenido del blog enlazado ${blog}]\n${sub.texto}`;
      }
      if (sub.jsonLdRecipe || sub.texto.length > 200) {
        acc.blogUrl = blog;
        acc.via.push(sub.jsonLdRecipe ? 'blog+jsonld' : 'blog:texto');
        break;
      }
    }
  }

  acc.texto = acc.texto.trim();
  return acc;
}
