import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Etiqueta, FUENTES, Telefono } from '@/components/bienvenida/telefono';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { marcarBienvenidaVista } from '@/lib/preferencias';

/**
 * Bienvenida previa al onboarding. ~18 s en cuatro actos:
 *
 *   1. Logo sobre el naranja de marca                       0.0 – 3.0 s
 *   2. "Guarda tus recetas desde cualquier lado": un mazo
 *      de celulares que salen uno a uno hacia la derecha     3.0 – 11.0 s
 *   3. "Y organízalas a tu manera": el icono grande          11.0 – 13.2 s
 *   4. El icono se achica y los celulares se meten dentro    13.2 – 18.0 s
 *
 * Todo corre en el hilo de UI con Reanimated: la linea de tiempo se programa
 * una sola vez al montar y JavaScript no interviene fotograma a fotograma.
 */

// Curvas: salida suave, sin rebotes bruscos. Mas suave que la referencia a proposito.
const SUAVE = Easing.bezier(0.22, 1, 0.36, 1); // ease-out-quint
const ENTRA_SALE = Easing.bezier(0.65, 0, 0.35, 1); // ease-in-out-cubic

const T = {
  logoEntra: 0,
  logoSale: 2600,
  acto2: 3000,
  primerPaso: 4200,
  paso: 1300, // 650 ms de movimiento + 650 ms quieto
  movimiento: 650,
  mazoSale: 10700,
  acto3: 11150,
  acto4: 13200,
  primeraMini: 13800,
  entreMinis: 650,
  viajeMini: 1050,
  boton: 18200,
} as const;

const N = FUENTES.length;

