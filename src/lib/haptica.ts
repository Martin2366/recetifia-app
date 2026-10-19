import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Vibracion suave en momentos clave. Nunca falla: si el telefono no vibra (o
 * es la web), no pasa nada.
 */

const disponible = Platform.OS !== 'web';

/** Un toque leve: cambiar de pestana, marcar en la lista, elegir un filtro. */
export function toque() {
  if (disponible) Haptics.selectionAsync().catch(() => {});
}

/** Algo salio bien: receta guardada, agregada al plan, fin del mantener presionado. */
export function exito() {
  if (disponible) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
