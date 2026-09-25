import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { Keyboard, TextInput, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView } from 'react-native';

/**
 * Que el teclado nunca tape el campo donde se escribe.
 *
 * En Android de borde a borde la ventana ya no se achica sola con el teclado:
 * aunque el KeyboardAvoidingView deje el hueco, el ScrollView no se desplaza
 * hasta el campo enfocado. Esto lo desplaza lo justo, al abrirse el teclado y
 * al pasar de un campo a otro con el teclado abierto.
 *
 * `margen`: lo que hay entre el campo y el teclado (por ejemplo, un boton fijo).
 */
export function useCampoVisible(scroll: RefObject<ScrollView | null>, margen = 24) {
  const desplazamiento = useRef(0);

  const subir = useCallback(
    (topeTeclado?: number) => {
      const tope = topeTeclado ?? Keyboard.metrics()?.screenY;
      const campo = TextInput.State.currentlyFocusedInput();
      if (tope == null || !campo || !scroll.current) return;
      // Esperar un fotograma: el hueco del teclado se aplica despues del evento
      setTimeout(() => {
        campo.measureInWindow((_x, y, _w, alto) => {
          const tapado = y + alto + margen - tope;
          if (tapado > 0) scroll.current?.scrollTo({ y: desplazamiento.current + tapado, animated: true });
        });
      }, 80);
    },
    [scroll, margen]
  );

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', (e) => subir(e.endCoordinates.screenY));
    return () => sub.remove();
  }, [subir]);

  const alDesplazar = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    desplazamiento.current = e.nativeEvent.contentOffset.y;
  }, []);

  /** Para el onFocus de cada campo: cubre el paso de un campo a otro con el teclado ya abierto. */
  const alEnfocar = useCallback(() => subir(), [subir]);

  return { alDesplazar, alEnfocar };
}
