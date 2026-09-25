import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo-modules-core';

import { supabase } from './supabase';

/**
 * Pedir la reseña de Google Play. Las reseñas de la competencia se quejan de
 * que la piden "antes de probar la app": aqui se pide una sola vez y recien
 * cuando la persona ya guardo 3 recetas importadas que le salieron bien.
 * Google Play decide ademas si muestra el dialogo; no se insiste nunca.
 */

const CLAVE = 'recetifia:resena-pedida';
const IMPORTACIONES_MINIMAS = 3;

export async function pedirResenaSiToca() {
  try {
    if ((await AsyncStorage.getItem(CLAVE)) === '1') return;
    const { count, error } = await supabase
      .from('import_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'done');
    if (error || (count ?? 0) < IMPORTACIONES_MINIMAS) return;
    // Un build sin el modulo nativo (el de desarrollo) ni siquiera lo carga:
    // cargarlo lanza un error que la pantalla roja de desarrollo muestra igual
    if (!requireOptionalNativeModule('ExpoStoreReview')) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const StoreReview = require('expo-store-review') as typeof import('expo-store-review');
    if (!(await StoreReview.isAvailableAsync())) return;

    await AsyncStorage.setItem(CLAVE, '1');
    await StoreReview.requestReview();
  } catch {
    // Una reseña no pedida no le rompe nada a nadie
  }
}
