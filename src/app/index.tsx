import { ActivityIndicator, StyleSheet, View } from 'react-native';

/**
 * Pantalla de reparto. A proposito no navega: de eso se encarga el guardian
 * del layout raiz, que espera a que el navegador este montado. Redirigir
 * tambien desde aqui provocaba dos navegaciones a la vez en el arranque en frio.
 */
export default function Index() {
  return (
    <View style={estilos.centro}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
