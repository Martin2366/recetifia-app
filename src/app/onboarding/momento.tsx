import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotonOnboarding } from '@/components/onboarding/boton';
import { EncabezadoOnboarding } from '@/components/onboarding/encabezado';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { guardarRespuesta } from '@/lib/preferencias';

/**
 * Quinta pantalla del onboarding: en que momento del dia decide que cocinar.
 * Un cielo ilustrado acompana la eleccion: el sol recorre su arco hasta la hora
 * elegida y de noche se cambia por la luna.
 */

const SUAVE = Easing.bezier(0.22, 1, 0.36, 1);

const MOMENTOS = [
  { id: 'manana', nombre: 'En la mañana', detalle: 'Planifico con tiempo', hora: '7:30', icono: 'weather-sunset-up' },
  { id: 'mediodia', nombre: 'Al mediodía', detalle: 'Decido sobre la marcha', hora: '13:00', icono: 'white-balance-sunny' },
  { id: 'tarde', nombre: 'En la tarde', detalle: 'Camino a casa', hora: '18:30', icono: 'weather-sunset-down' },
  { id: 'noche', nombre: 'En la noche', detalle: 'Justo antes de cocinar', hora: '21:00', icono: 'weather-night' },
] as const;

// Angulo del astro sobre el horizonte (grados) y color del cielo en cada momento
const ANGULOS = [160, 90, 24, 112];
const CIELOS = ['#FFE3CF', '#FFF1D2', '#FFD0B4', '#2E3157'];
const SUELOS = ['#FFD3B8', '#FFE2B3', '#FFBE9C', '#232649'];

export default function Momento() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [elegido, setElegido] = useState<number | null>(null);

  // Arranca con un amanecer: el sol sube hasta el mediodia mientras nadie elige
  const pos = useSharedValue(0);
  const entrada = useSharedValue(0);
  useEffect(() => {
    entrada.value = withTiming(1, { duration: 600, easing: SUAVE });
    pos.value = withDelay(300, withTiming(1, { duration: 1400, easing: SUAVE }));
  }, [entrada, pos]);

  function elegir(i: number) {
    setElegido(i);
    pos.value = withSpring(i, { damping: 18, stiffness: 90 });
  }

  const estiloCabecera = useAnimatedStyle(() => ({
    opacity: entrada.value,
    transform: [{ translateY: interpolate(entrada.value, [0, 1], [12, 0]) }],
  }));

  async function continuar() {
    if (elegido === null) return;
    await guardarRespuesta('momento', MOMENTOS[elegido].id);
    router.push({ pathname: '/onboarding/notificaciones', params: { hora: MOMENTOS[elegido].hora } });
  }

  return (
    <View style={estilos.pantalla}>
      <StatusBar style="dark" />
      <EncabezadoOnboarding paso={4} />

      <ScrollView contentContainerStyle={estilos.cuerpo} showsVerticalScrollIndicator={false}>
        <Animated.View style={estiloCabecera}>
          <Text style={estilos.titulo} accessibilityRole="header">
            ¿Cuándo decides{'\n'}qué cocinar?
          </Text>
          <Text style={estilos.subtitulo}>Así tendremos tus recetas a mano en el momento justo.</Text>
        </Animated.View>

        <Cielo pos={pos} hora={elegido === null ? null : MOMENTOS[elegido].hora} />

        <View style={estilos.rejilla} accessibilityRole="radiogroup">
          {MOMENTOS.map((m, i) => (
            <Opcion key={m.id} momento={m} indice={i} elegido={elegido === i} alPulsar={() => elegir(i)} />
          ))}
        </View>
      </ScrollView>

      <View style={[estilos.pie, { paddingBottom: insets.bottom + 20 }]}>
        <BotonOnboarding texto="Continuar" alPulsar={continuar} apagado={elegido === null} />
      </View>
    </View>
  );
}

