import { useWindowDimensions } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useDerivedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Lo que se deja libre arriba de una hoja aunque el teclado este abierto. */
const AIRE = 12;

/**
 * Alto disponible para una hoja inferior, en vivo: la pantalla menos la barra
 * de estado y menos el teclado mientras se abre. Las hojas suben con el
 * teclado (KeyboardAvoidingView); si no se achican a la vez, una hoja alta se
 * sale por arriba y se pierden el titulo y el buscador (paso en telefonos con
 * pantalla chica o teclado alto).
 */
export function useEspacioConTeclado() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // height viene en negativo mientras el teclado esta abierto
  const { height: teclado } = useReanimatedKeyboardAnimation();
  return useDerivedValue(() => height - insets.top - AIRE + teclado.value);
}
