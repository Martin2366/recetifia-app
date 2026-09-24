import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotonOnboarding } from '@/components/onboarding/boton';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { CuentaEnUso, InicioCancelado, useAuth } from '@/lib/auth';
import { abrirGestionDeSuscripcion, LIMITES, restaurarCompras } from '@/lib/compras';
import { claveCuota, useCuota } from '@/lib/cuota';
import { abrirLegal } from '@/lib/legal';

const FONDO = '#F7F2EE';

type Ocupado = 'respaldo' | 'salida' | 'borrado' | 'restaurar' | null;

export default function Perfil() {
  const { session, anonima, respaldarConGoogle, cambiarACuentaDeGoogle, borrarCuenta, salir } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const cuota = useCuota();
  const plus = cuota.data?.plus ?? false;
  const [ocupado, setOcupado] = useState<Ocupado>(null);

  // Quien pago en otro telefono o reinstalo recupera Plus sin escribir a nadie
  function restaurar() {
    hacer(
      'restaurar',
      async () => {
        const ok = await restaurarCompras();
        qc.invalidateQueries({ queryKey: claveCuota });
        Alert.alert(
          ok ? 'Recetifia+ restaurado' : 'Sin compras para restaurar',
          ok ? 'Ya tienes Plus en este teléfono.' : 'No encontramos una suscripción activa en tu cuenta de Google Play.'
        );
      },
      'No pudimos restaurar'
    );
  }

  const usuario = session?.user;
  const nombre =
    (usuario?.user_metadata?.full_name as string | undefined) ??
    (usuario?.user_metadata?.name as string | undefined) ??
    usuario?.email ??
    'Tu cuenta';

  async function hacer(que: Exclude<Ocupado, null>, accion: () => Promise<void>, titulo: string) {
    setOcupado(que);
    try {
      await accion();
    } catch (err) {
      if (!(err instanceof InicioCancelado)) Alert.alert(titulo, err instanceof Error ? err.message : 'Inténtalo de nuevo en un momento.');
    } finally {
      setOcupado(null);
    }
  }

  function respaldar() {
    hacer(
      'respaldo',
      async () => {
        try {
          await respaldarConGoogle();
        } catch (err) {
          if (!(err instanceof CuentaEnUso)) throw err;
          // Esa cuenta ya tiene sus recetas: se ofrece usarla, diciendo que pasa con estas
          Alert.alert(
            'Esa cuenta ya está en Recetifia',
            'Ya tiene sus propias recetas guardadas. Si entras con ella, las recetas de este teléfono se borran.',
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Entrar con esa cuenta',
                style: 'destructive',
                onPress: () => hacer('respaldo', () => cambiarACuentaDeGoogle(err.token), 'No pudimos cambiar de cuenta'),
              },
            ]
          );
        }
      },
      'No pudimos respaldar tus recetas'
    );
  }

  function confirmarSalida() {
    Alert.alert('Cerrar sesión', 'Tus recetas quedan guardadas en tu cuenta de Google.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', onPress: () => hacer('salida', salir, 'No pudimos cerrar la sesión') },
    ]);
  }

  // Dos toques y listo: nada de escribir "Eliminar" para que despues no funcione
  function confirmarBorrado() {
    Alert.alert(
      '¿Borrar tu cuenta?',
      'Se borran para siempre tus recetas, colecciones y listas. No se puede deshacer.\n\nSi pagas Recetifia+, cancela también la suscripción en Google Play: borrar la cuenta no la cancela.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar todo', style: 'destructive', onPress: () => hacer('borrado', borrarCuenta, 'No pudimos borrar tu cuenta') },
      ]
    );
  }

  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={[estilos.contenido, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 }]}>
      <Text style={estilos.titulo} accessibilityRole="header">
        Perfil
      </Text>

      {anonima ? (
        <View style={estilos.tarjeta}>
          <View style={estilos.icono}>
            <MaterialCommunityIcons name="cellphone-lock" size={24} color={Marca.primario} />
          </View>
          <Text style={estilos.tituloTarjeta}>Tus recetas están solo en este teléfono</Text>
          <Text style={estilos.texto}>
            Usas Recetifia sin cuenta, y está bien. Si cambias o pierdes el teléfono, las recetas se van con él. Respáldalas
            con Google y no pierdes nada de lo que ya guardaste.
          </Text>
          {ocupado === 'respaldo' ? (
            <View style={estilos.cargando}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          ) : (
            <BotonOnboarding texto="Respaldar con Google" alPulsar={respaldar} apagado={ocupado !== null} />
          )}
        </View>
      ) : (
        <View style={estilos.tarjeta}>
          <Text style={estilos.tituloTarjeta}>{nombre}</Text>
          {usuario?.email ? <Text style={estilos.texto}>{usuario.email}</Text> : null}
          <View style={estilos.respaldada}>
            <MaterialCommunityIcons name="cloud-check-outline" size={18} color={Marca.exito} />
            <Text style={estilos.textoRespaldada}>Recetas respaldadas en tu cuenta</Text>
          </View>
        </View>
      )}

      <Text style={estilos.seccion}>Tu plan</Text>
      <View style={estilos.tarjeta}>
        <View style={estilos.filaPlan}>
          <MaterialCommunityIcons name={plus ? 'crown' : 'leaf'} size={22} color={Marca.primario} />
          <Text style={estilos.tituloTarjeta}>{plus ? 'Recetifia+' : 'Plan gratis'}</Text>
        </View>
        <Text style={estilos.texto}>
          {plus
            ? 'Importaciones sin límite e información nutricional. Si cancelas, sigues con Plus hasta el final de lo que pagaste.'
            : `Todo gratis y sin límite, salvo importar videos e imágenes: ${LIMITES.importacionesPorSemana} por semana.`}
        </Text>
      </View>
      <View style={estilos.lista}>
        {plus ? (
          <Opcion icono="open-in-new" texto="Gestionar o cancelar suscripción" alPulsar={abrirGestionDeSuscripcion} ocupado={false} apagado={ocupado !== null} />
        ) : (
          <Opcion icono="crown-outline" texto="Ver Recetifia+" alPulsar={() => router.push('/plus')} ocupado={false} apagado={ocupado !== null} />
        )}
        <View style={estilos.separador} />
        <Opcion icono="restore" texto="Restaurar compra" alPulsar={restaurar} ocupado={ocupado === 'restaurar'} apagado={ocupado !== null} />
      </View>

      <Text style={estilos.seccion}>Cuenta</Text>
      <View style={estilos.lista}>
        {!anonima ? (
          <Opcion icono="logout" texto="Cerrar sesión" alPulsar={confirmarSalida} ocupado={ocupado === 'salida'} apagado={ocupado !== null} />
        ) : null}
        <Opcion
          icono="delete-outline"
          texto={anonima ? 'Borrar mis datos' : 'Borrar mi cuenta y mis datos'}
          peligro
          alPulsar={confirmarBorrado}
          ocupado={ocupado === 'borrado'}
          apagado={ocupado !== null}
        />
      </View>

      <View style={estilos.lista}>
        <Opcion icono="shield-lock-outline" texto="Política de privacidad" alPulsar={() => abrirLegal('privacidad')} ocupado={false} apagado={false} />
        <View style={estilos.separador} />
        <Opcion icono="file-document-outline" texto="Términos de uso" alPulsar={() => abrirLegal('terminos')} ocupado={false} apagado={false} />
      </View>
    </ScrollView>
  );
}

