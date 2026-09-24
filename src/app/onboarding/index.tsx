import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Marca, Radios, Tipografia } from '@/constants/theme';
import { LIMITES } from '@/lib/compras';

/**
 * Primera pantalla del onboarding: el ciclo de la app en tres pasos (guarda,
 * ordena, cocina). Cada paso trae su foto a pantalla completa con un zoom lento;
 * los pasos avanzan solos y tambien se pueden deslizar o elegir con los puntos.
 */

const SUAVE = Easing.bezier(0.22, 1, 0.36, 1); // ease-out-quint, igual que la bienvenida
const DURACION = 5000; // lo que se queda cada paso
const FUNDIDO = 900;

type MaterialIcon = keyof typeof MaterialIcons.glyphMap;

const PASOS: {
  foto: number;
  /** Encuadre de la foto: el plato no siempre esta centrado. */
  encuadre?: { left: string; top: string };
  icono: MaterialIcon;
  etiqueta: string;
  titulo: string;
  texto: string;
}[] = [
  {
    foto: require('@/assets/images/onboarding/guarda.jpg'),
    icono: 'ios-share',
    etiqueta: 'Guarda',
    titulo: 'Esa receta del reel,\nahora es tuya.',
    texto: 'Compártela desde Instagram, TikTok o YouTube a Recetifia. Sin capturas, sin pausar el video.',
  },
  {
    foto: require('@/assets/images/onboarding/ordena.jpg'),
    encuadre: { left: '25%', top: '50%' },
    icono: 'auto-awesome',
    etiqueta: 'Ordena',
    titulo: 'Ingredientes y pasos,\nlistos en segundos.',
    texto: 'Recetifia saca la receta del video y la deja limpia, ordenada y en tu biblioteca.',
  },
  {
    foto: require('@/assets/images/onboarding/cocina.jpg'),
    icono: 'restaurant',
    etiqueta: 'Cocina',
    titulo: 'Y a cocinar,\npaso a paso.',
    texto: 'Arma tu lista de compras y sigue cada paso sin perderte, con la pantalla siempre encendida.',
  },
];

