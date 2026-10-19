import { useWindowDimensions } from 'react-native';

/**
 * Ancho util para el contenido. En un telefono es la pantalla entera; en una
 * tablet se limita, para que las tarjetas y las columnas no se estiren.
 */
export const ANCHO_MAXIMO = 720;

export function useAncho() {
  const { width, height } = useWindowDimensions();
  return { ancho: Math.min(width, ANCHO_MAXIMO), alto: height, pantalla: width };
}
