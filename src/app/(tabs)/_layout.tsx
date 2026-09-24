import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { useEffect, type ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReceptorCompartir } from '@/components/receptor-compartir';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { useSubidaAutomatica } from '@/lib/guardado-local';

type Icono = keyof typeof MaterialCommunityIcons.glyphMap;
// expo-router no reexporta el tipo; se saca de la propia prop
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** Icono lleno y de contorno de cada pestana. */
const PESTANAS: Record<string, { titulo: string; icono: Icono; iconoActivo: Icono }> = {
  index: { titulo: 'Recetas', icono: 'bookmark-outline', iconoActivo: 'bookmark' },
  lista: { titulo: 'Lista', icono: 'basket-outline', iconoActivo: 'basket' },
  perfil: { titulo: 'Perfil', icono: 'account-circle-outline', iconoActivo: 'account-circle' },
};

export default function TabsLayout() {
  // Lo guardado sin conexion se sube solo en cuanto vuelve la red
  useSubidaAutomatica();

  return (
    <>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <BarraFlotante {...props} />}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="lista" />
        <Tabs.Screen name="perfil" />
      </Tabs>
      {/* Solo Android recibe lo compartido; en web el modulo no existe */}
      {Platform.OS === 'android' ? <ReceptorCompartir /> : null}
    </>
  );
}

/** Barra flotante en forma de pildora, como la de la referencia. */
function BarraFlotante({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[estilos.contenedor, { paddingBottom: insets.bottom + 10 }]} pointerEvents="box-none">
      <View style={estilos.barra}>
        {state.routes.map((ruta, i) => {
          const datos = PESTANAS[ruta.name];
          if (!datos) return null;
          const activa = state.index === i;
          return (
            <Pestana
              key={ruta.key}
              titulo={datos.titulo}
              icono={activa ? datos.iconoActivo : datos.icono}
              activa={activa}
              alPulsar={() => {
                const evento = navigation.emit({ type: 'tabPress', target: ruta.key, canPreventDefault: true });
                if (!activa && !evento.defaultPrevented) navigation.navigate(ruta.name);
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

function Pestana({ titulo, icono, activa, alPulsar }: { titulo: string; icono: Icono; activa: boolean; alPulsar: () => void }) {
  const fondo = useSharedValue(activa ? 1 : 0);
  useEffect(() => {
    fondo.value = withSpring(activa ? 1 : 0, { damping: 18, stiffness: 220 });
  }, [activa, fondo]);
  const estiloFondo = useAnimatedStyle(() => ({ opacity: fondo.value, transform: [{ scale: 0.85 + fondo.value * 0.15 }] }));

  const color = activa ? Marca.primario : Colors.light.textSecondary;
  return (
    <Pressable
      onPress={alPulsar}
      accessibilityRole="tab"
      accessibilityState={{ selected: activa }}
      accessibilityLabel={titulo}
      style={estilos.pestana}>
      <Animated.View style={[StyleSheet.absoluteFill, estilos.fondoActivo, estiloFondo]} />
      <MaterialCommunityIcons name={icono} size={26} color={color} />
      <Text style={[estilos.titulo, { color }, activa && estilos.tituloActivo]}>{titulo}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  contenedor: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  barra: {
    flexDirection: 'row',
    gap: 6,
    padding: 6,
    borderRadius: Radios.pildora,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EBE8',
    elevation: 12,
    shadowColor: '#7A2E12',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  pestana: { width: 92, height: 60, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: Radios.pildora },
  fondoActivo: { borderRadius: Radios.pildora, backgroundColor: Marca.primarioTenue },
  titulo: { fontFamily: Tipografia.media, fontSize: 12 },
  tituloActivo: { fontFamily: Tipografia.seminegrita },
});
