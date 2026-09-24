import type { BorradorReceta } from './tipos';

/**
 * Importacion sin IA: texto pegado y paginas web con datos estructurados.
 *
 * Casi todos los blogs de recetas publican la receta en JSON-LD (schema.org
 * Recipe) para que Google la muestre con estrellas y tiempos. Leer eso es
 * gratis, instantaneo y exacto. Los reels y las fotos si necesitan IA y van por
 * el servidor (fase 3).
 */

// --- Texto ---------------------------------------------------------------

const CABECERA_INGREDIENTES = /^(ingredientes?|ingredients?|necesitas|lo que necesitas)\s*:?$/i;
const CABECERA_PASOS = /^(preparaci[oó]n|pasos|instrucciones|procedimiento|elaboraci[oó]n|modo de preparaci[oó]n|m[eé]todo|directions|instructions|steps)\s*:?$/i;

/** "- 2 tazas", "• sal", "1. Mezclar", "Paso 3: hornear" → texto limpio. */
function limpiar(linea: string): string {
  return linea
    .replace(/^\s*[-•*·▪️✅✔️👉]+\s*/u, '')
    .replace(/^\s*(paso\s*)?\d+\s*[.):-]\s+/i, '')
    .trim();
}

/** Parece ingrediente: corto y empieza con cantidad o con una medida tipica. */
function pareceIngrediente(linea: string): boolean {
  const l = limpiar(linea);
  if (l.length > 90) return false;
  return (
    /^(\d|½|¼|¾|⅓|⅔|un[ao]?s?\s|media?\s|pizca|chorrito|taza|cucharad)/i.test(l) ||
    /\b(al gusto|c\/n|cantidad necesaria)\b/i.test(l)
  );
}

/**
 * Convierte una receta pegada en borrador. Primero busca cabeceras
 * ("Ingredientes", "Preparacion"); si no hay, adivina linea a linea.
 */
export function recetaDesdeTexto(texto: string): BorradorReceta {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const titulo = limpiar(lineas[0] ?? '') || 'Receta sin título';
  const resto = lineas.slice(1);
  const ingredientes: string[] = [];
  const pasos: string[] = [];
  const notas: string[] = [];

  const hayCabeceras = resto.some((l) => CABECERA_INGREDIENTES.test(l) || CABECERA_PASOS.test(l));

  if (hayCabeceras) {
    let seccion: 'nota' | 'ing' | 'paso' = 'nota';
    for (const l of resto) {
      if (CABECERA_INGREDIENTES.test(l)) seccion = 'ing';
      else if (CABECERA_PASOS.test(l)) seccion = 'paso';
      else if (seccion === 'ing') ingredientes.push(limpiar(l));
      else if (seccion === 'paso') pasos.push(limpiar(l));
      else notas.push(l);
    }
  } else {
    for (const l of resto) {
      if (pareceIngrediente(l)) ingredientes.push(limpiar(l));
      else if (limpiar(l).length > 25) pasos.push(limpiar(l));
      else notas.push(l);
    }
  }

  return {
    title: titulo,
    description: notas.join(' ').slice(0, 400) || null,
    source_type: 'text',
    status: ingredientes.length && pasos.length ? 'complete' : 'needs_review',
    ingredients: ingredientes.filter(Boolean).map((raw_text) => ({ raw_text })),
    steps: pasos.filter(Boolean).map((text) => ({ text })),
  };
}

// --- Web -----------------------------------------------------------------

export function esEnlace(texto: string): boolean {
  return /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(texto.trim());
}

export function normalizarEnlace(texto: string): string {
  const t = texto.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/** Redes que no publican la receta en la pagina: necesitan la IA del servidor. */
export function esRedSocial(url: string): boolean {
  return /(instagram\.com|tiktok\.com|facebook\.com|fb\.watch|youtube\.com|youtu\.be|pinterest\.)/i.test(url);
}

export class RecetaNoEncontrada extends Error {}

/** "PT1H15M" → 75 */
function minutosIso(iso: unknown): number | null {
  if (typeof iso !== 'string') return null;
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return null;
  const total = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return total > 0 ? total : null;
}

function primerTexto(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return primerTexto(v[0]);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return primerTexto(o.url ?? o.name ?? o['@id']);
  }
  return null;
}

