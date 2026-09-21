import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Marca, Tipografia } from '@/constants/theme';

/** Colores planos para las siluetas de comida: la paleta de marca y dos acentos. */
export const TONOS = {
  naranja: Marca.primario,
  durazno: '#FFA25A',
  amarillo: '#FFC93C',
  verde: '#A8D86E',
  lila: '#A77BDB',
  celeste: '#8FB8FF',
} as const;

type Icono = keyof typeof MaterialCommunityIcons.glyphMap;

/**
 * Una silueta de comida que aparece con un rebote y luego flota. `x`, `y` son
 * la esquina superior izquierda dentro del contenedor.
 */
export function Silueta({
  icono,
  color,
  tamano,
  x,
  y,
  giro = 0,
  retraso = 0,
  desde = 'escala',
}: {
  icono: Icono;
  color: string;
  tamano: number;
  x: number;
  y: number;
  giro?: number;
  retraso?: number;
  /** "escala" aparece en su sitio; "abajo" sube desde fuera del contenedor. */
  desde?: 'escala' | 'abajo';
}) {
  const aparece = useSharedValue(0);
  const flote = useSharedValue(0);

  useEffect(() => {
    aparece.value = withDelay(retraso, withSpring(1, { damping: 11, stiffness: 120 }));
    flote.value = withDelay(
      retraso + 600,
      withRepeat(withSequence(withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1900, easing: Easing.inOut(Easing.sin) })), -1)
    );
  }, [aparece, flote, retraso]);

  const estilo = useAnimatedStyle(() => {
    const entrada =
      desde === 'abajo'
        ? [{ translateY: interpolate(aparece.value, [0, 1], [tamano, 0]) }]
        : [{ scale: aparece.value }];
    return {
      opacity: interpolate(aparece.value, [0, 0.25], [0, 1], 'clamp'),
      transform: [...entrada, { translateY: flote.value * -7 }, { rotate: `${giro + flote.value * 4}deg` }],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[estilos.silueta, { left: x, top: y } as ViewStyle, estilo]}>
      <MaterialCommunityIcons name={icono} size={tamano} color={color} />
    </Animated.View>
  );
}

/** Logo de Recetifia+ para las pantallas de la suscripcion. */
export function MarcaPlus({ claro = false }: { claro?: boolean }) {
  return (
    <View style={estilos.marca} accessible accessibilityLabel="Recetifia Plus">
      <View style={estilos.teja}>
        <Image source={require('@/assets/images/logo-blanco.png')} style={estilos.logo} contentFit="contain" />
      </View>
      <Text style={[estilos.nombre, claro && { color: '#FFFFFF' }]}>
        Recetifia<Text style={estilos.mas}>+</Text>
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  silueta: { position: 'absolute' },
  marca: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  teja: { width: 32, height: 32, borderRadius: 9, backgroundColor: Marca.primario, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 20, height: 18 },
  nombre: { fontFamily: Tipografia.display, fontSize: 24, color: Colors.light.text },
  mas: { color: Marca.primario, fontFamily: Tipografia.negrita, fontSize: 26 },
});
