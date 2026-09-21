import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { MarcaPlus } from '@/components/onboarding/formas';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { AHORRO_ANUAL, BENEFICIOS, cargarPlanes, PLANES_RESPALDO } from '@/lib/compras';

/**
 * Gratis frente a Recetifia+. El plan gratis sirve para probar la app; lo que
 * se usa todos los dias (porciones, lista por pasillo, sin conexion, fotos) es
 * de Plus.
 */

const SUAVE = Easing.bezier(0.22, 1, 0.36, 1);
const ANCHO_GRATIS = 70;
const ANCHO_PLUS = 96;

type Celda = boolean | string;
const FILAS = BENEFICIOS;

export default function Planes() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mensual, setMensual] = useState(PLANES_RESPALDO.anual.precioMensual ?? '');

  useEffect(() => {
    cargarPlanes().then((p) => p.anual.precioMensual && setMensual(p.anual.precioMensual));
  }, []);

  const cabecera = useSharedValue(0);
  const columna = useSharedValue(0);
  const nota = useSharedValue(0);
  useEffect(() => {
    cabecera.value = withTiming(1, { duration: 600, easing: SUAVE });
    columna.value = withDelay(250, withTiming(1, { duration: 700, easing: SUAVE }));
    nota.value = withDelay(1300, withTiming(1, { duration: 550, easing: SUAVE }));
  }, [cabecera, columna, nota]);

  const estiloCabecera = useAnimatedStyle(() => ({
    opacity: cabecera.value,
    transform: [{ translateY: interpolate(cabecera.value, [0, 1], [12, 0]) }],
  }));
  // La columna de Plus crece de arriba hacia abajo
  const estiloColumna = useAnimatedStyle(() => ({
    opacity: columna.value,
    transform: [{ scaleY: interpolate(columna.value, [0, 1], [0.6, 1]) }],
  }));
  const estiloNota = useAnimatedStyle(() => ({
    opacity: nota.value,
    transform: [{ translateY: interpolate(nota.value, [0, 1], [14, 0]) }],
  }));

  return (
    <View style={estilos.pantalla}>
      <StatusBar style="dark" />

      <ScrollView contentContainerStyle={[estilos.cuerpo, { paddingTop: insets.top + 32 }]} showsVerticalScrollIndicator={false}>
        <Animated.View style={[estilos.cabecera, estiloCabecera]}>
          <MarcaPlus />
          <Text style={estilos.titulo} accessibilityRole="header">
            Guarda todas las recetas que quieras, <Text style={estilos.resalte}>sin límites</Text>
          </Text>
        </Animated.View>

        <View style={estilos.tabla}>
          <Animated.View style={[estilos.columnaPlus, { width: ANCHO_PLUS }, estiloColumna]} />

          <View style={[estilos.fila, estilos.filaCabecera]}>
            <View style={{ flex: 1 }} />
            <Text style={[estilos.encabezado, { width: ANCHO_GRATIS }]}>Gratis</Text>
            <View style={[estilos.encabezadoPlus, { width: ANCHO_PLUS }]}>
              <MaterialCommunityIcons name="crown" size={18} color={Marca.primario} />
              <Text style={estilos.textoEncabezadoPlus}>Plus</Text>
            </View>
          </View>

          {FILAS.map((f, i) => (
            <Fila key={f.titulo} fila={f} indice={i} ultima={i === FILAS.length - 1} />
          ))}
        </View>

        <Animated.View style={[estilos.nota, estiloNota]}>
          <View style={estilos.notaIcono}>
            <MaterialCommunityIcons name="coffee-outline" size={22} color={Marca.primario} />
          </View>
          <Text style={estilos.notaTexto}>
            Con el plan anual sale <Text style={estilos.negrita}>{mensual} al mes</Text>, menos que un café. Pagas un año
            por poco más de lo que cuestan 3 meses del mensual: <Text style={estilos.negrita}>ahorras {AHORRO_ANUAL}</Text>.
          </Text>
        </Animated.View>
      </ScrollView>

      <View style={[estilos.pie, { paddingBottom: insets.bottom + 16 }]}>
        <BotonOnboarding texto="Probar gratis 3 días" alPulsar={() => router.push('/onboarding/recordatorio')} />
        <Text style={estilos.letraChica}>Prueba gratis con el plan anual · Cancela cuando quieras</Text>
      </View>
    </View>
  );
}

