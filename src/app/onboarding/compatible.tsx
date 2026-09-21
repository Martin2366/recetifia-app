import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotonOnboarding } from '@/components/onboarding/boton';
import { EncabezadoOnboarding } from '@/components/onboarding/encabezado';
import { Reel } from '@/components/onboarding/reel';
import { Colors, Marca, Tipografia } from '@/constants/theme';
import { leerRespuesta } from '@/lib/preferencias';

/**
 * Septima pantalla del onboarding: todo lo que Recetifia sabe importar. Las
 * fuentes que el usuario marco antes aparecen nombradas y con un check.
 */

const SUAVE = Easing.bezier(0.22, 1, 0.36, 1);

const NOMBRES: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  facebook: 'Facebook',
  pinterest: 'Pinterest',
  web: 'sitios web',
  cuaderno: 'tus cuadernos',
};

/** "A", "A y B", "A, B y C" */
function enumerar(partes: string[]): string {
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

type Logo = {
  id: string;
  /** Posicion relativa al centro de la escena, en fracciones del ancho y alto. */
  x: number;
  y: number;
  lado: number;
  fondo: string;
  icono: (tamano: number) => ReactNode;
};

const LOGOS: Logo[] = [
  { id: 'web', x: -0.3, y: 0.03, lado: 48, fondo: '#FFFFFF', icono: (t) => <FontAwesome6 name="google" brand size={t} color="#4285F4" /> },
  { id: 'pinterest', x: 0.33, y: 0.06, lado: 54, fondo: '#FFFFFF', icono: (t) => <FontAwesome6 name="pinterest" brand size={t} color="#E60023" /> },
  { id: 'cuaderno', x: -0.37, y: 0.28, lado: 60, fondo: '#EDEDED', icono: (t) => <MaterialCommunityIcons name="camera" size={t} color="#333" /> },
  { id: 'facebook', x: 0.38, y: 0.4, lado: 62, fondo: '#1877F2', icono: (t) => <FontAwesome6 name="facebook-f" brand size={t} color="#FFF" /> },
  { id: 'tiktok', x: -0.36, y: 0.6, lado: 70, fondo: '#111111', icono: (t) => <FontAwesome6 name="tiktok" brand size={t} color="#FFF" /> },
  { id: 'instagram', x: 0.3, y: 0.76, lado: 74, fondo: '#E1306C', icono: (t) => <FontAwesome6 name="instagram" brand size={t} color="#FFF" /> },
  { id: 'youtube', x: -0.22, y: 0.9, lado: 50, fondo: '#FF0000', icono: (t) => <FontAwesome6 name="youtube" brand size={t} color="#FFF" /> },
];

export default function Compatible() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const [fuentes, setFuentes] = useState<string[]>([]);

  useEffect(() => {
    leerRespuesta<string[]>('fuentes').then((f) => setFuentes(Array.isArray(f) ? f : []));
  }, []);

  const cabecera = useSharedValue(0);
  const telefono = useSharedValue(0);
  const pie = useSharedValue(0);
  useEffect(() => {
    cabecera.value = withTiming(1, { duration: 600, easing: SUAVE });
    telefono.value = withDelay(200, withSpring(1, { damping: 16, stiffness: 110 }));
    pie.value = withDelay(1200, withTiming(1, { duration: 550, easing: SUAVE }));
  }, [cabecera, telefono, pie]);

  const estiloCabecera = useAnimatedStyle(() => ({
    opacity: cabecera.value,
    transform: [{ translateY: interpolate(cabecera.value, [0, 1], [12, 0]) }],
  }));
  const estiloTelefono = useAnimatedStyle(() => ({
    opacity: interpolate(telefono.value, [0, 0.3], [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(telefono.value, [0, 1], [40, 0]) }],
  }));
  const estiloPie = useAnimatedStyle(() => ({
    opacity: pie.value,
    transform: [{ translateY: interpolate(pie.value, [0, 1], [16, 0]) }],
  }));

  const conocidas = fuentes.filter((f) => NOMBRES[f]).map((f) => NOMBRES[f]);
  const texto = conocidas.length
    ? `Recetifia trae tus recetas de ${enumerar(conocidas)}. Y de casi cualquier otro lado, también.`
    : 'Recetifia trae tus recetas de Instagram, TikTok, YouTube, Facebook, Pinterest, sitios web ¡y hasta de tus cuadernos!';

  // La escena se adapta al alto disponible para no empujar el boton
  const altoEscena = Math.min(H * 0.46, 400);
  const anchoTel = altoEscena * 0.5;

  return (
    <View style={estilos.pantalla}>
      <StatusBar style="dark" />
      <EncabezadoOnboarding paso={6} />

      <Animated.View style={[estilos.cabecera, estiloCabecera]}>
        <Text style={estilos.titulo} accessibilityRole="header">
          ¡Buenas noticias! 🎉
        </Text>
        <Text style={estilos.texto}>{texto}</Text>
      </Animated.View>

      <View style={estilos.medio}>
        <View style={{ width: W, height: altoEscena }}>
          <Animated.View
            style={[
              estilos.telefono,
              { width: anchoTel, height: altoEscena * 0.94, left: (W - anchoTel) / 2, top: altoEscena * 0.03, borderRadius: anchoTel * 0.12 },
              estiloTelefono,
            ]}>
            <Reel escala={anchoTel / 360} />
          </Animated.View>

          {LOGOS.map((l, i) => (
            <LogoFlotante
              key={l.id}
              logo={l}
              indice={i}
              elegido={fuentes.includes(l.id)}
              cx={W / 2 + l.x * W}
              cy={l.y * altoEscena}
            />
          ))}
        </View>
      </View>

      <Animated.View style={[estilos.pie, { paddingBottom: insets.bottom + 20 }, estiloPie]}>
        <BotonOnboarding texto="Muéstrame cómo" alPulsar={() => router.push('/onboarding/tour')} />
      </Animated.View>
    </View>
  );
}

