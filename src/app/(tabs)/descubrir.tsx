import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Silueta, TONOS } from '@/components/onboarding/formas';
import { Colors, Tipografia } from '@/constants/theme';

/** Descubrir: llega en la siguiente etapa. Mientras, la pestana explica que viene. */

const FONDO = '#F7F2EE';

export default function Descubrir() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[estilos.pantalla, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <Text style={estilos.titulo} accessibilityRole="header">
        Descubrir
      </Text>
      <View style={estilos.centro}>
        <View style={estilos.dibujo}>
          <Silueta icono="compass-outline" color={TONOS.naranja} tamano={96} x={52} y={20} giro={-10} retraso={80} />
          <Silueta icono="noodles" color={TONOS.amarillo} tamano={56} x={0} y={70} giro={-12} retraso={220} />
          <Silueta icono="fish" color={TONOS.celeste} tamano={52} x={148} y={0} giro={14} retraso={320} />
        </View>
        <Text style={estilos.tituloVacio}>Muy pronto</Text>
        <Text style={estilos.texto}>Aquí vas a encontrar ideas nuevas para cocinar cada semana.</Text>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: FONDO },
  titulo: { fontFamily: Tipografia.display, fontSize: 30, color: Colors.light.text, paddingHorizontal: 20, paddingTop: 16 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32, paddingBottom: 120 },
  dibujo: { width: 200, height: 140, marginBottom: 8 },
  tituloVacio: { fontFamily: Tipografia.display, fontSize: 24, color: Colors.light.text },
  texto: { fontFamily: Tipografia.regular, fontSize: 15, lineHeight: 22, textAlign: 'center', color: Colors.light.textSecondary },
});
