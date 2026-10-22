import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGuia } from '@/components/guia/guia';
import { BotonOnboarding } from '@/components/onboarding/boton';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { CuentaEnUso, InicioCancelado, useAuth } from '@/lib/auth';
import { useEstadisticasCocina } from '@/lib/cocinadas';
import { abrirGestionDeSuscripcion, LIMITES, restaurarCompras } from '@/lib/compras';
import { claveCuota, useCuota } from '@/lib/cuota';
import { abrirLegal } from '@/lib/legal';
import { notificacionesDisponibles, pedirPermiso, reprogramarRecordatorios } from '@/lib/notificaciones';
import { useCambiarAvatar, useMiPerfil } from '@/lib/perfil';
import { guardarRecordatorios, HORAS_COCINA, leerRecordatorios, type Recordatorios } from '@/lib/preferencias';

const FONDO = '#F7F2EE';

type Ocupado = 'respaldo' | 'salida' | 'borrado' | 'restaurar' | null;

export default function Perfil() {
  const { session, anonima, respaldarConGoogle, cambiarACuentaDeGoogle, borrarCuenta, salir } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const cuota = useCuota();
  const guia = useGuia();
  const perfil = useMiPerfil();
  const cocina = useEstadisticasCocina();
  const cambiarAvatar = useCambiarAvatar();
  const plus = cuota.data?.plus ?? false;
  const [ocupado, setOcupado] = useState<Ocupado>(null);

  async function elegirFoto() {
    try {
      await cambiarAvatar.mutateAsync();
    } catch (err) {
      Alert.alert('No pudimos cambiar la foto', err instanceof Error ? err.message : 'Inténtalo de nuevo en un momento.');
    }
  }

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

      <View style={estilos.tarjeta}>
        <View style={estilos.filaCuenta}>
          <Pressable
            onPress={elegirFoto}
            disabled={cambiarAvatar.isPending}
            accessibilityRole="button"
            accessibilityLabel="Cambiar foto de perfil"
            style={estilos.avatar}>
            {perfil.data?.avatar ? (
              <Image source={{ uri: perfil.data.avatar }} style={estilos.avatarFoto} contentFit="cover" transition={200} />
            ) : (
              <MaterialCommunityIcons name="chef-hat" size={34} color={Marca.primario} />
            )}
            <View style={estilos.camara}>
              {cambiarAvatar.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <MaterialCommunityIcons name="camera" size={14} color="#FFFFFF" />
              )}
            </View>
          </Pressable>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={estilos.tituloTarjeta} numberOfLines={1}>
              {anonima ? 'Tu cocina' : nombre}
            </Text>
            {anonima ? (
              <Text style={estilos.texto}>Sin cuenta · solo en este teléfono</Text>
            ) : (
              <View style={estilos.respaldada}>
                <MaterialCommunityIcons name="cloud-check-outline" size={18} color={Marca.exito} />
                <Text style={estilos.textoRespaldada}>Recetas respaldadas</Text>
              </View>
            )}
          </View>
        </View>

        {/* Lo primero que se ve: sin respaldo, cambiar de telefono es perderlo todo */}
        {anonima ? (
          <View style={estilos.respaldo}>
            <View style={estilos.filaRespaldo}>
              <MaterialCommunityIcons name="cellphone-lock" size={22} color={Marca.primarioTexto} />
              <Text style={estilos.textoRespaldo}>
                Si cambias o pierdes el teléfono, tus recetas se van con él. Respáldalas con Google y guarda tu progreso.
              </Text>
            </View>
            {ocupado === 'respaldo' ? (
              <View style={estilos.cargando}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : (
              <BotonOnboarding texto="Respaldar con Google" alPulsar={respaldar} apagado={ocupado !== null} />
            )}
          </View>
        ) : null}
      </View>

      <View style={estilos.estadisticas}>
        <Estadistica numero={perfil.data?.recetas} texto="recetas guardadas" icono="bookmark-outline" />
        <Estadistica numero={cocina.data?.total} texto="recetas cocinadas" icono="pot-steam-outline" />
        <Estadistica numero={cocina.data?.esteMes} texto="cocinadas este mes" icono="calendar-check-outline" />
      </View>

      <Text style={estilos.seccion}>Tu plan</Text>
      <View style={estilos.tarjeta}>
        <View style={estilos.filaPlan}>
          <MaterialCommunityIcons name={plus ? 'crown' : 'leaf'} size={22} color={Marca.primario} />
          <Text style={estilos.tituloTarjeta}>{plus ? 'Recetifia+' : 'Plan gratis'}</Text>
        </View>
        <Text style={estilos.texto}>
          {plus
            ? 'Importaciones, modo cocina y búsquedas por ingredientes sin límite, e información nutricional. Si cancelas, sigues con Plus hasta el final de lo que pagaste.'
            : `Guardar, organizar, el plan y la lista son gratis y sin límite. Con tope: importar videos e imágenes (${
                cuota.data?.tope ?? LIMITES.importacionesGratis
              } en total${cuota.data ? `, te quedan ${cuota.data.importacionesRestantes}` : ''}), el modo cocina (3 sesiones) y la búsqueda por ingredientes (3 al día).`}
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

      <SeccionRecordatorios />

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
        <Opcion
          icono="compass-outline"
          texto="Ver la guía otra vez"
          alPulsar={() => {
            // La guia recorre la biblioteca: primero se vuelve alli
            router.navigate('/');
            setTimeout(() => guia.iniciar(true), 600);
          }}
          ocupado={false}
          apagado={false}
        />
        <View style={estilos.separador} />
        <Opcion icono="shield-lock-outline" texto="Política de privacidad" alPulsar={() => abrirLegal('privacidad')} ocupado={false} apagado={false} />
        <View style={estilos.separador} />
        <Opcion icono="file-document-outline" texto="Términos de uso" alPulsar={() => abrirLegal('terminos')} ocupado={false} apagado={false} />
      </View>
    </ScrollView>
  );
}

