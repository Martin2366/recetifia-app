import { cacheDirectory, copyAsync, deleteAsync, FileSystemUploadType, getInfoAsync, uploadAsync } from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { getThumbnailAsync } from 'expo-video-thumbnails';

import { prepararFotos, type FotoReceta } from './fotos';
import { nuevoId } from './guardado-local';
import { supabase } from './supabase';

/**
 * Importar desde un video de la galeria (un reel descargado, una grabacion
 * propia). El video se sube tal cual a una carpeta privada; el servidor lo
 * escucha o lo mira con IA y lo borra al terminar. Cuenta como una importacion.
 */

/** Igual que el limite del bucket "videos". */
export const MAX_MB = 50;
export const MAX_MINUTOS = 10;

export type VideoReceta = { uri: string; mime: string };

/** El video viaja de la hoja a la pantalla de importacion por aqui, no por la URL. */
let pendiente: VideoReceta | null = null;

export function dejarVideo(v: VideoReceta) {
  pendiente = v;
}

export function tomarVideoPendiente(): VideoReceta | null {
  const v = pendiente;
  pendiente = null;
  return v;
}

export type Eleccion = { video: VideoReceta } | { problema: 'pesado' | 'largo' } | null;

/** Null si la persona cancelo. */
export async function elegirVideo(): Promise<Eleccion> {
  // En Android 13+ el selector del sistema no pide permiso
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  if (a.fileSize && a.fileSize > MAX_MB * 1024 * 1024) return { problema: 'pesado' };
  // duration viene en milisegundos
  if (a.duration && a.duration > MAX_MINUTOS * 60_000) return { problema: 'largo' };
  return { video: { uri: a.uri, mime: a.mimeType ?? 'video/mp4' } };
}

/** Un cuadro del video, achicado, para la foto de la receta. Si falla, sin portada. */
async function portadaDe(uri: string): Promise<FotoReceta | null> {
  try {
    const { uri: imagen } = await getThumbnailAsync(uri, { time: 1500, quality: 0.8 });
    return (await prepararFotos([imagen]))[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Sube el video a la carpeta privada de la persona. La subida es nativa: el
 * archivo no pasa por la memoria de JavaScript, asi un video de 50 MB no
 * tumba la app en un telefono modesto.
 */
export async function subirVideo(v: VideoReceta): Promise<{ ruta: string; portada: FotoReceta | null }> {
  // Lo compartido desde la galeria llega como content://: se copia al cache,
  // que es lo que saben leer la subida y la portada
  let archivo = v.uri;
  let copia: string | null = null;
  if (archivo.startsWith('content://')) {
    copia = `${cacheDirectory}video-${nuevoId()}`;
    await copyAsync({ from: archivo, to: copia });
    archivo = copia;
  }
  try {
    const info = await getInfoAsync(archivo);
    if (info.exists && info.size > MAX_MB * 1024 * 1024) throw new VideoPesado();
    return await subirArchivo(archivo, v.mime);
  } finally {
    if (copia) deleteAsync(copia, { idempotent: true }).catch(() => {});
  }
}

async function subirArchivo(uri: string, mime: string): Promise<{ ruta: string; portada: FotoReceta | null }> {
  const v = { uri, mime };
  const { data } = await supabase.auth.getSession();
  const sesion = data.session;
  if (!sesion) throw new Error('Necesitas iniciar sesión.');
  const extension = v.mime.includes('quicktime') ? 'mov' : v.mime.includes('webm') ? 'webm' : v.mime.includes('3gpp') ? '3gp' : 'mp4';
  const ruta = `${sesion.user.id}/${nuevoId()}.${extension}`;
  const [portada, r] = await Promise.all([
    portadaDe(v.uri),
    uploadAsync(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/videos/${ruta}`, v.uri, {
      httpMethod: 'POST',
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers: {
        authorization: `Bearer ${sesion.access_token}`,
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
        'content-type': v.mime,
      },
    }),
  ]);
  if (r.status === 413) throw new VideoPesado();
  if (r.status < 200 || r.status >= 300) throw new Error(`No pudimos subir el video (${r.status}).`);
  return { ruta, portada };
}

export class VideoPesado extends Error {
  constructor() {
    super(`El video pesa más de ${MAX_MB} MB.`);
  }
}
