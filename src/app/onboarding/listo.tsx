import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Silueta, TONOS } from '@/components/onboarding/formas';
import { Colors, Marca, Tipografia } from '@/constants/theme';
import { exito, toque } from '@/lib/haptica';

/**
 * Antes del tour: avisa que viene una explicacion corta. El boton hay que
 * mantenerlo presionado (un toque sin querer no salta el paso) y al llenarse
 * hay una pequena celebracion; recien ahi empieza el tour.
 */

const MANTENER_MS = 1500;
const BOTON = 112;
const COLORES = [Marca.primario, Marca.primarioSuave, TONOS.amarillo, TONOS.verde, TONOS.lila, TONOS.celeste];
const EMOJIS = ['🎉', '🎊', '✨'];

export default function Listo() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const quieto = useReducedMotion();
  const progreso = useSharedValue(0);
  const latido = useSharedValue(0);
  const fiesta = useSharedValue(0);
  const [celebrando, setCelebrando] = useState(false);
  const duracion = quieto ? 600 : MANTENER_MS;

  useEffect(() => {
    if (quieto) return;
    latido.value = withRepeat(
      withSequence(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 900 })),
      -1
    );
  }, [quieto, latido]);

  function seguir() {
    router.replace('/onboarding/tour');
  }

  function completado() {
    exito();
    setCelebrando(true);
    if (quieto) {
      seguir();
      return;
    }
    fiesta.value = withTiming(1, { duration: 1300, easing: Easing.out(Easing.quad) }, (fin) => {
      if (fin) runOnJS(seguir)();
    });
  }

  function apretar() {
    if (celebrando) return;
    toque();
    cancelAnimation(progreso);
    progreso.value = withTiming(1, { duration: duracion * (1 - progreso.value), easing: Easing.linear }, (fin) => {
      if (fin) runOnJS(completado)();
    });
  }

  function soltar() {
    if (celebrando) return;
    // Si se suelta antes, el circulo vuelve atras despacio
    cancelAnimation(progreso);
    progreso.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.quad) });
  }

  const estiloBoton = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progreso.value, [0, 1], [1, 0.94]) * (1 + latido.value * 0.04) }],
  }));
  const estiloRelleno = useAnimatedStyle(() => ({
    opacity: progreso.value > 0 ? 1 : 0,
    transform: [{ scale: progreso.value }],
  }));
  const estiloHalo = useAnimatedStyle(() => ({
    opacity: 0.25 + latido.value * 0.2,
    transform: [{ scale: 1.15 + latido.value * 0.12 + progreso.value * 0.25 }],
  }));

  return (
    <View style={[estilos.pantalla, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar style="dark" />

      <View style={estilos.siluetas} pointerEvents="none">
        {/* Repartidas en proporcion a la pantalla: igual en un telefono chico que en una tablet */}
        <Silueta icono="food-apple" color={TONOS.verde} tamano={64} x={W * 0.05} y={H * 0.31} giro={-12} retraso={80} />
        <Silueta icono="noodles" color={TONOS.amarillo} tamano={72} x={W * 0.74} y={H * 0.3} giro={10} retraso={180} />
        <Silueta icono="carrot" color={Marca.primarioSuave} tamano={56} x={W * 0.44} y={H * 0.005} giro={20} retraso={420} />
        <Silueta icono="fish" color={TONOS.celeste} tamano={58} x={W * 0.08} y={H * 0.72} giro={14} retraso={260} />
        <Silueta icono="cupcake" color="#F7A8C0" tamano={64} x={W * 0.74} y={H * 0.75} giro={-8} retraso={340} />
        <Silueta icono="egg-fried" color={TONOS.amarillo} tamano={60} x={W * 0.42} y={H * 0.84} giro={-6} retraso={500} />
      </View>

      <View style={estilos.textos}>
        <Text style={estilos.titulo} accessibilityRole="header">
          Ahora te enseñamos a guardar tu primera receta
        </Text>
        <Text style={estilos.subtitulo}>Es muy fácil: toma menos de un minuto.</Text>
      </View>

      <View style={estilos.centro}>
        <View style={estilos.zonaBoton}>
          <Animated.View pointerEvents="none" style={[estilos.halo, estiloHalo]} />
          <Pressable
            onPressIn={apretar}
            onPressOut={soltar}
            accessibilityRole="button"
            accessibilityLabel="Empezar el recorrido"
            accessibilityHint="Mantén presionado para empezar"
            // Con lector de pantalla, un toque doble basta
            accessibilityActions={[{ name: 'activate' }]}
            onAccessibilityAction={() => completado()}>
            <Animated.View style={[estilos.boton, estiloBoton]}>
              <Animated.View style={[estilos.relleno, estiloRelleno]} />
              <MaterialCommunityIcons name="arrow-right" size={46} color="#FFFFFF" />
            </Animated.View>
          </Pressable>
          {celebrando && !quieto ? <Confeti avance={fiesta} /> : null}
        </View>
        <Text style={estilos.ayuda}>{celebrando ? '¡Vamos!' : 'Mantén presionado'}</Text>
      </View>
    </View>
  );
}

type Particula = { vx: number; vy: number; giro: number; color: string; emoji?: string; ancho: number; alto: number };

/** Confeti que sale del boton hacia arriba y cae, con algo de giro. Todo en el hilo de UI. */
function Confeti({ avance }: { avance: SharedValue<number> }) {
  const { width } = useWindowDimensions();
  const particulas = useMemo<Particula[]>(
    () =>
      Array.from({ length: 40 }, (_, i) => {
        const angulo = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
        const fuerza = width * (0.35 + Math.random() * 0.45);
        return {
          vx: Math.cos(angulo) * fuerza,
          vy: Math.sin(angulo) * fuerza,
          giro: (Math.random() - 0.5) * 900,
          color: COLORES[i % COLORES.length],
          emoji: i % 8 === 0 ? EMOJIS[(i / 8) % EMOJIS.length] : undefined,
          ancho: 7 + Math.random() * 6,
          alto: 10 + Math.random() * 8,
        };
      }),
    [width]
  );
  return (
    <View pointerEvents="none" style={estilos.origen}>
      {particulas.map((p, i) => (
        <Pieza key={i} p={p} avance={avance} />
      ))}
    </View>
  );
}

function Pieza({ p, avance }: { p: Particula; avance: SharedValue<number> }) {
  const estilo = useAnimatedStyle(() => {
    const t = avance.value;
    return {
      opacity: interpolate(t, [0, 0.75, 1], [1, 1, 0]),
      transform: [
        { translateX: p.vx * t },
        // Sube y la gravedad la trae de vuelta
        { translateY: p.vy * t + 520 * t * t },
        { rotate: `${p.giro * t}deg` },
      ],
    };
  });
  if (p.emoji) return <Animated.Text style={[estilos.emoji, estilo]}>{p.emoji}</Animated.Text>;
  return (
    <Animated.View style={[{ position: 'absolute', width: p.ancho, height: p.alto, borderRadius: 2, backgroundColor: p.color }, estilo]} />
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#FFFFFF' },
  siluetas: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.55 },
  textos: { paddingHorizontal: 28, paddingTop: 72, gap: 10, alignItems: 'center' },
  titulo: { fontFamily: Tipografia.tituloTour, fontSize: 30, lineHeight: 37, textAlign: 'center', color: Colors.light.text },
  subtitulo: { fontFamily: Tipografia.media, fontSize: 16, lineHeight: 22, textAlign: 'center', color: Colors.light.textSecondary },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 },
  zonaBoton: { width: BOTON * 2, height: BOTON * 2, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: BOTON, height: BOTON, borderRadius: BOTON / 2, backgroundColor: Marca.primario },
  boton: {
    width: BOTON,
    height: BOTON,
    borderRadius: BOTON / 2,
    backgroundColor: Marca.primario,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    elevation: 10,
    shadowColor: Marca.primario,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  // Se llena desde el centro mientras se mantiene presionado
  relleno: { position: 'absolute', width: BOTON, height: BOTON, borderRadius: BOTON / 2, backgroundColor: '#E04E1F' },
  ayuda: { fontFamily: Tipografia.seminegrita, fontSize: 16, color: Marca.primarioTexto },
  origen: { position: 'absolute', top: '50%', left: '50%' },
  emoji: { position: 'absolute', fontSize: 24 },
});
