// Transcripcion de audio con Groq (Whisper). Solo se usa cuando el texto no alcanza
// y tenemos un archivo local: el spike NO descarga video de las redes.

export async function transcribeFile(path, { apiKey, model = 'whisper-large-v3-turbo' }) {
  const { readFile, stat } = await import('node:fs/promises');
  const { basename } = await import('node:path');

  const info = await stat(path);
  const MAX = 25 * 1024 * 1024; // limite del tier gratuito de Groq
  if (info.size > MAX) {
    throw new Error(`archivo de ${(info.size / 1048576).toFixed(1)} MB, por encima del limite de 25 MB`);
  }

  const form = new FormData();
  form.append('file', new Blob([await readFile(path)]), basename(path));
  form.append('model', model);
  form.append('language', 'es');
  form.append('response_format', 'json');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(j?.error?.message || `HTTP ${res.status}`);
  return { texto: j.text || '', segundos: j.duration || null };
}
