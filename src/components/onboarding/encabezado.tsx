import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Marca } from '@/constants/theme';

/**
 * Pasos con barra de progreso, sin contar la presentacion. Provisional: se
 * ajusta a medida que se suman pantallas al onboarding.
 */
export const TOTAL_PASOS = 8;

/** Flecha para volver y barra de progreso que avanza desde el paso anterior. */
export function EncabezadoOnboarding({ paso }: { paso: number }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const relleno = useSharedValue((paso - 1) / TOTAL_PASOS);

  useEffect(() => {
    relleno.value = withDelay(150, withTiming(paso / TOTAL_PASOS, { duration: 700, easing: Easing.bezier(0.22, 1, 0.36, 1) }));
  }, [paso, relleno]);

  const estiloRelleno = useAnimatedStyle(() => ({ width: `${relleno.value * 100}%` }));

  return (
    <View style={[estilos.fila, { paddingTop: insets.top + 8 }]}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Volver"
        style={({ pressed }) => [estilos.volver, { opacity: pressed ? 0.5 : 1 }]}>
        <MaterialIcons name="arrow-back-ios-new" size={20} color={Colors.light.text} />
      </Pressable>
      <View
        style={estilos.pista}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: TOTAL_PASOS, now: paso }}>
        <Animated.View style={[estilos.relleno, estiloRelleno]} />
      </View>
      {/* Contrapeso de la flecha para que la barra quede centrada */}
      <View style={estilos.volver} />
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  volver: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pista: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#EFE7E3', overflow: 'hidden' },
  relleno: { height: 6, borderRadius: 3, backgroundColor: Marca.primario },
});