function Fila({ fila, indice, ultima }: { fila: (typeof FILAS)[number]; indice: number; ultima: boolean }) {
  const v = useSharedValue(0);
  const latido = useSharedValue(1);

  useEffect(() => {
    v.value = withDelay(350 + indice * 90, withTiming(1, { duration: 450, easing: SUAVE }));
    if (fila.estrella) {
      // "Ilimitadas" da un salto cuando termina de entrar la tabla
      latido.value = withDelay(
        350 + (FILAS.length + 1) * 90,
        withSequence(withTiming(1.18, { duration: 180, easing: SUAVE }), withSpring(1, { damping: 7, stiffness: 200 }))
      );
    }
  }, [v, latido, indice, fila.estrella]);

  const estilo = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ translateY: interpolate(v.value, [0, 1], [10, 0]) }],
  }));
  const estiloLatido = useAnimatedStyle(() => ({ transform: [{ scale: latido.value }] }));

  return (
    <Animated.View style={[estilos.fila, !ultima && estilos.filaBorde, estilo]}>
      <View style={estilos.celdaTitulo}>
        <Text style={[estilos.tituloFila, fila.estrella && estilos.tituloEstrella]}>{fila.titulo}</Text>
        {fila.detalle ? <Text style={estilos.detalleFila}>{fila.detalle}</Text> : null}
      </View>
      <View style={[estilos.celda, { width: ANCHO_GRATIS }]}>
        <Valor valor={fila.gratis} />
      </View>
      <Animated.View style={[estilos.celda, { width: ANCHO_PLUS }, fila.estrella && estiloLatido]}>
        <Valor valor={fila.plus} plus />
      </Animated.View>
    </Animated.View>
  );
}

function Valor({ valor, plus = false }: { valor: Celda; plus?: boolean }) {
  if (typeof valor === 'string') {
    return <Text style={[estilos.valorTexto, plus && estilos.valorPlus]}>{valor}</Text>;
  }
  if (!valor) return <MaterialCommunityIcons name="minus" size={18} color="#C9CECE" />;
  return <MaterialCommunityIcons name="check" size={20} color={plus ? Marca.primario : Colors.light.textSecondary} />;
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#FFFFFF' },
  cuerpo: { paddingHorizontal: 20, paddingBottom: 150 },
  cabecera: { alignItems: 'center', gap: 16 },
  titulo: { fontFamily: Tipografia.display, fontSize: 30, lineHeight: 38, textAlign: 'center', color: Colors.light.text },
  resalte: { color: Marca.primario },

  tabla: { marginTop: 28 },
  columnaPlus: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: Radios.grande,
    backgroundColor: '#FFF1EA',
    borderWidth: 1.5,
    borderColor: '#FFD9C7',
  },
  fila: { flexDirection: 'row', alignItems: 'center', minHeight: 58, paddingVertical: 10 },
  filaBorde: { borderBottomWidth: 1, borderBottomColor: '#F0ECEA', borderStyle: 'dashed' },
  filaCabecera: { minHeight: 48 },
  encabezado: { fontFamily: Tipografia.seminegrita, fontSize: 14, textAlign: 'center', color: Colors.light.textSecondary },
  encabezadoPlus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  textoEncabezadoPlus: { fontFamily: Tipografia.negrita, fontSize: 15, color: Marca.primario },
  celdaTitulo: { flex: 1, paddingRight: 8, gap: 2 },
  tituloFila: { fontFamily: Tipografia.media, fontSize: 15, lineHeight: 20, color: Colors.light.text },
  tituloEstrella: { fontFamily: Tipografia.seminegrita, fontSize: 16 },
  detalleFila: { fontFamily: Tipografia.regular, fontSize: 12, lineHeight: 16, color: Colors.light.textSecondary },
  celda: { alignItems: 'center', justifyContent: 'center' },
  valorTexto: { fontFamily: Tipografia.media, fontSize: 13, textAlign: 'center', color: Colors.light.textSecondary },
  valorPlus: { fontFamily: Tipografia.negrita, fontSize: 14, color: Marca.primario },

  nota: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginTop: 24,
    padding: 14,
    borderRadius: Radios.grande - 4,
    backgroundColor: '#FAFAF9',
    borderWidth: 1,
    borderColor: Colors.light.borde,
  },
  notaIcono: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Marca.primarioTenue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notaTexto: { flex: 1, fontFamily: Tipografia.regular, fontSize: 14, lineHeight: 20, color: Colors.light.textSecondary },
  negrita: { fontFamily: Tipografia.seminegrita, color: Colors.light.text },

  pie: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 14,
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderTopWidth: 1,
    borderTopColor: '#F3F0EE',
  },
  letraChica: { fontFamily: Tipografia.regular, fontSize: 13, textAlign: 'center', color: Colors.light.textSecondary },
});
