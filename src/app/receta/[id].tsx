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

import { PantallaVacia } from '@/components/pantalla-vacia';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { textoIngredienteEscalado } from '@/lib/porciones';
import { useBorrarReceta, useReceta } from '@/lib/recetas';

export default function DetalleReceta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colores = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];

  const { data: receta, isLoading, error } = useReceta(id);
  const borrar = useBorrarReceta();

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
    return (
      <PantallaVacia
        titulo="No encontramos esta receta"
        texto={error instanceof Error ? error.message : 'Puede que la hayas borrado.'}
      />
    );
  }

  const porcionesBase = receta.servings;
  const porcionesActuales = porciones ?? porcionesBase ?? null;
  const escalada = porcionesBase != null && porcionesActuales != null && porcionesActuales !== porcionesBase;
  const tiempo = (receta.prep_minutes ?? 0) + (receta.cook_minutes ?? 0);

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
            <Pressable onPress={confirmarBorrado} hitSlop={12} accessibilityLabel="Borrar receta">
              <MaterialIcons name="delete-outline" size={24} color={colores.text} />
            </Pressable>
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

        {/* Porciones */}
        <View style={[estilos.porciones, { backgroundColor: colores.backgroundElement }]}>
          <ThemedText type="smallBold">Porciones</ThemedText>
          <View style={estilos.contador}>
            <Pressable
              onPress={() => setPorciones(Math.max(1, (porcionesActuales ?? 1) - 1))}
              hitSlop={10}
              accessibilityLabel="Menos porciones"
              style={estilos.paso}>
              <MaterialIcons name="remove" size={22} color={colores.text} />
            </Pressable>
            <ThemedText style={estilos.numero}>{porcionesActuales ?? '—'}</ThemedText>
            <Pressable
              onPress={() => setPorciones((porcionesActuales ?? 1) + 1)}
              hitSlop={10}
              accessibilityLabel="Más porciones"
              style={estilos.paso}>
              <MaterialIcons name="add" size={22} color={colores.text} />
            </Pressable>
          </View>
        </View>

        {escalada ? (
          <ThemedText type="small" style={estilos.ajustado}>
            Cantidades ajustadas de {porcionesBase} a {porcionesActuales} porciones.
          </ThemedText>
        ) : null}

        {/* Ingredientes */}
        <View style={estilos.seccion}>
          <ThemedText type="subtitle">Ingredientes</ThemedText>
          {receta.ingredientes.length === 0 ? (
            <ThemedText style={estilos.tenue}>Esta receta no tiene ingredientes guardados.</ThemedText>
          ) : (
            receta.ingredientes.map((ing) => (
              <View key={ing.id} style={estilos.linea}>
                <ThemedText style={estilos.punto}>•</ThemedText>
                <ThemedText style={estilos.textoLinea}>
                  {textoIngredienteEscalado(ing, porcionesBase, porcionesActuales)}
                </ThemedText>
              </View>
            ))
          )}
        </View>

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
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  contenido: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  meta: { flexDirection: 'row', gap: Spacing.three },
  aviso: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three, borderRadius: 12, alignItems: 'center' },
  avisoTexto: { flex: 1 },
  porciones: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: 12,
  },
  contador: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
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