function Opcion({
  icono,
  texto,
  alPulsar,
  ocupado,
  apagado,
  peligro = false,
}: {
  icono: keyof typeof MaterialCommunityIcons.glyphMap;
  texto: string;
  alPulsar: () => void;
  ocupado: boolean;
  apagado: boolean;
  peligro?: boolean;
}) {
  const color = peligro ? Marca.error : Colors.light.text;
  return (
    <Pressable
      onPress={alPulsar}
      disabled={apagado}
      accessibilityRole="button"
      style={({ pressed }) => [estilos.opcion, { opacity: pressed || (apagado && !ocupado) ? 0.6 : 1 }]}>
      <MaterialCommunityIcons name={icono} size={22} color={color} />
      <Text style={[estilos.textoOpcion, { color }]}>{texto}</Text>
      {ocupado ? <ActivityIndicator color={color} /> : null}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: FONDO },
  contenido: { paddingHorizontal: 20, gap: 18 },
  titulo: { fontFamily: Tipografia.display, fontSize: 32, color: Colors.light.text },

  tarjeta: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radios.grande,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: '#EDE5E0',
  },
  icono: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Marca.primarioTenue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tituloTarjeta: { fontFamily: Tipografia.display, fontSize: 21, lineHeight: 27, color: Colors.light.text },
  texto: { fontFamily: Tipografia.regular, fontSize: 15, lineHeight: 22, color: Colors.light.textSecondary },
  cargando: { minHeight: 56, borderRadius: Radios.pildora, backgroundColor: Marca.primario, alignItems: 'center', justifyContent: 'center' },
  respaldada: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  textoRespaldada: { fontFamily: Tipografia.media, fontSize: 14, color: Colors.light.textSecondary },

  seccion: { fontFamily: Tipografia.seminegrita, fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase', color: Colors.light.textSecondary, marginBottom: -8, marginLeft: 4 },
  filaPlan: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  separador: { height: 1, backgroundColor: '#F1ECE9', marginLeft: 54 },
  lista: { backgroundColor: '#FFFFFF', borderRadius: Radios.grande, borderWidth: 1, borderColor: '#EDE5E0', overflow: 'hidden' },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingHorizontal: 18 },
  textoOpcion: { flex: 1, fontFamily: Tipografia.media, fontSize: 16 },
});