/** Ilustracion: cielo, arco punteado, astro y una olla en el horizonte. */
function Cielo({ pos, hora }: { pos: SharedValue<number>; hora: string | null }) {
  const { width: W } = useWindowDimensions();
  const ancho = W - 40;
  const alto = 176;
  const R = Math.min(ancho * 0.36, 118);
  const cx = ancho / 2;
  const horizonte = alto - 40;
  const ASTRO = 44;

  // Flotar suave, para que la escena no quede quieta
  const flote = useSharedValue(0);
  useEffect(() => {
    flote.value = withRepeat(withSequence(withTiming(1, { duration: 1800 }), withTiming(0, { duration: 1800 })), -1);
  }, [flote]);

  const estiloCielo = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(pos.value, [0, 1, 2, 3], CIELOS) }));
  const estiloSuelo = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(pos.value, [0, 1, 2, 3], SUELOS) }));
  const estiloAstro = useAnimatedStyle(() => {
    const a = (interpolate(pos.value, [0, 1, 2, 3], ANGULOS) * Math.PI) / 180;
    return {
      transform: [
        { translateX: cx + R * Math.cos(a) - ASTRO / 2 },
        { translateY: horizonte - R * Math.sin(a) - ASTRO / 2 + flote.value * 3 },
      ],
    };
  });
  const noche = (valor: SharedValue<number>) => {
    'worklet';
    return interpolate(valor.value, [2, 3], [0, 1], 'clamp');
  };
  const estiloSol = useAnimatedStyle(() => ({ opacity: 1 - noche(pos) }));
  const estiloLuna = useAnimatedStyle(() => ({ opacity: noche(pos) }));
  const estiloEstrellas = useAnimatedStyle(() => ({ opacity: noche(pos) }));
  const estiloArco = useAnimatedStyle(() => ({ opacity: 0.55 - noche(pos) * 0.25 }));

  const puntos = Array.from({ length: 15 }, (_, i) => {
    const a = (Math.PI * i) / 14;
    return { x: cx + R * Math.cos(a), y: horizonte - R * Math.sin(a) };
  });
  const estrellas = [
    [0.12, 0.2],
    [0.24, 0.42],
    [0.8, 0.18],
    [0.9, 0.46],
    [0.66, 0.1],
    [0.38, 0.14],
  ];

  return (
    <Animated.View
      style={[estilos.cielo, { height: alto }, estiloCielo]}
      accessible
      accessibilityLabel={hora ? `Ilustración del cielo a las ${hora}` : 'Ilustración del cielo'}>
      <Animated.View style={[StyleSheet.absoluteFill, estiloEstrellas]}>
        {estrellas.map(([x, y], i) => (
          <View key={i} style={[estilos.estrella, { left: x * ancho, top: y * alto, opacity: i % 2 ? 0.6 : 1 }]} />
        ))}
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, estiloArco]}>
        {puntos.map((p, i) => (
          <View key={i} style={[estilos.punto, { left: p.x - 2, top: p.y - 2 }]} />
        ))}
      </Animated.View>

      <Animated.View style={[estilos.astro, { width: ASTRO, height: ASTRO }, estiloAstro]}>
        <Animated.View style={[StyleSheet.absoluteFill, estilos.sol, estiloSol]}>
          <View style={estilos.halo} />
          <MaterialCommunityIcons name="white-balance-sunny" size={24} color="#FFFFFF" />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, estilos.centrado, estiloLuna]}>
          <MaterialCommunityIcons name="moon-waning-crescent" size={34} color="#F6E7B8" />
        </Animated.View>
      </Animated.View>

      <Animated.View style={[estilos.suelo, { top: horizonte }, estiloSuelo]} />

      <View style={[estilos.olla, { left: cx - 22, top: horizonte - 22 }]}>
        <MaterialCommunityIcons name="pot-steam-outline" size={24} color={Marca.primario} />
      </View>

      {hora ? (
        <View style={estilos.chipHora}>
          <MaterialCommunityIcons name="clock-outline" size={14} color={Colors.light.text} />
          <Text style={estilos.textoHora}>{hora}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

function Opcion({
  momento,
  indice,
  elegido,
  alPulsar,
}: {
  momento: (typeof MOMENTOS)[number];
  indice: number;
  elegido: boolean;
  alPulsar: () => void;
}) {
  const entrada = useSharedValue(0);
  const presion = useSharedValue(1);
  const salto = useSharedValue(1);

  useEffect(() => {
    entrada.value = withDelay(250 + indice * 70, withTiming(1, { duration: 550, easing: SUAVE }));
  }, [entrada, indice]);

  useEffect(() => {
    if (elegido) {
      salto.value = withSequence(withTiming(1.2, { duration: 140, easing: SUAVE }), withSpring(1, { damping: 8, stiffness: 220 }));
    }
  }, [elegido, salto]);

  const estiloCelda = useAnimatedStyle(() => ({
    opacity: entrada.value,
    transform: [{ translateY: interpolate(entrada.value, [0, 1], [18, 0]) }, { scale: presion.value }],
  }));
  const estiloIcono = useAnimatedStyle(() => ({ transform: [{ scale: salto.value }] }));

  return (
    <Animated.View style={[estilos.celda, estiloCelda]}>
      <Pressable
        onPress={alPulsar}
        onPressIn={() => (presion.value = withSpring(0.96, { damping: 18, stiffness: 400 }))}
        onPressOut={() => (presion.value = withSpring(1, { damping: 14, stiffness: 300 }))}
        accessibilityRole="radio"
        accessibilityState={{ checked: elegido }}
        accessibilityLabel={`${momento.nombre}. ${momento.detalle}`}
        style={[estilos.opcion, elegido && estilos.opcionElegida]}>
        <Animated.View style={[estilos.burbuja, elegido && estilos.burbujaElegida, estiloIcono]}>
          <MaterialCommunityIcons name={momento.icono} size={24} color={elegido ? '#FFFFFF' : Marca.primario} />
        </Animated.View>
        <Text style={estilos.nombre}>{momento.nombre}</Text>
        <Text style={estilos.detalle}>{momento.detalle}</Text>
      </Pressable>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#FFFFFF' },
  cuerpo: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16, gap: 22 },

  titulo: { fontFamily: Tipografia.display, fontSize: 30, lineHeight: 38, textAlign: 'center', color: Colors.light.text },
  subtitulo: {
    fontFamily: Tipografia.regular,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    color: Colors.light.textSecondary,
    marginTop: 10,
    paddingHorizontal: 12,
  },

  cielo: { borderRadius: Radios.grande + 4, overflow: 'hidden' },
  estrella: { position: 'absolute', width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#FFFFFF' },
  punto: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF' },
  astro: { position: 'absolute', left: 0, top: 0 },
  centrado: { alignItems: 'center', justifyContent: 'center' },
  sol: { alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#FFB547' },
  halo: { position: 'absolute', width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(255, 181, 71, 0.25)' },
  suelo: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  olla: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#7A2E12',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  chipHora: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radios.pildora,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  textoHora: { fontFamily: Tipografia.seminegrita, fontSize: 13, color: Colors.light.text },

  rejilla: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  celda: { width: '48%' },
  opcion: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderRadius: Radios.grande,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.light.borde,
    elevation: 2,
    shadowColor: '#7A2E12',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  opcionElegida: { borderColor: Marca.primario, backgroundColor: '#FFF7F3' },
  burbuja: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Marca.primarioTenue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  burbujaElegida: { backgroundColor: Marca.primario },
  nombre: { fontFamily: Tipografia.seminegrita, fontSize: 15, lineHeight: 20, textAlign: 'center', color: Colors.light.text },
  detalle: { fontFamily: Tipografia.regular, fontSize: 13, lineHeight: 17, textAlign: 'center', color: Colors.light.textSecondary },

  pie: { paddingHorizontal: 24, paddingTop: 12 },
});
