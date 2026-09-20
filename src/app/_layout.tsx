import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRootNavigationState,
  useRouter,
  useSegments,
} from 'expo-router';
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
  // Sin esto se navega antes de que el navegador exista y React avisa de una
  // actualizacion de estado sobre un componente sin montar. En frio puede
  // dejar la pantalla en blanco.
  const navegador = useRootNavigationState();

  useEffect(() => {
    if (!navegador?.key) return;
    if (cargando) return;

    SplashScreen.hideAsync().catch(() => {
      // Ya estaba oculta. No es un problema.
    });

    const enTabs = segmentos[0] === '(tabs)';
    const enLogin = segmentos[0] === 'login';

    // Los dos casos han de estar cubiertos: quedarse fuera de ambos deja al
    // usuario atrapado en la pantalla de reparto, sin nada que mirar.
    if (!session && !enLogin) router.replace('/login');
    else if (session && !enTabs) router.replace('/(tabs)');
  }, [session, cargando, segmentos, router, navegador?.key]);

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
              <Stack.Screen name="receta/[id]" options={{ headerShown: true, title: '' }} />
              <Stack.Screen
                name="receta/nueva"
                options={{ headerShown: true, title: 'Nueva receta', presentation: 'modal' }}
              />
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