export default function Bienvenida() {
  const router = useRouter();
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sinMovimiento = useReducedMotion();

  // --- valores animados ---------------------------------------------------
  const logo = useSharedValue(0); // 0 oculto → 1 visible
  const fondoMarca = useSharedValue(1); // naranja de marca → fondo claro
  const titulo1 = useSharedValue(0);
  const mazo = useSharedValue(0); // aparicion del mazo
  const progreso = useSharedValue(0); // 0..N-1: que celular esta al frente
  const titulo2 = useSharedValue(0);
  const icono = useSharedValue(0); // aparicion del icono grande
  const encoge = useSharedValue(0); // 0 grande en el centro → 1 pequeno y abajo
  const latido = useSharedValue(1);
  const minis = [
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
  ];

  const [barraClara, setBarraClara] = useState(!sinMovimiento);
  const [mostrarBoton, setMostrarBoton] = useState(sinMovimiento);

  useEffect(() => {
    if (sinMovimiento) {
      // Quien pide menos movimiento ve directamente el estado final.
      fondoMarca.value = 0;
      titulo2.value = 1;
      icono.value = 1;
      encoge.value = 1;
      return;
    }

    // Acto 1: el logo entra con una escala suave y sale fundiendose
    logo.value = withSequence(
      withTiming(1, { duration: 800, easing: SUAVE }),
      withDelay(T.logoSale - 800, withTiming(0, { duration: 450, easing: ENTRA_SALE }))
    );
    fondoMarca.value = withDelay(T.logoSale, withTiming(0, { duration: 550, easing: ENTRA_SALE }));

    // Acto 2: titulo y mazo
    titulo1.value = withDelay(
      T.acto2,
      withSequence(
        withTiming(1, { duration: 550, easing: SUAVE }),
        withDelay(T.mazoSale - T.acto2 - 550, withTiming(0, { duration: 350 }))
      )
    );
    mazo.value = withDelay(
      T.acto2 + 150,
      withSequence(
        withTiming(1, { duration: 700, easing: SUAVE }),
        withDelay(T.mazoSale - T.acto2 - 850, withTiming(2, { duration: 450, easing: ENTRA_SALE }))
      )
    );

    // Cada celular sale hacia la derecha; el siguiente avanza al frente
    const pasos = Array.from({ length: N - 1 }, (_, k) =>
      withDelay(
        k === 0 ? 0 : T.paso - T.movimiento,
        withTiming(k + 1, { duration: T.movimiento, easing: ENTRA_SALE })
      )
    );
    progreso.value = withDelay(T.primerPaso, withSequence(...pasos));

    // Acto 3: el icono grande
    titulo2.value = withDelay(T.acto3, withTiming(1, { duration: 500, easing: SUAVE }));
    icono.value = withDelay(T.acto3 + 100, withSpring(1, { damping: 16, stiffness: 120 }));

    // Acto 4: el icono se achica y los celulares entran en el
    encoge.value = withDelay(T.acto4, withTiming(1, { duration: 750, easing: ENTRA_SALE }));
    minis.forEach((m, i) => {
      m.value = withDelay(
        T.primeraMini + i * T.entreMinis,
        withTiming(1, { duration: T.viajeMini, easing: Easing.bezier(0.33, 0, 0.2, 1) })
      );
    });
    // Un pequeno latido del icono cada vez que "traga" un celular
    latido.value = withDelay(
      T.primeraMini + T.viajeMini * 0.8,
      withSequence(
        ...Array.from({ length: N }, (_, i) =>
          withDelay(
            i === 0 ? 0 : T.entreMinis - 260,
            withSequence(
              withTiming(1.05, { duration: 130, easing: SUAVE }),
              withTiming(1, { duration: 130, easing: SUAVE })
            )
          )
        )
      )
    );

    const t1 = setTimeout(() => setBarraClara(false), T.logoSale);
    const t2 = setTimeout(() => setMostrarBoton(true), T.boton);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // La linea de tiempo se programa una sola vez al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sinMovimiento]);

  async function continuar() {
    await marcarBienvenidaVista();
    router.replace('/login');
  }

  // --- geometria ----------------------------------------------------------
  const anchoTel = Math.min(W * 0.47, 250);
  const altoTel = anchoTel * 2.05;
  const centroMazoY = H * 0.57;
  const ladoIcono = Math.min(W * 0.62, 320);
  const centroIconoY = H * 0.52;
  const bajadaIcono = H * 0.13;
  const escalaIconoFinal = 0.62;
  const anchoMini = anchoTel * 0.62;

  // --- estilos animados ---------------------------------------------------
  const estiloFondoMarca = useAnimatedStyle(() => ({ opacity: fondoMarca.value }));

  const estiloLogo = useAnimatedStyle(() => ({
    opacity: logo.value,
    transform: [{ scale: interpolate(logo.value, [0, 1], [0.82, 1]) }],
  }));

  const estiloTitulo1 = useAnimatedStyle(() => ({
    opacity: titulo1.value,
    transform: [{ translateY: interpolate(titulo1.value, [0, 1], [14, 0]) }],
  }));

  const estiloTitulo2 = useAnimatedStyle(() => ({
    opacity: titulo2.value,
    transform: [{ translateY: interpolate(titulo2.value, [0, 1], [14, 0]) }],
  }));

  const estiloMazo = useAnimatedStyle(() => ({
    opacity: interpolate(mazo.value, [0, 1, 2], [0, 1, 0]),
    transform: [
      { translateX: interpolate(mazo.value, [0, 1], [50, 0], Extrapolation.CLAMP) },
      { scale: interpolate(mazo.value, [1, 2], [1, 0.95], Extrapolation.CLAMP) },
    ],
  }));

  const estiloIcono = useAnimatedStyle(() => {
    const escala = interpolate(encoge.value, [0, 1], [1, escalaIconoFinal]);
    return {
      opacity: icono.value,
      transform: [
        { translateY: interpolate(encoge.value, [0, 1], [0, bajadaIcono]) },
        { scale: interpolate(icono.value, [0, 1], [0.6, 1]) * escala * latido.value },
      ],
    };
  });

  // Punto donde aterrizan los mini celulares: justo encima del icono ya encogido
  const ladoFinal = ladoIcono * escalaIconoFinal;
  const aterrizajeY = centroIconoY + bajadaIcono - ladoFinal / 2 - anchoMini * 0.55;

  return (
    <View style={[estilos.pantalla, { backgroundColor: Colors.light.background }]}>
      <StatusBar style={barraClara ? 'light' : 'dark'} />

      {/* Acto 1 */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, estilos.marca, estiloFondoMarca]}>
        <Animated.View style={[estilos.teja, { width: W * 0.34, height: W * 0.34, borderRadius: W * 0.34 * 0.24 }, estiloLogo]}>
          <Image source={require('@/assets/images/logo.png')} style={estilos.logoTeja} contentFit="contain" />
        </Animated.View>
      </Animated.View>

      {/* Titulos */}
      <View style={[estilos.titulos, { top: insets.top + H * 0.07 }]} pointerEvents="none">
        <Animated.Text style={[estilos.titulo, estiloTitulo1]}>Guarda tus recetas{'\n'}desde cualquier lado</Animated.Text>
        <Animated.Text style={[estilos.titulo, estilos.tituloEncima, estiloTitulo2]}>
          Y organízalas{'\n'}a tu manera
        </Animated.Text>
      </View>

      {/* Acto 2: el mazo */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, estiloMazo]}>
        {FUENTES.map((f, i) => (
          <CelularDelMazo
            key={f.id}
            indice={i}
            progreso={progreso}
            ancho={anchoTel}
            alto={altoTel}
            anchoPantalla={W}
            centroY={centroMazoY}
            fuente={f.id}
          />
        ))}
      </Animated.View>

      {/* Acto 4: los mini celulares van por DETRAS del icono para desaparecer dentro */}
      {FUENTES.map((f, i) => (
        <MiniCelular
          key={`mini-${f.id}`}
          indice={i}
          avance={minis[i]}
          ancho={anchoMini}
          anchoPantalla={W}
          altoPantalla={H}
          destinoY={aterrizajeY}
          fuente={f.id}
        />
      ))}

      {/* Acto 3 y 4: el icono */}
      <Animated.View
        pointerEvents="none"
        style={[
          estilos.teja,
          estilos.iconoGrande,
          {
            width: ladoIcono,
            height: ladoIcono,
            borderRadius: ladoIcono * 0.24,
            left: (W - ladoIcono) / 2,
            top: centroIconoY - ladoIcono / 2,
          },
          estiloIcono,
        ]}>
        <Image source={require('@/assets/images/logo.png')} style={estilos.logoTeja} contentFit="contain" />
      </Animated.View>

      {/* Saltar: nadie deberia estar obligado a mirar 18 segundos */}
      {!mostrarBoton ? (
        <Animated.View entering={FadeIn.delay(T.acto2).duration(400)} style={[estilos.saltar, { top: insets.top + 8 }]}>
          <Pressable onPress={continuar} hitSlop={12} accessibilityRole="button" accessibilityLabel="Saltar la bienvenida">
            <Text style={estilos.textoSaltar}>Saltar</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {mostrarBoton ? (
        <Animated.View
          entering={FadeInDown.duration(550).easing(SUAVE)}
          style={[estilos.pie, { paddingBottom: insets.bottom + 24 }]}>
          <Pressable
            onPress={continuar}
            accessibilityRole="button"
            style={({ pressed }) => [estilos.boton, { opacity: pressed ? 0.85 : 1 }]}>
            <Text style={estilos.textoBoton}>Comenzar</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Un celular del mazo. Su posicion depende de cuanto le falta para estar al frente. */
function CelularDelMazo({
  indice,
  progreso,
  ancho,
  alto,
  anchoPantalla,
  centroY,
  fuente,
}: {
  indice: number;
  progreso: SharedValue<number>;
  ancho: number;
  alto: number;
  anchoPantalla: number;
  centroY: number;
  fuente: (typeof FUENTES)[number]['id'];
}) {
  const estilo = useAnimatedStyle(() => {
    // r < 0: ya paso y sale por la derecha · r = 0: al frente · r > 0: esperando atras
    const r = indice - progreso.value;
    if (r < 0) {
      return {
        opacity: interpolate(r, [-1, -0.7, 0], [0, 1, 1], Extrapolation.CLAMP),
        transform: [
          { translateX: -r * anchoPantalla * 0.95 },
          { rotate: `${-r * 12}deg` },
          { scale: 1 },
        ],
      };
    }
    return {
      opacity: interpolate(r, [0, 1, 2, 3, 3.6], [1, 0.8, 0.55, 0.3, 0], Extrapolation.CLAMP),
      transform: [{ translateX: -r * 46 }, { rotate: '0deg' }, { scale: 1 - Math.min(r, 4) * 0.05 }],
    };
  });

  const estiloEtiqueta = useAnimatedStyle(() => {
    const r = indice - progreso.value;
    return {
      opacity: r < 0 ? 1 : interpolate(r, [0, 1, 2, 2.8], [1, 0.6, 0.3, 0], Extrapolation.CLAMP),
      transform: [{ translateY: r > 0 ? r * 30 : 0 }],
    };
  });

  return (
    <Animated.View
      style={[
        estilos.celular,
        {
          width: ancho,
          left: (anchoPantalla - ancho) / 2,
          top: centroY - alto / 2 - 52,
          zIndex: N - indice, // el que va delante tapa a los de atras, tambien al salir
        },
        estilo,
      ]}>
      <Animated.View style={[estilos.etiquetaCelular, estiloEtiqueta]}>
        <Etiqueta fuente={fuente} />
      </Animated.View>
      <Telefono fuente={fuente} ancho={ancho} />
    </Animated.View>
  );
}

/** Celular pequeno que entra desde una esquina y se mete dentro del icono. */
function MiniCelular({
  indice,
  avance,
  ancho,
  anchoPantalla,
  altoPantalla,
  destinoY,
  fuente,
}: {
  indice: number;
  avance: SharedValue<number>;
  ancho: number;
  anchoPantalla: number;
  altoPantalla: number;
  destinoY: number;
  fuente: (typeof FUENTES)[number]['id'];
}) {
  const alto = ancho * 2.05;
  // Alternan esquina derecha e izquierda
  const lado = indice % 2 === 0 ? 1 : -1;
  const origenX = lado * anchoPantalla * 0.62;
  const origenY = -altoPantalla * 0.08 - alto;

  const estilo = useAnimatedStyle(() => {
    const m = avance.value;
    return {
      opacity: interpolate(m, [0, 0.12, 0.82, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(m, [0, 0.72], [origenX, 0], Extrapolation.CLAMP) },
        {
          translateY: interpolate(
            m,
            [0, 0.72, 1],
            [origenY, destinoY - alto / 2, destinoY - alto / 2 + alto * 0.6],
            Extrapolation.CLAMP
          ),
        },
        { rotate: `${interpolate(m, [0, 0.72], [lado * 16, 0], Extrapolation.CLAMP)}deg` },
        { scale: interpolate(m, [0.72, 1], [1, 0.9], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[estilos.mini, { width: ancho, left: (anchoPantalla - ancho) / 2 }, estilo]}>
      <View style={estilos.etiquetaMini}>
        <Etiqueta fuente={fuente} escala={0.62} />
      </View>
      <Telefono fuente={fuente} ancho={ancho} />
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, overflow: 'hidden' },
  marca: { backgroundColor: Marca.primario, alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  teja: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    shadowColor: '#7A2E12',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  logoTeja: { width: '60%', height: '60%' },
  iconoGrande: { position: 'absolute', zIndex: 20 },

  titulos: { position: 'absolute', left: 24, right: 24, zIndex: 30 },
  titulo: {
    fontFamily: Tipografia.negrita,
    fontSize: 30,
    lineHeight: 38,
    textAlign: 'center',
    color: Colors.light.text,
  },
  tituloEncima: { position: 'absolute', left: 0, right: 0, top: 0 },

  celular: { position: 'absolute' },
  etiquetaCelular: { marginBottom: 12 },
  mini: { position: 'absolute', top: 0, zIndex: 10 },
  etiquetaMini: { marginBottom: 6 },

  saltar: { position: 'absolute', right: 20, zIndex: 40 },
  textoSaltar: { fontFamily: Tipografia.media, fontSize: 15, color: Colors.light.textSecondary, padding: 6 },

  pie: { position: 'absolute', left: 24, right: 24, bottom: 0, zIndex: 40 },
  boton: {
    backgroundColor: Marca.primario,
    minHeight: 56,
    borderRadius: Radios.pildora,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoBoton: { fontFamily: Tipografia.seminegrita, fontSize: 17, color: '#FFFFFF' },
});
