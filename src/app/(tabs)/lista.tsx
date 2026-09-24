import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { itemAMano, textoItem, useAgregarALista, useBorrarDeLista, useLista, useMarcarItem, type ItemLista } from '@/lib/lista';
import { PASILLOS } from '@/lib/pasillos';

/**
 * Lista de compras, ordenada por pasillo del supermercado. Se llena desde las
 * recetas ("Agregar a la lista") o a mano. Lo marcado baja a "En el carro".
 */

const FONDO = '#F7F2EE';

export default function Lista() {
  const insets = useSafeAreaInsets();
  const lista = useLista();
  const agregar = useAgregarALista();
  const marcar = useMarcarItem();
  const borrar = useBorrarDeLista();
  const [texto, setTexto] = useState('');

  const items = lista.data ?? [];
  const pendientes = items.filter((i) => !i.is_checked);
  const enCarro = items.filter((i) => i.is_checked);

  const secciones = useMemo(
    () =>
      PASILLOS.map((p) => ({ ...p, items: pendientes.filter((i) => (i.aisle ?? 'otros') === p.id) })).filter((s) => s.items.length),
    [pendientes]
  );

  async function agregarAMano() {
    const t = texto.trim();
    if (!t) return;
    setTexto('');
    try {
      await agregar.mutateAsync([itemAMano(t)]);
    } catch {
      setTexto(t);
      Alert.alert('No se agregó', 'Revisa tu conexión e inténtalo de nuevo.');
    }
  }

  function vaciar() {
    Alert.alert('¿Vaciar la lista?', 'Se quitan todos los productos, también los marcados.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Vaciar', style: 'destructive', onPress: () => borrar.mutate(items.map((i) => i.id)) },
    ]);
  }

  return (
    <View style={[estilos.pantalla, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={estilos.cabecera}>
        <Text style={estilos.titulo} accessibilityRole="header">
          Lista de compras
        </Text>
        {items.length ? (
          <Pressable onPress={vaciar} hitSlop={10} accessibilityRole="button">
            <Text style={estilos.vaciar}>Vaciar</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={estilos.entrada}>
        <TextInput
          value={texto}
          onChangeText={setTexto}
          placeholder="Agregar algo: pan, detergente…"
          placeholderTextColor={Colors.light.textTenue}
          style={estilos.campo}
          returnKeyType="done"
          onSubmitEditing={agregarAMano}
          submitBehavior="submit"
          accessibilityLabel="Agregar a la lista"
        />
        <Pressable
          onPress={agregarAMano}
          disabled={!texto.trim()}
          accessibilityRole="button"
          accessibilityLabel="Agregar"
          style={[estilos.mas, !texto.trim() && { opacity: 0.4 }]}>
          <MaterialCommunityIcons name="plus" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      {lista.isLoading ? (
        <View style={estilos.centro}>
          <ActivityIndicator color={Marca.primario} size="large" />
        </View>
      ) : lista.error ? (
        <View style={estilos.centro}>
          <Text style={estilos.tituloVacio}>No pudimos cargar tu lista</Text>
          <Text style={estilos.textoVacio}>Revisa tu conexión e inténtalo de nuevo.</Text>
          <Pressable onPress={() => lista.refetch()} style={estilos.boton} accessibilityRole="button">
            <Text style={estilos.textoBoton}>Reintentar</Text>
          </Pressable>
        </View>
      ) : !items.length ? (
        <View style={estilos.centro}>
          <Text style={estilos.emojiVacio}>🛒</Text>
          <Text style={estilos.tituloVacio}>Tu lista está vacía</Text>
          <Text style={estilos.textoVacio}>
            Abre una receta y toca «Agregar a la lista»: sus ingredientes llegan aquí, ordenados por pasillo. También puedes
            escribir lo que quieras arriba.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[estilos.contenido, { paddingBottom: insets.bottom + 130 }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={lista.isRefetching} onRefresh={lista.refetch} colors={[Marca.primario]} />}>
          {secciones.map((s) => (
            <View key={s.id} style={estilos.seccion}>
              <Text style={estilos.tituloSeccion}>
                {s.emoji}  {s.nombre}
              </Text>
              <View style={estilos.tarjeta}>
                {s.items.map((item, i) => (
                  <Fila key={item.id} item={item} primera={i === 0} alMarcar={() => marcar.mutate({ id: item.id, marcado: true })} />
                ))}
              </View>
            </View>
          ))}

          {enCarro.length ? (
            <View style={estilos.seccion}>
              <View style={estilos.filaCarro}>
                <Text style={estilos.tituloSeccion}>✅  En el carro ({enCarro.length})</Text>
                <Pressable onPress={() => borrar.mutate(enCarro.map((i) => i.id))} hitSlop={8} accessibilityRole="button">
                  <Text style={estilos.quitar}>Quitar</Text>
                </Pressable>
              </View>
              <View style={[estilos.tarjeta, estilos.tarjetaCarro]}>
                {enCarro.map((item, i) => (
                  <Fila key={item.id} item={item} primera={i === 0} alMarcar={() => marcar.mutate({ id: item.id, marcado: false })} />
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function Fila({ item, primera, alMarcar }: { item: ItemLista; primera: boolean; alMarcar: () => void }) {
  const marcado = item.is_checked;
  return (
    <Pressable
      onPress={alMarcar}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcado }}
      style={({ pressed }) => [estilos.fila, !primera && estilos.filaBorde, pressed && { backgroundColor: '#FFF7F3' }]}>
      <View style={[estilos.casilla, marcado && estilos.casillaMarcada]}>
        {marcado ? <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" /> : null}
      </View>
      <Text style={[estilos.textoFila, marcado && estilos.textoMarcado]}>{textoItem(item)}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: FONDO },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  titulo: { fontFamily: Tipografia.display, fontSize: 30, color: Colors.light.text },
  vaciar: { fontFamily: Tipografia.seminegrita, fontSize: 15, color: Colors.light.textSecondary },

  entrada: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 12 },
  campo: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: 16,
    borderRadius: Radios.pildora,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE5E0',
    fontFamily: Tipografia.media,
    fontSize: 16,
    color: Colors.light.text,
  },
  mas: { width: 50, height: 50, borderRadius: 25, backgroundColor: Marca.primario, alignItems: 'center', justifyContent: 'center' },

  contenido: { paddingHorizontal: 20, gap: 18 },
  seccion: { gap: 8 },
  tituloSeccion: { fontFamily: Tipografia.seminegrita, fontSize: 14, color: Colors.light.textSecondary, marginLeft: 4 },
  tarjeta: { backgroundColor: '#FFFFFF', borderRadius: Radios.grande - 4, borderWidth: 1, borderColor: '#EDE5E0', overflow: 'hidden' },
  tarjetaCarro: { opacity: 0.75 },
  filaCarro: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quitar: { fontFamily: Tipografia.seminegrita, fontSize: 14, color: Marca.primario, marginRight: 4 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52, paddingHorizontal: 16, paddingVertical: 10 },
  filaBorde: { borderTopWidth: 1, borderTopColor: '#F1ECE9' },
  casilla: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#D9CFC9', alignItems: 'center', justifyContent: 'center' },
  casillaMarcada: { backgroundColor: Marca.exito, borderColor: Marca.exito },
  textoFila: { flex: 1, fontFamily: Tipografia.regular, fontSize: 16, lineHeight: 22, color: Colors.light.text },
  textoMarcado: { textDecorationLine: 'line-through', color: Colors.light.textTenue },

  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32, paddingBottom: 120 },
  emojiVacio: { fontSize: 52 },
  tituloVacio: { fontFamily: Tipografia.display, fontSize: 24, textAlign: 'center', color: Colors.light.text },
  textoVacio: { fontFamily: Tipografia.regular, fontSize: 15, lineHeight: 22, textAlign: 'center', color: Colors.light.textSecondary },
  boton: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: Radios.pildora, backgroundColor: Marca.primario },
  textoBoton: { fontFamily: Tipografia.seminegrita, fontSize: 16, color: '#FFFFFF' },
});
