import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotonOnboarding } from '@/components/onboarding/boton';
import { EncabezadoOnboarding } from '@/components/onboarding/encabezado';
import { Pulso } from '@/components/onboarding/pulso';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { guardarRespuesta } from '@/lib/preferencias';

/**
 * Sexta pantalla del onboarding: pide permiso de notificaciones. La tarjeta del
 * centro es una maqueta del dialogo; el dialogo real de Android sale al pulsar
 * el boton (o la maqueta).
 */

const SUAVE = Easing.bezier(0.22, 1, 0.36, 1);

/** Android 13+ pide permiso en tiempo de ejecucion; antes estaban permitidas por defecto. */
async function pedirPermiso(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (Platform.Version < 33) return true;
  try {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    return r === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export default function Notificaciones() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hora } = useLocalSearchParams<{ hora?: string }>();
  const [pidiendo, setPidiendo] = useState(false);

  const cabecera = useSharedValue(0);
  const aviso = useSharedValue(0);
  const dialogo = useSharedValue(0);
  const pie = useSharedValue(0);
  const flote = useSharedValue(0);

  useEffect(() => {
    cabecera.value = withTiming(1, { duration: 600, easing: SUAVE });
    dialogo.value = withDelay(250, withSpring(1, { damping: 15, stiffness: 120 }));
    // La notificacion de ejemplo baja desde arriba y luego flota
    aviso.value = withDelay(900, withSpring(1, { damping: 13, stiffness: 110 }));
    flote.value = withDelay(1600, withRepeat(withSequence(withTiming(1, { duration: 1700 }), withTiming(0, { duration: 1700 })), -1));
    pie.value = withDelay(500, withTiming(1, { duration: 550, easing: SUAVE }));
  }, [cabecera, aviso, dialogo, pie, flote]);

  const estiloCabecera = useAnimatedStyle(() => ({
    opacity: cabecera.value,
    transform: [{ translateY: interpolate(cabecera.value, [0, 1], [12, 0]) }],
  }));
  const estiloAviso = useAnimatedStyle(() => ({
    opacity: interpolate(aviso.value, [0, 0.4], [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(aviso.value, [0, 1], [-40, 0]) + flote.value * -5 }],
  }));
  const estiloDialogo = useAnimatedStyle(() => ({
    opacity: interpolate(dialogo.value, [0, 0.4], [0, 1], 'clamp'),
    transform: [{ scale: interpolate(dialogo.value, [0, 1], [0.9, 1]) }],
  }));
  const estiloPie = useAnimatedStyle(() => ({
    opacity: pie.value,
    transform: [{ translateY: interpolate(pie.value, [0, 1], [16, 0]) }],
  }));

  async function seguir(pedir: boolean) {
    if (pidiendo) return;
    setPidiendo(true);
    const permitidas = pedir ? await pedirPermiso() : false;
    await guardarRespuesta('notificaciones', permitidas ? 'si' : 'no');
    setPidiendo(false);
    router.push('/onboarding/compatible');
  }

  const cuando = hora ? `cerca de las ${hora}` : 'a la hora que elegiste';

  return (
    <View style={estilos.pantalla}>
      <StatusBar style="dark" />
      <EncabezadoOnboarding paso={5} />

      <Animated.View style={[estilos.cabecera, estiloCabecera]}>
        <Text style={estilos.titulo} accessibilityRole="header">
          La receta ideal,{'\n'}justo a tiempo
        </Text>
        <Text style={estilos.subtitulo}>Te mandamos una idea para cocinar {cuando}, cuando más la necesitas.</Text>
      </Animated.View>

      <View style={estilos.escena}>
        {/* Ejemplo de la notificacion que llegara */}
        <Animated.View style={[estilos.aviso, estiloAviso]} accessible accessibilityLabel="Ejemplo de notificación">
          <View style={estilos.avisoIcono}>
            <Image source={require('@/assets/images/logo-blanco.png')} style={estilos.avisoLogo} contentFit="contain" />
          </View>
          <View style={estilos.avisoTextos}>
            <Text style={estilos.avisoApp}>
              Recetifia <Text style={estilos.avisoHora}>· {hora ?? 'ahora'}</Text>
            </Text>
            <Text style={estilos.avisoTexto} numberOfLines={2}>
              ¿Y si hoy toca carbonara? 🍝 La guardaste desde Instagram.
            </Text>
          </View>
        </Animated.View>

        {/* Maqueta del dialogo del sistema */}
        <Animated.View style={[estilos.dialogo, estiloDialogo]}>
          <MaterialCommunityIcons name="bell-ring" size={28} color={Marca.primario} />
          <Text style={estilos.dialogoTexto}>
            ¿Permitir que <Text style={estilos.negrita}>Recetifia</Text> te envíe notificaciones?
          </Text>
          <Pressable
            onPress={() => seguir(true)}
            accessibilityRole="button"
            accessibilityLabel="Permitir notificaciones"
            style={({ pressed }) => [estilos.opcion, estilos.opcionPermitir, { opacity: pressed ? 0.8 : 1 }]}>
            <Pulso ancho={64} alto={64} radio={32} />
            <Text style={[estilos.textoOpcion, estilos.textoPermitir]}>Permitir</Text>
          </Pressable>
          <Pressable
            onPress={() => seguir(false)}
            accessibilityRole="button"
            accessibilityLabel="No permitir notificaciones"
            style={({ pressed }) => [estilos.opcion, { opacity: pressed ? 0.8 : 1 }]}>
            <Text style={estilos.textoOpcion}>No permitir</Text>
          </Pressable>
        </Animated.View>
      </View>

      <Animated.View style={[estilos.pie, { paddingBottom: insets.bottom + 20 }, estiloPie]}>
        <Text style={estilos.nota}>Puedes desactivarlas cuando quieras.</Text>
        <BotonOnboarding texto="Avísame a mi hora" alPulsar={() => seguir(true)} apagado={pidiendo} />
      </Animated.View>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#FFFFFF' },
  cabecera: { paddingHorizontal: 24, paddingTop: 24 },
  titulo: { fontFamily: Tipografia.display, fontSize: 30, lineHeight: 38, textAlign: 'center', color: Colors.light.text },
  subtitulo: {
    fontFamily: Tipografia.regular,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    color: Colors.light.textSecondary,
    marginTop: 10,
  },

  escena: { flex: 1, justifyContent: 'center', paddingHorizontal: 32, gap: 22 },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.light.borde,
    elevation: 6,
    shadowColor: '#7A2E12',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  avisoIcono: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Marca.primario,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avisoLogo: { width: 24, height: 22 },
  avisoTextos: { flex: 1, gap: 2 },
  avisoApp: { fontFamily: Tipografia.seminegrita, fontSize: 13, color: Colors.light.text },
  avisoHora: { fontFamily: Tipografia.regular, color: Colors.light.textSecondary },
  avisoTexto: { fontFamily: Tipografia.regular, fontSize: 14, lineHeight: 19, color: Colors.light.text },

  dialogo: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 22,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderRadius: 28,
    backgroundColor: '#FFF7F3',
    borderWidth: 1,
    borderColor: '#FBE3D8',
  },
  dialogoTexto: {
    fontFamily: Tipografia.regular,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    color: Colors.light.text,
    marginBottom: 6,
  },
  negrita: { fontFamily: Tipografia.negrita },
  opcion: {
    alignSelf: 'stretch',
    minHeight: 46,
    borderRadius: Radios.pildora,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  opcionPermitir: { backgroundColor: Marca.primarioTenue },
  textoOpcion: { fontFamily: Tipografia.media, fontSize: 15, color: Colors.light.textSecondary },
  textoPermitir: { fontFamily: Tipografia.seminegrita, color: Marca.primario },

  pie: { paddingHorizontal: 24, paddingTop: 12, gap: 12 },
  nota: { fontFamily: Tipografia.regular, fontSize: 14, textAlign: 'center', color: Colors.light.textSecondary },
});
