/**
 * Sistema de diseno de Recetifia.
 *
 * v1 es solo modo claro: la app fuerza el esquema claro al arrancar (ver
 * _layout.tsx). `Colors.dark` apunta a la misma paleta para que ninguna pantalla
 * que todavia pregunte por el esquema se quede con colores de otro tema.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Marca = {
  primario: '#FF6B3A',
  primarioSuave: '#FFA25A',
  /** Fondo tenue del primario, para chips y estados seleccionados. */
  primarioTenue: '#FFE9E0',
  exito: '#22C55E',
  error: '#DC3A2A',
  aviso: '#B26A00',
} as const;

const claro = {
  /** Casi negro con un matiz frio: contrasta con el naranja sin la dureza del negro puro. */
  text: '#222B2B',
  /**
   * El gris #9E9E9E del sistema no alcanza el contraste minimo para texto
   * (2,5:1 sobre el fondo). Se reserva para placeholders; el texto secundario
   * usa este tono, que si supera 4,5:1.
   */
  textSecondary: '#5E6767',
  textTenue: '#9E9E9E',
  background: '#F5F6F6',
  backgroundElement: '#FFFFFF',
  backgroundSelected: Marca.primarioTenue,
  borde: '#E7E9E9',
} as const;

export const Colors = { light: claro, dark: claro } as const;

export type ThemeColor = keyof typeof claro;

/** Familias cargadas en _layout.tsx. En Android el peso va en el nombre de la familia. */
export const Tipografia = {
  regular: 'Inter_400Regular',
  media: 'Inter_500Medium',
  seminegrita: 'Inter_600SemiBold',
  negrita: 'Inter_700Bold',
  /** Solo para titulos de receta y momentos destacados. */
  display: 'PlayfairDisplay_700Bold',
} as const;

export const Fonts = Platform.select({
  default: {
    sans: Tipografia.regular,
    serif: Tipografia.display,
    rounded: Tipografia.regular,
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radios = {
  chico: 10,
  medio: 14,
  grande: 24,
  pildora: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
