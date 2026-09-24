// Primera pasada, la gratis: lo que se puede leer de la pagina publica.
// Para redes sociales es el caption (meta tags); para blogs, el JSON-LD.

import {
  BROWSER_UA, decodificar, detectarFuente, httpGet, jsonLdSuficiente, metaTags, recetaJsonLd,
  textoLegible, urlsEnTexto, type Fuente, type RecetaJsonLd,
} from './util.ts';

export type Contenido = {
  titulo: string;
  autor: string;
  miniatura: string | null;
  texto: string;
  jsonLd: RecetaJsonLd | null;
  /** Web del creador de donde salio la receta, si no estaba en el post. */
  blog: string | null;
  via: string[];
};

function vacio(): Contenido {
  return { titulo: '', autor: '', miniatura: null, texto: '', jsonLd: null, blog: null, via: [] };
}

function tieneAlgo(html: string) {
  const m = metaTags(html);
  return Boolean(m['og:description'] || m['og:title'] || m['description']) || /application\/ld\+json/i.test(html);
}

/** Pinterest guarda el enlace al blog de origen dentro del HTML del pin. */
function enlacesDeOrigen(html = ''): string[] {
  const out = new Set<string>();
  const re = /"link":"(https?:[^"]{10,300})"/g;
  let m;
  while ((m = re.exec(html)) && out.size < 5) {
    const u = m[1].replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
    if (!/pinterest|pinimg/i.test(u)) out.add(u);
  }
  return [...out];
}

async function pagina(url: string, acc: Contenido, esWeb: boolean): Promise<string[]> {
  let r = await httpGet(url);
  // Instagram da una carcasa vacia a un navegador y las meta tags a un bot;
  // otros sitios hacen lo contrario.
  if (r.ok && !tieneAlgo(r.body)) {
    const alt = await httpGet(url, { ua: BROWSER_UA });
    if (alt.ok && tieneAlgo(alt.body)) r = alt;
  }
  if (!r.ok || !r.body) return [];

  const m = metaTags(r.body);
  if (!acc.titulo) acc.titulo = m['og:title'] || m['twitter:title'] || m['<title>'] || '';
  if (!acc.miniatura) acc.miniatura = m['og:image'] || m['twitter:image'] || null;
  const desc = m['og:description'] || m['twitter:description'] || m['description'] || '';
  if (desc) acc.texto += (acc.texto ? '\n' : '') + desc;

  const receta = recetaJsonLd(r.body);
  if (receta) {
    acc.jsonLd = receta;
    acc.via.push('jsonld');
  }
  // En blogs el cuerpo de la pagina rescata la receta cuando el JSON-LD viene pobre;
  // en redes sociales es solo ruido.
  if (esWeb) {
    const cuerpo = textoLegible(r.body);
    if (cuerpo.length > 200) acc.texto += `\n\n${cuerpo}`;
  }
  return detectarFuente(url) === 'pinterest' ? enlacesDeOrigen(r.body) : [];
}

async function descripcionYoutube(url: string, acc: Contenido) {
  const r = await httpGet(url, { ua: BROWSER_UA });
  if (!r.ok) return;
  const m = /"shortDescription":"([\s\S]*?)","/.exec(r.body);
  if (m) {
    try {
      acc.texto += JSON.parse(`"${m[1]}"`);
    } catch {
      // descripcion ilegible
    }
  }
  const meta = metaTags(r.body);
  acc.titulo ||= meta['og:title'] || '';
  acc.miniatura ||= meta['og:image'] || null;
  const canal = /"ownerChannelName":"([^"]+)"/.exec(r.body)?.[1];
  if (canal) acc.autor = canal;
}

export async function obtenerContenido(url: string, fuente: Fuente): Promise<Contenido> {
  const acc = vacio();
  let candidatos: string[] = [];

  if (fuente === 'youtube') await descripcionYoutube(url, acc);
  else candidatos = await pagina(url, acc, fuente === 'web');

  if (acc.texto) acc.via.push('caption');

  // Si el post enlaza a la web del creador, ahi suele estar la receta exacta y gratis
  if (fuente !== 'web' && !jsonLdSuficiente(acc.jsonLd)) {
    const delTexto = urlsEnTexto(acc.texto).filter((u) => detectarFuente(u) === 'web');
    for (const blog of [...new Set([...candidatos, ...delTexto])].slice(0, 3)) {
      const sub = vacio();
      await pagina(blog, sub, true);
      if (sub.jsonLd || sub.texto.length > 200) {
        if (sub.jsonLd) acc.jsonLd = sub.jsonLd;
        if (sub.texto.length > 200) acc.texto += `\n\n[Web del creador: ${blog}]\n${sub.texto}`;
        acc.miniatura ||= sub.miniatura;
        acc.blog = blog;
        acc.via.push('web_creador');
        break;
      }
    }
  }

  // Autor de Instagram: el titulo de la pagina es "Nombre (@usuario) on Instagram: ..."
  const arroba = /\(@([\w.]+)\)/.exec(acc.titulo)?.[1] ?? /^([\w.]+) on (Instagram|TikTok)/i.exec(acc.titulo)?.[1];
  if (arroba) acc.autor = `@${arroba}`;
  acc.texto = decodificar(acc.texto).trim();
  return acc;
}
