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
import { OBJETIVOS, type IdObjetivo, type Objetivo } from '@/lib/objetivos';
import { guardarRespuesta } from '@/lib/preferencias';

/** Segunda pantalla del onboarding: que quiere lograr el usuario. Seleccion multiple. */

const SUAVE = Easing.bezier(0.22, 1, 0.36, 1);

export default function Objetivos() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // En el orden en que se tocaron: el primero es el principal.
  const [elegidos, setElegidos] = useState<IdObjetivo[]>([]);

  const entrada = useSharedValue(0);
  useEffect(() => {
    entrada.value = withTiming(1, { duration: 600, easing: SUAVE });
  }, [entrada]);
  const estiloCabecera = useAnimatedStyle(() => ({
    opacity: entrada.value,
    transform: [{ translateY: interpolate(entrada.value, [0, 1], [12, 0]) }],
  }));

  function alternar(id: IdObjetivo) {
    setElegidos((actual) => (actual.includes(id) ? actual.filter((e) => e !== id) : [...actual, id]));
  }

  async function continuar() {
    await guardarRespuesta('objetivos', elegidos);
    router.push({ pathname: '/onboarding/genial', params: { objetivos: elegidos.join(',') } });
  }

  const puede = elegidos.length > 0;

  return (
    <View style={estilos.pantalla}>
      <StatusBar style="dark" />
      <EncabezadoOnboarding paso={1} />

      <ScrollView contentContainerStyle={estilos.cuerpo} showsVerticalScrollIndicator={false}>
        <Animated.View style={estiloCabecera}>
          <Text style={estilos.titulo} accessibilityRole="header">
            ¿Qué quieres lograr{'\n'}en la cocina?
          </Text>
          <Text style={estilos.subtitulo}>Elige todas las que quieras</Text>
        </Animated.View>

        <View style={estilos.rejilla}>
          {OBJETIVOS.map((o, i) => (
            <Tarjeta key={o.id} objetivo={o} indice={i} elegido={elegidos.includes(o.id)} alPulsar={() => alternar(o.id)} />
          ))}
        </View>
      </ScrollView>

      <View style={[estilos.pie, { paddingBottom: insets.bottom + 20 }]}>
        <BotonOnboarding texto="Continuar" alPulsar={continuar} apagado={!puede} />
      </View>
    </View>
  );
}

function Tarjeta({
  objetivo,
  indice,
  elegido,
  alPulsar,
}: {
  objetivo: Objetivo;
  indice: number;
  elegido: boolean;
  alPulsar: () => void;
}) {
  // Entran en cascada, fila a fila
  const entrada = useSharedValue(0);
  const presion = useSharedValue(1);
  const salto = useSharedValue(1);
  const marca = useSharedValue(elegido ? 1 : 0);

  useEffect(() => {
    entrada.value = withDelay(180 + indice * 70, withTiming(1, { duration: 550, easing: SUAVE }));
  }, [entrada, indice]);

  useEffect(() => {
    marca.value = withSpring(elegido ? 1 : 0, { damping: 14, stiffness: 260 });
    if (elegido) {
      salto.value = withSequence(withTiming(1.22, { duration: 140, easing: SUAVE }), withSpring(1, { damping: 8, stiffness: 220 }));
    }
  }, [elegido, marca, salto]);

  const estiloTarjeta = useAnimatedStyle(() => ({
    opacity: entrada.value,
    transform: [{ translateY: interpolate(entrada.value, [0, 1], [18, 0]) }, { scale: presion.value }],
  }));
  const estiloEmoji = useAnimatedStyle(() => ({ transform: [{ scale: salto.value }] }));
  const estiloMarca = useAnimatedStyle(() => ({ opacity: marca.value, transform: [{ scale: marca.value }] }));

  return (
    <Animated.View style={[estilos.celda, estiloTarjeta]}>
      <Pressable
        onPress={alPulsar}
        onPressIn={() => (presion.value = withSpring(0.96, { damping: 18, stiffness: 400 }))}
        onPressOut={() => (presion.value = withSpring(1, { damping: 14, stiffness: 300 }))}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: elegido }}
        accessibilityLabel={objetivo.nombre}
        style={[estilos.tarjeta, elegido && estilos.tarjetaElegida]}>
        <View style={[estilos.radio, elegido && estilos.radioElegido]}>
          <Animated.View style={estiloMarca}>
            <MaterialIcons name="check" size={14} color="#FFFFFF" />
          </Animated.View>
        </View>
        <Animated.Text style={[estilos.emoji, estiloEmoji]}>{objetivo.emoji}</Animated.Text>
        <Text style={estilos.nombre}>{objetivo.nombre}</Text>
      </Pressable>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#FFFFFF' },
  cuerpo: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16, gap: 28 },

  titulo: { fontFamily: Tipografia.display, fontSize: 30, lineHeight: 38, textAlign: 'center', color: Colors.light.text },
  subtitulo: { fontFamily: Tipografia.regular, fontSize: 16, lineHeight: 22, textAlign: 'center', color: Colors.light.textSecondary, marginTop: 10 },

  rejilla: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  celda: { width: '48%' },
  tarjeta: {
    minHeight: 132,
    borderRadius: Radios.grande,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.light.borde,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingTop: 22,
    paddingBottom: 16,
    gap: 10,
    elevation: 3,
    shadowColor: '#7A2E12',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  tarjetaElegida: { borderColor: Marca.primario, backgroundColor: '#FFF7F3' },
  radio: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#D5D9D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioElegido: { backgroundColor: Marca.primario, borderColor: Marca.primario },
  emoji: { fontSize: 34, lineHeight: 42 },
  nombre: { fontFamily: Tipografia.seminegrita, fontSize: 14, lineHeight: 19, textAlign: 'center', color: Colors.light.text },

  pie: { paddingHorizontal: 24, paddingTop: 12 },
});
