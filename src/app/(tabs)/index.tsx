import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

import { PantallaVacia } from '@/components/pantalla-vacia';
import { TarjetaReceta } from '@/components/tarjeta-receta';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useAlternarFavorita, useRecetas } from '@/lib/recetas';

export default function Biblioteca() {
  const [busqueda, setBusqueda] = useState('');
  const [soloFavoritas, setSoloFavoritas] = useState(false);
  const router = useRouter();
  const colores = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];

  const { data, isLoading, isRefetching, refetch, error } = useRecetas(busqueda);
  const alternarFavorita = useAlternarFavorita();

  const recetas = (data ?? []).filter((r) => !soloFavoritas || r.is_favorite);
  const buscando = busqueda.trim().length > 0;

  return (
    <View style={estilos.pantalla}>
      <View style={estilos.controles}>
        <View style={[estilos.buscador, { backgroundColor: colores.backgroundElement }]}>
          <MaterialIcons name="search" size={20} color={colores.textSecondary} />
          <TextInput
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar por nombre o ingrediente"
            placeholderTextColor={colores.textSecondary}
            style={[estilos.input, { color: colores.text }]}
            returnKeyType="search"
            accessibilityLabel="Buscar recetas"
          />
          {buscando ? (
            <Pressable onPress={() => setBusqueda('')} hitSlop={10} accessibilityLabel="Borrar búsqueda">
              <MaterialIcons name="close" size={20} color={colores.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          onPress={() => setSoloFavoritas((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: soloFavoritas }}
          accessibilityLabel="Ver solo favoritas"
          style={[
            estilos.filtro,
            { backgroundColor: soloFavoritas ? colores.backgroundSelected : colores.backgroundElement },
          ]}>
          <MaterialIcons
            name={soloFavoritas ? 'favorite' : 'favorite-border'}
            size={20}
            color={soloFavoritas ? '#E0245E' : colores.textSecondary}
          />
        </Pressable>
      </View>

      {error ? (
        <PantallaVacia
          titulo="No pudimos cargar tus recetas"
          texto={error instanceof Error ? error.message : 'Revisa tu conexión e inténtalo de nuevo.'}
        />
      ) : isLoading ? (
        <View style={estilos.centro}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={recetas}
          keyExtractor={(r) => r.id}
          contentContainerStyle={
            recetas.length ? estilos.lista : estilos.listaVacia
          }
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TarjetaReceta
              receta={item}
              onPress={() => router.push({ pathname: '/receta/[id]', params: { id: item.id } })}
              onFavorita={() => alternarFavorita.mutate({ id: item.id, favorita: !item.is_favorite })}
            />
          )}
          ListEmptyComponent={
            buscando ? (
              <PantallaVacia
                titulo="Sin resultados"
                texto={`No encontramos nada para "${busqueda.trim()}". Prueba con un ingrediente.`}
              />
            ) : soloFavoritas ? (
              <PantallaVacia
                titulo="Aún no tienes favoritas"
                texto="Toca el corazón de una receta para tenerla siempre a mano."
              />
            ) : (
              <PantallaVacia
                titulo="Tu biblioteca está vacía"
                texto="Crea tu primera receta con el botón de abajo. Pronto podrás importarlas desde Instagram y TikTok."
              />
            )
          }
        />
      )}

      <Pressable
        onPress={() => router.push('/receta/nueva')}
        accessibilityRole="button"
        accessibilityLabel="Crear receta"
        style={({ pressed }) => [
          estilos.boton,
          { backgroundColor: colores.text, opacity: pressed ? 0.8 : 1 },
        ]}>
        <MaterialIcons name="add" size={26} color={colores.background} />
        <ThemedText style={{ color: colores.background, fontWeight: '600' }}>Nueva receta</ThemedText>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  controles: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three },
  buscador: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
    minHeight: 48,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: Spacing.two },
  filtro: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lista: { paddingHorizontal: Spacing.three, paddingBottom: 96, gap: Spacing.two },
  listaVacia: { flexGrow: 1 },
  boton: {
    position: 'absolute',
    right: Spacing.three,
    bottom: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
    minHeight: 52,
    borderRadius: 26,
    elevation: 4,
  },
});
