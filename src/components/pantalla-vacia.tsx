import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * Estado vacio reutilizable. Una biblioteca sin recetas es lo primero que ve
 * todo usuario nuevo: si no dice que hacer a continuacion, la app parece rota.
 */
export function PantallaVacia({
  titulo,
  texto,
  children,
}: {
  titulo: string;
  texto: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={estilos.contenedor}>
      <ThemedText type="subtitle" style={estilos.centrado}>
        {titulo}
      </ThemedText>
      <ThemedText style={[estilos.centrado, estilos.texto]}>{texto}</ThemedText>
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.two,
  },
  centrado: { textAlign: 'center' },
  texto: { maxWidth: 300, opacity: 0.7 },
});
