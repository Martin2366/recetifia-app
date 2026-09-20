// Transcripcion de audio con Groq (Whisper). Solo se usa cuando el texto no alcanza
// y tenemos un archivo local: el spike NO descarga video de las redes.

const MAX = 25 * 1024 * 1024; // limite del tier gratuito de Groq

/**
 * Descarga el video y lo transcribe. Whisper acepta mp4 directamente, asi que
 * no hace falta ffmpeg ni extraer el audio por separado.
 */
export async function transcribeUrl(url, { apiKey, model = 'whisper-large-v3-turbo' }) {
  const res = await fetch(url, { headers: { 'user-agent': 'RecetifiaBot/0.1' } });
  if (!res.ok) throw new Error(`descarga del video: HTTP ${res.status}`);

  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > MAX) {
    throw new Error(`video de ${(buf.byteLength / 1048576).toFixed(1)} MB, por encima del limite de 25 MB`);
  }
  if (buf.byteLength < 10000) throw new Error('el video descargado esta vacio o es demasiado pequeno');

  return { ...(await enviarAGroq(buf, 'video.mp4', apiKey, model)), bytes: buf.byteLength, origen: 'whisper' };
}

async function enviarAGroq(bytes, nombre, apiKey, model) {
  const form = new FormData();
  form.append('file', new Blob([bytes]), nombre);
  form.append('model', model);
  form.append('language', 'es');
  form.append('response_format', 'json');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(j?.error?.message || `groq: HTTP ${res.status}`);
  return { texto: j.text || '', segundos: j.duration || null };
}

/** Misma transcripcion, pero desde un archivo local (el fallback "comparte el video"). */
export async function transcribeFile(path, { apiKey, model = 'whisper-large-v3-turbo' }) {
  const { readFile, stat } = await import('node:fs/promises');
  const { basename } = await import('node:path');

  const info = await stat(path);
  if (info.size > MAX) {
    throw new Error(`archivo de ${(info.size / 1048576).toFixed(1)} MB, por encima del limite de 25 MB`);
  }
  return enviarAGroq(await readFile(path), basename(path), apiKey, model);
}
