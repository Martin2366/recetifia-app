import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Marca, Spacing, Tipografia } from '@/constants/theme';
import { InicioCancelado, useAuth } from '@/lib/auth';

export default function Login() {
  const { entrarConGoogle, entrarSinCuenta } = useAuth();
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const colores = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];

  async function entrar(como: 'google' | 'sin-cuenta') {
    setError(null);
    setEntrando(true);
    try {
      await (como === 'google' ? entrarConGoogle() : entrarSinCuenta());
      // No navegamos aqui: el guardian de la raiz reacciona al cambio de sesion.
    } catch (err) {
      if (!(err instanceof InicioCancelado)) {
        setError(err instanceof Error ? err.message : 'No pudimos iniciar sesion.');
      }
    } finally {
      setEntrando(false);
    }
  }

  return (
    <SafeAreaView style={[estilos.pantalla, { backgroundColor: colores.background }]}>
      <View style={estilos.centro}>
        <ThemedText type="title">Recetifia</ThemedText>
        <ThemedText style={estilos.lema}>
          Todas tus recetas de redes sociales, en un solo lugar y listas para cocinar.
        </ThemedText>
      </View>

      <View style={estilos.pie}>
        {error ? (
          <ThemedText style={estilos.error} accessibilityLiveRegion="polite">
            {error}
          </ThemedText>
        ) : null}

        <Pressable
          onPress={() => entrar('google')}
          disabled={entrando}
          accessibilityRole="button"
          accessibilityLabel="Continuar con Google"
          style={({ pressed }) => [
            estilos.boton,
            { backgroundColor: colores.text, opacity: pressed || entrando ? 0.7 : 1 },
          ]}>
          {entrando ? (
            <ActivityIndicator color={colores.background} />
          ) : (
            <ThemedText style={[estilos.textoBoton, { color: colores.background }]}>
              Continuar con Google
            </ThemedText>
          )}
        </Pressable>

        {/* La cuenta es para respaldar, no un peaje: se puede usar sin ella */}
        <Pressable
          onPress={() => entrar('sin-cuenta')}
          disabled={entrando}
          hitSlop={8}
          accessibilityRole="button"
          style={({ pressed }) => [estilos.sinCuenta, { opacity: pressed || entrando ? 0.6 : 1 }]}>
          <ThemedText style={estilos.textoSinCuenta}>Seguir sin cuenta</ThemedText>
        </Pressable>

        <ThemedText type="small" style={estilos.legal}>
          Al continuar aceptas nuestros términos y la política de privacidad.
        </ThemedText>
      </View>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, paddingHorizontal: Spacing.four },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  lema: { textAlign: 'center', maxWidth: 300 },
  pie: { paddingBottom: Spacing.five, gap: Spacing.two },
  boton: {
    minHeight: 52, // por encima del minimo de 48 dp de area tactil
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  textoBoton: { fontWeight: '600' },
  sinCuenta: { alignSelf: 'center', paddingVertical: Spacing.two },
  textoSinCuenta: { fontFamily: Tipografia.seminegrita, color: Marca.primario },
  error: { color: '#D93025', textAlign: 'center' },
  legal: { textAlign: 'center', opacity: 0.6 },
});
