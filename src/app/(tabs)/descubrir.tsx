import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, BotonGuardar, Detalle, Foto, LineaCreador } from '@/components/descubrir/piezas';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { arroba, ETIQUETAS, useDescubrirInicio, type Creador, type TarjetaDescubrir } from '@/lib/descubrir';

/**
 * Descubrir: recetas de creadores de redes, curadas e importadas con nuestro
 * motor. Guardarlas no gasta importaciones. El buscador abre /descubrir/buscar.
 */

const FONDO = '#F7F2EE';
const MARGEN = 16;

export default function Descubrir() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: W } = useWindowDimensions();
  const inicio = useDescubrirInicio();

  // Dos filas de chips que se deslizan juntas
  const filas = [ETIQUETAS.filter((_, i) => i % 2 === 0), ETIQUETAS.filter((_, i) => i % 2 === 1)];

  return (
    <View style={[estilos.pantalla, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 130 }}
        refreshControl={<RefreshControl refreshing={inicio.isRefetching} onRefresh={inicio.refetch} colors={[Marca.primario]} />}>
        <Text style={estilos.titulo} accessibilityRole="header">
          Descubrir
        </Text>

        <Pressable
          onPress={() => router.push('/descubrir/buscar')}
          accessibilityRole="search"
          accessibilityLabel="Buscar recetas"
          style={({ pressed }) => [estilos.buscador, pressed && { opacity: 0.85 }]}>
          <MaterialCommunityIcons name="magnify" size={24} color={Colors.light.textSecondary} />
          <Text style={estilos.textoBuscador}>¿Qué te gustaría cocinar?</Text>
        </Pressable>

        <Text style={estilos.subtitulo}>Búsquedas populares</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.chips}>
          <View style={{ gap: 10 }}>
            {filas.map((fila, i) => (
              <View key={i} style={estilos.filaChips}>
                {fila.map((e) => (
                  <Pressable
                    key={e.id}
                    onPress={() => router.push({ pathname: '/descubrir/lista', params: { tipo: 'etiqueta', valor: e.id } })}
                    accessibilityRole="button"
                    style={({ pressed }) => [estilos.chip, pressed && estilos.chipPresionado]}>
                    <Text style={estilos.emojiChip}>{e.emoji}</Text>
                    <Text style={estilos.textoChip}>{e.nombre}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>

        {inicio.isLoading ? (
          <Esqueleto ancho={W} />
        ) : inicio.error ? (
          <View style={estilos.aviso}>
            <Text style={estilos.tituloAviso}>No pudimos cargar Descubrir</Text>
            <Text style={estilos.textoAviso}>Revisa tu conexión e inténtalo de nuevo.</Text>
            <Pressable onPress={() => inicio.refetch()} style={estilos.boton} accessibilityRole="button">
              <Text style={estilos.textoBoton}>Reintentar</Text>
            </Pressable>
          </View>
        ) : !inicio.data?.del_dia ? (
          <View style={estilos.aviso}>
            <Text style={estilos.emoji}>🍳</Text>
            <Text style={estilos.tituloAviso}>Estamos preparando recetas</Text>
            <Text style={estilos.textoAviso}>Muy pronto vas a ver aquí lo que se cocina en redes.</Text>
          </View>
        ) : (
          <>
            <RecetaDelDia tarjeta={inicio.data.del_dia} ancho={W - MARGEN * 2} />

            <Cabecera titulo="Más populares esta semana" alVerTodo={() => router.push({ pathname: '/descubrir/lista', params: { tipo: 'populares' } })} />
            <FlatList
              horizontal
              data={inicio.data.populares}
              keyExtractor={(t) => t.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: MARGEN, gap: 14 }}
              renderItem={({ item, index }) => <TarjetaPopular tarjeta={item} puesto={index + 1} ancho={Math.min(W * 0.6, 260)} />}
            />

            {inicio.data.creadores.length ? (
              <>
                <Cabecera titulo="Creadores en tendencia" alVerTodo={() => router.push({ pathname: '/descubrir/lista', params: { tipo: 'creadores' } })} />
                <FlatList
                  horizontal
                  data={inicio.data.creadores}
                  keyExtractor={(c) => c.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: MARGEN, gap: 16 }}
                  renderItem={({ item }) => <TarjetaCreador creador={item} />}
                />
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** Titulo de seccion con "Ver todo" a la derecha, en la misma linea. */
function Cabecera({ titulo, alVerTodo }: { titulo: string; alVerTodo: () => void }) {
  return (
    <View style={estilos.cabecera}>
      <Text style={estilos.tituloSeccion} numberOfLines={2}>
        {titulo}
      </Text>
      <Pressable onPress={alVerTodo} hitSlop={10} accessibilityRole="button" style={estilos.verTodo}>
        <Text style={estilos.textoVerTodo}>Ver todo</Text>
        <MaterialCommunityIcons name="chevron-right" size={18} color={Marca.primario} />
      </Pressable>
    </View>
  );
}

/** Foto a todo el ancho con el titulo encima, sobre un degradado. */
function RecetaDelDia({ tarjeta, ancho }: { tarjeta: TarjetaDescubrir; ancho: number }) {
  const router = useRouter();
  const alto = ancho * 1.05;
  return (
    <View style={[estilos.delDia, { width: ancho, height: alto }]}>
      <Pressable
        onPress={() => router.push({ pathname: '/descubrir/[id]', params: { id: tarjeta.id } })}
        accessibilityRole="button"
        accessibilityLabel={`Receta del día: ${tarjeta.titulo}`}
        style={StyleSheet.absoluteFill}>
        <Foto uri={tarjeta.foto} estilo={{ width: ancho, height: alto, borderRadius: 20 }} />
        <Degradado alto={alto * 0.55} />
        <View style={estilos.etiquetaDelDia}>
          <Text style={estilos.textoEtiquetaDelDia}>✨ Receta del día</Text>
        </View>
        <View style={estilos.pieDelDia}>
          <Text style={estilos.tituloDelDia} numberOfLines={2}>
            {tarjeta.titulo}
          </Text>
          <LineaCreador tarjeta={tarjeta} claro />
          {tarjeta.descripcion ? (
            <Text style={estilos.descripcionDelDia} numberOfLines={2}>
              {tarjeta.descripcion}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <BotonGuardar tarjeta={tarjeta} estilo={estilos.marcadorDelDia} />
    </View>
  );
}

/**
 * Sin expo-linear-gradient (seria otro modulo nativo y otro build): franjas
 * apiladas de negro cada vez mas opaco hacen un degradado suave.
 */
function Degradado({ alto }: { alto: number }) {
  const pasos = 12;
  return (
    <View pointerEvents="none" style={[estilos.degradado, { height: alto }]}>
      {Array.from({ length: pasos }, (_, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: `rgba(20,12,8,${((i + 1) / pasos) ** 1.6 * 0.78})` }} />
      ))}
    </View>
  );
}

function TarjetaPopular({ tarjeta, puesto, ancho }: { tarjeta: TarjetaDescubrir; puesto: number; ancho: number }) {
  const router = useRouter();
  const alto = ancho * 1.2;
  return (
    <View style={{ width: ancho }}>
      <Pressable
        onPress={() => router.push({ pathname: '/descubrir/[id]', params: { id: tarjeta.id } })}
        accessibilityRole="button"
        accessibilityLabel={`${puesto}. ${tarjeta.titulo}`}
        style={({ pressed }) => [{ gap: 6 }, pressed && { opacity: 0.85 }]}>
        <View>
          <Foto uri={tarjeta.foto} estilo={{ width: ancho, height: alto }} />
          <Degradado alto={alto * 0.4} />
          <Text style={estilos.puesto}>{puesto}</Text>
        </View>
        <LineaCreador tarjeta={tarjeta} />
        <Text style={estilos.tituloPopular} numberOfLines={2}>
          {tarjeta.titulo}
        </Text>
        <Detalle tarjeta={tarjeta} />
      </Pressable>
      <BotonGuardar tarjeta={tarjeta} estilo={estilos.marcadorEsquina} />
    </View>
  );
}

function TarjetaCreador({ creador }: { creador: Creador }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/descubrir/lista', params: { tipo: 'creador', valor: creador.id } })}
      accessibilityRole="button"
      accessibilityLabel={arroba(creador.usuario)}
      style={({ pressed }) => [estilos.creador, pressed && { opacity: 0.8 }]}>
      <Avatar usuario={creador.usuario} foto={creador.foto} tamano={76} />
      <Text style={estilos.nombreCreador} numberOfLines={1}>
        {creador.nombre ?? arroba(creador.usuario)}
      </Text>
      <Text style={estilos.recetasCreador}>
        {creador.recetas} {creador.recetas === 1 ? 'receta' : 'recetas'}
      </Text>
    </Pressable>
  );
}

function Esqueleto({ ancho }: { ancho: number }) {
  return (
    <View style={{ paddingHorizontal: MARGEN, gap: 14, marginTop: 24 }}>
      <View style={[estilos.bloque, { height: (ancho - MARGEN * 2) * 1.05 }]}>
        <ActivityIndicator color={Marca.primario} />
      </View>
      <View style={[estilos.bloque, { height: 24, width: '60%' }]} />
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: FONDO },
  titulo: { fontFamily: Tipografia.display, fontSize: 30, color: Colors.light.text, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },

  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: MARGEN,
    minHeight: 54,
    paddingHorizontal: 18,
    borderRadius: Radios.pildora,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE5E0',
  },
  textoBuscador: { fontFamily: Tipografia.media, fontSize: 16, color: Colors.light.textTenue },

  subtitulo: { fontFamily: Tipografia.seminegrita, fontSize: 15, color: Colors.light.textSecondary, paddingHorizontal: 20, marginTop: 22, marginBottom: 10 },
  chips: { paddingHorizontal: MARGEN },
  filaChips: { flexDirection: 'row', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radios.pildora,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE5E0',
  },
  chipPresionado: { backgroundColor: Marca.primarioTenue, borderColor: '#FBD9C9' },
  emojiChip: { fontSize: 16 },
  textoChip: { fontFamily: Tipografia.seminegrita, fontSize: 15, color: Colors.light.text },

  delDia: { marginHorizontal: MARGEN, marginTop: 24, borderRadius: 20, overflow: 'hidden' },
  degradado: { position: 'absolute', left: 0, right: 0, bottom: 0, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, overflow: 'hidden' },
  etiquetaDelDia: {
    position: 'absolute',
    top: 14,
    left: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radios.pildora,
    backgroundColor: '#FFFFFF',
  },
  textoEtiquetaDelDia: { fontFamily: Tipografia.tituloTour, fontSize: 15, color: Marca.primario },
  pieDelDia: { position: 'absolute', left: 18, right: 18, bottom: 18, gap: 8 },
  tituloDelDia: { fontFamily: Tipografia.display, fontSize: 27, lineHeight: 33, color: '#FFFFFF' },
  descripcionDelDia: { fontFamily: Tipografia.regular, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.88)' },
  marcadorDelDia: { position: 'absolute', top: 12, right: 12 },

  cabecera: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: 20, marginTop: 30, marginBottom: 14 },
  tituloSeccion: { flex: 1, fontFamily: Tipografia.display, fontSize: 22, lineHeight: 28, color: Colors.light.text },
  // Abajo, a la altura de la ultima linea del titulo si este ocupa dos
  verTodo: { flexDirection: 'row', alignItems: 'center', paddingBottom: 3 },
  textoVerTodo: { fontFamily: Tipografia.seminegrita, fontSize: 15, color: Marca.primario },

  puesto: {
    position: 'absolute',
    left: 12,
    bottom: 2,
    fontFamily: Tipografia.tituloTour,
    fontSize: 56,
    lineHeight: 64,
    color: '#FFFFFF',
  },
  tituloPopular: { fontFamily: Tipografia.seminegrita, fontSize: 16, lineHeight: 21, color: Colors.light.text },
  marcadorEsquina: { position: 'absolute', top: 10, right: 10 },

  creador: { width: 88, alignItems: 'center', gap: 4 },
  nombreCreador: { maxWidth: 88, fontFamily: Tipografia.seminegrita, fontSize: 14, color: Colors.light.text, marginTop: 4 },
  recetasCreador: { fontFamily: Tipografia.regular, fontSize: 13, color: Colors.light.textSecondary },

  aviso: { alignItems: 'center', gap: 8, paddingHorizontal: 32, paddingVertical: 48 },
  emoji: { fontSize: 48 },
  tituloAviso: { fontFamily: Tipografia.display, fontSize: 22, textAlign: 'center', color: Colors.light.text },
  textoAviso: { fontFamily: Tipografia.regular, fontSize: 15, lineHeight: 22, textAlign: 'center', color: Colors.light.textSecondary },
  boton: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: Radios.pildora, backgroundColor: Marca.primario },
  textoBoton: { fontFamily: Tipografia.seminegrita, fontSize: 16, color: '#FFFFFF' },
  bloque: { borderRadius: 20, backgroundColor: '#EFE7E2', alignItems: 'center', justifyContent: 'center' },
});
