import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Silueta, TONOS } from '@/components/onboarding/formas';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { InicioCancelado, useAuth } from '@/lib/auth';
import { abrirLegal } from '@/lib/legal';

/**
 * Entrada para quien ya vio la bienvenida (volvio a instalar o cerro sesion).
 * Poco texto: el logo rodeado de comida dice de que va la app.
 */

const SUAVE = Easing.bezier(0.22, 1, 0.36, 1);
const FONDO = '#F7F2EE';
const LADO = 300; // caja de la ilustracion

export default function Login() {
  const { entrarConGoogle, entrarSinCuenta } = useAuth();
  const [entrando, setEntrando] = useState<'google' | 'sin-cuenta' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const logo = useSharedValue(0);
  const textos = useSharedValue(0);
  useEffect(() => {
    logo.value = withSpring(1, { damping: 12, stiffness: 110 });
    textos.value = withDelay(350, withTiming(1, { duration: 600, easing: SUAVE }));
  }, [logo, textos]);
  const estiloLogo = useAnimatedStyle(() => ({
    opacity: logo.value,
    transform: [{ scale: interpolate(logo.value, [0, 1], [0.6, 1]) }],
  }));
  const estiloTextos = useAnimatedStyle(() => ({
    opacity: textos.value,
    transform: [{ translateY: interpolate(textos.value, [0, 1], [16, 0]) }],
  }));

  async function entrar(como: 'google' | 'sin-cuenta') {
    setError(null);
    setEntrando(como);
    try {
      await (como === 'google' ? entrarConGoogle() : entrarSinCuenta());
      // No navegamos aqui: el guardian de la raiz reacciona al cambio de sesion.
    } catch (err) {
      if (!(err instanceof InicioCancelado)) {
        setError(err instanceof Error ? err.message : 'No pudimos iniciar sesión.');
      }
    } finally {
      setEntrando(null);
    }
  }

  return (
    <SafeAreaView style={estilos.pantalla}>
      <StatusBar style="dark" />

      <View style={estilos.centro}>
        {/* El logo al centro, con la comida flotando alrededor */}
        <View style={estilos.escena} accessible={false}>
          <Silueta icono="chef-hat" color={TONOS.lila} tamano={70} x={18} y={22} giro={-14} retraso={250} />
          <Silueta icono="carrot" color={TONOS.naranja} tamano={64} x={214} y={12} giro={18} retraso={330} />
          <Silueta icono="fish" color={TONOS.celeste} tamano={62} x={0} y={170} giro={-8} retraso={410} />
          <Silueta icono="cupcake" color="#F7A8C0" tamano={66} x={222} y={176} giro={10} retraso={490} />
          <Silueta icono="leaf" color={TONOS.verde} tamano={48} x={122} y={0} giro={24} retraso={570} />
          <Silueta icono="bread-slice" color={TONOS.amarillo} tamano={54} x={116} y={236} giro={-10} retraso={650} />

          <Animated.View style={[estilos.teja, estiloLogo]}>
            <Image source={require('@/assets/images/logo-blanco.png')} style={estilos.logo} contentFit="contain" />
          </Animated.View>
        </View>

        <Animated.View style={[estilos.textos, estiloTextos]}>
          <Text style={estilos.nombre} accessibilityRole="header">
            Recetifia
          </Text>
          <Text style={estilos.lema}>Tus recetas, listas para cocinar.</Text>
        </Animated.View>
      </View>

      <View style={estilos.pie}>
        {error ? (
          <Text style={estilos.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        <Pressable
          onPress={() => entrar('google')}
          disabled={entrando !== null}
          accessibilityRole="button"
          accessibilityLabel="Continuar con Google"
          style={({ pressed }) => [estilos.boton, { opacity: pressed || entrando ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
          {entrando === 'google' ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <FontAwesome6 name="google" brand size={18} color="#FFFFFF" />
              <Text style={estilos.textoBoton}>Continuar con Google</Text>
            </>
          )}
        </Pressable>

        {/* La cuenta es para respaldar, no un peaje: se puede usar sin ella */}
        <Pressable
          onPress={() => entrar('sin-cuenta')}
          disabled={entrando !== null}
          hitSlop={8}
          accessibilityRole="button"
          style={({ pressed }) => [estilos.sinCuenta, { opacity: pressed || entrando ? 0.6 : 1 }]}>
          {entrando === 'sin-cuenta' ? (
            <ActivityIndicator color={Marca.primario} />
          ) : (
            <Text style={estilos.textoSinCuenta}>Seguir sin cuenta</Text>
          )}
        </Pressable>

        <Text style={estilos.legal}>
          Al continuar aceptas los{' '}
          <Text style={estilos.enlaceLegal} onPress={() => abrirLegal('terminos')}>
            términos
          </Text>{' '}
          y la{' '}
          <Text style={estilos.enlaceLegal} onPress={() => abrirLegal('privacidad')}>
            privacidad
          </Text>
          .
        </Text>
      </View>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: FONDO, paddingHorizontal: 24 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  escena: { width: LADO, height: LADO, alignItems: 'center', justifyContent: 'center' },
  teja: {
    width: 116,
    height: 116,
    borderRadius: 32,
    backgroundColor: Marca.primario,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    shadowColor: '#7A2E12',
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
  },
  logo: { width: 66, height: 57 },
  textos: { alignItems: 'center', gap: 6 },
  nombre: { fontFamily: Tipografia.display, fontSize: 40, color: Colors.light.text },
  lema: { fontFamily: Tipografia.regular, fontSize: 17, color: Colors.light.textSecondary, textAlign: 'center' },

  pie: { paddingBottom: 24, gap: 10 },
  boton: {
    minHeight: 56,
    borderRadius: Radios.pildora,
    backgroundColor: Marca.primario,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  textoBoton: { fontFamily: Tipografia.seminegrita, fontSize: 17, color: '#FFFFFF' },
  sinCuenta: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  textoSinCuenta: { fontFamily: Tipografia.seminegrita, fontSize: 16, color: Colors.light.text },
  legal: { fontFamily: Tipografia.regular, fontSize: 12, lineHeight: 17, textAlign: 'center', color: Colors.light.textTenue },
  enlaceLegal: { textDecorationLine: 'underline' },
  error: { fontFamily: Tipografia.media, fontSize: 14, color: Marca.error, textAlign: 'center' },
});
