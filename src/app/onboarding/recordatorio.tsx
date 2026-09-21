import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { MarcaPlus } from '@/components/onboarding/formas';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { guardarRespuesta } from '@/lib/preferencias';

/** Antes del paywall: cuando avisar de que la prueba de 3 dias se acaba. */

const SUAVE = Easing.bezier(0.22, 1, 0.36, 1);
const DIAS_PRUEBA = 3;

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** "jue 25 sept". A mano: el Intl de Hermes no siempre trae los nombres en espanol. */
function fechaEn(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
}

const OPCIONES = [
  { antes: 1, etiqueta: '1 día antes' },
  { antes: 2, etiqueta: '2 días antes' },
];

export default function Recordatorio() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [antes, setAntes] = useState(1);

  const cabecera = useSharedValue(0);
  const campana = useSharedValue(0);
  const vaiven = useSharedValue(0);
  const hoja = useSharedValue(0);

  useEffect(() => {
    cabecera.value = withTiming(1, { duration: 600, easing: SUAVE });
    campana.value = withDelay(200, withSpring(1, { damping: 10, stiffness: 120 }));
    // Tilin-tilin: unos golpes, pausa, y otra vez
    vaiven.value = withDelay(
      700,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 120 }),
          withTiming(-1, { duration: 200 }),
          withTiming(0.7, { duration: 180 }),
          withTiming(-0.5, { duration: 160 }),
          withTiming(0, { duration: 140 }),
          withTiming(0, { duration: 1600 })
        ),
        -1
      )
    );
    hoja.value = withDelay(400, withTiming(1, { duration: 600, easing: SUAVE }));
  }, [cabecera, campana, vaiven, hoja]);

  // Un toque en una opcion hace sonar la campana otra vez
  function elegir(n: number) {
    setAntes(n);
    vaiven.value = withSequence(withTiming(1, { duration: 110 }), withTiming(-1, { duration: 190 }), withTiming(0, { duration: 160 }));
  }

  const estiloCabecera = useAnimatedStyle(() => ({
    opacity: cabecera.value,
    transform: [{ translateY: interpolate(cabecera.value, [0, 1], [12, 0]) }],
  }));
  const estiloCampana = useAnimatedStyle(() => ({
    opacity: interpolate(campana.value, [0, 0.3], [0, 1], 'clamp'),
    transform: [{ scale: interpolate(campana.value, [0, 1], [0.6, 1]) }, { rotate: `${vaiven.value * 14}deg` }],
  }));
  const estiloOndas = useAnimatedStyle(() => ({ opacity: Math.abs(vaiven.value) }));
  const estiloHoja = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(hoja.value, [0, 1], [320, 0]) }] }));

  async function continuar() {
    await guardarRespuesta('recordatorio', String(antes));
    router.push('/onboarding/paywall');
  }

  return (
    <View style={estilos.pantalla}>
      <StatusBar style="dark" />

      <Animated.View style={[estilos.cabecera, { paddingTop: insets.top + 32 }, estiloCabecera]}>
        <MarcaPlus />
        <Text style={estilos.titulo} accessibilityRole="header">
          Te avisamos <Text style={estilos.resalte}>{antes === 1 ? '1 día' : `${antes} días`}</Text> antes de que termine tu
          prueba
        </Text>
      </Animated.View>

      <View style={estilos.escena}>
        <View style={estilos.halo} />
        <Animated.View style={[estilos.ondas, estiloOndas]}>
          <MaterialCommunityIcons name="music-note" size={26} color={Marca.primarioSuave} style={estilos.notaIzq} />
          <MaterialCommunityIcons name="music-note-eighth" size={22} color={Marca.primario} style={estilos.notaDer} />
        </Animated.View>
        {/* El giro se hace desde el asa, como una campana de verdad */}
        <Animated.View style={[estilos.campana, estiloCampana]}>
          <MaterialCommunityIcons name="bell" size={150} color="#FFC93C" />
        </Animated.View>
      </View>

      <Animated.View style={[estilos.hoja, { paddingBottom: insets.bottom + 16 }, estiloHoja]}>
        {OPCIONES.map((o) => {
          const elegida = antes === o.antes;
          return (
            <Pressable
              key={o.antes}
              onPress={() => elegir(o.antes)}
              accessibilityRole="radio"
              accessibilityState={{ checked: elegida }}
              style={[estilos.opcion, elegida && estilos.opcionElegida]}>
              <View style={[estilos.radio, elegida && estilos.radioElegido]}>{elegida ? <View style={estilos.punto} /> : null}</View>
              <Text style={estilos.etiqueta}>{o.etiqueta}</Text>
              <Text style={estilos.fecha}>{fechaEn(DIAS_PRUEBA - o.antes)}</Text>
            </Pressable>
          );
        })}
        <Text style={estilos.nota}>Cancela fácil, sin cargos si lo haces antes de que termine.</Text>
        <BotonOnboarding texto="Empezar mis 3 días gratis" alPulsar={continuar} />
      </Animated.View>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#FFFFFF' },
  cabecera: { alignItems: 'center', gap: 18, paddingHorizontal: 28 },
  titulo: { fontFamily: Tipografia.display, fontSize: 30, lineHeight: 38, textAlign: 'center', color: Colors.light.text },
  resalte: { color: Marca.primario },

  escena: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 230, height: 230, borderRadius: 115, backgroundColor: '#FFF6E0' },
  campana: { transformOrigin: 'top' },
  ondas: { position: 'absolute', width: 260, height: 200 },
  notaIzq: { position: 'absolute', left: 14, top: 30, transform: [{ rotate: '-14deg' }] },
  notaDer: { position: 'absolute', right: 18, top: 60, transform: [{ rotate: '12deg' }] },

  hoja: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#FFFFFF',
    elevation: 14,
    shadowColor: '#7A2E12',
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
  },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    minHeight: 64,
    borderRadius: Radios.grande - 4,
    borderWidth: 1.5,
    borderColor: Colors.light.borde,
    backgroundColor: '#FAFAFA',
  },
  opcionElegida: { borderColor: Marca.primario, backgroundColor: '#FFF7F3' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#C9CECE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioElegido: { borderColor: Marca.primario },
  punto: { width: 12, height: 12, borderRadius: 6, backgroundColor: Marca.primario },
  etiqueta: { flex: 1, fontFamily: Tipografia.seminegrita, fontSize: 17, color: Colors.light.text },
  fecha: { fontFamily: Tipografia.regular, fontSize: 15, color: Colors.light.textSecondary },
  nota: { fontFamily: Tipografia.regular, fontSize: 13, textAlign: 'center', color: Colors.light.textSecondary, marginTop: 2 },
});
