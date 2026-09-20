import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, useColorScheme, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

export default function Perfil() {
  const { session, salir } = useAuth();
  const [saliendo, setSaliendo] = useState(false);
  const colores = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];

  const usuario = session?.user;
  const nombre =
    (usuario?.user_metadata?.full_name as string | undefined) ??
    (usuario?.user_metadata?.name as string | undefined) ??
    'Sin nombre';

  function confirmarSalida() {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          setSaliendo(true);
          try {
            await salir();
          } catch (err) {
            Alert.alert('No pudimos cerrar la sesión', err instanceof Error ? err.message : '');
          } finally {
            setSaliendo(false);
          }
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <View style={[estilos.tarjeta, { backgroundColor: colores.backgroundElement }]}>
        <ThemedText type="subtitle">{nombre}</ThemedText>
        <ThemedText type="small" style={estilos.tenue}>
          {usuario?.email ?? 'sin correo'}
        </ThemedText>
      </View>

      <Pressable
        onPress={confirmarSalida}
        disabled={saliendo}
        accessibilityRole="button"
        style={({ pressed }) => [
          estilos.boton,
          { backgroundColor: colores.backgroundElement, opacity: pressed || saliendo ? 0.6 : 1 },
        ]}>
        <ThemedText>Cerrar sesión</ThemedText>
      </Pressable>

      {/* Google Play exige borrado de cuenta dentro de la app. Se implementa
          en la fase de salida a produccion, junto con la Edge Function que
          borra de verdad el usuario de auth. */}
      <ThemedText type="small" style={estilos.tenue}>
        Borrar cuenta: disponible antes de publicar en Google Play.
      </ThemedText>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: Spacing.four, gap: Spacing.four },
  tarjeta: { padding: Spacing.four, borderRadius: 12, gap: Spacing.one },
  boton: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  tenue: { opacity: 0.7 },
});
