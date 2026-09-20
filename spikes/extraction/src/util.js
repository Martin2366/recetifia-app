// Utilidades compartidas del spike.

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

export async function httpGet(url, { timeoutMs = 20000, headers = {} } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': UA, 'accept-language': 'es-ES,es;q=0.9,en;q=0.8', ...headers },
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, finalUrl: res.url || url, body };
  } catch (err) {
    return { ok: false, status: 0, finalUrl: url, body: '', error: String(err?.message || err) };
  } finally {
    clearTimeout(t);
  }
}

export async function httpGetJson(url, opts) {
  const r = await httpGet(url, opts);
  if (!r.ok) return { ...r, json: null };
  try {
    return { ...r, json: JSON.parse(r.body) };
  } catch {
    return { ...r, ok: false, json: null, error: 'respuesta no es JSON' };
  }
}

/** Detecta la plataforma a partir del host. */
export function detectSource(url) {
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return 'invalida';
  }
  if (/(^|\.)instagram\.com$/.test(host)) return 'instagram';
  if (/(^|\.)tiktok\.com$/.test(host)) return 'tiktok';
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) return 'youtube';
  if (/(^|\.)(facebook\.com|fb\.watch)$/.test(host)) return 'facebook';
  if (/(^|\.)(pinterest\.[a-z.]+|pin\.it)$/.test(host)) return 'pinterest';
  return 'web';
}

/** Quita parametros de tracking para que la cache compartida acierte mas. */
export function canonicalizeUrl(url) {
  try {
    const u = new URL(url);
    const drop = [/^utm_/i, /^fbclid$/i, /^igshid$/i, /^igsh$/i, /^si$/i, /^_r$/i, /^is_from_webapp$/i, /^sender_device$/i, /^web_id$/i];
    for (const key of [...u.searchParams.keys()]) {
      if (drop.some((re) => re.test(key))) u.searchParams.delete(key);
    }
    u.hash = '';
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '');
    return u.toString();
  } catch {
    return url;
  }
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };

export function decodeHtml(s = '') {
  return s
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, e) => ENTITIES[e])
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

/** Extrae meta tags Open Graph / Twitter / description. */
export function extractMetaTags(html = '') {
  const out = {};
  const re = /<meta\s+([^>]+?)\/?>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
    const val = /content\s*=\s*["']([\s\S]*?)["']/i.exec(attrs)?.[1];
    if (key && val != null) out[key.toLowerCase()] = decodeHtml(val).trim();
  }
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  if (title) out['<title>'] = decodeHtml(title).trim();
  return out;
}

/** Busca un objeto schema.org/Recipe dentro de los bloques JSON-LD. Es la mejor fuente posible. */
export function extractRecipeJsonLd(html = '') {
  const re = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const candidates = [];
  let m;
  while ((m = re.exec(html))) {
    const raw = m[1].trim().replace(/^﻿/, '');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue; // JSON-LD roto: muy comun, lo ignoramos sin ruido
    }
    const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
    while (queue.length) {
      const node = queue.shift();
      if (!node || typeof node !== 'object') continue;
      if (Array.isArray(node)) {
        queue.push(...node);
        continue;
      }
      if (node['@graph']) queue.push(...[].concat(node['@graph']));
      const type = [].concat(node['@type'] || []).map((t) => String(t).toLowerCase());
      if (type.includes('recipe')) candidates.push(node);
    }
  }
  return candidates[0] || null;
}

/** Convierte un schema.org/Recipe en nuestro formato, sin pasar por la IA. */
export function recipeFromJsonLd(node) {
  const text = (v) => (typeof v === 'string' ? decodeHtml(v).trim() : '');
  const steps = [];
  const walkSteps = (v) => {
    if (!v) return;
    if (typeof v === 'string') {
      // A veces viene un unico bloque HTML con todos los pasos
      const parts = v.split(/<\/li>|<br\s*\/?>|\n/gi).map((s) => decodeHtml(s.replace(/<[^>]+>/g, '')).trim());
      parts.filter(Boolean).forEach((p) => steps.push(p));
      return;
    }
    if (Array.isArray(v)) return v.forEach(walkSteps);
    if (typeof v === 'object') {
      if (v.itemListElement) return walkSteps(v.itemListElement);
      if (v.text) return walkSteps(v.text);
      if (v.name) return walkSteps(v.name);
    }
  };
  walkSteps(node.recipeInstructions);

  const ingredients = [].concat(node.recipeIngredient || node.ingredients || [])
    .map((i) => text(i))
    .filter(Boolean);

  const img = node.image;
  const imageUrl =
    typeof img === 'string' ? img : Array.isArray(img) ? (typeof img[0] === 'string' ? img[0] : img[0]?.url) : img?.url;

  return {
    titulo: text(node.name),
    descripcion: text(node.description),
    porciones: parseServings(node.recipeYield),
    ingredientes_texto: ingredients,
    pasos: steps,
    imagen: imageUrl || null,
  };
}

function parseServings(y) {
  if (y == null) return null;
  const s = Array.isArray(y) ? String(y[0]) : String(y);
  const n = /(\d+)/.exec(s)?.[1];
  return n ? Number(n) : null;
}

/** Saca URLs de un texto libre (para detectar el blog enlazado en un caption). */
export function extractUrlsFromText(text = '') {
  const re = /https?:\/\/[^\s"'<>)\]]+/gi;
  return [...new Set((text.match(re) || []).map((u) => u.replace(/[.,;:]+$/, '')))];
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function truncate(s = '', n = 120) {
  const one = String(s).replace(/\s+/g, ' ').trim();
  return one.length <= n ? one : one.slice(0, n - 1) + '…';
}

/**
 * Texto legible del cuerpo de la pagina. Red de seguridad para cuando el JSON-LD
 * existe pero viene pobre, que resulta ser bastante comun.
 */
export function extractReadableText(html = '', maxChars = 6000) {
  const limpio = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(nav|header|footer|aside|form|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeHtml(limpio)
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .split('\n').map((l) => l.trim()).join('\n')
    .trim()
    .slice(0, maxChars);
}

/**
 * ¿El JSON-LD trae suficiente para saltarse la IA? Muchos sitios publican un
 * Recipe incompleto (ingredientes en una sola cadena, sin pasos) y fiarse de el
 * produce recetas peores que las de la IA.
 */
export function jsonLdEsSuficiente(receta) {
  if (!receta) return false;
  const ings = receta.ingredientes_texto || [];
  const pasos = receta.pasos || [];
  if (ings.length === 1 && (ings[0].match(/,/g) || []).length >= 2) return false; // lista colapsada en una cadena
  return ings.length >= 3 && pasos.length >= 2;
}
