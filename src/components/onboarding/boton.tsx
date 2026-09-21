import { Pressable, StyleSheet, Text } from 'react-native';

import { Marca, Radios, Tipografia } from '@/constants/theme';

/** Boton principal del onboarding. Apagado se ve en naranja palido, no gris. */
export function BotonOnboarding({
  texto,
  alPulsar,
  apagado = false,
}: {
  texto: string;
  alPulsar: () => void;
  apagado?: boolean;
}) {
  return (
    <Pressable
      onPress={alPulsar}
      disabled={apagado}
      accessibilityRole="button"
      accessibilityState={{ disabled: apagado }}
      style={({ pressed }) => [
        estilos.boton,
        apagado && estilos.apagado,
        { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}>
      <Text style={estilos.texto}>{texto}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  boton: { backgroundColor: Marca.primario, minHeight: 56, borderRadius: Radios.pildora, alignItems: 'center', justifyContent: 'center' },
  apagado: { backgroundColor: '#FFC7B2' },
  texto: { fontFamily: Tipografia.seminegrita, fontSize: 17, color: '#FFFFFF' },
});
