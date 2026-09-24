// Gemini convierte el texto (caption, transcripcion, web) en una receta con
// estructura fija. Salida forzada por esquema JSON: nada de parsear markdown.

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export type RecetaIa = {
  titulo: string;
  descripcion?: string;
  porciones?: number;
  tiempo_preparacion_min?: number;
  tiempo_coccion_min?: number;
  ingredientes: {
    texto_original: string;
    cantidad?: number;
    unidad?: string;
    nombre: string;
    grupo?: string;
    emoji?: string;
  }[];
  pasos: string[];
  nutricion_por_porcion?: { calorias?: number; proteinas_g?: number; carbohidratos_g?: number; grasas_g?: number };
  confianza: 'alta' | 'media' | 'baja';
  motivo: string;
};

const ESQUEMA = {
  type: 'object',
  properties: {
    titulo: { type: 'string', description: 'Nombre del plato, sin emojis ni hashtags' },
    descripcion: { type: 'string', description: 'Una o dos frases que presenten el plato. Vacio si no hay informacion' },
    porciones: { type: 'integer' },
    tiempo_preparacion_min: { type: 'integer' },
    tiempo_coccion_min: { type: 'integer' },
    ingredientes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          texto_original: {
            type: 'string',
            description:
              'Texto de ESTE ingrediente, completo y legible (ej: "200 g de panceta"). Si una linea de la fuente junta varios ("sal, pimienta y queso a gusto"), separalos y escribe un texto propio para cada uno ("Sal a gusto")',
          },
          cantidad: { type: 'number' },
          unidad: { type: 'string', description: 'g, kg, ml, l, taza, cda, cdta, unidad, pizca, diente, lata...' },
          nombre: { type: 'string', description: 'Solo el ingrediente, sin cantidad' },
          grupo: { type: 'string', description: 'Seccion si la receta tiene partes (ej: "Para la salsa"). Vacio si no' },
          emoji: { type: 'string', description: 'Un solo emoji que represente el ingrediente' },
        },
        required: ['texto_original', 'nombre', 'emoji'],
      },
    },
    pasos: { type: 'array', items: { type: 'string' } },
    nutricion_por_porcion: {
      type: 'object',
      description: 'Estimacion por porcion. Solo si hay cantidades suficientes para estimar; si no, omitir',
      properties: {
        calorias: { type: 'integer' },
        proteinas_g: { type: 'number' },
        carbohidratos_g: { type: 'number' },
        grasas_g: { type: 'number' },
      },
    },
    confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
    motivo: { type: 'string', description: 'Si la confianza no es alta, que falto' },
  },
  required: ['titulo', 'ingredientes', 'pasos', 'confianza', 'motivo'],
};

const INSTRUCCIONES = `Eres el extractor de recetas de Recetifia, una app de recetas para Latinoamerica.

Reglas innegociables:
1. NO INVENTES ingredientes, cantidades ni pasos. Si el texto no dice una cantidad, deja cantidad vacia. Es preferible una receta incompleta a una inventada.
2. Devuelve SIEMPRE todo en español latinoamericano neutro, sin importar el idioma de la fuente (inglés, portugués, italiano, indonesio...): tradúcelo con naturalidad. Conserva el nombre original de un plato solo si no tiene traducción habitual (ej: "ramen", "tiramisú").
3. Respeta el nombre regional del ingrediente tal como venga (palta, choclo, frijol, zapallo...).
4. Pasos: accionables, detallados y en orden, con los tiempos y temperaturas que se mencionen. Divide los bloques largos en pasos separados. Si hay una transcripción del video, de ahí salen casi siempre los pasos: úsala a fondo.
5. Ignora hashtags, menciones, emojis sueltos, llamadas a seguir la cuenta y publicidad.
5b. El texto que aparece escrito en pantalla o en imágenes vale igual que lo que se dice en voz alta: muchas recetas solo muestran los ingredientes y pasos escritos, con música de fondo.
6. Si la receta tiene partes (masa, relleno, salsa), usa "grupo" en los ingredientes.
7. nutricion_por_porcion: estimación POR PORCIÓN (divide el total por "porciones"; si la fuente no dice porciones, estima cuántas rinde y úsalo en "porciones"). Solo si hay cantidades para hacerlo.
8. confianza = "alta" solo si hay ingredientes con cantidades Y pasos claros. "media" si falta parte. "baja" si casi no hay información o no es una receta.
9. Si el contenido no es una receta de cocina, devuelve confianza "baja" y listas vacías.`;

