import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Preferencias locales del dispositivo. Nada de esto es sensible: por eso va en
 * AsyncStorage y no en SecureStore, que se reserva para la sesion.
 */

const CLAVE_BIENVENIDA = 'recetifia:vio-bienvenida';

/** La bienvenida dura ~18 s: verla una vez esta bien, verla cada vez que cierras sesion no. */
export async function vioBienvenida(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CLAVE_BIENVENIDA)) === '1';
  } catch {
    return false;
  }
}

export async function marcarBienvenidaVista(): Promise<void> {
  try {
    await AsyncStorage.setItem(CLAVE_BIENVENIDA, '1');
  } catch {
    // Si no se puede guardar, lo peor que pasa es verla otra vez.
  }
}

// ---------------------------------------------------------------- recordatorios

export const CLAVE_RECORDATORIOS = 'recetifia:recordatorios';
/** La hoja "¿Te recuerdo cocinarla?" se ofrece una sola vez, tras la primera receta. */
export const CLAVE_OFRECIO_RECORDATORIOS = 'recetifia:ofrecio-recordatorios';

export type HoraCocina = 'manana' | 'mediodia' | 'tarde';

export const HORAS_COCINA: { id: HoraCocina; texto: string; emoji: string; hora: number; minuto: number }[] = [
  { id: 'manana', texto: 'En la mañana', emoji: '🌅', hora: 7, minuto: 30 },
  { id: 'mediodia', texto: 'A mediodía', emoji: '☀️', hora: 13, minuto: 0 },
  { id: 'tarde', texto: 'En la tarde', emoji: '🌙', hora: 18, minuto: 30 },
];

export type Recordatorios = { activos: boolean; hora: HoraCocina };

const RECORDATORIOS_INICIALES: Recordatorios = { activos: false, hora: 'tarde' };

export async function leerRecordatorios(): Promise<Recordatorios> {
  try {
    const guardado = await AsyncStorage.getItem(CLAVE_RECORDATORIOS);
    return guardado ? { ...RECORDATORIOS_INICIALES, ...JSON.parse(guardado) } : RECORDATORIOS_INICIALES;
  } catch {
    return RECORDATORIOS_INICIALES;
  }
}

export async function guardarRecordatorios(r: Recordatorios): Promise<void> {
  try {
    await AsyncStorage.setItem(CLAVE_RECORDATORIOS, JSON.stringify(r));
  } catch {
    // Sin guardar, los recordatorios siguen como estaban
  }
}

/** true solo la primera vez que se pregunta; despues, siempre false. */
export async function tocaOfrecerRecordatorios(): Promise<boolean> {
  try {
    if ((await AsyncStorage.getItem(CLAVE_OFRECIO_RECORDATORIOS)) === '1') return false;
    await AsyncStorage.setItem(CLAVE_OFRECIO_RECORDATORIOS, '1');
    return true;
  } catch {
    return false;
  }
}
