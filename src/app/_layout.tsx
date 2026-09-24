import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import {
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRootNavigationState,
  useRouter,
  useSegments,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { Appearance, StyleSheet, View } from 'react-native';

import { ErrorAmable } from '@/components/error-amable';
import { Colors, Marca } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { vioBienvenida } from '@/lib/preferencias';

SplashScreen.preventAutoHideAsync();

// Expo Router lo usa para cualquier pantalla que falle al dibujarse
export const ErrorBoundary = ErrorAmable;

// v1 es solo modo claro. Forzarlo aqui hace que useColorScheme() devuelva
// 'light' en toda la app sin recompilar; app.json lo fija a nivel nativo en el
// siguiente build.
// En web no existe; alli solo se usa para previsualizar.
Appearance.setColorScheme?.('light');

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

const temaNavegacion = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Marca.primario,
    background: Colors.light.background,
    card: Colors.light.background,
    text: Colors.light.text,
    border: Colors.light.borde,
  },
};

/** Pantallas a las que se puede estar sin sesion. */
const RUTAS_PUBLICAS = new Set(['bienvenida', 'onboarding', 'login']);

/** Decide si el usuario ve la app, la bienvenida o la entrada. */
function Guardian({ children, listo }: { children: ReactNode; listo: boolean }) {
  const { session, cargando } = useAuth();
  const segmentos = useSegments();
  const router = useRouter();
  // Sin esto se navega antes de que el navegador exista y React avisa de una
  // actualizacion de estado sobre un componente sin montar.
  const navegador = useRootNavigationState();
  const [bienvenidaVista, setBienvenidaVista] = useState<boolean | null>(null);

  useEffect(() => {
    vioBienvenida().then(setBienvenidaVista);
  }, []);

  useEffect(() => {
    if (!navegador?.key || cargando || !listo || bienvenidaVista === null) return;

    SplashScreen.hideAsync().catch(() => {
      // Ya estaba oculta. No es un problema.
    });

    // Las rutas tipadas no modelan la raiz, donde el array viene vacio.
    const primero = segmentos[0] as string | undefined;
    const enPublica = primero !== undefined && RUTAS_PUBLICAS.has(primero);
    const enReparto = primero === undefined;

    // El guardian solo expulsa de donde NO se debe estar. Comprobar "no esta en
    // una pestana" rebotaba al usuario desde pantallas legitimas como
    // /receta/nueva.
    if (!session && !enPublica) {
      router.replace(bienvenidaVista ? '/login' : '/bienvenida');
    } else if (session && (enPublica || enReparto)) {
      router.replace('/(tabs)');
    }
  }, [session, cargando, listo, bienvenidaVista, segmentos, router, navegador?.key]);

  // Mientras tanto se ve el splash nativo; no hace falta pintar nada encima.
  if (cargando || !listo) return <View style={estilos.fondo} />;
  return <>{children}</>;
}

export default function RootLayout() {
  const [fuentesListas, errorFuentes] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlayfairDisplay_700Bold,
  });

  // Si las fuentes fallan, seguimos con la del sistema antes que dejar la app
  // bloqueada en el splash.
  const listo = fuentesListas || Boolean(errorFuentes);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider value={temaNavegacion}>
          <StatusBar style="dark" />
          <Guardian listo={listo}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="bienvenida" options={{ animation: 'fade' }} />
              <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
              <Stack.Screen name="login" options={{ animation: 'fade' }} />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="receta/[id]" options={{ headerShown: true, title: '' }} />
              <Stack.Screen name="receta/nueva" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="coleccion/[id]" />
              <Stack.Screen name="importar/texto" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="importar/web" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="importar/procesando" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
              <Stack.Screen name="expo-sharing" options={{ animation: 'none' }} />
              <Stack.Screen name="plus" options={{ animation: 'slide_from_bottom' }} />
            </Stack>
          </Guardian>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: Colors.light.background },
});
