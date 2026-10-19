import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { useEffect, type ComponentProps } from 'react';
import { Easing as EasingRN, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GuiaProvider, useObjetivoGuia, type ObjetivoGuia } from '@/components/guia/guia';
import { ReceptorCompartir } from '@/components/receptor-compartir';
import { Colors, Marca, Tipografia } from '@/constants/theme';
import { useSubidaAutomatica } from '@/lib/guardado-local';
import { toque } from '@/lib/haptica';
import { ANCHO_MAXIMO } from '@/hooks/use-ancho';

type Icono = keyof typeof MaterialCommunityIcons.glyphMap;
// expo-router no reexporta el tipo; se saca de la propia prop
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** Icono lleno y de contorno de cada pestana. Descubrir es el boton flotante del centro. */
const PESTANAS: Record<string, { titulo: string; icono: Icono; iconoActivo: Icono; guia?: ObjetivoGuia }> = {
  index: { titulo: 'Recetas', icono: 'bookmark-outline', iconoActivo: 'bookmark' },
  plan: { titulo: 'Plan', icono: 'calendar-blank-outline', iconoActivo: 'calendar-blank', guia: 'plan' },
  descubrir: { titulo: 'Descubrir', icono: 'compass-outline', iconoActivo: 'compass' },
  lista: { titulo: 'Lista', icono: 'basket-outline', iconoActivo: 'basket', guia: 'lista' },
  perfil: { titulo: 'Perfil', icono: 'account-circle-outline', iconoActivo: 'account-circle', guia: 'perfil' },
};
const CENTRO = 'descubrir';

const ALTO_BARRA = 62;

/** Cambio de pestana con un fundido corto: ni brusco ni lento. */
const TRANSICION = {
  headerShown: false,
  animation: 'fade',
  // En tablets cada pestana queda centrada con un ancho comodo
  sceneStyle: { width: '100%', maxWidth: ANCHO_MAXIMO, alignSelf: 'center' },
  transitionSpec: { animation: 'timing', config: { duration: 180, easing: EasingRN.out(EasingRN.quad) } },
} as const;
/** Radio de la muesca y diametro del boton que flota dentro de ella. */
const RADIO_MUESCA = 39;
const BOTON = 60;
const LINEA = '#EDE5E0';

export default function TabsLayout() {
  // Lo guardado sin conexion se sube solo en cuanto vuelve la red
  useSubidaAutomatica();

  return (
    // La guia de primeros pasos cubre tambien la barra de pestanas
    <GuiaProvider>
      <Tabs screenOptions={TRANSICION} tabBar={(props) => <Barra {...props} />}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="plan" />
        <Tabs.Screen name="descubrir" />
        <Tabs.Screen name="lista" />
        <Tabs.Screen name="perfil" />
      </Tabs>
      {/* Solo Android recibe lo compartido; en web el modulo no existe */}
      {Platform.OS === 'android' ? <ReceptorCompartir /> : null}
    </GuiaProvider>
  );
}

