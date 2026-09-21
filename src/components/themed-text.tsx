import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor, Tipografia } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'subtitle'
    | 'h3'
    | 'display'
    | 'small'
    | 'smallBold'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return <Text style={[{ color: theme[themeColor ?? 'text'] }, styles[type], style]} {...rest} />;
}

/**
 * Escala del sistema de diseno. Una desviacion deliberada: el cuerpo va a 16/24
 * en lugar de 14/20, porque la receta se lee con el celular apoyado en la
 * encimera, a un brazo de distancia.
 */
const styles = StyleSheet.create({
  title: { fontFamily: Tipografia.negrita, fontSize: 28, lineHeight: 36 },
  subtitle: { fontFamily: Tipografia.seminegrita, fontSize: 22, lineHeight: 28 },
  h3: { fontFamily: Tipografia.seminegrita, fontSize: 18, lineHeight: 24 },
  display: { fontFamily: Tipografia.display, fontSize: 30, lineHeight: 38 },
  default: { fontFamily: Tipografia.regular, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: Tipografia.regular, fontSize: 13, lineHeight: 18 },
  smallBold: { fontFamily: Tipografia.seminegrita, fontSize: 13, lineHeight: 18 },
  link: { fontFamily: Tipografia.media, fontSize: 14, lineHeight: 20 },
  linkPrimary: { fontFamily: Tipografia.seminegrita, fontSize: 14, lineHeight: 20, color: '#FF6B3A' },
  code: { fontFamily: Fonts?.mono, fontSize: 12 },
});