function decodificar(texto: string): string {
  return texto
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

/** recipeInstructions puede ser texto, lista de textos, HowToStep o HowToSection. */
function aplanarPasos(v: unknown): string[] {
  if (!v) return [];
  if (typeof v === 'string') {
    // Un bloque de texto: se parte en oraciones que empiezan con mayuscula
    return v
      .replace(/\.\s+(?=[A-ZÁÉÍÓÚÑ])/g, '.\n')
      .split(/\r?\n/)
      .map(decodificar)
      .filter(Boolean);
  }
  if (Array.isArray(v)) return v.flatMap(aplanarPasos);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (o.itemListElement) return aplanarPasos(o.itemListElement);
    if (typeof o.text === 'string') return [decodificar(o.text)];
    if (typeof o.name === 'string') return [decodificar(o.name)];
  }
  return [];
}

function esReceta(nodo: Record<string, unknown>): boolean {
  const tipo = nodo['@type'];
  return tipo === 'Recipe' || (Array.isArray(tipo) && tipo.includes('Recipe'));
}

/** Busca el nodo Recipe dentro de cualquier forma de JSON-LD (@graph, listas, anidado). */
function buscarReceta(dato: unknown): Record<string, unknown> | null {
  if (!dato || typeof dato !== 'object') return null;
  if (Array.isArray(dato)) {
    for (const d of dato) {
      const r = buscarReceta(d);
      if (r) return r;
    }
    return null;
  }
  const o = dato as Record<string, unknown>;
  if (esReceta(o)) return o;
  return buscarReceta(o['@graph']) ?? buscarReceta(o.mainEntity);
}

export async function recetaDesdeWeb(enlace: string): Promise<BorradorReceta> {
  const url = normalizarEnlace(enlace);
  const respuesta = await fetch(url, {
    headers: {
      // Algunos sitios devuelven una pagina vacia a clientes sin navegador
      'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36',
      'Accept-Language': 'es-419,es;q=0.9',
    },
  });
  if (!respuesta.ok) throw new Error(`La página respondió con un error (${respuesta.status}).`);
  return recetaDesdeHtml(await respuesta.text(), url);
}

/** La parte pura de recetaDesdeWeb, separada para poder probarla sin red. */
export function recetaDesdeHtml(html: string, url: string): BorradorReceta {
  const bloques = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  let receta: Record<string, unknown> | null = null;
  for (const b of bloques) {
    try {
      receta = buscarReceta(JSON.parse(b[1].trim()));
    } catch {
      // Hay sitios con JSON-LD mal formado; se prueba el siguiente bloque
    }
    if (receta) break;
  }
  if (!receta) throw new RecetaNoEncontrada('No encontramos una receta en esa página.');

  const ingredientes = (Array.isArray(receta.recipeIngredient) ? receta.recipeIngredient : [])
    .map((i) => decodificar(String(i)))
    .filter(Boolean);
  const pasos = aplanarPasos(receta.recipeInstructions);
  const porciones = Number(String(primerTexto(receta.recipeYield) ?? '').match(/\d+/)?.[0]);

  return {
    title: decodificar(String(receta.name ?? 'Receta sin título')),
    description: receta.description ? decodificar(String(receta.description)).slice(0, 400) : null,
    image_path: primerTexto(receta.image),
    servings: Number.isFinite(porciones) && porciones > 0 ? porciones : null,
    prep_minutes: minutosIso(receta.prepTime),
    cook_minutes: minutosIso(receta.cookTime) ?? (receta.prepTime ? null : minutosIso(receta.totalTime)),
    source_type: 'web',
    source_url: url,
    source_author: primerTexto(receta.author),
    status: ingredientes.length && pasos.length ? 'complete' : 'needs_review',
    ingredients: ingredientes.map((raw_text) => ({ raw_text })),
    steps: pasos.map((text) => ({ text })),
  };
}
