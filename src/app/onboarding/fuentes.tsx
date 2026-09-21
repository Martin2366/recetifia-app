import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotonOnboarding } from '@/components/onboarding/boton';
import { EncabezadoOnboarding } from '@/components/onboarding/encabezado';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { guardarRespuesta } from '@/lib/preferencias';

/** Cuarta pantalla del onboarding: de donde saca sus recetas. Seleccion multiple. */

const SUAVE = Easing.bezier(0.22, 1, 0.36, 1);

type Fuente = {
  id: string;
  nombre: string;
  detalle: string;
  color: string;
  /** Marca de FontAwesome o, si no hay, un icono de MaterialCommunityIcons. */
  marca?: 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'pinterest' | 'google';
  icono?: keyof typeof MaterialCommunityIcons.glyphMap;
};

const FUENTES: Fuente[] = [
  { id: 'instagram', nombre: 'Instagram', detalle: 'Reels y publicaciones', color: '#E1306C', marca: 'instagram' },
  { id: 'tiktok', nombre: 'TikTok', detalle: 'Videos de recetas', color: '#111111', marca: 'tiktok' },
  { id: 'youtube', nombre: 'YouTube', detalle: 'Videos y shorts', color: '#FF0000', marca: 'youtube' },
  { id: 'facebook', nombre: 'Facebook', detalle: 'Videos y publicaciones', color: '#1877F2', marca: 'facebook' },
  { id: 'pinterest', nombre: 'Pinterest', detalle: 'Pines de recetas', color: '#E60023', marca: 'pinterest' },
  { id: 'web', nombre: 'Google y sitios web', detalle: 'Blogs y páginas de recetas', color: '#4285F4', marca: 'google' },
  {
    id: 'cuaderno',
    nombre: 'Cuadernos y recetas a mano',
    detalle: 'Les tomas una foto y listo',
    color: Marca.aviso,
    icono: 'notebook-edit-outline',
  },
];

export default function Fuentes() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [elegidas, setElegidas] = useState<string[]>([]);

  const entrada = useSharedValue(0);
  useEffect(() => {
    entrada.value = withTiming(1, { duration: 600, easing: SUAVE });
  }, [entrada]);
  const estiloCabecera = useAnimatedStyle(() => ({
    opacity: entrada.value,
    transform: [{ translateY: interpolate(entrada.value, [0, 1], [12, 0]) }],
  }));

  function alternar(id: string) {
    setElegidas((actual) => (actual.includes(id) ? actual.filter((e) => e !== id) : [...actual, id]));
  }

  async function continuar() {
    await guardarRespuesta('fuentes', elegidas);
    router.push('/onboarding/momento');
  }

  return (
    <View style={estilos.pantalla}>
      <StatusBar style="dark" />
      <EncabezadoOnboarding paso={3} />

      <ScrollView contentContainerStyle={estilos.cuerpo} showsVerticalScrollIndicator={false}>
        <Animated.View style={estiloCabecera}>
          <Text style={estilos.titulo} accessibilityRole="header">
            ¿De dónde sacas{'\n'}tus recetas?
          </Text>
          <Text style={estilos.subtitulo}>Elige todas las que uses: Recetifia las trae desde ahí.</Text>
        </Animated.View>

        <View style={estilos.lista}>
          {FUENTES.map((f, i) => (
            <Fila key={f.id} fuente={f} indice={i} elegida={elegidas.includes(f.id)} alPulsar={() => alternar(f.id)} />
          ))}
        </View>
      </ScrollView>

      <View style={[estilos.pie, { paddingBottom: insets.bottom + 20 }]}>
        <BotonOnboarding texto="Continuar" alPulsar={continuar} apagado={elegidas.length === 0} />
      </View>
    </View>
  );
}

function Fila({
  fuente,
  indice,
  elegida,
  alPulsar,
}: {
  fuente: Fuente;
  indice: number;
  elegida: boolean;
  alPulsar: () => void;
}) {
  const entrada = useSharedValue(0);
  const presion = useSharedValue(1);
  const giro = useSharedValue(0);
  const marca = useSharedValue(elegida ? 1 : 0);

  useEffect(() => {
    entrada.value = withDelay(160 + indice * 60, withTiming(1, { duration: 550, easing: SUAVE }));
  }, [entrada, indice]);

  useEffect(() => {
    marca.value = withSpring(elegida ? 1 : 0, { damping: 14, stiffness: 260 });
    if (elegida) {
      // Un meneo corto del icono, como quien saluda
      giro.value = withSequence(
        withTiming(-12, { duration: 90 }),
        withTiming(10, { duration: 110 }),
        withSpring(0, { damping: 6, stiffness: 240 })
      );
    }
  }, [elegida, marca, giro]);

  const estiloFila = useAnimatedStyle(() => ({
    opacity: entrada.value,
    transform: [{ translateX: interpolate(entrada.value, [0, 1], [24, 0]) }, { scale: presion.value }],
  }));
  const estiloIcono = useAnimatedStyle(() => ({ transform: [{ rotate: `${giro.value}deg` }] }));
  const estiloMarca = useAnimatedStyle(() => ({ opacity: marca.value, transform: [{ scale: marca.value }] }));

  return (
    <Animated.View style={estiloFila}>
      <Pressable
        onPress={alPulsar}
        onPressIn={() => (presion.value = withSpring(0.97, { damping: 18, stiffness: 400 }))}
        onPressOut={() => (presion.value = withSpring(1, { damping: 14, stiffness: 300 }))}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: elegida }}
        accessibilityLabel={`${fuente.nombre}. ${fuente.detalle}`}
        style={[estilos.fila, elegida && estilos.filaElegida]}>
        <Animated.View style={[estilos.burbuja, { backgroundColor: `${fuente.color}14` }, estiloIcono]}>
          {fuente.marca ? (
            <FontAwesome6 name={fuente.marca} brand size={22} color={fuente.color} />
          ) : (
            <MaterialCommunityIcons name={fuente.icono ?? 'book'} size={24} color={fuente.color} />
          )}
        </Animated.View>
        <View style={estilos.textos}>
          <Text style={estilos.nombre}>{fuente.nombre}</Text>
          <Text style={estilos.detalle}>{fuente.detalle}</Text>
        </View>
        <View style={[estilos.casilla, elegida && estilos.casillaElegida]}>
          <Animated.View style={estiloMarca}>
            <MaterialIcons name="check" size={15} color="#FFFFFF" />
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#FFFFFF' },
  cuerpo: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16, gap: 24 },

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

  lista: { gap: 10 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radios.grande - 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.light.borde,
    elevation: 2,
    shadowColor: '#7A2E12',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  filaElegida: { borderColor: Marca.primario, backgroundColor: '#FFF7F3' },
  burbuja: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1, gap: 2 },
  nombre: { fontFamily: Tipografia.seminegrita, fontSize: 16, lineHeight: 21, color: Colors.light.text },
  detalle: { fontFamily: Tipografia.regular, fontSize: 13, lineHeight: 18, color: Colors.light.textSecondary },
  casilla: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D5D9D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  casillaElegida: { backgroundColor: Marca.primario, borderColor: Marca.primario },

  pie: { paddingHorizontal: 24, paddingTop: 12 },
});
