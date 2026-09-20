// Convierte texto libre en una receta estructurada usando Gemini.
// Salida forzada por esquema JSON: nada de parsear markdown a mano.

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export async function listModels(apiKey) {
  const res = await fetch(`${BASE}/models?key=${apiKey}&pageSize=100`);
  const j = await res.json();
  if (!res.ok) throw new Error(j?.error?.message || `HTTP ${res.status}`);
  return (j.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => ({
      name: String(m.name).replace(/^models\//, ''),
      display: m.displayName || '',
      inputLimit: m.inputTokenLimit,
    }));
}

const SCHEMA = {
  type: 'object',
  properties: {
    titulo: { type: 'string', description: 'Nombre del plato, en espanol' },
    descripcion: { type: 'string' },
    porciones: { type: 'integer' },
    tiempo_preparacion_min: { type: 'integer' },
    tiempo_coccion_min: { type: 'integer' },
    ingredientes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          texto_original: { type: 'string', description: 'La linea tal cual aparecia en la fuente' },
          cantidad: { type: 'number' },
          unidad: { type: 'string', description: 'Unidad metrica normalizada: g, kg, ml, l, taza, cda, cdta, unidad, pizca' },
          nombre: { type: 'string', description: 'Nombre del ingrediente, sin cantidad' },
        },
        required: ['texto_original', 'nombre'],
      },
    },
    pasos: { type: 'array', items: { type: 'string' } },
    confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
    motivo: { type: 'string', description: 'Si la confianza no es alta, que falto' },
  },
  required: ['titulo', 'ingredientes', 'pasos', 'confianza', 'motivo'],
};

const INSTRUCCIONES = [
  'Eres un extractor de recetas para una app hispanohablante (LATAM).',
  '',
  'Reglas innegociables:',
  '1. NO INVENTES. Si el texto no dice una cantidad, deja el campo vacio. Es preferible una receta incompleta a una inventada.',
  '2. Conserva en texto_original la linea exacta del ingrediente tal como aparecia.',
  '3. Usa unidades metricas y espanol neutro. Respeta el nombre regional del ingrediente tal como venga (palta, choclo, frijol...).',
  '4. Los pasos deben ser accionables y estar en orden. Divide los bloques largos en pasos separados.',
  '5. Ignora hashtags, menciones, emojis sueltos y llamadas a seguir la cuenta.',
  '6. confianza = "alta" solo si hay ingredientes con cantidades Y pasos claros.',
  '   "media" si falta parte. "baja" si esto no parece una receta o casi no hay informacion.',
  '7. Si el contenido no es una receta de cocina, devuelve confianza "baja" y listas vacias.',
  '',
  'Texto de la fuente:',
].join('\n');

export async function structureRecipe({ apiKey, model, texto, contexto = {} }) {
  const prompt = [
    INSTRUCCIONES,
    '---',
    contexto.titulo ? `Titulo del post: ${contexto.titulo}` : '',
    contexto.autor ? `Autor: ${contexto.autor}` : '',
    '---',
    texto.slice(0, 30000),
  ].filter(Boolean).join('\n');

  const res = await fetch(`${BASE}/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: 'application/json', responseSchema: SCHEMA },
    }),
  });

  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(j?.error?.message || `HTTP ${res.status}`);

  const cand = j?.candidates?.[0];
  const raw = cand?.content?.parts?.map((p) => p.text).join('') || '';
  if (cand?.finishReason && cand.finishReason !== 'STOP') {
    throw new Error(`la respuesta se corto: ${cand.finishReason}`);
  }
  let receta;
  try {
    receta = JSON.parse(raw);
  } catch {
    throw new Error('la respuesta no era JSON valido');
  }

  const u = j.usageMetadata || {};
  return {
    receta,
    usage: {
      in: u.promptTokenCount || 0,
      out: u.candidatesTokenCount || 0,
      total: u.totalTokenCount || 0,
    },
  };
}

/**
 * Gemini acepta una URL de YouTube y procesa el audio y el video por su cuenta.
 * Sin descargas, sin Apify, sin Whisper: para esta fuente el paso a paso sale gratis.
 */
export async function structureFromYoutube({ apiKey, model, url, texto = '' }) {
  const prompt = [
    INSTRUCCIONES,
    '---',
    'El video adjunto es la fuente principal. Escucha lo que dice quien cocina:',
    'ahi estan los pasos, aunque no aparezcan escritos.',
    texto ? `\nTexto de la descripcion:\n${texto.slice(0, 8000)}` : '',
  ].filter(Boolean).join('\n');

  const res = await fetch(`${BASE}/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }, { fileData: { fileUri: url } }],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: 'application/json', responseSchema: SCHEMA },
    }),
  });

  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(j?.error?.message || `HTTP ${res.status}`);

  const cand = j?.candidates?.[0];
  const raw = cand?.content?.parts?.map((p) => p.text).join('') || '';
  if (cand?.finishReason && cand.finishReason !== 'STOP') {
    throw new Error(`la respuesta se corto: ${cand.finishReason}`);
  }
  let receta;
  try { receta = JSON.parse(raw); } catch { throw new Error('la respuesta no era JSON valido'); }

  const u = j.usageMetadata || {};
  return { receta, usage: { in: u.promptTokenCount || 0, out: u.candidatesTokenCount || 0, total: u.totalTokenCount || 0 } };
}

export function estimateCost(usage, priceInPerM, priceOutPerM) {
  return (usage.in / 1e6) * priceInPerM + (usage.out / 1e6) * priceOutPerM;
}
