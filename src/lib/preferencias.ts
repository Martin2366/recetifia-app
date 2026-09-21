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

/** Preguntas del onboarding cuya respuesta se guarda en el dispositivo. */
export type PreguntaOnboarding = 'objetivos' | 'fuentes' | 'momento' | 'notificaciones' | 'recordatorio' | 'plan';

/**
 * Respuestas del onboarding. Hoy solo personalizan textos; mas adelante sirven
 * para la analitica del embudo y los recordatorios.
 */
export async function guardarRespuesta(pregunta: PreguntaOnboarding, valor: string | string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(`recetifia:onboarding:${pregunta}`, JSON.stringify(valor));
  } catch {
    // Perderlas no rompe nada.
  }
}

export async function leerRespuesta<T = string | string[]>(pregunta: PreguntaOnboarding): Promise<T | null> {
  try {
    const valor = await AsyncStorage.getItem(`recetifia:onboarding:${pregunta}`);
    return valor ? (JSON.parse(valor) as T) : null;
  } catch {
    return null;
  }
}
