import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
import { AHORRO_ANUAL, cargarPlanes, comprar, PLANES_RESPALDO, restaurarCompras, type IdPlan, type Plan } from '@/lib/compras';
import { claveCuota } from '@/lib/cuota';

/**
 * Paywall blando. Ya no forma parte del onboarding: solo se abre desde la app,
 * cuando la persona llega al limite o busca Plus. La X se ve desde el primer
 * momento y vuelve atras. (Precios y prueba se rehacen en la fase 5 del plan.)
 */

const SUAVE = Easing.bezier(0.22, 1, 0.36, 1);

/** Lo mas valioso de Plus, en tres lineas. */
// Solo lo que existe de verdad. Recetas, colecciones, fotos, porciones y el
// modo cocina ya son gratis: Plus no puede venderlos.
const INCLUYE = [
  'Importa videos e imágenes sin preocuparte del tope gratis',
  'Información nutricional de cada receta',
  'Apoyas una app hecha para Latinoamérica',
];

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
  const [comprando, setComprando] = useState(false);

  useEffect(() => {
    cargarPlanes().then(setPlanes);
  }, []);

  const contenido = useSharedValue(0);
  useEffect(() => {
    contenido.value = withTiming(1, { duration: 650, easing: SUAVE });
  }, [contenido]);

  const estiloContenido = useAnimatedStyle(() => ({
    opacity: contenido.value,
    transform: [{ translateY: interpolate(contenido.value, [0, 1], [18, 0]) }],
  }));

  const qc = useQueryClient();

  function salir() {
    qc.invalidateQueries({ queryKey: claveCuota });
    router.back();
  }

  async function empezar() {
    if (comprando) return;
    setComprando(true);
    const resultado = await comprar(elegido);
    setComprando(false);
    if (resultado === 'comprado') {
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
  const periodo = elegido === 'anual' ? 'año' : 'mes';
  const precio = elegido === 'anual' ? anual.precio : mensual.precio;
  // Sin letra chica escondida: lo que se cobra, cada cuanto y como cancelar
  const letraChica = `Se cobra ${precio} hoy y se renueva cada ${periodo}. Cancela cuando quieras en Google Play: sigues con Plus hasta el final de lo que pagaste y no se vuelve a cobrar.`;

  return (
    <View style={estilos.pantalla}>
      <StatusBar style="dark" />

      <ScrollView contentContainerStyle={{ paddingBottom: 250 + insets.bottom }} showsVerticalScrollIndicator={false} bounces={false}>
        <Mosaico alto={Math.min(H * 0.3, 260)} />

        <Animated.View style={[estilos.contenido, estiloContenido]}>
          <MarcaPlus />
          <Text style={estilos.titulo} accessibilityRole="header">
            Importa <Text style={estilos.resalte}>sin límites</Text>
          </Text>
          <Text style={estilos.subtitulo}>Recetifia sigue siendo gratis. Plus es para quien importa mucho.</Text>

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
              detalle={`${anual.precio} al año`}
            />
            <OpcionPlan
              elegido={elegido === 'mensual'}
              alPulsar={() => setElegido('mensual')}
              titulo="Mensual"
              precio={`${mensual.precio}/mes`}
              detalle="Se cobra cada mes"
            />
          </View>

        </Animated.View>
      </ScrollView>

      <View style={[estilos.pie, { paddingBottom: insets.bottom + 12 }]}>
        <View style={estilos.sinPago}>
          <MaterialIcons name="check" size={20} color={Colors.light.text} />
          <Text style={estilos.textoSinPago}>Cancela cuando quieras, en dos toques</Text>
        </View>
        {comprando ? (
          <View style={estilos.cargando}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : (
          <BotonOnboarding
            texto={`Suscribirme por ${precio} al ${periodo}`}
            alPulsar={empezar}
          />
        )}
        <Text style={estilos.letraChica}>
          {letraChica}
        </Text>
        <Pressable onPress={restaurar} hitSlop={8} accessibilityRole="button">
          <Text style={estilos.restaurar}>Restaurar compra</Text>
        </Pressable>
      </View>

      <View style={[estilos.cerrar, { top: insets.top + 10 }]}>
        <Pressable
          onPress={salir}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Cerrar y seguir con el plan gratis"
          style={({ pressed }) => [estilos.botonCerrar, { opacity: pressed ? 0.7 : 1 }]}>
          <MaterialIcons name="close" size={22} color={Colors.light.text} />
        </Pressable>
      </View>
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
  subtitulo: { fontFamily: Tipografia.regular, fontSize: 15, lineHeight: 21, textAlign: 'center', color: Colors.light.textSecondary, marginTop: -6 },

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
