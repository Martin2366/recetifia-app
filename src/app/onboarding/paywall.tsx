import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotonOnboarding } from '@/components/onboarding/boton';
import { MarcaPlus } from '@/components/onboarding/formas';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { AHORRO_ANUAL, cargarPlanes, comprar, LIMITES, PLANES_RESPALDO, restaurarCompras, type IdPlan, type Plan } from '@/lib/compras';
import { guardarRespuesta } from '@/lib/preferencias';

/**
 * Paywall blando. El anual trae 3 dias de prueba (con tope de importaciones);
 * el mensual se cobra desde hoy, para que el anual sea la opcion obvia. La X
 * lleva a crear la cuenta con el plan gratis.
 */

const SUAVE = Easing.bezier(0.22, 1, 0.36, 1);

/** Lo mas valioso de Plus, en tres lineas. */
const INCLUYE = ['Importaciones y recetas ilimitadas', 'Recetas desde fotos y cuadernos', 'Porciones, lista por pasillo y sin conexión'];

const FOTOS = [
  require('@/assets/images/paywall/1.webp'),
  require('@/assets/images/paywall/4.webp'),
  require('@/assets/images/paywall/2.webp'),
  require('@/assets/images/paywall/5.webp'),
  require('@/assets/images/paywall/3.webp'),
  require('@/assets/images/paywall/6.webp'),
];

