import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Radios, Tipografia } from '@/constants/theme';
import { toque } from '@/lib/haptica';
import type { Etiqueta } from '@/lib/etiquetas';

/**
 * "Busquedas populares": dos filas de capsulas que corren solas, en sentidos
 * contrarios y sin costura (cada fila va duplicada). Cada capsula tiene su
 * color al azar, lo cambia despacio y flota un poco a su ritmo. Con "reducir
 * movimiento" activado en el telefono, todo queda quieto.
 */

/** Pastel de fondo y su borde un poco mas oscuro. */
const COLORES = [
  ['#FFE9E0', '#FBCDB8'],
  ['#FFF3D6', '#F6DC9C'],
  ['#E6F6EA', '#B9E2C4'],
  ['#E5F1FB', '#B7D5F0'],
  ['#F1E8FB', '#D6C2F0'],
  ['#FDE6EF', '#F4BCD2'],
  ['#E3F6F4', '#AEE0D9'],
] as const;

/** Pixeles por segundo: se puede leer mientras pasa. */
const VELOCIDAD = 28;

export function CarruselBusquedas({ etiquetas }: { etiquetas: Etiqueta[] }) {
  const filas = [etiquetas.filter((_, i) => i % 2 === 0), etiquetas.filter((_, i) => i % 2 === 1)];
  return (
    <View style={estilos.carrusel}>
      {filas.map((fila, i) => (
        <FilaQueCorre key={i} etiquetas={fila} haciaLaDerecha={i === 1} />
      ))}
    </View>
  );
}

function FilaQueCorre({ etiquetas, haciaLaDerecha }: { etiquetas: Etiqueta[]; haciaLaDerecha: boolean }) {
  const quieto = useReducedMotion();
  const [ancho, setAncho] = useState(0);
  const avance = useSharedValue(0);

  useEffect(() => {
    if (!ancho || quieto) return;
    avance.value = 0;
    avance.value = withRepeat(withTiming(1, { duration: (ancho / VELOCIDAD) * 1000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(avance);
  }, [ancho, quieto, avance]);

  // Al llegar al final de la primera copia, la segunda ocupa su lugar exacto
  const estilo = useAnimatedStyle(() => ({
    transform: [{ translateX: haciaLaDerecha ? (avance.value - 1) * ancho : -avance.value * ancho }],
  }));

  return (
    <View style={estilos.ventana}>
      <Animated.View style={[estilos.fila, estilo]}>
        {[0, 1].map((copia) => (
          <View
            key={copia}
            style={estilos.copia}
            onLayout={copia === 0 ? (e) => setAncho(e.nativeEvent.layout.width) : undefined}
            // La segunda copia solo esta para el bucle: los lectores de pantalla leen una
            importantForAccessibility={copia === 0 ? 'auto' : 'no-hide-descendants'}>
            {etiquetas.map((e) => (
              <Capsula key={e.id} etiqueta={e} quieta={quieto} />
            ))}
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

function Capsula({ etiqueta, quieta }: { etiqueta: Etiqueta; quieta: boolean }) {
  const router = useRouter();
  // Cada capsula arranca en un color y a un ritmo propios
  const azar = useMemo(() => {
    const desde = Math.floor(Math.random() * COLORES.length);
    // Siempre otro color distinto del de partida
    const hasta = (desde + 1 + Math.floor(Math.random() * (COLORES.length - 1))) % COLORES.length;
    return { desde: COLORES[desde], hasta: COLORES[hasta], demora: Math.random() * 2000, ritmo: 1600 + Math.random() * 1200 };
  }, []);
  const { desde, hasta } = azar;

  const color = useSharedValue(0);
  const flota = useSharedValue(0);
  const pulsada = useSharedValue(1);

  useEffect(() => {
    if (quieta) return;
    color.value = withDelay(azar.demora, withRepeat(withTiming(1, { duration: azar.ritmo * 2.5, easing: Easing.inOut(Easing.sin) }), -1, true));
    flota.value = withDelay(azar.demora, withRepeat(withTiming(1, { duration: azar.ritmo, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => {
      cancelAnimation(color);
      cancelAnimation(flota);
    };
  }, [quieta, azar, color, flota]);

  const estilo = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(color.value, [0, 1], [desde[0], hasta[0]]),
    borderColor: interpolateColor(color.value, [0, 1], [desde[1], hasta[1]]),
    transform: [{ translateY: (flota.value - 0.5) * 4 }, { scale: pulsada.value }],
  }));

  return (
    <Pressable
      onPressIn={() => {
        pulsada.value = withTiming(0.92, { duration: 90 });
      }}
      onPressOut={() => {
        pulsada.value = withSequence(withTiming(1.06, { duration: 110 }), withTiming(1, { duration: 120 }));
      }}
      onPress={() => {
        toque();
        router.push({ pathname: '/descubrir/lista', params: { tipo: 'etiqueta', valor: etiqueta.id } });
      }}
      accessibilityRole="button"
      accessibilityLabel={etiqueta.nombre}>
      <Animated.View style={[estilos.capsula, estilo]}>
        <Text style={estilos.emoji}>{etiqueta.emoji}</Text>
        <Text style={estilos.texto}>{etiqueta.nombre}</Text>
      </Animated.View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  carrusel: { gap: 10 },
  // Un poco de aire arriba y abajo para que el flotar no se corte
  ventana: { overflow: 'hidden', paddingVertical: 3 },
  fila: { flexDirection: 'row', alignSelf: 'flex-start' },
  copia: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  capsula: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radios.pildora,
    borderWidth: 1,
  },
  emoji: { fontSize: 16 },
  texto: { fontFamily: Tipografia.seminegrita, fontSize: 15, color: Colors.light.text },
});
