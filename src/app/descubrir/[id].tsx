import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Foto, LineaCreador } from '@/components/descubrir/piezas';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { etiqueta, useGuardarDeDescubrir, useRecetaDescubrir, useYaGuardada } from '@/lib/descubrir';

/** Una receta del catalogo antes de guardarla: foto, creador, ingredientes y pasos. */

const FONDO = '#F7F2EE';

export default function RecetaDescubrir() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: W } = useWindowDimensions();
  const consulta = useRecetaDescubrir(id);
  const ya = useYaGuardada(consulta.data?.tarjeta.extraction_id);
  const guardar = useGuardarDeDescubrir();

  if (consulta.isLoading) {
    return (
      <View style={[estilos.pantalla, estilos.centro]}>
        <ActivityIndicator color={Marca.primario} size="large" />
      </View>
    );
  }
  if (!consulta.data) {
    return (
      <View style={[estilos.pantalla, estilos.centro, { gap: 12 }]}>
        <Text style={estilos.tituloSeccion}>No pudimos abrir la receta</Text>
        <Pressable onPress={() => consulta.refetch()} style={estilos.boton} accessibilityRole="button">
          <Text style={estilos.textoBoton}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  const { tarjeta, receta } = consulta.data;
  const miId = ya.data;
  const ingredientes = receta.ingredients ?? [];
  const pasos = receta.steps ?? [];

  async function alGuardar() {
    if (miId) {
      router.push(`/receta/${miId}`);
      return;
    }
    try {
      const r = await guardar.mutateAsync(tarjeta);
      Alert.alert('Guardada en tus recetas', 'No gastó ninguna importación.', [
        { text: 'Seguir aquí', style: 'cancel' },
        { text: 'Abrir', onPress: () => router.push(`/receta/${r.id}`) },
      ]);
    } catch {
      Alert.alert('No se guardó', 'Revisa tu conexión e inténtalo de nuevo.');
    }
  }

  return (
    <View style={estilos.pantalla}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        <Foto uri={tarjeta.foto} estilo={{ width: W, height: W * 1.05, borderRadius: 0 }} />

        <View style={estilos.cuerpo}>
          <Text style={estilos.titulo}>{tarjeta.titulo}</Text>
          <View style={estilos.filaCreador}>
            <LineaCreador tarjeta={tarjeta} />
            <Pressable onPress={() => Linking.openURL(tarjeta.source_url)} hitSlop={8} accessibilityRole="link" style={estilos.original}>
              <Text style={estilos.textoOriginal}>Ver original</Text>
              <MaterialCommunityIcons name="open-in-new" size={15} color={Marca.primario} />
            </Pressable>
          </View>

          <View style={estilos.datos}>
            {tarjeta.minutos ? <Dato icono="clock-outline" texto={`${tarjeta.minutos} min`} /> : null}
            {receta.servings ? <Dato icono="account-group-outline" texto={`${receta.servings} porciones`} /> : null}
            {tarjeta.etiquetas.slice(0, 2).map((e) => {
              const x = etiqueta(e);
              return x ? <Dato key={e} texto={`${x.emoji} ${x.nombre}`} /> : null;
            })}
          </View>

          {receta.description ? <Text style={estilos.descripcion}>{receta.description}</Text> : null}

          <Text style={estilos.tituloSeccion}>Ingredientes</Text>
          <View style={estilos.tarjeta}>
            {ingredientes.map((ing, k) => (
              <View key={k}>
                {ing.group_label && ing.group_label !== ingredientes[k - 1]?.group_label ? (
                  <Text style={estilos.grupo}>{ing.group_label}</Text>
                ) : null}
                <View style={[estilos.linea, k > 0 && estilos.lineaBorde]}>
                  <Text style={estilos.emojiLinea}>{ing.emoji ?? '•'}</Text>
                  <Text style={estilos.textoLinea}>{ing.raw_text}</Text>
                </View>
              </View>
            ))}
          </View>

          {pasos.length ? (
            <>
              <Text style={estilos.tituloSeccion}>Preparación</Text>
              <View style={{ gap: 14 }}>
                {pasos.map((p, k) => (
                  <View key={k} style={estilos.paso}>
                    <View style={estilos.numero}>
                      <Text style={estilos.textoNumero}>{k + 1}</Text>
                    </View>
                    <Text style={estilos.textoPaso}>{p.text}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Volver"
        style={[estilos.volver, { top: insets.top + 8 }]}>
        <MaterialCommunityIcons name="chevron-left" size={28} color={Colors.light.text} />
      </Pressable>

      <View style={[estilos.pie, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          onPress={alGuardar}
          disabled={guardar.isPending || ya.isLoading}
          accessibilityRole="button"
          style={({ pressed }) => [estilos.guardar, miId && estilos.guardada, pressed && { opacity: 0.9 }]}>
          {guardar.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <MaterialCommunityIcons name={miId ? 'bookmark-check' : 'bookmark-plus-outline'} size={22} color={miId ? Marca.primario : '#FFFFFF'} />
              <Text style={[estilos.textoGuardar, miId && { color: Marca.primario }]}>{miId ? 'Abrir en mis recetas' : 'Guardar en mis recetas'}</Text>
            </>
          )}
        </Pressable>
        {!miId ? <Text style={estilos.nota}>No gasta importaciones</Text> : null}
      </View>
    </View>
  );
}

function Dato({ icono, texto }: { icono?: keyof typeof MaterialCommunityIcons.glyphMap; texto: string }) {
  return (
    <View style={estilos.dato}>
      {icono ? <MaterialCommunityIcons name={icono} size={16} color={Colors.light.textSecondary} /> : null}
      <Text style={estilos.textoDato}>{texto}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: FONDO },
  centro: { alignItems: 'center', justifyContent: 'center' },
  cuerpo: {
    marginTop: -24,
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 14,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: FONDO,
  },
  titulo: { fontFamily: Tipografia.display, fontSize: 28, lineHeight: 35, color: Colors.light.text },
  filaCreador: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  original: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radios.pildora,
    backgroundColor: Marca.primarioTenue,
  },
  textoOriginal: { fontFamily: Tipografia.seminegrita, fontSize: 14, color: Marca.primario },
  datos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dato: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radios.pildora,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE5E0',
  },
  textoDato: { fontFamily: Tipografia.media, fontSize: 13, color: Colors.light.text },
  descripcion: { fontFamily: Tipografia.regular, fontSize: 15, lineHeight: 22, color: Colors.light.textSecondary },
  tituloSeccion: { fontFamily: Tipografia.display, fontSize: 22, color: Colors.light.text, marginTop: 10 },
  tarjeta: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#EDE5E0', paddingHorizontal: 14 },
  grupo: { fontFamily: Tipografia.seminegrita, fontSize: 14, color: Colors.light.textSecondary, paddingTop: 12 },
  linea: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  lineaBorde: { borderTopWidth: 1, borderTopColor: '#F1ECE9' },
  emojiLinea: { width: 22, textAlign: 'center', fontSize: 16, color: Colors.light.textSecondary },
  textoLinea: { flex: 1, fontFamily: Tipografia.regular, fontSize: 15, lineHeight: 21, color: Colors.light.text },
  paso: { flexDirection: 'row', gap: 12 },
  numero: { width: 28, height: 28, borderRadius: 14, backgroundColor: Marca.primario, alignItems: 'center', justifyContent: 'center' },
  textoNumero: { fontFamily: Tipografia.negrita, fontSize: 14, color: '#FFFFFF' },
  textoPaso: { flex: 1, fontFamily: Tipografia.regular, fontSize: 15, lineHeight: 22, color: Colors.light.text },

  volver: {
    position: 'absolute',
    left: 14,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  pie: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 6,
    backgroundColor: FONDO,
    borderTopWidth: 1,
    borderTopColor: '#EDE5E0',
  },
  guardar: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: Radios.pildora,
    backgroundColor: Marca.primario,
  },
  guardada: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: Marca.primario },
  textoGuardar: { fontFamily: Tipografia.seminegrita, fontSize: 16, color: '#FFFFFF' },
  nota: { textAlign: 'center', fontFamily: Tipografia.media, fontSize: 13, color: Colors.light.textSecondary },
  boton: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: Radios.pildora, backgroundColor: Marca.primario },
  textoBoton: { fontFamily: Tipografia.seminegrita, fontSize: 16, color: '#FFFFFF' },
});
