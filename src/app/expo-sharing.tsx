import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Marca } from '@/constants/theme';

/**
 * Cuando se comparte a Recetifia con la app cerrada, expo-sharing la abre en
 * recetifia://expo-sharing. Esta ruta solo lleva a las pestanas: alli el
 * receptor lee lo compartido y abre la importacion, con la biblioteca debajo
 * para que "atras" vuelva a ella. Sin sesion, el guardian manda antes al login
 * y lo compartido espera.
 */
export default function EntradaCompartir() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/(tabs)');
  }, [router]);

  return (
    <View style={estilos.centro}>
      <ActivityIndicator size="large" color={Marca.primario} />
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
});