function Estadistica({
  numero,
  texto,
  icono,
}: {
  numero: number | undefined;
  texto: string;
  icono: keyof typeof MaterialCommunityIcons.glyphMap;
}) {
  return (
    <View style={estilos.estadistica}>
      <MaterialCommunityIcons name={icono} size={20} color={Marca.primario} />
      <Text style={estilos.numero}>{numero ?? '–'}</Text>
      <Text style={estilos.textoEstadistica}>{texto}</Text>
    </View>
  );
}

/** Recordatorios locales: activar y elegir la hora. Solo donde hay notificaciones (Android). */
function SeccionRecordatorios() {
  const [prefs, setPrefs] = useState<Recordatorios | null>(null);

  useEffect(() => {
    leerRecordatorios().then(setPrefs);
  }, []);

  if (!prefs || !notificacionesDisponibles()) return null;

  async function cambiar(nuevas: Recordatorios) {
    if (nuevas.activos && !prefs!.activos && !(await pedirPermiso())) {
      Alert.alert('Notificaciones desactivadas', 'Para recibir recordatorios, permite las notificaciones de Recetifia en los ajustes del teléfono.', [
        { text: 'Ahora no', style: 'cancel' },
        { text: 'Abrir ajustes', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    setPrefs(nuevas);
    await guardarRecordatorios(nuevas);
    reprogramarRecordatorios();
  }

  return (
    <>
      <Text style={estilos.seccion}>Recordatorios</Text>
      <View style={estilos.tarjeta}>
        <View style={estilos.filaInterruptor}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={estilos.textoOpcion}>Ideas para cocinar</Text>
            <Text style={estilos.texto}>4 días a la semana, con recetas que guardaste y todavía no cocinas.</Text>
          </View>
          <Switch
            value={prefs.activos}
            onValueChange={(activos) => cambiar({ ...prefs, activos })}
            trackColor={{ true: Marca.primario, false: '#D5D9D9' }}
            thumbColor="#FFFFFF"
          />
        </View>
        {prefs.activos ? (
          <View style={estilos.horas}>
            {HORAS_COCINA.map((h) => {
              const elegida = prefs.hora === h.id;
              return (
                <Pressable
                  key={h.id}
                  onPress={() => cambiar({ ...prefs, hora: h.id })}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: elegida }}
                  style={[estilos.hora, elegida && estilos.horaElegida]}>
                  <Text style={[estilos.textoHora, elegida && { color: Marca.primarioTexto }]}>
                    {h.emoji} {h.texto}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    </>
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
  filaCuenta: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Marca.primarioTenue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFoto: { width: 72, height: 72, borderRadius: 36 },
  camara: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: Marca.primario,
    alignItems: 'center',
    justifyContent: 'center',
  },
  respaldo: { gap: 12, padding: 14, marginTop: 4, borderRadius: Radios.medio, backgroundColor: '#FFF7F3', borderWidth: 1, borderColor: Marca.primarioTenue },
  filaRespaldo: { flexDirection: 'row', gap: 10 },
  textoRespaldo: { flex: 1, fontFamily: Tipografia.media, fontSize: 14, lineHeight: 20, color: Colors.light.text },
  estadisticas: { flexDirection: 'row', gap: 10 },
  estadistica: {
    flex: 1,
    gap: 2,
    padding: 14,
    borderRadius: Radios.medio + 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE5E0',
  },
  numero: { fontFamily: Tipografia.display, fontSize: 26, color: Colors.light.text, marginTop: 4 },
  textoEstadistica: { fontFamily: Tipografia.media, fontSize: 12, lineHeight: 16, color: Colors.light.textSecondary },
  filaInterruptor: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  horas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hora: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radios.pildora, borderWidth: 1.5, borderColor: '#EDE5E0' },
  horaElegida: { borderColor: Marca.primario, backgroundColor: Marca.primarioTenue },
  textoHora: { fontFamily: Tipografia.media, fontSize: 14, color: Colors.light.text },
  textoRespaldada: { fontFamily: Tipografia.media, fontSize: 14, color: Colors.light.textSecondary },

  seccion: { fontFamily: Tipografia.seminegrita, fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase', color: Colors.light.textSecondary, marginBottom: -8, marginLeft: 4 },
  filaPlan: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  separador: { height: 1, backgroundColor: '#F1ECE9', marginLeft: 54 },
  lista: { backgroundColor: '#FFFFFF', borderRadius: Radios.grande, borderWidth: 1, borderColor: '#EDE5E0', overflow: 'hidden' },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingHorizontal: 18 },
  textoOpcion: { flex: 1, fontFamily: Tipografia.media, fontSize: 16 },
});
