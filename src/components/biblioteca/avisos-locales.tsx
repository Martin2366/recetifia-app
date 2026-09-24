import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { claveLocales, descartarPendiente, guardarBorrador, useLocales } from '@/lib/guardado-local';

type Icono = keyof typeof MaterialCommunityIcons.glyphMap;

/**
 * Lo que esta en el telefono y aun no en la biblioteca: una receta a medio
 * escribir (la app se cerro, se cayo, se fue la bateria) o recetas guardadas
 * sin conexion que esperan para subirse. Nada de eso se pierde ni se esconde.
 */
export function AvisosLocales() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data, refetch } = useLocales();
  // Al volver del editor la biblioteca no se vuelve a montar: se relee aqui
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );
  if (!data) return null;

  const borrador = data.borradores[0];
  const esperando = data.pendientes.filter((p) => !p.error);
  const rechazada = data.pendientes.find((p) => p.error);
  if (!borrador && !esperando.length && !rechazada) return null;

  function abrirBorrador(id: string) {
    router.push({ pathname: '/receta/nueva', params: { borrador: id } });
  }

  // Si el servidor la rechazo, vuelve al editor como borrador para arreglarla
  async function revisar() {
    if (!rechazada) return;
    await guardarBorrador(rechazada.borrador, rechazada.modo);
    await descartarPendiente(rechazada.borrador.id);
    qc.invalidateQueries({ queryKey: claveLocales });
    abrirBorrador(rechazada.borrador.id);
  }

  const otros = data.borradores.length - 1;

  return (
    <View style={estilos.columna}>
      {borrador ? (
        <Aviso
          icono="pencil-outline"
          titulo={borrador.borrador.title.trim() ? `«${borrador.borrador.title.trim()}» sin terminar` : 'Tienes una receta sin terminar'}
          detalle={otros > 0 ? `Y ${otros} más. Está guardada en tu teléfono.` : 'Está guardada en tu teléfono.'}
          accion="Seguir"
          alPulsar={() => abrirBorrador(borrador.borrador.id)}
        />
      ) : null}
      {esperando.length ? (
        <Aviso
          icono="cloud-upload-outline"
          titulo={esperando.length === 1 ? '1 receta esperando conexión' : `${esperando.length} recetas esperando conexión`}
          detalle="Está a salvo en tu teléfono y se sube sola."
        />
      ) : null}
      {rechazada ? (
        <Aviso
          icono="alert-circle-outline"
          titulo={`No pudimos subir «${rechazada.borrador.title || 'tu receta'}»`}
          detalle="Sigue guardada en tu teléfono. Revísala y vuelve a guardarla."
          accion="Revisar"
          alPulsar={revisar}
          alerta
        />
      ) : null}
    </View>
  );
}

function Aviso({
  icono,
  titulo,
  detalle,
  accion,
  alPulsar,
  alerta = false,
}: {
  icono: Icono;
  titulo: string;
  detalle: string;
  accion?: string;
  alPulsar?: () => void;
  alerta?: boolean;
}) {
  return (
    <Pressable
      onPress={alPulsar}
      disabled={!alPulsar}
      accessibilityRole={alPulsar ? 'button' : undefined}
      style={({ pressed }) => [estilos.aviso, pressed && estilos.presionado]}>
      <View style={[estilos.burbuja, alerta && estilos.burbujaAlerta]}>
        <MaterialCommunityIcons name={icono} size={20} color={alerta ? Marca.error : Marca.primario} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={estilos.titulo} numberOfLines={1}>
          {titulo}
        </Text>
        <Text style={estilos.detalle}>{detalle}</Text>
      </View>
      {accion ? <Text style={estilos.accion}>{accion}</Text> : null}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  columna: { gap: 8, paddingHorizontal: 18, paddingBottom: 12 },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radios.grande - 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE5E0',
  },
  presionado: { backgroundColor: '#FFF7F3' },
  burbuja: { width: 38, height: 38, borderRadius: 19, backgroundColor: Marca.primarioTenue, alignItems: 'center', justifyContent: 'center' },
  burbujaAlerta: { backgroundColor: '#FDECEA' },
  titulo: { fontFamily: Tipografia.seminegrita, fontSize: 15, color: Colors.light.text },
  detalle: { fontFamily: Tipografia.regular, fontSize: 13, color: Colors.light.textSecondary },
  accion: { fontFamily: Tipografia.seminegrita, fontSize: 15, color: Marca.primario },
});
