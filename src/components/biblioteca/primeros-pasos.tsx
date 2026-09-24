import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';

/**
 * Primeros pasos: cuatro tareas que se tachan solas al hacerlas. Guian los
 * primeros minutos sin tapar nada (la guia con foco explica donde esta cada
 * cosa; esto invita a usarla). Desaparece al completarlas o al ocultarla.
 */

const CLAVE_OCULTA = 'recetifia:primeros-pasos-oculta';

export type Tarea = { clave: string; titulo: string; hecha: boolean; alPulsar: () => void };

export function PrimerosPasos({ tareas }: { tareas: Tarea[] }) {
  const [oculta, setOculta] = useState<boolean | null>(null);
  const [abierta, setAbierta] = useState(false);
  const hechas = tareas.filter((t) => t.hecha).length;
  const siguiente = tareas.find((t) => !t.hecha);

  const avance = useSharedValue(0);
  useEffect(() => {
    avance.value = withTiming(hechas / tareas.length, { duration: 500 });
  }, [hechas, tareas.length, avance]);
  const estiloAvance = useAnimatedStyle(() => ({ transform: [{ scaleX: avance.value }] }));

  useEffect(() => {
    AsyncStorage.getItem(CLAVE_OCULTA)
      .then((v) => setOculta(v === '1'))
      .catch(() => setOculta(false));
  }, []);

  if (oculta !== false || !siguiente) return null;

  function ocultar() {
    setOculta(true);
    AsyncStorage.setItem(CLAVE_OCULTA, '1').catch(() => {});
  }

  function alternar() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAbierta((a) => !a);
  }

  return (
    <View style={estilos.tarjeta}>
      <Pressable onPress={alternar} accessibilityRole="button" accessibilityState={{ expanded: abierta }} style={estilos.cabecera}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={estilos.titulo}>
            Primeros pasos <Text style={estilos.cuenta}>· {hechas} de {tareas.length}</Text>
          </Text>
          <View style={estilos.pista}>
            <Animated.View style={[estilos.relleno, estiloAvance]} />
          </View>
        </View>
        <MaterialCommunityIcons name={abierta ? 'chevron-up' : 'chevron-down'} size={24} color={Colors.light.textSecondary} />
      </Pressable>

      {(abierta ? tareas : [siguiente]).map((t) => (
        <Pressable
          key={t.clave}
          onPress={t.hecha ? undefined : t.alPulsar}
          disabled={t.hecha}
          accessibilityRole="button"
          accessibilityState={{ checked: t.hecha }}
          style={({ pressed }) => [estilos.fila, pressed && { opacity: 0.7 }]}>
          <View style={[estilos.casilla, t.hecha && estilos.casillaHecha]}>
            {t.hecha ? <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" /> : null}
          </View>
          <Text style={[estilos.textoTarea, t.hecha && estilos.textoHecho]}>{t.titulo}</Text>
          {!t.hecha ? <MaterialCommunityIcons name="arrow-right" size={20} color={Marca.primario} /> : null}
        </Pressable>
      ))}

      {abierta ? (
        <Pressable onPress={ocultar} hitSlop={8} style={estilos.ocultar} accessibilityRole="button">
          <Text style={estilos.textoOcultar}>Ocultar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    marginHorizontal: 18,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
    borderRadius: Radios.grande - 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE5E0',
  },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 4 },
  titulo: { fontFamily: Tipografia.seminegrita, fontSize: 15, color: Colors.light.text },
  cuenta: { fontFamily: Tipografia.media, color: Colors.light.textSecondary },
  pista: { height: 6, borderRadius: 3, backgroundColor: '#F3ECE8', overflow: 'hidden' },
  relleno: { width: '100%', height: 6, borderRadius: 3, backgroundColor: Marca.primario, transformOrigin: 'left' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 40 },
  casilla: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D9CFC9', alignItems: 'center', justifyContent: 'center' },
  casillaHecha: { backgroundColor: Marca.exito, borderColor: Marca.exito },
  textoTarea: { flex: 1, fontFamily: Tipografia.media, fontSize: 15, color: Colors.light.text },
  textoHecho: { color: Colors.light.textTenue, textDecorationLine: 'line-through' },
  ocultar: { alignSelf: 'flex-end', paddingTop: 4 },
  textoOcultar: { fontFamily: Tipografia.seminegrita, fontSize: 13, color: Colors.light.textSecondary },
});
