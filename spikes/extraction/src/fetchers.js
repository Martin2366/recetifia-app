// Obtencion de contenido publico. Cada fetcher intenta lo barato primero.
// Devuelve siempre: { titulo, autor, miniatura, texto, via[], notas[], blogUrl }

import {
  httpGet, httpGetJson, extractMetaTags, extractRecipeJsonLd, recipeFromJsonLd,
  extractUrlsFromText, extractReadableText, decodeHtml, detectSource, BROWSER_UA,
} from './util.js';

const GRAPH_VERSIONS = (process.env.GRAPH_API_VERSION || 'v23.0,v20.0,v16.0').split(',');

function empty() {
  return {
    titulo: '', autor: '', miniatura: null, texto: '',
    via: [], notas: [], candidatos: [], blogUrl: null, jsonLdRecipe: null,
  };
}

/** Saca del HTML de un pin los enlaces externos que Pinterest guarda como origen. */
function enlacesDeOrigen(html = '') {
  const out = new Set();
  const re = /"link":"(https?:[^"]{10,300})"/g;
  let m;
  while ((m = re.exec(html)) && out.size < 5) {
    const u = m[1].replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
    if (!/pinterest|pinimg/i.test(u)) out.add(u);
  }
  return [...out];
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

/** ¿La respuesta trae algo aprovechable, o es la carcasa de JavaScript? */
function tieneAlgo(body) {
  if (!body) return false;
  const m = extractMetaTags(body);
  return Boolean(m['og:description'] || m['og:title'] || m['description']) || /application\/ld\+json/i.test(body);
}

async function scrapeOg(url, acc, label) {
  let r = await httpGet(url);

  // Instagram y compania devuelven una pagina vacia al UA de navegador pero las
  // meta tags completas a un bot. Otros sitios hacen justo lo contrario.
  if (r.ok && !tieneAlgo(r.body)) {
    const alt = await httpGet(url, { ua: BROWSER_UA });
    if (alt.ok && tieneAlgo(alt.body)) {
      r = alt;
      acc.notas.push(`${label}: hizo falta UA de navegador`);
    }
  }

  if (!r.ok || !r.body) {
    acc.notas.push(`${label}: fallo (${r.status || r.error})`);
    return false;
  }
  const before = acc.texto.length;
  addMeta(acc, extractMetaTags(r.body));

  // Pinterest esconde el enlace al blog de origen en el cuerpo de la pagina:
  // ahi es donde suele estar la receta de verdad, no en el pin.
  if (label.includes('pinterest')) {
    for (const enlace of enlacesDeOrigen(r.body)) acc.candidatos.push(enlace);
  }

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

  if (acc.texto.length > before && !acc.via.includes(label)) acc.via.push(label);
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
  // El oEmbed sin token de Meta responde 200 pero solo devuelve el iframe de
  // incrustacion: ni caption, ni autor, ni miniatura. Comprobado, no sirve de nada.
  // El caption si esta en las meta tags de la propia pagina, que Instagram entrega
  // a cualquier cliente que no se presente como un navegador completo.
  await scrapeOg(url, acc, 'og:instagram');
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
    // Primero los enlaces de origen que la plataforma declara (Pinterest),
    // despues los que aparezcan escritos en el caption.
    const delTexto = extractUrlsFromText(acc.texto).filter((u) => detectSource(u) === 'web');
    const candidatos = [...new Set([...acc.candidatos, ...delTexto])].slice(0, 3);
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
