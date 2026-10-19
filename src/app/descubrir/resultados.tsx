import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HojaFiltro } from '@/components/descubrir/hoja-filtro';
import { TarjetaRejilla } from '@/components/descubrir/piezas';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { useDescubrirBuscar } from '@/lib/descubrir';
import { CATEGORIAS, opcionDe, partir, type Categoria } from '@/lib/filtros';
import { ANCHO_MAXIMO, useAncho } from '@/hooks/use-ancho';

/**
 * Resultados de Descubrir: texto y filtros juntos. Arriba, una pildora por
 * categoria (las activas en naranja, con cuantas tienen) y debajo cada filtro
 * elegido, que se quita con su ×.
 */

const MARGEN = 16;
const SEPARACION = 14;

export default function Resultados() {
  const params = useLocalSearchParams<{ q?: string; f?: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { ancho: W } = useAncho();
  const [escrito, setEscrito] = useState(params.q ?? '');
  const [texto, setTexto] = useState(params.q ?? '');
  const [filtros, setFiltros] = useState<string[]>(params.f ? params.f.split(',').filter(Boolean) : []);
  const [hoja, setHoja] = useState<Categoria | null>(null);
  const resultados = useDescubrirBuscar(texto, filtros);
  const ancho = (W - MARGEN * 2 - SEPARACION) / 2;
  const n = resultados.data?.length ?? 0;
  const cuantos = (c: Categoria) => filtros.filter((f) => partir(f).categoria === c.id).length;

  return (
    <View style={[estilos.pantalla, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={estilos.barra}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Volver" style={estilos.atras}>
          <MaterialCommunityIcons name="chevron-left" size={30} color={Colors.light.text} />
        </Pressable>
        <View style={estilos.campo}>
          <MaterialCommunityIcons name="magnify" size={22} color={Colors.light.textSecondary} />
          <TextInput
            value={escrito}
            onChangeText={setEscrito}
            onSubmitEditing={() => setTexto(escrito)}
            placeholder="¿Qué te gustaría cocinar?"
            placeholderTextColor={Colors.light.textTenue}
            style={estilos.entrada}
            returnKeyType="search"
            accessibilityLabel="Buscar recetas"
          />
          {escrito ? (
            <Pressable
              onPress={() => {
                setEscrito('');
                setTexto('');
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Borrar">
              <MaterialCommunityIcons name="close-circle" size={20} color={Colors.light.textTenue} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.categorias}>
          {CATEGORIAS.map((c) => {
            const k = cuantos(c);
            return (
              <Pressable
                key={c.id}
                onPress={() => setHoja(c)}
                accessibilityRole="button"
                style={[estilos.categoria, k > 0 && estilos.categoriaActiva]}>
                <Text style={estilos.emojiCategoria}>{c.emoji}</Text>
                <Text style={[estilos.textoCategoria, k > 0 && { color: '#FFFFFF' }]}>{c.nombre}</Text>
                {k > 0 ? (
                  <View style={estilos.cuantos}>
                    <Text style={estilos.textoCuantos}>{k}</Text>
                  </View>
                ) : (
                  <MaterialCommunityIcons name="chevron-down" size={18} color={Colors.light.textSecondary} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {filtros.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.activos}>
            {filtros.map((f) => {
              const o = opcionDe(f);
              if (!o) return null;
              return (
                <Pressable
                  key={f}
                  onPress={() => setFiltros((l) => l.filter((x) => x !== f))}
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar ${o.nombre}`}
                  style={estilos.activo}>
                  <Text style={estilos.textoActivo}>
                    {o.emoji} {o.nombre}
                  </Text>
                  <MaterialCommunityIcons name="close" size={15} color={Marca.primario} />
                </Pressable>
              );
            })}
            <Pressable onPress={() => setFiltros([])} accessibilityRole="button" style={estilos.quitarTodo}>
              <Text style={estilos.textoQuitarTodo}>Quitar todo</Text>
            </Pressable>
          </ScrollView>
        ) : null}
      </View>

      <FlatList

        style={{ width: '100%', maxWidth: ANCHO_MAXIMO, alignSelf: 'center' }}
        data={resultados.data ?? []}
        keyExtractor={(t) => t.id}
        initialNumToRender={6}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        numColumns={2}
        columnWrapperStyle={{ gap: SEPARACION }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: MARGEN, gap: 22, paddingTop: 8, paddingBottom: insets.bottom + 32 }}
        ListHeaderComponent={
          resultados.data ? (
            <Text style={estilos.cuenta}>
              {n === 1 ? '1 receta' : `${n} recetas`}
              {resultados.isFetching ? '…' : ''}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          resultados.isLoading ? (
            <ActivityIndicator color={Marca.primario} style={{ marginTop: 40 }} />
          ) : resultados.error ? (
            <Pressable onPress={() => resultados.refetch()} style={estilos.vacio} accessibilityRole="button">
              <Text style={estilos.textoVacio}>No pudimos buscar. Toca para reintentar.</Text>
            </Pressable>
          ) : (
            <View style={estilos.vacio}>
              <Text style={estilos.emojiVacio}>🔍</Text>
              <Text style={estilos.tituloVacio}>Nada por aquí</Text>
              <Text style={estilos.textoVacio}>Prueba con menos filtros o con otra palabra.</Text>
            </View>
          )
        }
        renderItem={({ item }) => <TarjetaRejilla tarjeta={item} ancho={ancho} />}
      />

      <HojaFiltro
        categoria={hoja}
        filtros={filtros}
        texto={texto}
        alCerrar={() => setHoja(null)}
        alAplicar={(f) => {
          setFiltros(f);
          setHoja(null);
        }}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#F7F2EE' },
  barra: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 10 },
  atras: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  campo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 50,
    marginRight: 8,
    paddingHorizontal: 14,
    borderRadius: Radios.pildora,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE5E0',
  },
  entrada: { flex: 1, fontFamily: Tipografia.media, fontSize: 16, color: Colors.light.text, paddingVertical: 8 },

  categorias: { gap: 8, paddingHorizontal: MARGEN, paddingVertical: 4 },
  categoria: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 8,
    borderRadius: Radios.pildora,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE5E0',
  },
  categoriaActiva: { backgroundColor: Marca.primario, borderColor: Marca.primario },
  emojiCategoria: { fontSize: 15 },
  textoCategoria: { fontFamily: Tipografia.seminegrita, fontSize: 14, color: Colors.light.text },
  cuantos: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  textoCuantos: { fontFamily: Tipografia.negrita, fontSize: 12, color: Marca.primarioTexto },

  activos: { gap: 8, paddingHorizontal: MARGEN, paddingTop: 10, paddingBottom: 4, alignItems: 'center' },
  activo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radios.pildora,
    backgroundColor: Marca.primarioTenue,
  },
  textoActivo: { fontFamily: Tipografia.media, fontSize: 13, color: Colors.light.text },
  quitarTodo: { paddingHorizontal: 8, paddingVertical: 6 },
  textoQuitarTodo: { fontFamily: Tipografia.seminegrita, fontSize: 13, color: Colors.light.textSecondary },

  cuenta: { fontFamily: Tipografia.media, fontSize: 14, color: Colors.light.textSecondary, paddingHorizontal: 4, marginTop: 6 },
  vacio: { alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 24 },
  emojiVacio: { fontSize: 44 },
  tituloVacio: { fontFamily: Tipografia.display, fontSize: 22, color: Colors.light.text },
  textoVacio: { fontFamily: Tipografia.media, fontSize: 15, textAlign: 'center', color: Colors.light.textSecondary },
});
