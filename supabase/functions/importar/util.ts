// Utilidades del pipeline de importacion. Portadas del spike de la fase 0
// (spikes/extraction/src/util.js), donde se midieron contra enlaces reales.

/**
 * Nos identificamos como lo que somos. Instagram sirve las meta tags con el
 * caption a cualquier cliente que no parezca un navegador completo.
 */
export const BOT_UA = 'RecetifiaBot/1.0 (+https://recetifia.app; link preview)';

/** Algunos sitios solo responden bien a un navegador. Segundo intento. */
export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

export type Fuente = 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'pinterest' | 'web';

export async function httpGet(url: string, { timeoutMs = 20000, ua = BOT_UA } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': ua, 'accept-language': 'es-419,es;q=0.9,en;q=0.8' },
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, finalUrl: res.url || url, body };
  } catch (err) {
    return { ok: false, status: 0, finalUrl: url, body: '', error: String((err as Error)?.message ?? err) };
  } finally {
    clearTimeout(t);
  }
}

export function detectarFuente(url: string): Fuente | null {
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
  if (/(^|\.)instagram\.com$/.test(host)) return 'instagram';
  if (/(^|\.)tiktok\.com$/.test(host)) return 'tiktok';
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) return 'youtube';
  if (/(^|\.)(facebook\.com|fb\.watch)$/.test(host)) return 'facebook';
  if (/(^|\.)(pinterest\.[a-z.]+|pin\.it)$/.test(host)) return 'pinterest';
  return 'web';
}

/** Quita parametros de tracking para que la cache compartida acierte mas. */
export function canonicalizar(url: string): string {
  try {
    const u = new URL(url);
    const fuera = [
      /^utm_/i, /^fbclid$/i, /^igshid$/i, /^igsh$/i, /^stkn$/i, /^si$/i, /^_r$/i, /^is_from_webapp$/i,
      /^sender_device$/i, /^web_id$/i, /^invite_code$/i, /^sender$/i, /^sfo$/i, /^_t$/i,
    ];
    for (const clave of [...u.searchParams.keys()]) {
      if (fuera.some((re) => re.test(clave))) u.searchParams.delete(clave);
    }
    u.hash = '';
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '');
    return u.toString();
  } catch {
    return url;
  }
}

export async function sha256(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };

export function decodificar(s = ''): string {
  return s
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, e) => ENTIDADES[e])
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

export function metaTags(html = ''): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<meta\s+([^>]+?)\/?>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    const clave = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
    const valor = /content\s*=\s*["']([\s\S]*?)["']/i.exec(attrs)?.[1];
    if (clave && valor != null) out[clave.toLowerCase()] = decodificar(valor).trim();
  }
  const titulo = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  if (titulo) out['<title>'] = decodificar(titulo).trim();
  return out;
}

export type RecetaJsonLd = {
  titulo: string;
  descripcion: string;
  porciones: number | null;
  ingredientes: string[];
  pasos: string[];
  imagen: string | null;
  autor: string | null;
  prep: number | null;
  coccion: number | null;
};

function minutosIso(iso: unknown): number | null {
  if (typeof iso !== 'string') return null;
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return null;
  const total = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return total > 0 ? total : null;
}

/** Busca un schema.org/Recipe en los bloques JSON-LD. La mejor fuente posible: exacta y gratis. */
export function recetaJsonLd(html = ''): RecetaJsonLd | null {
  const re = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    let dato: unknown;
    try {
      dato = JSON.parse(m[1].trim().replace(/^﻿/, ''));
    } catch {
      continue; // JSON-LD roto: muy comun
    }
    const cola: unknown[] = Array.isArray(dato) ? [...dato] : [dato];
    while (cola.length) {
      const nodo = cola.shift() as Record<string, unknown> | null;
      if (!nodo || typeof nodo !== 'object') continue;
      if (Array.isArray(nodo)) {
        cola.push(...nodo);
        continue;
      }
      if (nodo['@graph']) cola.push(...([] as unknown[]).concat(nodo['@graph']));
      const tipos = ([] as unknown[]).concat(nodo['@type'] ?? []).map((t) => String(t).toLowerCase());
      if (tipos.includes('recipe')) return desdeNodo(nodo);
    }
  }
  return null;
}

function desdeNodo(n: Record<string, unknown>): RecetaJsonLd {
  const texto = (v: unknown) => (typeof v === 'string' ? decodificar(v.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() : '');
  const pasos: string[] = [];
  const recorrer = (v: unknown): void => {
    if (!v) return;
    if (typeof v === 'string') {
      v.split(/<\/li>|<br\s*\/?>|\n/gi).map(texto).filter(Boolean).forEach((p) => pasos.push(p));
      return;
    }
    if (Array.isArray(v)) return v.forEach(recorrer);
    if (typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (o.itemListElement) return recorrer(o.itemListElement);
      if (o.text) return recorrer(o.text);
      if (o.name) return recorrer(o.name);
    }
  };
  recorrer(n.recipeInstructions);

  const img = n.image as unknown;
  const imagen =
    typeof img === 'string'
      ? img
      : Array.isArray(img)
        ? typeof img[0] === 'string'
          ? img[0]
          : (img[0] as { url?: string })?.url
        : (img as { url?: string })?.url;
  const autor = n.author as unknown;
  const yieldTexto = Array.isArray(n.recipeYield) ? String(n.recipeYield[0]) : String(n.recipeYield ?? '');

  return {
    titulo: texto(n.name),
    descripcion: texto(n.description),
    porciones: Number(/(\d+)/.exec(yieldTexto)?.[1]) || null,
    ingredientes: ([] as unknown[]).concat(n.recipeIngredient ?? []).map(texto).filter(Boolean),
    pasos,
    imagen: imagen ?? null,
    autor: typeof autor === 'string' ? autor : ((Array.isArray(autor) ? autor[0] : autor) as { name?: string })?.name ?? null,
    prep: minutosIso(n.prepTime),
    coccion: minutosIso(n.cookTime),
  };
}

/**
 * ¿El JSON-LD basta? Muchos sitios publican un Recipe incompleto (ingredientes
 * en una sola cadena, sin pasos); fiarse de el da recetas peores que la IA.
 */
export function jsonLdSuficiente(r: RecetaJsonLd | null): boolean {
  if (!r) return false;
  if (r.ingredientes.length === 1 && (r.ingredientes[0].match(/,/g) ?? []).length >= 2) return false;
  return r.ingredientes.length >= 3 && r.pasos.length >= 2;
}

export function urlsEnTexto(texto = ''): string[] {
  const re = /https?:\/\/[^\s"'<>)\]]+/gi;
  return [...new Set((texto.match(re) ?? []).map((u) => u.replace(/[.,;:]+$/, '')))];
}

/** Texto legible del cuerpo de una pagina: la red de seguridad cuando el JSON-LD viene pobre. */
export function textoLegible(html = '', max = 6000): string {
  const limpio = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(nav|header|footer|aside|form|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodificar(limpio)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .trim()
    .slice(0, max);
}

/** Subtitulos WebVTT/SRT a texto corrido. */
export function subtitulosATexto(raw = ''): string {
  const out: string[] = [];
  for (const l of raw.split(/\r?\n/)) {
    const t = l.trim();
    if (!t || /^WEBVTT/i.test(t) || /^\d+$/.test(t) || /-->/.test(t) || /^(NOTE|STYLE|REGION)\b/i.test(t)) continue;
    const limpio = t.replace(/<[^>]+>/g, '').trim();
    if (!limpio || out[out.length - 1] === limpio) continue;
    out.push(limpio);
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}