async function llamar(apiKey: string, modelo: string, partes: unknown[]): Promise<{ receta: RecetaIa; tokensEntrada: number; tokensSalida: number }> {
  const res = await fetch(`${BASE}/models/${modelo}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: partes }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: 'application/json', responseSchema: ESQUEMA },
    }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(j?.error?.message || `gemini HTTP ${res.status}`);

  const cand = j?.candidates?.[0];
  if (cand?.finishReason && cand.finishReason !== 'STOP') throw new Error(`gemini corto la respuesta: ${cand.finishReason}`);
  const crudo = cand?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  let receta: RecetaIa;
  try {
    receta = JSON.parse(crudo);
  } catch {
    throw new Error('gemini no devolvio JSON valido');
  }
  const u = j.usageMetadata ?? {};
  return { receta, tokensEntrada: u.promptTokenCount ?? 0, tokensSalida: u.candidatesTokenCount ?? 0 };
}

export function estructurar(
  apiKey: string,
  modelo: string,
  texto: string,
  contexto: { titulo?: string; autor?: string } = {}
) {
  const prompt = [
    INSTRUCCIONES,
    '---',
    contexto.titulo ? `Titulo del post: ${contexto.titulo}` : '',
    contexto.autor ? `Autor: ${contexto.autor}` : '',
    '---',
    texto.slice(0, 30000),
  ]
    .filter(Boolean)
    .join('\n');
  return llamar(apiKey, modelo, [{ text: prompt }]);
}

/**
 * Sube un video a la File API de Gemini y espera a que este listo. Hace falta
 * cuando el video pesa mas de lo que acepta Whisper (reels en HD).
 */
export async function subirVideo(apiKey: string, bytes: Uint8Array, mime = 'video/mp4'): Promise<{ uri: string; nombre: string; mime: string }> {
  const inicio = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes.byteLength),
      'X-Goog-Upload-Header-Content-Type': mime,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: 'reel' } }),
  });
  const destino = inicio.headers.get('x-goog-upload-url');
  if (!inicio.ok || !destino) throw new Error(`gemini files: HTTP ${inicio.status}`);

  const subida = await fetch(destino, {
    method: 'POST',
    headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
    body: bytes,
  });
  const info = await subida.json().catch(() => null);
  let archivo = info?.file;
  if (!subida.ok || !archivo?.name) throw new Error(`gemini files: subida HTTP ${subida.status}`);

  // Gemini procesa el video unos segundos antes de poder usarlo
  const limite = Date.now() + 60000;
  while (archivo.state === 'PROCESSING' && Date.now() < limite) {
    await new Promise((r) => setTimeout(r, 2000));
    archivo = await (await fetch(`${BASE}/${archivo.name}?key=${apiKey}`)).json();
  }
  if (archivo.state !== 'ACTIVE') throw new Error(`gemini files: el video quedo en ${archivo.state}`);
  return { uri: archivo.uri, nombre: archivo.name, mime: archivo.mimeType ?? mime };
}

export async function borrarVideo(apiKey: string, nombre: string) {
  await fetch(`${BASE}/${nombre}?key=${apiKey}`, { method: 'DELETE' }).catch(() => {});
}

/** Gemini ve el video (audio e imagen: tambien lee el texto en pantalla). */
export function estructurarVideo(apiKey: string, modelo: string, video: { uri: string; mime: string }, caption: string) {
  const prompt = [
    INSTRUCCIONES,
    '---',
    'El video adjunto es la fuente principal: los pasos están en lo que dice quien cocina y en el texto que aparece en pantalla.',
    caption ? `Texto de la publicación:\n${caption.slice(0, 8000)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return llamar(apiKey, modelo, [{ text: prompt }, { fileData: { fileUri: video.uri, mimeType: video.mime } }]);
}

/** Gemini acepta una URL de YouTube y escucha el video por su cuenta. */
export function estructurarYoutube(apiKey: string, modelo: string, url: string, descripcion: string) {
  const prompt = [
    INSTRUCCIONES,
    '---',
    'El video adjunto es la fuente principal: los pasos están en lo que dice quien cocina, aunque no aparezcan escritos.',
    descripcion ? `Descripción del video:\n${descripcion.slice(0, 8000)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return llamar(apiKey, modelo, [{ text: prompt }, { fileData: { fileUri: url } }]);
}