export default function Paywall() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();
  const [planes, setPlanes] = useState<Record<IdPlan, Plan>>(PLANES_RESPALDO);
  const [elegido, setElegido] = useState<IdPlan>('anual');
  const [recordar, setRecordar] = useState(true);
  const [comprando, setComprando] = useState(false);

  useEffect(() => {
    cargarPlanes().then(setPlanes);
  }, []);

  const cierre = useSharedValue(0);
  const contenido = useSharedValue(0);
  useEffect(() => {
    contenido.value = withTiming(1, { duration: 650, easing: SUAVE });
    // La X llega con un pequeno retraso: se ve, pero no es lo primero
    cierre.value = withDelay(1200, withTiming(1, { duration: 400 }));
  }, [cierre, contenido]);

  const estiloCierre = useAnimatedStyle(() => ({ opacity: cierre.value }));
  const estiloContenido = useAnimatedStyle(() => ({
    opacity: contenido.value,
    transform: [{ translateY: interpolate(contenido.value, [0, 1], [18, 0]) }],
  }));

  function salir() {
    router.replace('/onboarding/cuenta');
  }

  async function empezar() {
    if (comprando) return;
    setComprando(true);
    const resultado = await comprar(elegido);
    setComprando(false);
    if (resultado === 'comprado') {
      await guardarRespuesta('plan', elegido);
      salir();
    } else if (resultado === 'demostracion') {
      Alert.alert('Modo demostración', 'Las compras se activan cuando conectemos RevenueCat y Google Play. Por ahora sigues sin pagar.', [
        { text: 'Entendido', onPress: salir },
      ]);
    } else if (resultado === 'error') {
      Alert.alert('No se pudo completar', 'No se hizo ningún cargo. Inténtalo de nuevo en un momento.');
    }
    // "cancelado": el usuario cerro el dialogo de Google Play; se queda aqui
  }

  async function restaurar() {
    const ok = await restaurarCompras();
    if (ok) salir();
    else Alert.alert('Sin compras', 'No encontramos una suscripción activa en esta cuenta de Google Play.');
  }

  const anual = planes.anual;
  const mensual = planes.mensual;
  const plan = planes[elegido];
  const conPrueba = plan.diasPrueba > 0;
  const letraChica = conPrueba
    ? `${plan.diasPrueba} días gratis con hasta ${LIMITES.importacionesPrueba} importaciones, luego ${anual.precio} al año (${anual.precioMensual}/mes).`
    : `${mensual.precio} al mes desde hoy.`;

  return (
    <View style={estilos.pantalla}>
      <StatusBar style="dark" />

      <ScrollView contentContainerStyle={{ paddingBottom: 250 + insets.bottom }} showsVerticalScrollIndicator={false} bounces={false}>
        <Mosaico alto={Math.min(H * 0.3, 260)} />

        <Animated.View style={[estilos.contenido, estiloContenido]}>
          <MarcaPlus />
          <Text style={estilos.titulo} accessibilityRole="header">
            Elige tu plan y <Text style={estilos.resalte}>desbloquea todo</Text>
          </Text>

          <View style={estilos.incluye}>
            {INCLUYE.map((t) => (
              <View key={t} style={estilos.filaIncluye}>
                <MaterialIcons name="check-circle" size={18} color={Marca.primario} />
                <Text style={estilos.textoIncluye}>{t}</Text>
              </View>
            ))}
          </View>

          <View style={estilos.planes} accessibilityRole="radiogroup">
            <OpcionPlan
              elegido={elegido === 'anual'}
              alPulsar={() => setElegido('anual')}
              titulo="Anual"
              insignia={`AHORRA ${AHORRO_ANUAL}`}
              precio={`${anual.precioMensual}/mes`}
              detalle={`${anual.precio} al año · ${anual.diasPrueba} días gratis`}
            />
            <OpcionPlan
              elegido={elegido === 'mensual'}
              alPulsar={() => setElegido('mensual')}
              titulo="Mensual"
              precio={`${mensual.precio}/mes`}
              detalle="Sin prueba · se cobra desde hoy"
            />
          </View>

          {/* Solo tiene sentido con prueba: el mensual se cobra desde hoy */}
          {conPrueba ? (
            <View style={estilos.recordar}>
              <MaterialCommunityIcons name="bell-ring-outline" size={20} color={Marca.primario} />
              <Text style={estilos.textoRecordar}>Recuérdame antes de que termine mi prueba</Text>
              <Switch
                value={recordar}
                onValueChange={(v) => {
                  setRecordar(v);
                  guardarRespuesta('recordatorio', v ? '1' : 'no');
                }}
                trackColor={{ false: '#D5D9D9', true: Marca.primario }}
                thumbColor="#FFFFFF"
              />
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      <View style={[estilos.pie, { paddingBottom: insets.bottom + 12 }]}>
        <View style={estilos.sinPago}>
          <MaterialIcons name="check" size={20} color={Colors.light.text} />
          <Text style={estilos.textoSinPago}>{conPrueba ? 'Sin pago hoy' : 'Cancela cuando quieras'}</Text>
        </View>
        {comprando ? (
          <View style={estilos.cargando}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : (
          <BotonOnboarding
            texto={conPrueba ? `Empezar mis ${plan.diasPrueba} días gratis` : `Suscribirme por ${mensual.precio}/mes`}
            alPulsar={empezar}
          />
        )}
        <Text style={estilos.letraChica}>
          {letraChica} Cancela cuando quieras en Google Play.
        </Text>
        <Pressable onPress={restaurar} hitSlop={8} accessibilityRole="button">
          <Text style={estilos.restaurar}>Restaurar compra</Text>
        </Pressable>
      </View>

      <Animated.View style={[estilos.cerrar, { top: insets.top + 10 }, estiloCierre]}>
        <Pressable
          onPress={salir}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Cerrar y seguir con el plan gratis"
          style={({ pressed }) => [estilos.botonCerrar, { opacity: pressed ? 0.7 : 1 }]}>
          <MaterialIcons name="close" size={22} color={Colors.light.text} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** Tres columnas de fotos que se deslizan lento, en sentidos alternos. */
function Mosaico({ alto }: { alto: number }) {
  const lado = 118;
  const paso = lado + 12;
  const columnas = [
    [FOTOS[0], FOTOS[1], FOTOS[2], FOTOS[0], FOTOS[1], FOTOS[2]],
    [FOTOS[3], FOTOS[4], FOTOS[5], FOTOS[3], FOTOS[4], FOTOS[5]],
    [FOTOS[2], FOTOS[5], FOTOS[1], FOTOS[2], FOTOS[5], FOTOS[1]],
  ];
  return (
    <View style={[estilos.mosaico, { height: alto }]}>
      <View style={estilos.columnas}>
        {columnas.map((fotos, i) => (
          <Columna key={i} fotos={fotos} lado={lado} recorrido={paso * 3} sube={i % 2 === 0} desfase={i === 1 ? -40 : 0} />
        ))}
      </View>
      <Image source={require('@/assets/images/paywall/fundido.png')} style={StyleSheet.absoluteFill} contentFit="fill" />
    </View>
  );
}

function Columna({
  fotos,
  lado,
  recorrido,
  sube,
  desfase,
}: {
  fotos: number[];
  lado: number;
  recorrido: number;
  sube: boolean;
  desfase: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    // Bucle sin costura: la columna repite sus fotos y vuelve al inicio justo cuando coinciden
    t.value = withRepeat(withTiming(1, { duration: 18000, easing: Easing.linear }), -1, false);
  }, [t]);
  const estilo = useAnimatedStyle(() => ({
    transform: [{ translateY: desfase + (sube ? -t.value : t.value - 1) * recorrido }],
  }));
  return (
    <Animated.View style={[{ gap: 12 }, estilo]}>
      {fotos.map((f, i) => (
        <Image key={i} source={f} style={{ width: lado, height: lado, borderRadius: 22 }} contentFit="cover" />
      ))}
    </Animated.View>
  );
}

function OpcionPlan({
  elegido,
  alPulsar,
  titulo,
  insignia,
  precio,
  detalle,
}: {
  elegido: boolean;
  alPulsar: () => void;
  titulo: string;
  insignia?: string;
  precio: string;
  detalle: string;
}) {
  return (
    <Pressable
      onPress={alPulsar}
      accessibilityRole="radio"
      accessibilityState={{ checked: elegido }}
      accessibilityLabel={`${titulo}, ${precio}, ${detalle}`}
      style={[estilos.plan, elegido && estilos.planElegido]}>
      {insignia ? (
        <View style={estilos.insignia}>
          <Text style={estilos.textoInsignia}>{insignia}</Text>
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={estilos.tituloPlan}>{titulo}</Text>
        <Text style={estilos.detallePlan}>{detalle}</Text>
      </View>
      <Text style={estilos.precioPlan}>{precio}</Text>
      <View style={[estilos.radio, elegido && estilos.radioElegido]}>
        {elegido ? <MaterialIcons name="check" size={15} color="#FFFFFF" /> : null}
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#FFFFFF' },

  mosaico: { overflow: 'hidden' },
  columnas: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: -30, transform: [{ rotate: '-6deg' }] },

  contenido: { paddingHorizontal: 20, gap: 14, marginTop: -8 },
  titulo: { fontFamily: Tipografia.display, fontSize: 30, lineHeight: 38, textAlign: 'center', color: Colors.light.text },
  resalte: { color: Marca.primario },

  incluye: { gap: 8, alignSelf: 'center' },
  filaIncluye: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  textoIncluye: { fontFamily: Tipografia.media, fontSize: 15, color: Colors.light.text },
  planes: { gap: 14, marginTop: 10 },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: Radios.grande - 4,
    borderWidth: 1.5,
    borderColor: Colors.light.borde,
    backgroundColor: '#FFFFFF',
  },
  planElegido: { borderColor: Marca.primario, borderWidth: 2, backgroundColor: '#FFF7F3' },
  insignia: {
    position: 'absolute',
    top: -11,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radios.pildora,
    backgroundColor: Marca.primario,
  },
  textoInsignia: { fontFamily: Tipografia.negrita, fontSize: 11, letterSpacing: 0.5, color: '#FFFFFF' },
  tituloPlan: { fontFamily: Tipografia.negrita, fontSize: 17, color: Colors.light.text },
  detallePlan: { fontFamily: Tipografia.regular, fontSize: 13, color: Colors.light.textSecondary },
  precioPlan: { fontFamily: Tipografia.seminegrita, fontSize: 16, color: Colors.light.text },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#C9CECE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioElegido: { backgroundColor: Marca.primario, borderColor: Marca.primario },

  recordar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: Radios.grande - 4,
    backgroundColor: '#F7F5F4',
  },
  textoRecordar: { flex: 1, fontFamily: Tipografia.media, fontSize: 14, lineHeight: 19, color: Colors.light.text },

  pie: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 22,
    paddingTop: 14,
    gap: 10,
    alignItems: 'stretch',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 14,
    shadowColor: '#7A2E12',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
  },
  sinPago: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  textoSinPago: { fontFamily: Tipografia.seminegrita, fontSize: 16, color: Colors.light.text },
  cargando: { minHeight: 56, borderRadius: Radios.pildora, backgroundColor: Marca.primario, alignItems: 'center', justifyContent: 'center' },
  letraChica: { fontFamily: Tipografia.regular, fontSize: 12, lineHeight: 17, textAlign: 'center', color: Colors.light.textSecondary },
  restaurar: { fontFamily: Tipografia.media, fontSize: 13, textAlign: 'center', color: Colors.light.textSecondary, textDecorationLine: 'underline' },

  cerrar: { position: 'absolute', right: 16 },
  botonCerrar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
});
