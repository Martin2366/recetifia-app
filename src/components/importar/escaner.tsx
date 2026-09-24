import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { Colors, Marca, Tipografia } from '@/constants/theme';

/**
 * "Importando…": ingredientes que pasan por un visor mientras una linea de luz
 * los recorre, como un escaner. El texto cambia segun la etapa real del servidor.
 */

const INGREDIENTES = ['🥩', '🥔', '🫑', '🧄', '🍅', '🧀', '🥕', '🍋'];

const TEXTOS: Record<string, string> = {
  iniciando: 'Preparando…',
  leyendo: 'Leyendo la publicación…',
  escuchando: 'Viendo el video…',
  ordenando: 'Ordenando ingredientes y pasos…',
  guardando: 'Guardando la foto…',
  listo: '¡Lista!',
  cache: '¡Lista!',
};

const LADO = 118;

export function Escaner({ etapa }: { etapa: string }) {
  const [actual, setActual] = useState(0);
  const paso = useSharedValue(0);
  const linea = useSharedValue(0);

  useEffect(() => {
    linea.value = withRepeat(withSequence(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) })), -1);
    const t = setInterval(() => {
      paso.value = 0;
      paso.value = withTiming(1, { duration: 700, easing: Easing.bezier(0.22, 1, 0.36, 1) });
      setActual((a) => (a + 1) % INGREDIENTES.length);
    }, 1500);
    return () => clearInterval(t);
  }, [paso, linea]);

  const estiloLinea = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(linea.value, [0, 1], [8, LADO - 16]) }] }));
  const estiloCentro = useAnimatedStyle(() => ({
    opacity: interpolate(paso.value, [0, 0.4, 1], [0, 1, 1]),
    transform: [{ translateX: interpolate(paso.value, [0, 1], [70, 0]) }, { scale: interpolate(paso.value, [0, 1], [0.6, 1]) }],
  }));
  const estiloIzquierda = useAnimatedStyle(() => ({
    opacity: interpolate(paso.value, [0, 1], [1, 0.45]),
    transform: [{ translateX: interpolate(paso.value, [0, 1], [0, -84]) }, { scale: interpolate(paso.value, [0, 1], [1, 0.6]) }],
  }));

  const anterior = INGREDIENTES[(actual - 1 + INGREDIENTES.length) % INGREDIENTES.length];
  const siguiente = INGREDIENTES[(actual + 1) % INGREDIENTES.length];

  return (
    <View style={estilos.contenedor} accessibilityLiveRegion="polite" accessibilityLabel={TEXTOS[etapa] ?? 'Importando…'}>
      <View style={estilos.escena}>
        <Animated.Text style={[estilos.lateral, estilos.izquierda, estiloIzquierda]}>{anterior}</Animated.Text>
        <Text style={[estilos.lateral, estilos.derecha]}>{siguiente}</Text>

        <View style={estilos.visor}>
          <Esquina estilo={{ top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 }} />
          <Esquina estilo={{ top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 }} />
          <Esquina estilo={{ bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 }} />
          <Esquina estilo={{ bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 }} />
          <Animated.Text key={actual} style={[estilos.centro, estiloCentro]}>
            {INGREDIENTES[actual]}
          </Animated.Text>
          <Animated.View style={[estilos.linea, estiloLinea]} />
        </View>
      </View>

      <Text style={estilos.texto}>{TEXTOS[etapa] ?? 'Importando…'}</Text>
      <Text style={estilos.nota}>Suele tardar menos de un minuto</Text>
    </View>
  );
}

function Esquina({ estilo }: { estilo: object }) {
  return <View style={[estilos.esquina, estilo]} />;
}

const estilos = StyleSheet.create({
  contenedor: { alignItems: 'center', gap: 10 },
  escena: { width: 320, height: LADO + 20, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  visor: { width: LADO, height: LADO, alignItems: 'center', justifyContent: 'center' },
  esquina: { position: 'absolute', width: 30, height: 30, borderColor: '#9E9E9E' },
  centro: { fontSize: 58 },
  lateral: { position: 'absolute', fontSize: 38 },
  izquierda: { left: 50 },
  derecha: { right: 50, opacity: 0.45, transform: [{ scale: 0.6 }] },
  linea: {
    position: 'absolute',
    top: 0,
    left: 6,
    right: 6,
    height: 5,
    borderRadius: 3,
    backgroundColor: Marca.primarioSuave,
    shadowColor: Marca.primario,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 6,
  },
  texto: { fontFamily: Tipografia.seminegrita, fontSize: 18, color: Colors.light.text },
  nota: { fontFamily: Tipografia.regular, fontSize: 14, color: Colors.light.textSecondary },
});