/** Barra blanca a todo el ancho con una muesca al centro donde flota Descubrir. */
function Barra({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const alto = ALTO_BARRA + insets.bottom;

  return (
    <View style={[estilos.contenedor, { height: alto }]} pointerEvents="box-none">
      {state.routes.map((ruta, i) => {
        const datos = PESTANAS[ruta.name];
        if (!datos) return null;
        const activa = state.index === i;
        const alPulsar = () => {
          const evento = navigation.emit({ type: 'tabPress', target: ruta.key, canPreventDefault: true });
          if (!activa && !evento.defaultPrevented) {
            toque();
            navigation.navigate(ruta.name);
          }
        };
        if (ruta.name === CENTRO) {
          return <BotonCentral key={ruta.key} titulo={datos.titulo} activa={activa} alto={alto} alPulsar={alPulsar} />;
        }
        return (
          <Pestana
            key={ruta.key}
            titulo={datos.titulo}
            guia={datos.guia}
            icono={activa ? datos.iconoActivo : datos.icono}
            activa={activa}
            margenAbajo={insets.bottom}
            alPulsar={alPulsar}
          />
        );
      })}
    </View>
  );
}

function Pestana({
  titulo,
  icono,
  activa,
  alPulsar,
  margenAbajo,
  guia,
}: {
  titulo: string;
  icono: Icono;
  activa: boolean;
  alPulsar: () => void;
  margenAbajo: number;
  guia?: ObjetivoGuia;
}) {
  const refGuia = useObjetivoGuia(guia);
  const fondo = useSharedValue(activa ? 1 : 0);
  useEffect(() => {
    fondo.value = withSpring(activa ? 1 : 0, { damping: 18, stiffness: 220 });
  }, [activa, fondo]);
  const estiloFondo = useAnimatedStyle(() => ({ opacity: fondo.value, transform: [{ scaleX: 0.6 + fondo.value * 0.4 }] }));
  // El icono activo crece un poco con el mismo resorte que su fondo
  const estiloIcono = useAnimatedStyle(() => ({ transform: [{ scale: 1 + fondo.value * 0.08 }] }));

  const color = activa ? Marca.primario : Colors.light.textSecondary;
  return (
    <Pressable
      ref={refGuia}
      collapsable={false}
      onPress={alPulsar}
      accessibilityRole="tab"
      accessibilityState={{ selected: activa }}
      accessibilityLabel={titulo}
      style={[estilos.pestana, { paddingBottom: margenAbajo }]}>
      <View style={estilos.icono}>
        <Animated.View style={[StyleSheet.absoluteFill, estilos.fondoActivo, estiloFondo]} />
        <Animated.View style={estiloIcono}>
          <MaterialCommunityIcons name={icono} size={24} color={color} />
        </Animated.View>
      </View>
      <Text
        style={[estilos.titulo, { color: activa ? Marca.primarioTexto : Colors.light.textSecondary }, activa && estilos.tituloActivo]}
        maxFontSizeMultiplier={1.3}
        numberOfLines={1}>
        {titulo}
      </Text>
    </Pressable>
  );
}

/**
 * Descubrir: un boton redondo que flota en la muesca. Sube y baja despacio y
 * suelta un halo cada tanto; con "reducir movimiento" se queda quieto. Todo
 * corre en el hilo de UI, sin renders.
 */
function BotonCentral({ titulo, activa, alto, alPulsar }: { titulo: string; activa: boolean; alto: number; alPulsar: () => void }) {
  const quieto = useReducedMotion();
  const flote = useSharedValue(0);
  const halo = useSharedValue(0);
  const presion = useSharedValue(1);

  useEffect(() => {
    if (quieto) return;
    flote.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }), -1, true);
    halo.value = withRepeat(
      withSequence(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), withTiming(1, { duration: 1600 })),
      -1
    );
  }, [quieto, flote, halo]);

  const estiloBoton = useAnimatedStyle(() => ({
    transform: [{ translateY: -flote.value * 4 }, { scale: presion.value }],
  }));
  const estiloHalo = useAnimatedStyle(() => ({
    opacity: halo.value >= 1 ? 0 : 0.35 * (1 - halo.value),
    transform: [{ scale: 1 + halo.value * 0.45 }],
  }));

  const ancho = RADIO_MUESCA * 2 + 2;
  return (
    <View style={[estilos.centro, { width: ancho, height: alto }]} pointerEvents="box-none">
      <Muesca ancho={ancho} alto={alto} />
      <Animated.View style={[estilos.boton, estiloBoton]}>
        <Animated.View pointerEvents="none" style={[estilos.halo, estiloHalo]} />
        <Pressable
          onPress={alPulsar}
          onPressIn={() => (presion.value = withSpring(0.9, { damping: 15, stiffness: 300 }))}
          onPressOut={() => (presion.value = withSpring(1, { damping: 12, stiffness: 260 }))}
          accessibilityRole="tab"
          accessibilityState={{ selected: activa }}
          accessibilityLabel={titulo}
          hitSlop={8}
          style={[estilos.circulo, activa && estilos.circuloActivo]}>
          <MaterialCommunityIcons name={activa ? 'compass' : 'compass-outline'} size={28} color="#FFFFFF" />
        </Pressable>
      </Animated.View>
      <Text
        maxFontSizeMultiplier={1.3}
        style={[estilos.titulo, estilos.tituloCentro, { color: activa ? Marca.primarioTexto : Colors.light.textSecondary }, activa && estilos.tituloActivo]}>
        {titulo}
      </Text>
    </View>
  );
}

/**
 * El tramo de barra con el mordisco semicircular. Sin SVG: dos aros de borde
 * muy grueso, recortados por la caja. El de abajo pinta la linea del borde y
 * el blanco, un punto mas abierto, la deja ver solo en el filo de la muesca.
 */
function Muesca({ ancho, alto }: { ancho: number; alto: number }) {
  const grosor = Math.ceil(Math.hypot(ancho / 2, alto)) + 2;
  const aro = (radioHueco: number, color: string) => {
    const r = radioHueco + grosor;
    return {
      position: 'absolute' as const,
      width: r * 2,
      height: r * 2,
      borderRadius: r,
      borderWidth: grosor,
      borderColor: color,
      left: ancho / 2 - r,
      top: -r,
    };
  };
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <View style={aro(RADIO_MUESCA, LINEA)} />
      <View style={aro(RADIO_MUESCA + 1, '#FFFFFF')} />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  pestana: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: LINEA,
  },
  icono: { width: 56, height: 30, alignItems: 'center', justifyContent: 'center' },
  fondoActivo: { borderRadius: 15, backgroundColor: Marca.primarioTenue },
  titulo: { fontFamily: Tipografia.media, fontSize: 11 },
  tituloActivo: { fontFamily: Tipografia.seminegrita },

  centro: { alignItems: 'center' },
  boton: { position: 'absolute', top: -BOTON / 2 + 2, width: BOTON, height: BOTON },
  halo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: BOTON / 2, backgroundColor: Marca.primario },
  circulo: {
    width: BOTON,
    height: BOTON,
    borderRadius: BOTON / 2,
    backgroundColor: Marca.primario,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#FF6B3A',
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  circuloActivo: { backgroundColor: '#F2552A' },
  // A la altura de los titulos de los costados (icono 30 + 3 de separacion, centrados en 62)
  tituloCentro: { position: 'absolute', top: 40 },
});
