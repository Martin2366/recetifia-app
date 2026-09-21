import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotonOnboarding } from '@/components/onboarding/boton';
import { MarcaPlus, Silueta, TONOS } from '@/components/onboarding/formas';
import { Colors, Marca, Tipografia } from '@/constants/theme';

/** Primera pantalla de la suscripcion: invita a probar Recetifia+ sin pagar hoy. */

const SUAVE = Easing.bezier(0.22, 1, 0.36, 1);

export default function Oferta() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();

  const marca = useSharedValue(0);
  const antes = useSharedValue(0);
  const titulo = useSharedValue(0);
  const pie = useSharedValue(0);

  useEffect(() => {
    marca.value = withTiming(1, { duration: 500, easing: SUAVE });
    antes.value = withDelay(250, withTiming(1, { duration: 500, easing: SUAVE }));
    // La frase principal llega despues de una pausa, como quien termina la frase
    titulo.value = withDelay(900, withTiming(1, { duration: 650, easing: SUAVE }));
    pie.value = withDelay(1500, withTiming(1, { duration: 500, easing: SUAVE }));
  }, [marca, antes, titulo, pie]);

  const estiloMarca = useSubida(marca);
  const estiloAntes = useSubida(antes);
  const estiloTitulo = useSubida(titulo);
  const estiloPie = useSubida(pie);

  return (
    <View style={estilos.pantalla}>
      <StatusBar style="dark" />
      <Image source={require('@/assets/images/onboarding/calido.png')} style={estilos.fondoCalido} contentFit="fill" />

      {/* Siluetas que suben desde abajo y se quedan flotando */}
      <View style={[estilos.bodegon, { width: W }]} pointerEvents="none">
        <Silueta icono="egg" color={TONOS.celeste} tamano={W * 0.62} x={-W * 0.26} y={150} giro={14} retraso={300} desde="abajo" />
        <Silueta icono="carrot" color={TONOS.naranja} tamano={W * 0.56} x={W * 0.02} y={10} giro={-24} retraso={420} desde="abajo" />
        <Silueta icono="food-apple" color={TONOS.amarillo} tamano={W * 0.46} x={W * 0.58} y={30} giro={10} retraso={540} desde="abajo" />
        <Silueta icono="leaf" color={TONOS.verde} tamano={W * 0.66} x={W * 0.2} y={170} giro={-10} retraso={660} desde="abajo" />
        <Silueta icono="chili-mild" color={TONOS.lila} tamano={W * 0.52} x={W * 0.64} y={200} giro={-30} retraso={780} desde="abajo" />
      </View>

      <View style={[estilos.cuerpo, { paddingTop: insets.top + 48 }]}>
        <Animated.View style={estiloMarca}>
          <MarcaPlus />
        </Animated.View>
        <Animated.Text style={[estilos.antes, estiloAntes]}>Recetifia es gratis, pero…</Animated.Text>
        <Animated.Text style={[estilos.titulo, estiloTitulo]} accessibilityRole="header">
          nos encantaría que probaras Recetifia+ <Text style={estilos.resalte}>gratis por 3 días</Text>
        </Animated.Text>
      </View>

      <Animated.View style={[estilos.pie, { paddingBottom: insets.bottom + 20 }, estiloPie]}>
        <BotonOnboarding texto="Probar gratis 3 días" alPulsar={() => router.push('/onboarding/planes')} />
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
  fondoCalido: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },
  bodegon: { position: 'absolute', bottom: 0, height: 440 },
  cuerpo: { paddingHorizontal: 28, alignItems: 'center', gap: 20 },
  antes: { fontFamily: Tipografia.media, fontSize: 17, color: Colors.light.textSecondary, marginTop: 28 },
  titulo: { fontFamily: Tipografia.display, fontSize: 32, lineHeight: 42, textAlign: 'center', color: Colors.light.text },
  resalte: { color: Marca.primario },
  pie: { position: 'absolute', left: 24, right: 24, bottom: 0 },
});
