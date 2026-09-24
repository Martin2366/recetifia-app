import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';

/**
 * Lo que se ve si una pantalla falla al dibujarse. En vez de cerrar la app o
 * dejarla en blanco (las reseñas de la competencia estan llenas de eso), se
 * explica sin tecnicismos y se ofrece reintentar. Lo escrito en el editor ya
 * esta guardado en el telefono, asi que tambien se dice.
 */
export function ErrorAmable({ error, retry }: ErrorBoundaryProps) {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (__DEV__) console.error(error);
    // Si fallo antes de arrancar, el splash taparia este mensaje
    SplashScreen.hideAsync().catch(() => {});
  }, [error]);

  return (
    <View style={[estilos.pantalla, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 }]}>
      <View style={estilos.centro}>
        <View style={estilos.icono}>
          <MaterialCommunityIcons name="pot-steam-outline" size={40} color={Marca.primario} />
        </View>
        <Text style={estilos.titulo}>Algo se nos quemó</Text>
        <Text style={estilos.texto}>
          Esta pantalla tuvo un problema. Tus recetas están a salvo, y si estabas escribiendo una, quedó guardada en tu
          teléfono.
        </Text>
      </View>
      <Pressable onPress={retry} accessibilityRole="button" style={({ pressed }) => [estilos.boton, pressed && { opacity: 0.85 }]}>
        <Text style={estilos.textoBoton}>Reintentar</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#F7F2EE', paddingHorizontal: 28 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  icono: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Marca.primarioTenue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  titulo: { fontFamily: Tipografia.display, fontSize: 26, textAlign: 'center', color: Colors.light.text },
  texto: { fontFamily: Tipografia.regular, fontSize: 16, lineHeight: 23, textAlign: 'center', color: Colors.light.textSecondary },
  boton: { minHeight: 56, borderRadius: Radios.pildora, backgroundColor: Marca.primario, alignItems: 'center', justifyContent: 'center' },
  textoBoton: { fontFamily: Tipografia.seminegrita, fontSize: 17, color: '#FFFFFF' },
});
