import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Marca, Tipografia } from '@/constants/theme';

/**
 * Anillos que laten alrededor de un objetivo tactil. Se coloca como hijo del
 * elemento que resalta y no captura toques.
 */
export function Pulso({
  ancho,
  alto,
  radio,
  color = Marca.primario,
}: {
  ancho: number;
  alto: number;
  radio: number;
  color?: string;
}) {
  const a = useSharedValue(0);
  const b = useSharedValue(0);

  useEffect(() => {
    const onda = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
    a.value = onda;
    b.value = withDelay(800, withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false));
  }, [a, b]);

  return (
    <View pointerEvents="none" style={[estilos.centro, { width: ancho, height: alto, marginLeft: -ancho / 2, marginTop: -alto / 2 }]}>
      <Anillo valor={a} radio={radio} color={color} />
      <Anillo valor={b} radio={radio} color={color} />
    </View>
  );
}

/**
 * Globo "Toca aquí" pegado al objetivo, con un vaivén que apunta hacia el. Va
 * como hijo del objetivo, que debe tener tamano fijo.
 */
export function Indicacion({ texto, lado }: { texto: string; lado: 'izquierda' | 'arriba' | 'abajo' }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(withTiming(1, { duration: 650, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [v]);
  const estilo = useAnimatedStyle(() => {
    const d = v.value * 6;
    if (lado === 'izquierda') return { transform: [{ translateX: -d }] };
    if (lado === 'arriba') return { transform: [{ translateY: -d }] };
    return { transform: [{ translateY: d }] };
  });

  const posicion =
    lado === 'izquierda'
      ? estilos.izquierda
      : lado === 'arriba'
        ? estilos.arriba
        : estilos.abajo;

  return (
    <View pointerEvents="none" style={posicion}>
      <Animated.View style={[estilos.globo, estilo]}>
        <Text style={estilos.textoGlobo}>{texto.toUpperCase()}</Text>
      </Animated.View>
    </View>
  );
}

function Anillo({ valor, radio, color }: { valor: SharedValue<number>; radio: number; color: string }) {
  const estilo = useAnimatedStyle(() => ({
    opacity: interpolate(valor.value, [0, 0.15, 1], [0, 0.9, 0]),
    transform: [{ scale: interpolate(valor.value, [0, 1], [0.9, 1.45]) }],
  }));
  return <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: radio, borderWidth: 3, borderColor: color }, estilo]} />;
}

const estilos = StyleSheet.create({
  centro: { position: 'absolute', left: '50%', top: '50%' },
  // Ancho fijo: si no, Yoga lo mide contra el objetivo (estrecho) y parte el texto
  izquierda: { position: 'absolute', right: '100%', top: 0, bottom: 0, width: 140, alignItems: 'flex-end', justifyContent: 'center', marginRight: 14 },
  arriba: { position: 'absolute', bottom: '100%', left: -80, right: -80, alignItems: 'center', marginBottom: 14 },
  abajo: { position: 'absolute', top: '100%', left: -80, right: -80, alignItems: 'center', marginTop: 14 },
  globo: {
    backgroundColor: Marca.primario,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  textoGlobo: { fontFamily: Tipografia.negrita, fontSize: 13, letterSpacing: 0.6, color: '#FFFFFF', flexShrink: 0 },
});