function LogoFlotante({ logo, indice, elegido, cx, cy }: { logo: Logo; indice: number; elegido: boolean; cx: number; cy: number }) {
  const aparece = useSharedValue(0);
  const flote = useSharedValue(0);

  useEffect(() => {
    aparece.value = withDelay(450 + indice * 110, withSpring(1, { damping: 10, stiffness: 150 }));
    // Cada logo flota con su propio ritmo para que no se muevan en bloque
    flote.value = withDelay(
      indice * 230,
      withRepeat(withSequence(withTiming(1, { duration: 1600 + indice * 140 }), withTiming(0, { duration: 1600 + indice * 140 })), -1)
    );
  }, [aparece, flote, indice]);

  const estilo = useAnimatedStyle(() => ({
    opacity: interpolate(aparece.value, [0, 0.3], [0, 1], 'clamp'),
    transform: [
      { translateY: flote.value * -8 },
      { scale: aparece.value },
      { rotate: `${(indice % 2 ? 1 : -1) * (4 + flote.value * 3)}deg` },
    ],
  }));

  const lado = logo.lado;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        estilos.logo,
        { width: lado, height: lado, borderRadius: lado * 0.26, left: cx - lado / 2, top: cy - lado / 2, backgroundColor: logo.fondo },
        estilo,
      ]}>
      {logo.icono(lado * 0.5)}
      {elegido ? (
        <View style={estilos.check}>
          <MaterialIcons name="check" size={13} color="#FFF" />
        </View>
      ) : null}
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#FFFFFF' },
  cabecera: { paddingHorizontal: 24, paddingTop: 24 },
  titulo: { fontFamily: Tipografia.display, fontSize: 32, lineHeight: 40, textAlign: 'center', color: Colors.light.text },
  texto: {
    fontFamily: Tipografia.regular,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: Colors.light.textSecondary,
    marginTop: 12,
  },

  medio: { flex: 1, justifyContent: 'center' },
  telefono: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 5,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    elevation: 10,
    shadowColor: '#7A2E12',
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  logo: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  check: {
    position: 'absolute',
    right: -6,
    top: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Marca.primario,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  pie: { paddingHorizontal: 24, paddingTop: 12 },
});
