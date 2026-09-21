import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotonOnboarding } from '@/components/onboarding/boton';
import { EncabezadoOnboarding } from '@/components/onboarding/encabezado';
import { Colors, Tipografia } from '@/constants/theme';
import { buscarObjetivo, OBJETIVOS } from '@/lib/objetivos';

/**
 * Tercera pantalla del onboarding: responde al objetivo principal que eligio el
 * usuario y le confirma que la app le sirve para eso.
 */

const SUAVE = Easing.bezier(0.22, 1, 0.36, 1);

export default function Genial() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const { objetivos } = useLocalSearchParams<{ objetivos?: string }>();

  const ids = (objetivos ?? '').split(',').filter(Boolean);
  // Si se llega sin parametros (recarga en caliente, enlace directo) se usa el primero
  const principal = buscarObjetivo(ids[0]) ?? OBJETIVOS[0];
  const cuantos = Math.max(ids.length, 1);

  const titulo = useSharedValue(0);
  const texto = useSharedValue(0);
  const foto = useSharedValue(0);
  const mancha = useSharedValue(0);
  const cierre = useSharedValue(0);
  const pie = useSharedValue(0);

  useEffect(() => {
    titulo.value = withTiming(1, { duration: 550, easing: SUAVE });
    texto.value = withDelay(150, withTiming(1, { duration: 550, easing: SUAVE }));
    mancha.value = withDelay(250, withTiming(1, { duration: 900, easing: SUAVE }));
    foto.value = withDelay(350, withSpring(1, { damping: 14, stiffness: 110 }));
    cierre.value = withDelay(800, withTiming(1, { duration: 550, easing: SUAVE }));
    pie.value = withDelay(1000, withTiming(1, { duration: 550, easing: SUAVE }));
  }, [titulo, texto, foto, mancha, cierre, pie]);

  const estiloTitulo = useSubida(titulo);
  const estiloTexto = useSubida(texto);
  const estiloCierre = useSubida(cierre);
  const estiloPie = useSubida(pie);
  const estiloFoto = useAnimatedStyle(() => ({
    opacity: interpolate(foto.value, [0, 0.3], [0, 1], 'clamp'),
    transform: [{ scale: interpolate(foto.value, [0, 1], [0.86, 1]) }],
  }));
  const estiloMancha = useAnimatedStyle(() => ({
    opacity: mancha.value,
    transform: [
      { translateX: interpolate(mancha.value, [0, 1], [0, 14]) },
      { translateY: interpolate(mancha.value, [0, 1], [0, -10]) },
      { rotate: `${interpolate(mancha.value, [0, 1], [0, -14])}deg` },
      { scale: 1.06 },
    ],
  }));

  const lado = Math.min(W - 40, 380);

  function continuar() {
    router.push('/onboarding/fuentes');
  }

  return (
    <View style={estilos.pantalla}>
      <StatusBar style="dark" />
      <EncabezadoOnboarding paso={2} />

      <View style={estilos.cuerpo}>
        <Animated.Text style={[estilos.titulo, estiloTitulo]} accessibilityRole="header">
          ¡Eso es genial!
        </Animated.Text>
        <Animated.Text style={[estilos.texto, estiloTexto]}>{principal.respuesta}</Animated.Text>

        <View style={estilos.escena}>
          {/* En pantallas bajas se encoge en vez de pisar los textos */}
          <View style={{ height: lado, maxHeight: '100%', aspectRatio: 1 }}>
            <Animated.View style={[StyleSheet.absoluteFill, estiloMancha]}>
              <Image source={require('@/assets/images/onboarding/mancha.png')} style={StyleSheet.absoluteFill} contentFit="contain" />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, estiloFoto]}>
              <Image
                source={require('@/assets/images/onboarding/cocinando.webp')}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                accessibilityLabel="Dos personas cocinando juntas"
              />
            </Animated.View>
          </View>
        </View>

        <Animated.Text style={[estilos.cierre, estiloCierre]}>
          {cuantos > 1
            ? `Estamos aquí para ayudarte\ncon tus ${cuantos} objetivos 🤝`
            : 'Estamos aquí para ayudarte\na lograrlo 🤝'}
        </Animated.Text>
      </View>

      <Animated.View style={[estilos.pie, { paddingBottom: insets.bottom + 20 }, estiloPie]}>
        <BotonOnboarding texto="Continuar" alPulsar={continuar} />
      </Animated.View>
    </View>
  );
}

/** Aparece subiendo unos pixeles. */
function useSubida(valor: SharedValue<number>) {
  return useAnimatedStyle(() => ({
    opacity: valor.value,
    transform: [{ translateY: interpolate(valor.value, [0, 1], [14, 0]) }],
  }));
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#FFFFFF' },
  cuerpo: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },

  titulo: { fontFamily: Tipografia.display, fontSize: 32, lineHeight: 40, textAlign: 'center', color: Colors.light.text },
  texto: {
    fontFamily: Tipografia.regular,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: Colors.light.textSecondary,
    marginTop: 12,
  },
  escena: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  cierre: { fontFamily: Tipografia.negrita, fontSize: 20, lineHeight: 28, textAlign: 'center', color: Colors.light.text, marginBottom: 8 },

  pie: { paddingHorizontal: 24, paddingTop: 16 },
});
