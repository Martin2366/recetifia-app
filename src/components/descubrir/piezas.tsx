import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Colors, Marca, Tipografia } from '@/constants/theme';
import { arroba, useGuardarDeDescubrir, useMisExtracciones, type TarjetaDescubrir } from '@/lib/descubrir';
import { exito } from '@/lib/haptica';

/** Piezas compartidas por el inicio de Descubrir, la rejilla y el detalle. */

/** Marcador redondo sobre la foto: guarda en la biblioteca sin gastar importaciones. */
export function BotonGuardar({ tarjeta, estilo }: { tarjeta: TarjetaDescubrir; estilo?: ViewStyle }) {
  const router = useRouter();
  const mias = useMisExtracciones();
  const guardar = useGuardarDeDescubrir();
  const guardada = mias.data?.has(tarjeta.extraction_id) ?? false;

  async function alPulsar() {
    try {
      const r = await guardar.mutateAsync(tarjeta);
      if (!r.yaEstaba) exito();
      if (guardada || r.yaEstaba) router.push(`/receta/${r.id}`);
    } catch {
      Alert.alert('No se guardó', 'Revisa tu conexión e inténtalo de nuevo.');
    }
  }

  return (
    <Pressable
      onPress={alPulsar}
      disabled={guardar.isPending}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={guardada ? 'Abrir en mis recetas' : 'Guardar en mis recetas'}
      style={[estilos.marcador, estilo]}>
      {guardar.isPending ? (
        <ActivityIndicator size="small" color={Marca.primario} />
      ) : (
        <MaterialCommunityIcons name={guardada ? 'bookmark' : 'bookmark-outline'} size={20} color={guardada ? Marca.primario : Colors.light.text} />
      )}
    </Pressable>
  );
}

/** Foto de la receta o, si no hay, un fondo de marca con cubiertos. */
export function Foto({ uri, estilo }: { uri: string | null; estilo?: ViewStyle }) {
  return (
    <View style={[estilos.foto, estilo]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      ) : (
        <MaterialCommunityIcons name="silverware-fork-knife" size={32} color={Marca.primarioSuave} />
      )}
    </View>
  );
}

/** Avatar del creador con anillo de marca; sin foto, su inicial. */
export function Avatar({ usuario, foto, tamano = 72, anillo = true }: { usuario: string; foto: string | null; tamano?: number; anillo?: boolean }) {
  const interno = anillo ? tamano - 8 : tamano;
  const inicial = usuario.replace(/^@/, '').trim()[0]?.toUpperCase() ?? '?';
  return (
    <View style={[estilos.anillo, { width: tamano, height: tamano, borderRadius: tamano / 2 }, !anillo && { borderWidth: 0 }]}>
      <View style={[estilos.avatar, { width: interno, height: interno, borderRadius: interno / 2 }]}>
        {foto ? (
          <Image cachePolicy="memory-disk" source={{ uri: foto }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Text style={[estilos.inicial, { fontSize: interno * 0.4 }]}>{inicial}</Text>
        )}
      </View>
    </View>
  );
}

/** "@creador" con su mini avatar. */
export function LineaCreador({ tarjeta, claro = false }: { tarjeta: TarjetaDescubrir; claro?: boolean }) {
  if (!tarjeta.creador_usuario) return null;
  return (
    <View style={estilos.lineaCreador}>
      <Avatar usuario={tarjeta.creador_usuario} foto={tarjeta.creador_foto} tamano={20} anillo={false} />
      <Text style={[estilos.textoCreador, claro && { color: '#FFFFFF' }]} numberOfLines={1}>
        {arroba(tarjeta.creador_usuario)}
      </Text>
    </View>
  );
}

/** Tarjeta de la rejilla de 2 columnas ("Ver todo", una etiqueta o un creador). */
export const TarjetaRejilla = memo(function TarjetaRejilla({ tarjeta, ancho }: { tarjeta: TarjetaDescubrir; ancho: number }) {
  const router = useRouter();
  // El marcador va al lado de la tarjeta, no dentro: dos botones no se anidan
  return (
    <View style={{ width: ancho }}>
      <Pressable
        onPress={() => router.push({ pathname: '/descubrir/[id]', params: { id: tarjeta.id } })}
        accessibilityRole="button"
        accessibilityLabel={tarjeta.titulo}
        style={({ pressed }) => [{ gap: 6 }, pressed && { opacity: 0.85 }]}>
        <Foto uri={tarjeta.foto} estilo={{ width: ancho, height: ancho * 1.2 }} />
        <LineaCreador tarjeta={tarjeta} />
        <Text style={estilos.tituloTarjeta} numberOfLines={2}>
          {tarjeta.titulo}
        </Text>
        <Detalle tarjeta={tarjeta} />
      </Pressable>
      <BotonGuardar tarjeta={tarjeta} estilo={estilos.marcadorEsquina} />
    </View>
  );
});


/**
 * "25 min · 1,2 M vistas", lo que haya. Las vistas (o los me gusta) son los
 * numeros reales de la publicacion original; la red se ve en el boton del video.
 */
export function Detalle({ tarjeta }: { tarjeta: TarjetaDescubrir }) {
  const social = tarjeta.vistas
    ? `${formatoMiles(tarjeta.vistas)} vistas`
    : tarjeta.me_gusta
      ? `${formatoMiles(tarjeta.me_gusta)} me gusta`
      : '';
  const partes = [
    tarjeta.minutos ? `${tarjeta.minutos} min` : '',
    social,
    tarjeta.guardados ? `${formatoMiles(tarjeta.guardados)} guardados` : '',
  ].filter(Boolean);
  if (!partes.length) return null;
  return (
    <Text style={estilos.detalle} numberOfLines={1}>
      {partes.join(' · ')}
    </Text>
  );
}

/** 950 · 12 mil · 1,2 M */
export function formatoMiles(n: number): string {
  const corto = (x: number) => x.toFixed(x < 10 ? 1 : 0).replace('.', ',').replace(/,0$/, '');
  if (n >= 1_000_000) return `${corto(n / 1_000_000)} M`;
  if (n >= 1000) return `${corto(n / 1000)} mil`;
  return String(n);
}

const estilos = StyleSheet.create({
  marcador: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  marcadorEsquina: { position: 'absolute', top: 10, right: 10 },
  foto: { borderRadius: 16, overflow: 'hidden', backgroundColor: Marca.primarioTenue, alignItems: 'center', justifyContent: 'center' },
  anillo: { borderWidth: 2.5, borderColor: Marca.primario, alignItems: 'center', justifyContent: 'center' },
  avatar: { overflow: 'hidden', backgroundColor: Marca.primarioTenue, alignItems: 'center', justifyContent: 'center' },
  inicial: { fontFamily: Tipografia.negrita, color: Marca.primarioTexto },
  lineaCreador: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  textoCreador: { flexShrink: 1, fontFamily: Tipografia.media, fontSize: 13, color: Colors.light.textSecondary },
  tituloTarjeta: { fontFamily: Tipografia.seminegrita, fontSize: 16, lineHeight: 21, color: Colors.light.text },
  detalle: { fontFamily: Tipografia.media, fontSize: 13, color: Colors.light.textSecondary },
});

