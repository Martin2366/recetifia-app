import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
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

import { MaquetaBiblioteca } from '@/components/bienvenida/maqueta-biblioteca';
import { Etiqueta, FUENTES, Telefono, type Fuente } from '@/components/bienvenida/telefono';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { marcarBienvenidaVista } from '@/lib/preferencias';

/**
 * Bienvenida previa al onboarding. ~19 s en cinco actos:
 *
 *   1. Logo sobre el naranja de marca                          0.0 – 2.8 s
 *   2. "Guarda tus recetas desde cualquier lado": mazo de
 *      celulares que salen uno a uno hacia la derecha            2.8 – 10.1 s
 *   3. "Y organízalas a tu manera": el icono grande             10.1 – 12.0 s
 *   4. El icono se achica y los celulares se meten dentro      12.0 – 16.3 s
 *   5. El icono se agranda hasta llenar la pantalla, se funde
 *      y revela la biblioteca con "Empezar"                    16.3 – 18.8 s
 *
 * Todo corre en el hilo de UI con Reanimated: la linea de tiempo se programa
 * una sola vez al montar y JavaScript no interviene fotograma a fotograma.
 */

// Curvas mas suaves que las de la referencia, a proposito.
const SUAVE = Easing.bezier(0.22, 1, 0.36, 1); // ease-out-quint
const ENTRA_SALE = Easing.bezier(0.65, 0, 0.35, 1); // ease-in-out-cubic

const T = {
  logoSale: 2400,
  acto2: 2800,
  primerPaso: 3900,
  paso: 1150, // movimiento + pausa
  movimiento: 600,
  mazoSale: 9700,
  acto3: 10100,
  acto4: 12000,
  primeraMini: 12500,
  entreMinis: 550,
  viajeMini: 1000,
  acto5: 16450,
  titulo3: 17700,
  boton: 18300,
} as const;

const N = FUENTES.length;

