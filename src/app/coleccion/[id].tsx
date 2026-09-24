import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotonOnboarding } from '@/components/onboarding/boton';
import { TarjetaReceta } from '@/components/biblioteca/tarjetas';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import {
  claveColeccion,
  useAgregarRecetasAColeccion,
  useBorrarColeccion,
  useColeccion,
  useQuitarDeColeccion,
  useRenombrarColeccion,
} from '@/lib/colecciones';
import { useAlternarFavorita, useRecetas } from '@/lib/recetas';
import type { Receta } from '@/lib/tipos';

/**
 * Una coleccion por dentro. Quitar una receta de aqui NUNCA la borra de la
 * biblioteca, y borrar la coleccion tampoco: se dice en cada confirmacion.
 */

const FONDO = '#F7F2EE';
const MARGEN = 18;
const SEPARACION = 14;

export default function ColeccionDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const qc = useQueryClient();

  const coleccion = useColeccion(id);
  const quitar = useQuitarDeColeccion();
  const borrar = useBorrarColeccion();
  const favorita = useAlternarFavorita();
  const [eligiendo, setEligiendo] = useState(false);
  const [renombrando, setRenombrando] = useState(false);

  const ancho = (W - MARGEN * 2 - SEPARACION) / 2;
  const datos = coleccion.data;
  const nombre = datos?.coleccion.name ?? '';

  function confirmarQuitar(receta: Receta) {
    Alert.alert(`¿Quitar de «${nombre}»?`, `«${receta.title}» sigue en tu biblioteca. Solo sale de esta colección.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quitar de la colección', onPress: () => quitar.mutate({ coleccionId: id!, recetaId: receta.id }) },
    ]);
  }

  function opciones() {
    Alert.alert(nombre, undefined, [
      { text: 'Cambiar nombre', onPress: () => setRenombrando(true) },
      {
        text: 'Borrar colección',
        style: 'destructive',
        onPress: () =>
          Alert.alert('¿Borrar la colección?', 'Tus recetas no se borran: siguen todas en tu biblioteca.', [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Borrar colección',
              style: 'destructive',
              onPress: async () => {
                try {
                  await borrar.mutateAsync(id!);
                  router.back();
                } catch {
                  Alert.alert('No se borró', 'Revisa tu conexión e inténtalo de nuevo.');
                }
              },
            },
          ]),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  return (
    <View style={[estilos.pantalla, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={estilos.cabecera}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Volver" style={estilos.boton}>
          <MaterialCommunityIcons name="chevron-left" size={30} color={Colors.light.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={estilos.titulo} numberOfLines={1} accessibilityRole="header">
            {nombre}
          </Text>
          {datos ? (
            <Text style={estilos.subtitulo}>
              {datos.recetas.length === 1 ? '1 receta' : `${datos.recetas.length} recetas`}
            </Text>
          ) : null}
        </View>
        {datos ? (
          <Pressable onPress={opciones} hitSlop={12} accessibilityRole="button" accessibilityLabel="Opciones de la colección" style={estilos.boton}>
            <MaterialCommunityIcons name="dots-horizontal" size={26} color={Colors.light.text} />
          </Pressable>
        ) : null}
      </View>

      {coleccion.isLoading ? (
        <View style={estilos.centro}>
          <ActivityIndicator color={Marca.primario} size="large" />
        </View>
      ) : coleccion.error || !datos ? (
        <View style={estilos.centro}>
          <Text style={estilos.tituloVacio}>No pudimos abrir la colección</Text>
          <Text style={estilos.textoVacio}>Revisa tu conexión e inténtalo de nuevo.</Text>
          <BotonOnboarding texto="Reintentar" alPulsar={() => coleccion.refetch()} />
        </View>
      ) : (
        <FlatList
          data={datos.recetas}
          keyExtractor={(r) => r.id}
          numColumns={2}
          columnWrapperStyle={{ gap: SEPARACION }}
          contentContainerStyle={[
            { paddingHorizontal: MARGEN, paddingTop: 8, paddingBottom: insets.bottom + 110, rowGap: 20 },
            !datos.recetas.length && { flexGrow: 1 },
          ]}
          ListHeaderComponent={
            datos.recetas.length ? <Text style={estilos.pista}>Mantén presionada una receta para quitarla de aquí.</Text> : null
          }
          ListEmptyComponent={
            <View style={estilos.centro}>
              <Text style={estilos.emojiVacio}>📂</Text>
              <Text style={estilos.tituloVacio}>Aún no tiene recetas</Text>
              <Text style={estilos.textoVacio}>Agrega las que ya tienes en tu biblioteca. Puedes poner una receta en varias colecciones.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TarjetaReceta
              receta={item}
              ancho={ancho}
              alPulsar={() => router.push({ pathname: '/receta/[id]', params: { id: item.id } })}
              alFavorita={() =>
                favorita.mutate(
                  { id: item.id, favorita: !item.is_favorite },
                  { onSettled: () => qc.invalidateQueries({ queryKey: claveColeccion(id!) }) }
                )
              }
              alMantener={() => confirmarQuitar(item)}
            />
          )}
        />
      )}

      {datos ? (
        <View style={[estilos.pie, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
          <BotonOnboarding texto="Agregar recetas" alPulsar={() => setEligiendo(true)} />
        </View>
      ) : null}

      {datos ? (
        <ElegirRecetas
          visible={eligiendo}
          coleccionId={id!}
          yaEstan={new Set(datos.recetas.map((r) => r.id))}
          alCerrar={() => setEligiendo(false)}
        />
      ) : null}
      {datos ? <Renombrar visible={renombrando} id={id!} actual={nombre} alCerrar={() => setRenombrando(false)} /> : null}
    </View>
  );
}

/** Hoja con la biblioteca para marcar las recetas que entran a la coleccion. */
function ElegirRecetas({
  visible,
  coleccionId,
  yaEstan,
  alCerrar,
}: {
  visible: boolean;
  coleccionId: string;
  yaEstan: Set<string>;
  alCerrar: () => void;
}) {
  const insets = useSafeAreaInsets();
  const recetas = useRecetas('');
  const agregar = useAgregarRecetasAColeccion();
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());

  const disponibles = (recetas.data ?? []).filter((r) => !yaEstan.has(r.id));

  function alternar(id: string) {
    setElegidas((e) => {
      const copia = new Set(e);
      if (copia.has(id)) copia.delete(id);
      else copia.add(id);
      return copia;
    });
  }

  async function confirmar() {
    try {
      await agregar.mutateAsync({ coleccionId, recetaIds: [...elegidas] });
      setElegidas(new Set());
      alCerrar();
    } catch {
      Alert.alert('No se agregaron', 'Revisa tu conexión e inténtalo de nuevo.');
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={alCerrar}>
      <Pressable style={estilos.velo} onPress={alCerrar} accessibilityLabel="Cerrar" />
      <View style={[estilos.hoja, { paddingBottom: insets.bottom + 16 }]}>
        <View style={estilos.asa} />
        <Text style={estilos.tituloHoja}>Agregar recetas</Text>
        {recetas.isLoading ? (
          <ActivityIndicator color={Marca.primario} style={{ marginVertical: 32 }} />
        ) : !disponibles.length ? (
          <Text style={[estilos.textoVacio, { marginVertical: 24 }]}>
            {recetas.data?.length ? 'Todas tus recetas ya están en esta colección.' : 'Todavía no tienes recetas en tu biblioteca.'}
          </Text>
        ) : (
          <FlatList
            data={disponibles}
            keyExtractor={(r) => r.id}
            style={{ maxHeight: 420 }}
            renderItem={({ item }) => {
              const marcada = elegidas.has(item.id);
              return (
                <Pressable
                  onPress={() => alternar(item.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: marcada }}
                  style={({ pressed }) => [estilos.filaReceta, pressed && { backgroundColor: '#FFF7F3' }]}>
                  {item.image_path ? (
                    <Image source={{ uri: item.image_path }} style={estilos.miniatura} contentFit="cover" />
                  ) : (
                    <View style={[estilos.miniatura, estilos.sinFoto]}>
                      <MaterialCommunityIcons name="silverware-fork-knife" size={20} color={Marca.primario} />
                    </View>
                  )}
                  <Text style={estilos.nombreReceta} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <View style={[estilos.casilla, marcada && estilos.casillaMarcada]}>
                    {marcada ? <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" /> : null}
                  </View>
                </Pressable>
              );
            }}
          />
        )}
        {agregar.isPending ? (
          <View style={estilos.cargando}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : (
          <BotonOnboarding
            texto={elegidas.size ? `Agregar ${elegidas.size === 1 ? '1 receta' : `${elegidas.size} recetas`}` : 'Elige recetas'}
            alPulsar={confirmar}
            apagado={!elegidas.size}
          />
        )}
      </View>
    </Modal>
  );
}

function Renombrar({ visible, id, actual, alCerrar }: { visible: boolean; id: string; actual: string; alCerrar: () => void }) {
  const renombrar = useRenombrarColeccion();
  const [nombre, setNombre] = useState(actual);

  async function guardar() {
    try {
      await renombrar.mutateAsync({ id, nombre });
      alCerrar();
    } catch {
      Alert.alert('No se guardó', 'Revisa tu conexión e inténtalo de nuevo.');
    }
  }

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={alCerrar} onShow={() => setNombre(actual)}>
      <KeyboardAvoidingView behavior="padding" style={estilos.centroModal}>
        <Pressable style={StyleSheet.absoluteFill} onPress={alCerrar} accessibilityLabel="Cerrar">
          <View style={[StyleSheet.absoluteFill, estilos.veloOscuro]} />
        </Pressable>
        <View style={estilos.dialogo}>
          <Text style={estilos.tituloHoja}>Cambiar nombre</Text>
          <TextInput
            value={nombre}
            onChangeText={setNombre}
            autoFocus
            maxLength={40}
            style={estilos.campo}
            returnKeyType="done"
            onSubmitEditing={() => nombre.trim() && guardar()}
            accessibilityLabel="Nombre de la colección"
          />
          <BotonOnboarding texto="Guardar" alPulsar={guardar} apagado={!nombre.trim() || renombrar.isPending} />
          <Pressable onPress={alCerrar} style={estilos.cancelar} accessibilityRole="button">
            <Text style={estilos.textoCancelar}>Cancelar</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: FONDO },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 10 },
  boton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: Tipografia.display, fontSize: 26, color: Colors.light.text },
  subtitulo: { fontFamily: Tipografia.media, fontSize: 14, color: Colors.light.textSecondary },
  pista: { fontFamily: Tipografia.regular, fontSize: 13, color: Colors.light.textTenue, marginBottom: 4 },

  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 28, paddingBottom: 80 },
  emojiVacio: { fontSize: 48 },
  tituloVacio: { fontFamily: Tipografia.display, fontSize: 23, textAlign: 'center', color: Colors.light.text },
  textoVacio: { fontFamily: Tipografia.regular, fontSize: 15, lineHeight: 22, textAlign: 'center', color: Colors.light.textSecondary },
  pie: { position: 'absolute', left: 20, right: 20, bottom: 0 },

  velo: { flex: 1, backgroundColor: 'rgba(26, 15, 10, 0.45)' },
  veloOscuro: { backgroundColor: 'rgba(26, 15, 10, 0.45)' },
  hoja: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 18, gap: 12 },
  asa: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: '#DDD6D2', marginTop: 10 },
  tituloHoja: { fontFamily: Tipografia.display, fontSize: 22, textAlign: 'center', color: Colors.light.text },
  filaReceta: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 14 },
  miniatura: { width: 52, height: 52, borderRadius: 12 },
  sinFoto: { backgroundColor: Marca.primarioTenue, alignItems: 'center', justifyContent: 'center' },
  nombreReceta: { flex: 1, fontFamily: Tipografia.media, fontSize: 16, color: Colors.light.text },
  casilla: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#D9CFC9', alignItems: 'center', justifyContent: 'center' },
  casillaMarcada: { backgroundColor: Marca.primario, borderColor: Marca.primario },
  cargando: { minHeight: 56, borderRadius: Radios.pildora, backgroundColor: Marca.primario, alignItems: 'center', justifyContent: 'center' },

  centroModal: { flex: 1, justifyContent: 'center', padding: 24 },
  dialogo: { backgroundColor: '#FFFFFF', borderRadius: Radios.grande, padding: 20, gap: 14 },
  campo: {
    minHeight: 54,
    borderRadius: Radios.grande - 4,
    borderWidth: 1.5,
    borderColor: Colors.light.borde,
    paddingHorizontal: 16,
    fontFamily: Tipografia.media,
    fontSize: 17,
    color: Colors.light.text,
  },
  cancelar: { alignSelf: 'center', padding: 6 },
  textoCancelar: { fontFamily: Tipografia.seminegrita, fontSize: 15, color: Colors.light.textSecondary },
});
