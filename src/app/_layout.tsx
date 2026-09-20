import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, useColorScheme, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // La biblioteca se abre desde cache y se refresca por detras: esa es la
      // lectura offline que promete el producto.
      staleTime: 30_000,
      retry: 2,
    },
  },
});

/** Decide si el usuario ve la app o la pantalla de entrada. */
function Guardian({ children }: { children: ReactNode }) {
  const { session, cargando } = useAuth();
  const segmentos = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (cargando) return;
    SplashScreen.hideAsync();

    const dentroDeLaApp = segmentos[0] === '(tabs)';
    if (!session && dentroDeLaApp) router.replace('/login');
    else if (session && !dentroDeLaApp) router.replace('/(tabs)');
  }, [session, cargando, segmentos, router]);

  if (cargando) {
    return (
      <View style={estilos.cargando}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  const esquema = useColorScheme();
  const oscuro = esquema === 'dark';

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider value={oscuro ? DarkTheme : DefaultTheme}>
          <StatusBar style={oscuro ? 'light' : 'dark'} />
          <Guardian>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="(tabs)" />
            </Stack>
          </Guardian>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const estilos = StyleSheet.create({
  cargando: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.background,
  },
});
