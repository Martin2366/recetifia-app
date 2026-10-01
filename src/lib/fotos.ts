import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

/**
 * Importar desde una foto: de la galeria, de la camara o compartida desde otra
 * app (una captura). Las fotos se achican antes de subirlas: 1600 px de ancho
 * bastan para leer una pagina de libro y pesan ~10 veces menos que el original.
 */

export type FotoReceta = { data: string; mime: string };

/** Igual que el servidor: una receta a doble pagina o varias capturas. */
export const MAX_FOTOS = 4;
const ANCHO = 1600;

/** Las fotos viajan de la hoja a la pantalla de importacion por aqui, no por la URL. */
let pendientes: FotoReceta[] | null = null;

export function dejarFotos(fotos: FotoReceta[]) {
  pendientes = fotos;
}

export function tomarFotosPendientes(): FotoReceta[] | null {
  const f = pendientes;
  pendientes = null;
  return f;
}

/** Achica y pasa a base64 (JPEG). Las que no se puedan leer se saltan. */
export async function prepararFotos(uris: string[]): Promise<FotoReceta[]> {
  const listas: FotoReceta[] = [];
  for (const uri of uris.slice(0, MAX_FOTOS)) {
    try {
      const ctx = ImageManipulator.manipulate(uri);
      ctx.resize({ width: ANCHO });
      const imagen = await ctx.renderAsync();
      const r = await imagen.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
      if (r.base64) listas.push({ data: r.base64, mime: 'image/jpeg' });
    } catch {
      // Una foto ilegible no tumba las demas
    }
  }
  return listas;
}

function sinPermiso(que: string) {
  Alert.alert(`Sin acceso a la ${que}`, `Para importar desde una foto, permite el acceso a la ${que} en los ajustes del teléfono.`, [
    { text: 'Ahora no', style: 'cancel' },
    { text: 'Abrir ajustes', onPress: () => Linking.openSettings() },
  ]);
}

/** Null si la persona cancelo. */
export async function elegirDeGaleria(): Promise<string[] | null> {
  // En Android 13+ el selector de fotos del sistema no pide permiso
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: MAX_FOTOS,
    quality: 1,
  });
  if (r.canceled) return null;
  return r.assets.map((a) => a.uri);
}

export async function tomarFoto(): Promise<string[] | null> {
  const permiso = await ImagePicker.requestCameraPermissionsAsync();
  if (!permiso.granted) {
    sinPermiso('cámara');
    return null;
  }
  const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  if (r.canceled) return null;
  return r.assets.map((a) => a.uri);
}
