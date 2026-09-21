import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { EncabezadoOnboarding } from '@/components/onboarding/encabezado';
import { Silueta, TONOS } from '@/components/onboarding/formas';
import { Colors, Marca, Tipografia } from '@/constants/theme';

/**
 * Transicion hacia la oferta: "preparamos todo para ti". Dura unos segundos y
 * avanza sola; no hay nada que tocar.
 */

const SUAVE = Easing.bezier(0.22, 1, 0.36, 1);
const DURACION = 4200;
const MENSAJES = ['Guardando tus objetivos…', 'Preparando tu biblioteca…', 'Ajustando tus recordatorios…', '¡Casi listo!'];

export default function Configurando() {
  const router = useRouter();
  const [mensaje, setMensaje] = useState(0);
  const [porcentaje, setPorcentaje] = useState(0);

  const titulo = useSharedValue(0);
  const texto = useSharedValue(1);
  const balanceo = useSharedValue(0);
  const barra = useSharedValue(0);

  useEffect(() => {
    titulo.value = withTiming(1, { duration: 600, easing: SUAVE });
    balanceo.value = withDelay(1200, withRepeat(withSequence(withTiming(1, { duration: 1400 }), withTiming(-1, { duration: 1400 })), -1, true));
    barra.value = withTiming(1, { duration: DURACION - 300, easing: Easing.inOut(Easing.quad) });

    const inicio = Date.now();
    const contador = setInterval(() => {
      const t = Math.min(1, (Date.now() - inicio) / (DURACION - 300));
      // Misma curva que la barra, para que numero y relleno vayan juntos
      const suavizado = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      setPorcentaje(Math.round(suavizado * 100));
    }, 50);

    const cambios = MENSAJES.slice(1).map((_, i) =>
      setTimeout(() => {
        texto.value = withSequence(withTiming(0, { duration: 180 }), withTiming(1, { duration: 280 }));
        setTimeout(() => setMensaje(i + 1), 180);
      }, ((i + 1) * DURACION) / MENSAJES.length)
    );
    const fin = setTimeout(() => router.replace('/onboarding/oferta'), DURACION + 300);

    return () => {
      clearInterval(contador);
      cambios.forEach(clearTimeout);
      clearTimeout(fin);
    };
    // Se programa una vez al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const estiloTitulo = useAnimatedStyle(() => ({
    opacity: titulo.value,
    transform: [{ translateY: interpolate(titulo.value, [0, 1], [12, 0]) }],
  }));
  const estiloTexto = useAnimatedStyle(() => ({ opacity: texto.value }));
  const estiloGrupo = useAnimatedStyle(() => ({ transform: [{ rotate: `${balanceo.value * 3}deg` }] }));
  const estiloBarra = useAnimatedStyle(() => ({ width: `${barra.value * 100}%` }));

  return (
    <View style={estilos.pantalla}>
      <StatusBar style="dark" />
      <EncabezadoOnboarding paso={7} />

      <Animated.Text style={[estilos.titulo, estiloTitulo]} accessibilityRole="header">
        Estamos preparando{'\n'}todo para ti
      </Animated.Text>

      <View style={estilos.centro}>
        {/* Bodegon de siluetas: hoja, huevo, manzana, estrella y un farfalle */}
        <Animated.View style={[estilos.grupo, estiloGrupo]}>
          <Silueta icono="leaf" color={TONOS.verde} tamano={118} x={18} y={0} giro={-18} retraso={250} />
          <Silueta icono="asterisk" color={TONOS.lila} tamano={50} x={168} y={22} giro={10} retraso={700} />
          <Silueta icono="egg" color={TONOS.amarillo} tamano={132} x={0} y={108} giro={-6} retraso={450} />
          <Silueta icono="food-apple" color={TONOS.durazno} tamano={122} x={118} y={86} giro={12} retraso={600} />
          <Silueta icono="bow-tie" color={TONOS.naranja} tamano={104} x={88} y={196} giro={-4} retraso={850} />
        </Animated.View>
      </View>

      <View style={estilos.pie} accessibilityLiveRegion="polite">
        <Animated.Text style={[estilos.mensaje, estiloTexto]}>{MENSAJES[mensaje]}</Animated.Text>
        <View style={estilos.filaBarra}>
          <View style={estilos.pista}>
            <Animated.View style={[estilos.relleno, estiloBarra]} />
          </View>
          <Text style={estilos.porcentaje}>{porcentaje}%</Text>
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#FFFFFF' },
  titulo: {
    fontFamily: Tipografia.display,
    fontSize: 30,
    lineHeight: 38,
    textAlign: 'center',
    color: Colors.light.text,
    marginTop: 40,
    paddingHorizontal: 24,
  },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grupo: { width: 250, height: 300 },
  pie: { paddingHorizontal: 40, paddingBottom: 64, gap: 16, alignItems: 'center' },
  mensaje: { fontFamily: Tipografia.media, fontSize: 17, color: Colors.light.textSecondary },
  filaBarra: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' },
  pista: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#F4E8E2', overflow: 'hidden' },
  relleno: { height: 8, borderRadius: 4, backgroundColor: Marca.primario },
  porcentaje: { fontFamily: Tipografia.seminegrita, fontSize: 14, color: Colors.light.text, width: 42, textAlign: 'right' },
});
