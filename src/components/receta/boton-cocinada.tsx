import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Marca, Spacing } from '@/constants/theme';
import { useCocinadas, useMarcarCocinada } from '@/lib/cocinadas';
import { exito } from '@/lib/haptica';
import { reprogramarRecordatorios } from '@/lib/notificaciones';
import { pedirResenaSiToca } from '@/lib/resena';

const FECHA = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

/** "La cocine ✓": en el detalle de la receta y al terminar el modo cocina. */
export function BotonCocinada({ recipeId, relleno = false }: { recipeId: string; relleno?: boolean }) {
  const { data } = useCocinadas(recipeId);
  const marcar = useMarcarCocinada();

  async function alPulsar() {
    try {
      const { primera } = await marcar.mutateAsync(recipeId);
      exito();
      reprogramarRecordatorios();
      if (primera) setTimeout(() => pedirResenaSiToca({ trasCocinar: true }), 1500);
    } catch {
      Alert.alert('No se guardó', 'Revisa tu conexión e inténtalo de nuevo.');
    }
  }

  const veces = data?.veces ?? 0;
  const color = relleno ? '#FFFFFF' : Marca.primario;

  return (
    <View style={estilos.bloque}>
      <Pressable
        onPress={alPulsar}
        disabled={marcar.isPending}
        accessibilityRole="button"
        style={({ pressed }) => [relleno ? estilos.relleno : estilos.borde, (pressed || marcar.isPending) && { opacity: 0.7 }]}>
        {marcar.isPending ? (
          <ActivityIndicator color={color} />
        ) : (
          <>
            <MaterialIcons name="check-circle-outline" size={20} color={color} />
            <ThemedText style={[estilos.texto, { color }]}>{veces ? 'La cociné otra vez' : 'La cociné'}</ThemedText>
          </>
        )}
      </Pressable>
      {veces && data?.ultima ? (
        <ThemedText type="small" style={estilos.detalle}>
          La cocinaste {veces === 1 ? '1 vez' : `${veces} veces`} · la última el {FECHA.format(new Date(data.ultima))}
        </ThemedText>
      ) : null}
    </View>
  );
}

const base = {
  minHeight: 48,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  gap: 8,
  borderRadius: 999,
};

const estilos = StyleSheet.create({
  bloque: { gap: Spacing.two },
  borde: { ...base, borderWidth: 1.5, borderColor: Marca.primario },
  relleno: { ...base, backgroundColor: Marca.primario },
  texto: { fontWeight: '600' },
  detalle: { textAlign: 'center', color: Colors.light.textSecondary },
});