const N = PASOS.length;

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sinMovimiento = useReducedMotion();

  const [activo, setActivo] = useState(0);
  const [altoTextos, setAltoTextos] = useState(0);

  const visibles = [useSharedValue(1), useSharedValue(0), useSharedValue(0)];
  const zooms = [useSharedValue(1), useSharedValue(1), useSharedValue(1)];
  const avance = useSharedValue(0);
  const entrada = useSharedValue(0);

  useEffect(() => {
    entrada.value = withDelay(250, withTiming(1, { duration: 600, easing: SUAVE }));
  }, [entrada]);

  const estiloAcciones = useAnimatedStyle(() => ({
    opacity: entrada.value,
    transform: [{ translateY: interpolate(entrada.value, [0, 1], [20, 0]) }],
  }));

  // Cada cambio de paso (automatico o del usuario) reprograma todo desde aqui.
  useEffect(() => {
    visibles.forEach((v, i) => {
      v.value = withTiming(i === activo ? 1 : 0, { duration: sinMovimiento ? 250 : FUNDIDO, easing: SUAVE });
    });

    const zoom = zooms[activo];
    cancelAnimation(zoom);
    zoom.value = 1;
    if (!sinMovimiento) {
      zoom.value = withTiming(1.1, { duration: DURACION + FUNDIDO, easing: Easing.linear });
    }

    cancelAnimation(avance);
    avance.value = 0;
    avance.value = withTiming(1, { duration: DURACION, easing: Easing.linear });

    const siguiente = setTimeout(() => setActivo((a) => (a + 1) % N), DURACION);
    return () => clearTimeout(siguiente);
    // Los valores compartidos son estables; solo importa el paso activo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, sinMovimiento]);

  // Deslizar a los lados cambia de paso. PanResponder evita envolver la app en
  // GestureHandlerRootView por un solo gesto.
  const irA = useRef(setActivo);
  irA.current = setActivo;
  const deslizar = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_, g) => {
          if (g.dx < -40) irA.current((a) => (a + 1) % N);
          else if (g.dx > 40) irA.current((a) => (a - 1 + N) % N);
        },
      }),
    []
  );

  function comenzar() {
    router.push('/onboarding/tour');
  }

  return (
    <View style={estilos.pantalla} {...deslizar.panHandlers}>
      <StatusBar style="light" />

      {PASOS.map((p, i) => (
        <Foto key={i} fuente={p.foto} encuadre={p.encuadre} visible={visibles[i]} zoom={zooms[i]} />
      ))}
      <Image
        source={require('@/assets/images/onboarding/degradado.png')}
        style={StyleSheet.absoluteFill}
        contentFit="fill"
        pointerEvents="none"
      />

      <View style={[estilos.marca, { top: insets.top + 14 }]} pointerEvents="none">
        <Image source={require('@/assets/images/logo-blanco.png')} style={estilos.logo} contentFit="contain" />
        <Text style={estilos.nombre}>Recetifia</Text>
      </View>

      {/* Para el apurado: salta el recorrido y va al mismo sitio que "Comenzar" */}
      <Animated.View style={[estilos.omitir, { top: insets.top + 10 }, estiloAcciones]}>
        <Pressable
          onPress={comenzar}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Omitir la presentación"
          style={({ pressed }) => [estilos.botonOmitir, { opacity: pressed ? 0.7 : 1 }]}>
          <Text style={estilos.textoOmitir}>Omitir</Text>
        </Pressable>
      </Animated.View>

      <View style={[estilos.contenido, { paddingBottom: insets.bottom + 20 }]}>
        {/* Los tres textos ocupan el mismo sitio; el contenedor toma el alto del mayor */}
        <View style={{ height: altoTextos }}>
          {PASOS.map((p, i) => (
            <TextoPaso
              key={i}
              paso={p}
              numero={i + 1}
              visible={visibles[i]}
              activo={i === activo}
              alMedir={(alto) => setAltoTextos((a) => Math.max(a, alto))}
            />
          ))}
        </View>

        <Animated.View style={[estilos.acciones, estiloAcciones]}>
          {/* Que es gratis y que tiene limite, dicho antes de pedir nada */}
          <View style={estilos.gratis}>
            <View style={estilos.filaGratis}>
              <MaterialIcons name="check-circle" size={18} color={Marca.primario} />
              <Text style={estilos.tituloGratis}>Gratis para siempre · Sin tarjeta</Text>
            </View>
            <Text style={estilos.detalleGratis}>
              Guarda, escribe y organiza sin límite. Solo importar con IA desde videos e imágenes tiene un tope:{' '}
              {LIMITES.importacionesPorSemana} por semana.
            </Text>
          </View>

          <Pressable
            onPress={comenzar}
            accessibilityRole="button"
            style={({ pressed }) => [estilos.boton, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
            <Text style={estilos.textoBoton}>Comenzar</Text>
          </Pressable>

          <View style={estilos.puntos}>
            {PASOS.map((p, i) => (
              <Punto
                key={i}
                activo={i === activo}
                avance={avance}
                alPulsar={() => setActivo(i)}
                etiqueta={`Paso ${i + 1}: ${p.etiqueta}`}
              />
            ))}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

function Foto({
  fuente,
  encuadre,
  visible,
  zoom,
}: {
  fuente: number;
  encuadre?: { left: string; top: string };
  visible: SharedValue<number>;
  zoom: SharedValue<number>;
}) {
  const estilo = useAnimatedStyle(() => ({
    opacity: visible.value,
    transform: [{ scale: zoom.value }],
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, estilo]} pointerEvents="none">
      <Image source={fuente} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={encuadre ?? 'center'} />
    </Animated.View>
  );
}

function TextoPaso({
  paso,
  numero,
  visible,
  activo,
  alMedir,
}: {
  paso: (typeof PASOS)[number];
  numero: number;
  visible: SharedValue<number>;
  activo: boolean;
  alMedir: (alto: number) => void;
}) {
  const estilo = useAnimatedStyle(() => ({
    opacity: interpolate(visible.value, [0, 0.4, 1], [0, 0, 1]),
    transform: [{ translateY: interpolate(visible.value, [0, 1], [16, 0]) }],
  }));
  return (
    <Animated.View
      style={[estilos.texto, estilo]}
      onLayout={(e) => alMedir(e.nativeEvent.layout.height)}
      accessibilityElementsHidden={!activo}
      importantForAccessibility={activo ? 'auto' : 'no-hide-descendants'}
      pointerEvents="none">
      <View style={estilos.chip}>
        <MaterialIcons name={paso.icono} size={15} color="#FFFFFF" />
        <Text style={estilos.textoChip}>
          {numero} · {paso.etiqueta}
        </Text>
      </View>
      <Text style={estilos.titulo} accessibilityRole="header">
        {paso.titulo}
      </Text>
      <Text style={estilos.descripcion}>{paso.texto}</Text>
    </Animated.View>
  );
}

/** Punto de progreso: el activo se estira y se llena mientras dura su paso. */
function Punto({
  activo,
  avance,
  alPulsar,
  etiqueta,
}: {
  activo: boolean;
  avance: SharedValue<number>;
  alPulsar: () => void;
  etiqueta: string;
}) {
  const ancho = useSharedValue(activo ? 28 : 8);
  useEffect(() => {
    ancho.value = withTiming(activo ? 28 : 8, { duration: 450, easing: SUAVE });
  }, [activo, ancho]);

  const estiloPista = useAnimatedStyle(() => ({ width: ancho.value }));
  const estiloRelleno = useAnimatedStyle(() => ({ width: activo ? avance.value * ancho.value : 0 }));

  return (
    <Pressable onPress={alPulsar} hitSlop={10} accessibilityRole="button" accessibilityLabel={etiqueta} accessibilityState={{ selected: activo }}>
      <Animated.View style={[estilos.pista, estiloPista]}>
        <Animated.View style={[estilos.relleno, estiloRelleno]} />
      </Animated.View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#140C08', overflow: 'hidden' },

  marca: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logo: { width: 30, height: 26 },
  nombre: { fontFamily: Tipografia.display, fontSize: 20, color: '#FFFFFF' },
  omitir: { position: 'absolute', right: 16 },
  botonOmitir: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radios.pildora,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  textoOmitir: { fontFamily: Tipografia.media, fontSize: 14, color: '#FFFFFF' },

  contenido: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 24, gap: 28 },
  texto: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 12 },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radios.pildora,
    backgroundColor: 'rgba(255, 107, 58, 0.9)',
  },
  textoChip: { fontFamily: Tipografia.seminegrita, fontSize: 13, color: '#FFFFFF', letterSpacing: 0.2 },
  titulo: { fontFamily: Tipografia.display, fontSize: 34, lineHeight: 42, color: '#FFFFFF' },
  descripcion: { fontFamily: Tipografia.regular, fontSize: 16, lineHeight: 24, color: 'rgba(255, 255, 255, 0.82)', maxWidth: 340 },

  acciones: { gap: 22 },
  gratis: {
    gap: 6,
    padding: 14,
    borderRadius: Radios.medio,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  filaGratis: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tituloGratis: { fontFamily: Tipografia.seminegrita, fontSize: 15, color: '#FFFFFF' },
  detalleGratis: { fontFamily: Tipografia.regular, fontSize: 13, lineHeight: 19, color: 'rgba(255, 255, 255, 0.82)' },
  boton: { backgroundColor: Marca.primario, minHeight: 56, borderRadius: Radios.pildora, alignItems: 'center', justifyContent: 'center' },
  textoBoton: { fontFamily: Tipografia.seminegrita, fontSize: 17, color: '#FFFFFF' },

  puntos: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  pista: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255, 255, 255, 0.35)', overflow: 'hidden' },
  relleno: { height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
});
