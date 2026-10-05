import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, TarjetaRejilla } from '@/components/descubrir/piezas';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { arroba, etiqueta, useCreador, useDescubrirInicio, useDescubrirLista, type TipoLista } from '@/lib/descubrir';

/** "Ver todo": rejilla de 2 columnas de populares, de una etiqueta o de un creador; o todos los creadores. */

const MARGEN = 16;
const SEPARACION = 14;

export default function ListaDescubrir() {
  const { tipo, valor } = useLocalSearchParams<{ tipo: TipoLista | 'creadores'; valor?: string }>();
  if (tipo === 'creadores') return <Creadores />;
  return <Rejilla tipo={tipo ?? 'populares'} valor={valor} />;
}

function Rejilla({ tipo, valor }: { tipo: TipoLista; valor?: string }) {
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const lista = useDescubrirLista(tipo, valor);
  const creador = useCreador(tipo === 'creador' ? valor : undefined);
  const ancho = (W - MARGEN * 2 - SEPARACION) / 2;
  const e = tipo === 'etiqueta' && valor ? etiqueta(valor) : undefined;
  const n = lista.data?.length ?? 0;

  const titulo = tipo === 'populares' ? 'Más populares esta semana' : e ? `${e.emoji} ${e.nombre}` : arroba(creador.data?.usuario);

  return (
    <View style={[estilos.pantalla, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <BarraSuperior />
      <FlatList
        data={lista.data ?? []}
        keyExtractor={(t) => t.id}
        numColumns={2}
        columnWrapperStyle={{ gap: SEPARACION }}
        contentContainerStyle={{ paddingHorizontal: MARGEN, gap: 22, paddingBottom: insets.bottom + 32 }}
        ListHeaderComponent={
          <View style={estilos.cabecera}>
            {tipo === 'creador' && creador.data ? (
              <View style={estilos.cabeceraCreador}>
                <Avatar usuario={creador.data.usuario} foto={creador.data.foto_path} tamano={84} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={estilos.titulo} numberOfLines={1}>
                    {creador.data.nombre ?? arroba(creador.data.usuario)}
                  </Text>
                  {creador.data.url ? (
                    <Pressable onPress={() => Linking.openURL(creador.data!.url!)} hitSlop={8} accessibilityRole="link" style={estilos.verPerfil}>
                      <Text style={estilos.textoVerPerfil}>Ver perfil</Text>
                      <MaterialCommunityIcons name="open-in-new" size={15} color={Marca.primario} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : (
              <Text style={estilos.titulo}>{titulo}</Text>
            )}
            {lista.data ? <Text style={estilos.cuenta}>{n === 1 ? '1 receta' : `${n} recetas`}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          lista.isLoading ? (
            <ActivityIndicator color={Marca.primario} style={{ marginTop: 40 }} />
          ) : lista.error ? (
            <Pressable onPress={() => lista.refetch()} style={estilos.vacio} accessibilityRole="button">
              <Text style={estilos.textoVacio}>No pudimos cargar. Toca para reintentar.</Text>
            </Pressable>
          ) : (
            <View style={estilos.vacio}>
              <Text style={estilos.textoVacio}>Todavía no hay recetas aquí.</Text>
            </View>
          )
        }
        renderItem={({ item }) => <TarjetaRejilla tarjeta={item} ancho={ancho} />}
      />
    </View>
  );
}

function Creadores() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: W } = useWindowDimensions();
  const inicio = useDescubrirInicio();
  const creadores = inicio.data?.creadores ?? [];
  const columnas = 3;
  const ancho = (W - MARGEN * 2 - SEPARACION * (columnas - 1)) / columnas;

  return (
    <View style={[estilos.pantalla, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <BarraSuperior />
      <FlatList
        data={creadores}
        keyExtractor={(c) => c.id}
        numColumns={columnas}
        columnWrapperStyle={{ gap: SEPARACION }}
        contentContainerStyle={{ paddingHorizontal: MARGEN, gap: 22, paddingBottom: insets.bottom + 32 }}
        ListHeaderComponent={
          <View style={estilos.cabecera}>
            <Text style={estilos.titulo}>Creadores en tendencia</Text>
          </View>
        }
        ListEmptyComponent={inicio.isLoading ? <ActivityIndicator color={Marca.primario} style={{ marginTop: 40 }} /> : null}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/descubrir/lista', params: { tipo: 'creador', valor: item.id } })}
            accessibilityRole="button"
            style={({ pressed }) => [{ width: ancho, alignItems: 'center', gap: 4 }, pressed && { opacity: 0.8 }]}>
            <Avatar usuario={item.usuario} foto={item.foto} tamano={Math.min(ancho - 8, 92)} />
            <Text style={estilos.nombreCreador} numberOfLines={1}>
              {item.nombre ?? arroba(item.usuario)}
            </Text>
            <Text style={estilos.cuenta}>{item.recetas === 1 ? '1 receta' : `${item.recetas} recetas`}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

function BarraSuperior() {
  const router = useRouter();
  return (
    <View style={estilos.barra}>
      <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Volver" style={estilos.atras}>
        <MaterialCommunityIcons name="chevron-left" size={30} color={Colors.light.text} />
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#F7F2EE' },
  barra: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 52 },
  atras: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  cabecera: { gap: 4, paddingHorizontal: 4, paddingBottom: 6 },
  cabeceraCreador: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 },
  titulo: { fontFamily: Tipografia.display, fontSize: 28, lineHeight: 35, color: Colors.light.text },
  cuenta: { fontFamily: Tipografia.media, fontSize: 14, color: Colors.light.textSecondary },
  verPerfil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radios.pildora,
    backgroundColor: Marca.primarioTenue,
  },
  textoVerPerfil: { fontFamily: Tipografia.seminegrita, fontSize: 14, color: Marca.primario },
  nombreCreador: { fontFamily: Tipografia.seminegrita, fontSize: 14, color: Colors.light.text, marginTop: 4 },
  vacio: { alignItems: 'center', paddingVertical: 48 },
  textoVacio: { fontFamily: Tipografia.media, fontSize: 15, color: Colors.light.textSecondary },
});
