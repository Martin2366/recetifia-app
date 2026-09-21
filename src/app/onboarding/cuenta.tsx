import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EncabezadoOnboarding } from '@/components/onboarding/encabezado';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { InicioCancelado, useAuth } from '@/lib/auth';

/**
 * Ultima pantalla del onboarding: crear la cuenta con Google. Al haber sesion,
 * el guardian del layout raiz lleva a la biblioteca.
 */

const SUAVE = Easing.bezier(0.22, 1, 0.36, 1);

const VENTAJAS: { icono: keyof typeof MaterialCommunityIcons.glyphMap; texto: string }[] = [
  { icono: 'cloud-check-outline', texto: 'Tus recetas, respaldadas en la nube' },
  { icono: 'cellphone-link', texto: 'Las tienes en cualquier celular' },
  { icono: 'key-remove', texto: 'Sin contraseñas: entras con Google' },
];

export default function Cuenta() {
  const insets = useSafeAreaInsets();
  const { entrarConGoogle } = useAuth();
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cabecera = useSharedValue(0);
  const ventajas = useSharedValue(0);
  const boton = useSharedValue(0);
  useEffect(() => {
    cabecera.value = withTiming(1, { duration: 600, easing: SUAVE });
    ventajas.value = withDelay(250, withTiming(1, { duration: 600, easing: SUAVE }));
    boton.value = withDelay(500, withTiming(1, { duration: 600, easing: SUAVE }));
  }, [cabecera, ventajas, boton]);

  const subir = (v: typeof cabecera) => {
    'worklet';
    return { opacity: v.value, transform: [{ translateY: interpolate(v.value, [0, 1], [14, 0]) }] };
  };
  const estiloCabecera = useAnimatedStyle(() => subir(cabecera));
  const estiloVentajas = useAnimatedStyle(() => subir(ventajas));
  const estiloBoton = useAnimatedStyle(() => subir(boton));

  async function entrar() {
    setError(null);
    setEntrando(true);
    try {
      await entrarConGoogle();
      // No se navega aqui: el guardian reacciona al cambio de sesion.
    } catch (err) {
      if (!(err instanceof InicioCancelado)) {
        setError(err instanceof Error ? err.message : 'No pudimos crear tu cuenta. Inténtalo de nuevo.');
      }
    } finally {
      setEntrando(false);
    }
  }

  return (
    <View style={estilos.pantalla}>
      <StatusBar style="dark" />
      <EncabezadoOnboarding paso={8} />

      <View style={estilos.cuerpo}>
        <Animated.View style={estiloCabecera}>
          <Text style={estilos.titulo} accessibilityRole="header">
            Crea tu cuenta
          </Text>
          <Text style={estilos.subtitulo}>Un paso más y tu primera receta queda guardada para siempre.</Text>
        </Animated.View>

        <Animated.View style={[estilos.ventajas, estiloVentajas]}>
          {VENTAJAS.map((v) => (
            <View key={v.texto} style={estilos.ventaja}>
              <View style={estilos.iconoVentaja}>
                <MaterialCommunityIcons name={v.icono} size={20} color={Marca.primario} />
              </View>
              <Text style={estilos.textoVentaja}>{v.texto}</Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View style={[{ gap: 12 }, estiloBoton]}>
          <Pressable
            onPress={entrar}
            disabled={entrando}
            accessibilityRole="button"
            accessibilityLabel="Continuar con Google"
            style={({ pressed }) => [estilos.google, { opacity: pressed || entrando ? 0.7 : 1 }]}>
            {entrando ? (
              <ActivityIndicator color={Colors.light.text} />
            ) : (
              <>
                <FontAwesome6 name="google" brand size={20} color="#4285F4" />
                <Text style={estilos.textoGoogle}>Continuar con Google</Text>
              </>
            )}
          </Pressable>
          {error ? (
            <Text style={estilos.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
        </Animated.View>
      </View>

      <View style={[estilos.legal, { paddingBottom: insets.bottom + 20 }]}>
        <MaterialCommunityIcons name="lock-outline" size={16} color={Colors.light.textSecondary} />
        <Text style={estilos.textoLegal}>
          Tu información está segura y no la vendemos. Al continuar aceptas los{' '}
          <Text style={estilos.enlace}>Términos</Text> y la <Text style={estilos.enlace}>Política de privacidad</Text>.
        </Text>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#FFFFFF' },
  cuerpo: { flex: 1, paddingHorizontal: 24, paddingTop: 28, gap: 32 },
  titulo: { fontFamily: Tipografia.display, fontSize: 32, lineHeight: 40, textAlign: 'center', color: Colors.light.text },
  subtitulo: {
    fontFamily: Tipografia.regular,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    color: Colors.light.textSecondary,
    marginTop: 10,
  },

  ventajas: { gap: 14, paddingHorizontal: 8 },
  ventaja: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconoVentaja: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Marca.primarioTenue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoVentaja: { flex: 1, fontFamily: Tipografia.media, fontSize: 15, color: Colors.light.text },

  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    minHeight: 56,
    borderRadius: Radios.pildora,
    borderWidth: 1.5,
    borderColor: Colors.light.borde,
    backgroundColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#7A2E12',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  textoGoogle: { fontFamily: Tipografia.seminegrita, fontSize: 17, color: Colors.light.text },
  error: { fontFamily: Tipografia.regular, fontSize: 14, textAlign: 'center', color: Marca.error },

  legal: { flexDirection: 'row', gap: 8, paddingHorizontal: 28, alignItems: 'flex-start' },
  textoLegal: { flex: 1, fontFamily: Tipografia.regular, fontSize: 12, lineHeight: 18, color: Colors.light.textSecondary },
  enlace: { fontFamily: Tipografia.media, textDecorationLine: 'underline', color: Colors.light.text },
});
