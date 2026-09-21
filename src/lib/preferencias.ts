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
