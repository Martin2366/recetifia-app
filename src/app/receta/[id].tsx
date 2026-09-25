import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useKeepAwake } from 'expo-keep-awake';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';

import { TarjetaNutricion } from '@/components/nutricion';
import { PantallaVacia } from '@/components/pantalla-vacia';
import { ThemedText } from '@/components/themed-text';
import { Colors, Marca, Spacing } from '@/constants/theme';
import { useCuota } from '@/lib/cuota';
import { textoIngredienteEscalado } from '@/lib/porciones';
import { itemDesdeIngrediente, useAgregarALista } from '@/lib/lista';
import { useBorrarReceta, useReceta } from '@/lib/recetas';

/** Atajos de porciones: lo que la gente piensa ("somos 4"), no un numero suelto. */
const ATAJOS = [
  { personas: 1, texto: 'Solo yo', emoji: '🙋' },
  { personas: 2, texto: 'Pareja', emoji: '👫' },
  { personas: 4, texto: 'Familia', emoji: '👨‍👩‍👧‍👦' },
  { personas: 8, texto: 'Visitas', emoji: '🎉' },
];

export default function DetalleReceta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colores = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];

  const { data: receta, isLoading, error, refetch, isRefetching } = useReceta(id);
  const cuota = useCuota();
  const borrar = useBorrarReceta();
  const agregarALista = useAgregarALista();

  const [porciones, setPorciones] = useState<number | null>(null);
  const [hechos, setHechos] = useState<Set<string>>(new Set());

  // Cocinar con las manos ocupadas y la pantalla apagándose es inutilizable.
  // Se libera sola al salir de esta pantalla.
  useKeepAwake();

  if (isLoading) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !receta) {
    // Sin conexion no es "no existe": se ofrece reintentar en vez de un callejon sin salida
    const noExiste = (error as { code?: string } | null)?.code === 'PGRST116';
    return (
      <PantallaVacia
        titulo={noExiste ? 'No encontramos esta receta' : 'No pudimos abrir la receta'}
        texto={noExiste ? 'Puede que la hayas borrado.' : 'Revisa tu conexión e inténtalo de nuevo.'}>
        {noExiste ? null : (
          <Pressable
            onPress={() => refetch()}
            disabled={isRefetching}
            accessibilityRole="button"
            style={[estilos.reintentar, isRefetching && { opacity: 0.6 }]}>
            <ThemedText style={estilos.textoReintentar}>{isRefetching ? 'Cargando…' : 'Reintentar'}</ThemedText>
          </Pressable>
        )}
      </PantallaVacia>
    );
  }

  const porcionesBase = receta.servings;
  const porcionesActuales = porciones ?? porcionesBase ?? null;
  const escalada = porcionesBase != null && porcionesActuales != null && porcionesActuales !== porcionesBase;
  const tiempo = (receta.prep_minutes ?? 0) + (receta.cook_minutes ?? 0);

  // Con las porciones que se estan viendo: si se duplico la receta, se compra el doble
  async function agregarIngredientesALista() {
    const r = receta!;
    try {
      const { nuevos, sumados } = await agregarALista.mutateAsync(
        r.ingredientes.map((ing) => itemDesdeIngrediente(ing, r.id, porcionesBase ?? null, porcionesActuales))
      );
      const partes = [nuevos ? `${nuevos} nuevos` : '', sumados ? `${sumados} sumados a los que ya tenías` : ''].filter(Boolean);
      Alert.alert('Listo, en tu lista', partes.length ? `Ingredientes: ${partes.join(', ')}.` : 'Ya estaban todos en tu lista.', [
        { text: 'Seguir aquí', style: 'cancel' },
        { text: 'Ver lista', onPress: () => router.push('/lista') },
      ]);
    } catch {
      Alert.alert('No se agregaron', 'Revisa tu conexión e inténtalo de nuevo.');
    }
  }

  function alternarPaso(idPaso: string) {
    setHechos((previos) => {
      const copia = new Set(previos);
      if (copia.has(idPaso)) copia.delete(idPaso);
      else copia.add(idPaso);
      return copia;
    });
  }

  function confirmarBorrado() {
    Alert.alert('Borrar receta', `Se eliminará «${receta!.title}». No se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await borrar.mutateAsync(receta!.id);
            router.back();
          } catch (err) {
            Alert.alert('No pudimos borrarla', err instanceof Error ? err.message : '');
          }
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <View style={estilos.acciones}>
              <Pressable
                onPress={() => router.push({ pathname: '/receta/nueva', params: { id: receta.id } })}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Editar receta">
                <MaterialIcons name="edit" size={23} color={colores.text} />
              </Pressable>
              <Pressable onPress={confirmarBorrado} hitSlop={12} accessibilityRole="button" accessibilityLabel="Borrar receta">
                <MaterialIcons name="delete-outline" size={24} color={colores.text} />
              </Pressable>
            </View>
          ),
        }}
      />

      <ScrollView contentContainerStyle={estilos.contenido}>
        <ThemedText type="title">{receta.title}</ThemedText>

        {receta.status === 'needs_review' ? (
          <View style={[estilos.aviso, { backgroundColor: colores.backgroundElement }]}>
            <MaterialIcons name="info-outline" size={18} color="#B26A00" />
            <ThemedText type="small" style={estilos.avisoTexto}>
              Esta receta quedó incompleta al importarla. Revísala antes de cocinar.
            </ThemedText>
          </View>
        ) : null}

        {tiempo > 0 || receta.source_author ? (
          <View style={estilos.meta}>
            {tiempo > 0 ? (
              <ThemedText type="small" style={{ color: colores.textSecondary }}>
                {tiempo} min
              </ThemedText>
            ) : null}
            {receta.source_author ? (
              <ThemedText type="small" style={{ color: colores.textSecondary }}>
                por {receta.source_author}
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        {/* Porciones: un toque para lo comun, y +/- para lo exacto */}
        {porcionesBase ? (
          <View style={[estilos.porciones, { backgroundColor: colores.backgroundElement }]}>
            <View style={estilos.filaPorciones}>
              <ThemedText type="smallBold">¿Para cuántos cocinas?</ThemedText>
              <View style={estilos.contador}>
                <Pressable
                  onPress={() => setPorciones(Math.max(1, (porcionesActuales ?? 1) - 1))}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Menos porciones"
                  style={estilos.paso}>
                  <MaterialIcons name="remove" size={22} color={colores.text} />
                </Pressable>
                <ThemedText style={estilos.numero}>{porcionesActuales}</ThemedText>
                <Pressable
                  onPress={() => setPorciones((porcionesActuales ?? 1) + 1)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Más porciones"
                  style={estilos.paso}>
                  <MaterialIcons name="add" size={22} color={colores.text} />
                </Pressable>
              </View>
            </View>
            <View style={estilos.atajos}>
              {ATAJOS.map((a) => {
                const activo = porcionesActuales === a.personas;
                return (
                  <Pressable
                    key={a.personas}
                    onPress={() => setPorciones(a.personas)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: activo }}
                    style={[estilos.atajo, activo && estilos.atajoActivo]}>
                    <ThemedText style={[estilos.textoAtajo, activo && estilos.textoAtajoActivo]}>
                      {a.emoji} {a.texto}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            {escalada ? (
              <ThemedText type="small" style={estilos.ajustado}>
                Cantidades ajustadas: la receta original es para {porcionesBase}.
              </ThemedText>
            ) : null}
          </View>
        ) : (
          <View style={[estilos.porciones, { backgroundColor: colores.backgroundElement }]}>
            <ThemedText type="small" style={estilos.tenue}>
              Esta receta no dice para cuántas personas es. Edítala (lápiz de arriba) e indícalo para poder ajustar las
              cantidades.
            </ThemedText>
          </View>
        )}

        {/* Ingredientes */}
        <View style={estilos.seccion}>
          <ThemedText type="subtitle">Ingredientes</ThemedText>
          {receta.ingredientes.length === 0 ? (
            <ThemedText style={estilos.tenue}>Esta receta no tiene ingredientes guardados.</ThemedText>
          ) : (
            receta.ingredientes.map((ing) => (
              <View key={ing.id} style={estilos.linea}>
                {ing.emoji ? <ThemedText>{ing.emoji}</ThemedText> : <ThemedText style={estilos.punto}>•</ThemedText>}
                <ThemedText style={estilos.textoLinea}>
                  {textoIngredienteEscalado(ing, porcionesBase, porcionesActuales)}
                </ThemedText>
              </View>
            ))
          )}
          {receta.ingredientes.length ? (
            <Pressable
              onPress={agregarIngredientesALista}
              disabled={agregarALista.isPending}
              accessibilityRole="button"
              style={({ pressed }) => [estilos.agregarLista, (pressed || agregarALista.isPending) && { opacity: 0.7 }]}>
              {agregarALista.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="add-shopping-cart" size={20} color="#FFFFFF" />
                  <ThemedText style={estilos.textoAgregarLista}>Agregar a la lista de compras</ThemedText>
                </>
              )}
            </Pressable>
          ) : null}
        </View>

        {receta.nutrition?.calorias ? <TarjetaNutricion nutricion={receta.nutrition} bloqueada={!cuota.data?.plus} /> : null}

        {/* Pasos */}
        <View style={estilos.seccion}>
          <ThemedText type="subtitle">Preparación</ThemedText>
          {receta.pasos.length === 0 ? (
            <ThemedText style={estilos.tenue}>
              No hay pasos guardados. Si la importaste, el procedimiento puede estar solo en el vídeo.
            </ThemedText>
          ) : (
            receta.pasos.map((paso, i) => {
              const hecho = hechos.has(paso.id);
              return (
                <Pressable
                  key={paso.id}
                  onPress={() => alternarPaso(paso.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: hecho }}
                  style={[estilos.paso2, { backgroundColor: colores.backgroundElement, opacity: hecho ? 0.45 : 1 }]}>
                  <View style={[estilos.numeroPaso, { backgroundColor: colores.backgroundSelected }]}>
                    <ThemedText type="smallBold">{i + 1}</ThemedText>
                  </View>
                  <ThemedText style={[estilos.textoLinea, hecho && estilos.tachado]}>{paso.text}</ThemedText>
                </Pressable>
              );
            })
          )}
        </View>

        {receta.source_url ? (
          <Pressable
            onPress={() => Linking.openURL(receta.source_url!)}
            accessibilityRole="link"
            style={[estilos.origen, { backgroundColor: colores.backgroundElement }]}>
            <MaterialIcons name="open-in-new" size={18} color={colores.text} />
            <ThemedText>Ver la publicación original</ThemedText>
          </Pressable>
        ) : null}
      </ScrollView>
    </>
  );
}

const estilos = StyleSheet.create({
  acciones: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  agregarLista: {
    marginTop: Spacing.two,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: Marca.primario,
  },
  textoAgregarLista: { color: '#FFFFFF', fontWeight: '600' },
  reintentar: { marginTop: Spacing.three, alignSelf: 'center', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999, backgroundColor: Marca.primario },
  textoReintentar: { color: '#FFFFFF', fontWeight: '600' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  contenido: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  meta: { flexDirection: 'row', gap: Spacing.three },
  aviso: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three, borderRadius: 12, alignItems: 'center' },
  avisoTexto: { flex: 1 },
  porciones: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 12,
  },
  contador: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  filaPorciones: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  atajos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  atajo: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: '#EDE5E0', backgroundColor: '#FFFFFF' },
  atajoActivo: { borderColor: Marca.primario, backgroundColor: Marca.primarioTenue },
  textoAtajo: { fontSize: 14 },
  textoAtajoActivo: { color: Marca.primario, fontWeight: '600' },
  paso: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  numero: { fontSize: 18, fontWeight: '700', minWidth: 28, textAlign: 'center' },
  ajustado: { opacity: 0.7, marginTop: -Spacing.two },
  seccion: { gap: Spacing.two },
  linea: { flexDirection: 'row', gap: Spacing.two },
  punto: { opacity: 0.5 },
  textoLinea: { flex: 1 },
  tachado: { textDecorationLine: 'line-through' },
  paso2: { flexDirection: 'row', gap: Spacing.three, padding: Spacing.three, borderRadius: 12 },
  numeroPaso: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tenue: { opacity: 0.6 },
  origen: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 52,
    borderRadius: 12,
  },
});