export default function Bienvenida() {
  const router = useRouter();
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sinMovimiento = useReducedMotion();

  // --- valores animados ---------------------------------------------------
  const logo = useSharedValue(0);
  const fondoMarca = useSharedValue(1);
  const titulo1 = useSharedValue(0);
  const mazo = useSharedValue(0); // 0 oculto · 1 visible · 2 desvanecido
  const progreso = useSharedValue(0); // 0..N-1: que celular esta al frente
  const titulo2 = useSharedValue(0); // 0 oculto · 1 visible · 2 desvanecido
  const icono = useSharedValue(0);
  const encoge = useSharedValue(0);
  const latido = useSharedValue(1);
  const expande = useSharedValue(0); // el icono crece hasta desaparecer
  const maqueta = useSharedValue(0);
  const titulo3 = useSharedValue(0);
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

  /** Salta directamente al estado final: la pantalla con "Empezar". */
  function irAlFinal() {
    const todos = [logo, fondoMarca, titulo1, mazo, progreso, titulo2, icono, encoge, latido, expande, maqueta, titulo3, ...minis];
    todos.forEach((v) => cancelAnimation(v));
    logo.value = 0;
    fondoMarca.value = 0;
    titulo1.value = 0;
    mazo.value = 0;
    titulo2.value = 0;
    icono.value = 0;
    minis.forEach((m) => (m.value = 0));
    maqueta.value = withTiming(1, { duration: 400, easing: SUAVE });
    titulo3.value = withTiming(1, { duration: 400, easing: SUAVE });
    setBarraClara(false);
    setMostrarBoton(true);
  }

  useEffect(() => {
    if (sinMovimiento) {
      // Quien pide menos movimiento ve directamente el estado final.
      fondoMarca.value = 0;
      maqueta.value = 1;
      titulo3.value = 1;
      return;
    }

    // Acto 1: el logo entra con una escala suave y se funde
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
    progreso.value = withDelay(
      T.primerPaso,
      withSequence(
        ...Array.from({ length: N - 1 }, (_, k) =>
          withDelay(k === 0 ? 0 : T.paso - T.movimiento, withTiming(k + 1, { duration: T.movimiento, easing: ENTRA_SALE }))
        )
      )
    );

    // Acto 3: el icono grande
    titulo2.value = withDelay(
      T.acto3,
      withSequence(
        withTiming(1, { duration: 500, easing: SUAVE }),
        withDelay(T.titulo3 - T.acto3 - 500 - 300, withTiming(2, { duration: 300 }))
      )
    );
    icono.value = withDelay(T.acto3 + 100, withSpring(1, { damping: 16, stiffness: 120 }));

    // Acto 4: el icono se achica y los celulares entran en el
    encoge.value = withDelay(T.acto4, withTiming(1, { duration: 700, easing: ENTRA_SALE }));
    minis.forEach((m, i) => {
      m.value = withDelay(
        T.primeraMini + i * T.entreMinis,
        withTiming(1, { duration: T.viajeMini, easing: Easing.bezier(0.33, 0, 0.2, 1) })
      );
    });
    latido.value = withDelay(
      T.primeraMini + T.viajeMini * 0.8,
      withSequence(
        ...Array.from({ length: N }, (_, i) =>
          withDelay(
            i === 0 ? 0 : T.entreMinis - 260,
            withSequence(withTiming(1.05, { duration: 130, easing: SUAVE }), withTiming(1, { duration: 130, easing: SUAVE }))
          )
        )
      )
    );

    // Acto 5: el icono crece hasta llenar la pantalla y revela la biblioteca
    expande.value = withDelay(T.acto5, withTiming(1, { duration: 900, easing: Easing.bezier(0.5, 0, 0.3, 1) }));
    maqueta.value = withDelay(T.acto5 + 250, withTiming(1, { duration: 800, easing: SUAVE }));
    titulo3.value = withDelay(T.titulo3, withTiming(1, { duration: 500, easing: SUAVE }));

    const t1 = setTimeout(() => setBarraClara(false), T.logoSale);
    const t2 = setTimeout(() => setMostrarBoton(true), T.boton);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // La linea de tiempo se programa una sola vez al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sinMovimiento]);

  // "Empezar" llevara al onboarding cuando exista; "Iniciar sesion" ira directo
  // al login. Mientras no haya onboarding, los dos terminan en el login.
  async function salir(_destino: 'empezar' | 'entrar') {
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

  const altoPie = 150 + insets.bottom;
  const anchoMaqueta = Math.min(W * 0.54, (H * 0.52) / 2.08);
  const centroMaquetaY = insets.top + H * 0.17 + (H - altoPie - insets.top - H * 0.17) / 2;

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
    opacity: interpolate(titulo2.value, [0, 1, 2], [0, 1, 0]),
    transform: [{ translateY: interpolate(titulo2.value, [0, 1, 2], [14, 0, -8]) }],
  }));

  const estiloTitulo3 = useAnimatedStyle(() => ({
    opacity: titulo3.value,
    transform: [{ translateY: interpolate(titulo3.value, [0, 1], [14, 0]) }],
  }));

  const estiloMazo = useAnimatedStyle(() => ({
    opacity: interpolate(mazo.value, [0, 1, 2], [0, 1, 0]),
    transform: [
      { translateX: interpolate(mazo.value, [0, 1], [50, 0], Extrapolation.CLAMP) },
      { scale: interpolate(mazo.value, [1, 2], [1, 0.95], Extrapolation.CLAMP) },
    ],
  }));

  const estiloIcono = useAnimatedStyle(() => {
    const e = expande.value;
    const escala =
      interpolate(icono.value, [0, 1], [0.6, 1]) *
      interpolate(encoge.value, [0, 1], [1, escalaIconoFinal]) *
      latido.value *
      interpolate(e, [0, 1], [1, 4.2]);
    // Al expandirse vuelve hacia el centro de la maqueta, que es lo que revela
    const y = interpolate(encoge.value, [0, 1], [0, bajadaIcono]) + interpolate(e, [0, 1], [0, centroMaquetaY - centroIconoY - bajadaIcono]);
    return {
      opacity: icono.value * interpolate(e, [0, 0.35, 1], [1, 0.55, 0]),
      transform: [{ translateY: y }, { scale: escala }],
    };
  });

  const estiloMaqueta = useAnimatedStyle(() => ({
    opacity: maqueta.value,
    transform: [{ scale: interpolate(maqueta.value, [0, 1], [0.9, 1]) }],
  }));

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

      {/* Titulos: tres, superpuestos, cada uno con su propia opacidad */}
      <View style={[estilos.titulos, { top: insets.top + H * 0.07 }]} pointerEvents="none">
        <Animated.Text style={[estilos.titulo, estiloTitulo1]}>Guarda tus recetas{'\n'}desde cualquier lado</Animated.Text>
        <Animated.Text style={[estilos.titulo, estilos.tituloEncima, estiloTitulo2]}>Y organízalas{'\n'}a tu manera</Animated.Text>
        <Animated.Text style={[estilos.titulo, estilos.tituloEncima, estiloTitulo3]}>
          ¿Todo listo para importar{'\n'}tu primera receta?
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

      {/* Acto 5: la biblioteca, por debajo del icono para que este la revele */}
      <Animated.View
        pointerEvents="none"
        style={[
          estilos.maqueta,
          { left: (W - anchoMaqueta) / 2, top: centroMaquetaY - (anchoMaqueta * 2.08) / 2 },
          estiloMaqueta,
        ]}>
        <MaquetaBiblioteca ancho={anchoMaqueta} />
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

      {/* Actos 3, 4 y 5: el icono */}
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

      {/* Saltar lleva al final, no fuera: ahi estan las dos opciones */}
      {!mostrarBoton ? (
        <Animated.View entering={FadeIn.delay(T.acto2).duration(400)} style={[estilos.saltar, { top: insets.top + 8 }]}>
          <Pressable onPress={irAlFinal} hitSlop={12} accessibilityRole="button" accessibilityLabel="Saltar la bienvenida">
            <Text style={estilos.textoSaltar}>Saltar</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {mostrarBoton ? (
        <Animated.View entering={FadeInDown.duration(550).easing(SUAVE)} style={[estilos.pie, { paddingBottom: insets.bottom + 20 }]}>
          <Pressable
            onPress={() => salir('empezar')}
            accessibilityRole="button"
            style={({ pressed }) => [estilos.boton, { opacity: pressed ? 0.85 : 1 }]}>
            <Text style={estilos.textoBoton}>Empezar</Text>
          </Pressable>
          <Pressable onPress={() => salir('entrar')} accessibilityRole="button" hitSlop={8} style={estilos.enlace}>
            <Text style={estilos.textoEnlace}>
              ¿Ya tienes una cuenta? <Text style={estilos.textoEnlaceMarca}>Iniciar sesión</Text>
            </Text>
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
  fuente: Fuente;
}) {
  const estilo = useAnimatedStyle(() => {
    // r < 0: ya paso y sale por la derecha · r = 0: al frente · r > 0: esperando atras
    const r = indice - progreso.value;
    if (r < 0) {
      return {
        opacity: interpolate(r, [-1, -0.7, 0], [0, 1, 1], Extrapolation.CLAMP),
        transform: [{ translateX: -r * anchoPantalla * 0.95 }, { rotate: `${-r * 12}deg` }, { scale: 1 }],
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
        { width: ancho, left: (anchoPantalla - ancho) / 2, top: centroY - alto / 2 - 52, zIndex: N - indice },
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
  fuente: Fuente;
}) {
  const alto = ancho * 2.05;
  const lado = indice % 2 === 0 ? 1 : -1; // alternan esquina derecha e izquierda
  const origenX = lado * anchoPantalla * 0.62;
  const origenY = -altoPantalla * 0.08 - alto;

  const estilo = useAnimatedStyle(() => {
    const m = avance.value;
    return {
      opacity: interpolate(m, [0, 0.12, 0.82, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(m, [0, 0.72], [origenX, 0], Extrapolation.CLAMP) },
        {
          translateY: interpolate(m, [0, 0.72, 1], [origenY, destinoY - alto / 2, destinoY - alto / 2 + alto * 0.6], Extrapolation.CLAMP),
        },
        { rotate: `${interpolate(m, [0, 0.72], [lado * 16, 0], Extrapolation.CLAMP)}deg` },
        { scale: interpolate(m, [0.72, 1], [1, 0.9], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[estilos.mini, { width: ancho, left: (anchoPantalla - ancho) / 2 }, estilo]}>
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
  titulo: { fontFamily: Tipografia.negrita, fontSize: 30, lineHeight: 38, textAlign: 'center', color: Colors.light.text },
  tituloEncima: { position: 'absolute', left: 0, right: 0, top: 0 },

  celular: { position: 'absolute' },
  etiquetaCelular: { marginBottom: 12 },
  mini: { position: 'absolute', top: 0, zIndex: 10 },
  etiquetaMini: { marginBottom: 6 },
  maqueta: { position: 'absolute', zIndex: 15 },

  saltar: { position: 'absolute', right: 20, zIndex: 40 },
  textoSaltar: { fontFamily: Tipografia.media, fontSize: 15, color: Colors.light.textSecondary, padding: 6 },

  pie: { position: 'absolute', left: 24, right: 24, bottom: 0, zIndex: 40, gap: 14 },
  boton: { backgroundColor: Marca.primario, minHeight: 56, borderRadius: Radios.pildora, alignItems: 'center', justifyContent: 'center' },
  textoBoton: { fontFamily: Tipografia.seminegrita, fontSize: 17, color: '#FFFFFF' },
  enlace: { alignSelf: 'center', paddingVertical: 4 },
  textoEnlace: { fontFamily: Tipografia.regular, fontSize: 15, color: Colors.light.textSecondary },
  textoEnlaceMarca: { fontFamily: Tipografia.seminegrita, color: Marca.primario },
});
