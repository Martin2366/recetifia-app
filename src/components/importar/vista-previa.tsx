import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TarjetaNutricion } from '@/components/nutricion';
import { BotonOnboarding } from '@/components/onboarding/boton';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import type { ColeccionConConteo } from '@/lib/colecciones';
import type { RecetaImportada } from '@/lib/importacion';

/**
 * Vista previa de la receta importada, antes de guardarla: foto, titulo,
 * ingredientes con su emoji, pasos numerados, nutricion y a que coleccion va.
 */

/** "200 g de panceta" → ["200 g", " de panceta"], para poner la cantidad en negrita. */
export function separarCantidad(texto: string): [string, string] {
  const m = texto.match(
    /^((?:\d+[.,/]?\d*|½|¼|¾|⅓|⅔)(?:\s*(?:\d+\/\d+|½|¼|¾))?(?:\s*(?:-|a)\s*\d+)?\s*(?:kg|g|gr|grs|mg|ml|l|lt|cc|taza|tazas|cda|cdas|cdta|cdtas|cucharadas?|cucharaditas?|tbsp|tsp|cups?|oz|lb|unidad(?:es)?|dientes?|latas?|pizcas?|sobres?|paquetes?|atados?)?\.?)(\s.*|$)/i
  );
  return m ? [m[1], m[2]] : ['', texto];
}

export function VistaPrevia({
  receta,
  plus,
  colecciones,
  guardando,
  alGuardar,
  alEditar,
  alCancelar,
}: {
  receta: RecetaImportada;
  plus: boolean;
  colecciones: ColeccionConConteo[];
  guardando: boolean;
  alGuardar: (coleccionId: string | null) => void;
  alEditar: () => void;
  alCancelar: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [coleccion, setColeccion] = useState<string | null>(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [avisoVisible, setAvisoVisible] = useState(true);

  const ingredientes = receta.ingredients ?? [];
  const pasos = receta.steps ?? [];
  const nombreColeccion = colecciones.find((c) => c.id === coleccion)?.name;
  const desdeWebCreador = receta.origin === 'web_creador' && receta.blog_url;
  const parcial = receta.quality === 'partial';
  const dominio = receta.blog_url?.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];

  // Agrupa respetando el orden: "Para el pollo", "Para la salsa"...
  const grupos: { titulo: string | null; items: typeof ingredientes }[] = [];
  for (const i of ingredientes) {
    const g = i.group_label ?? null;
    if (!grupos.length || grupos[grupos.length - 1].titulo !== g) grupos.push({ titulo: g, items: [] });
    grupos[grupos.length - 1].items.push(i);
  }

  return (
    <View style={estilos.pantalla}>
      <ScrollView contentContainerStyle={{ paddingBottom: 190 + insets.bottom }}>
        <View style={estilos.cabecera}>
          {receta.image_path ? (
            <Image source={{ uri: receta.image_path }} style={estilos.foto} contentFit="cover" transition={200} />
          ) : (
            <View style={[estilos.foto, estilos.sinFoto]}>
              <MaterialCommunityIcons name="silverware-fork-knife" size={34} color={Marca.primario} />
            </View>
          )}
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={estilos.titulo} numberOfLines={3}>
              {receta.title}
            </Text>
            {receta.source_author ? <Text style={estilos.autor}>de {receta.source_author}</Text> : null}
            <Pressable onPress={alEditar} accessibilityRole="button" style={({ pressed }) => [estilos.editar, pressed && { opacity: 0.7 }]}>
              <MaterialCommunityIcons name="pencil-outline" size={16} color={Colors.light.text} />
              <Text style={estilos.textoEditar}>Editar receta</Text>
            </Pressable>
          </View>
        </View>

        {avisoVisible && (desdeWebCreador || parcial) ? (
          <View style={estilos.aviso}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={estilos.textoAviso}>
                {desdeWebCreador
                  ? 'La receta no estaba completa en la publicación 🤔\nAsí que la trajimos de la web del creador 🔗\n¿Se ve bien? ✅'
                  : 'No encontramos todos los pasos en la publicación 🤔\nRevísala y complétala con «Editar receta» antes de cocinar.'}
              </Text>
              {desdeWebCreador ? (
                <Text style={estilos.textoAviso}>
                  Receta:{' '}
                  <Text style={estilos.enlace} onPress={() => Linking.openURL(receta.blog_url!)}>
                    {dominio}
                  </Text>
                </Text>
              ) : null}
            </View>
            <Pressable onPress={() => setAvisoVisible(false)} hitSlop={10} accessibilityLabel="Cerrar aviso">
              <MaterialCommunityIcons name="close" size={20} color={Colors.light.textSecondary} />
            </Pressable>
          </View>
        ) : null}

        <View style={estilos.seccion}>
          <Text style={estilos.etiqueta}>Ingredientes</Text>
          {ingredientes.length === 0 ? <Text style={estilos.vacio}>No encontramos ingredientes. Agrégalos con «Editar receta».</Text> : null}
          {grupos.map((g, k) => (
            <View key={k}>
              {g.titulo ? <Text style={estilos.grupo}>{g.titulo}</Text> : null}
              {g.items.map((ing, i) => {
                const [cantidad, resto] = separarCantidad(ing.raw_text);
                return (
                  <View key={i} style={estilos.ingrediente}>
                    <View style={estilos.burbuja}>
                      <Text style={estilos.emoji}>{ing.emoji || '🥄'}</Text>
                    </View>
                    <Text style={estilos.textoIngrediente}>
                      {cantidad ? <Text style={estilos.cantidad}>{cantidad}</Text> : null}
                      {resto}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <View style={estilos.seccion}>
          <Text style={estilos.etiqueta}>Preparación</Text>
          {pasos.length === 0 ? <Text style={estilos.vacio}>No encontramos los pasos. Agrégalos con «Editar receta».</Text> : null}
          {pasos.map((p, i) => (
            <View key={i} style={estilos.paso}>
              <View style={estilos.numero}>
                <Text style={estilos.textoNumero}>{i + 1}</Text>
              </View>
              <Text style={estilos.textoPaso}>{p.text}</Text>
            </View>
          ))}
        </View>

        {receta.nutrition?.calorias ? (
          <View style={estilos.seccionNutricion}>
            <TarjetaNutricion nutricion={receta.nutrition} bloqueada={!plus} />
          </View>
        ) : null}
      </ScrollView>

      <View style={[estilos.pie, { paddingBottom: insets.bottom + 12 }]}>
        {eligiendo ? (
          <View style={estilos.lista}>
            {[{ id: null, name: 'Solo en mi biblioteca' }, ...colecciones].map((c) => (
              <Pressable
                key={c.id ?? 'ninguna'}
                onPress={() => {
                  setColeccion(c.id);
                  setEligiendo(false);
                }}
                style={estilos.opcion}>
                <Text style={[estilos.textoOpcion, coleccion === c.id && estilos.opcionElegida]}>{c.name}</Text>
                {coleccion === c.id ? <MaterialCommunityIcons name="check" size={18} color={Marca.primario} /> : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        {colecciones.length ? (
          <Pressable onPress={() => setEligiendo((v) => !v)} style={estilos.selector} accessibilityRole="button">
            <MaterialCommunityIcons name="bookmark-multiple-outline" size={18} color={Colors.light.textSecondary} />
            <Text style={estilos.textoSelector}>{nombreColeccion ? `Guardar en «${nombreColeccion}»` : 'Elegir una colección'}</Text>
            <MaterialCommunityIcons name={eligiendo ? 'chevron-down' : 'chevron-right'} size={20} color={Colors.light.textSecondary} />
          </Pressable>
        ) : null}

        {guardando ? (
          <View style={estilos.cargando}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : (
          <BotonOnboarding texto="Guardar receta" alPulsar={() => alGuardar(coleccion)} />
        )}

        <View style={estilos.enlacesPie}>
          <Pressable onPress={alCancelar} hitSlop={8}>
            <Text style={estilos.textoEnlacePie}>Descartar</Text>
          </Pressable>
          <Text style={estilos.separador}>·</Text>
          <Pressable
            onPress={() => Alert.alert('¡Gracias!', 'Revisaremos esta importación para mejorar. Mientras tanto puedes corregirla con «Editar receta».')}
            hitSlop={8}
            style={estilos.reportar}>
            <MaterialCommunityIcons name="flag-outline" size={14} color={Colors.light.textSecondary} />
            <Text style={estilos.textoEnlacePie}>Reportar un error</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#FFFFFF' },
  cabecera: { flexDirection: 'row', gap: 16, padding: 18, alignItems: 'center' },
  foto: { width: 104, height: 104, borderRadius: 20 },
  sinFoto: { backgroundColor: Marca.primarioTenue, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: Tipografia.display, fontSize: 21, lineHeight: 27, color: Colors.light.text },
  autor: { fontFamily: Tipografia.regular, fontSize: 13, color: Colors.light.textSecondary, marginTop: -4 },
  editar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    height: 36,
    borderRadius: Radios.medio,
    borderWidth: 1.5,
    borderColor: Colors.light.borde,
  },
  textoEditar: { fontFamily: Tipografia.media, fontSize: 14, color: Colors.light.text },

  aviso: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 18,
    marginBottom: 6,
    padding: 14,
    borderRadius: Radios.medio,
    backgroundColor: '#FFF6E6',
  },
  textoAviso: { fontFamily: Tipografia.regular, fontSize: 14, lineHeight: 21, color: Colors.light.text },
  enlace: { fontFamily: Tipografia.seminegrita, color: Marca.primario, textDecorationLine: 'underline' },

  seccion: { paddingHorizontal: 18, paddingTop: 22, borderTopWidth: 8, borderTopColor: '#F7F2EE', marginTop: 12 },
  etiqueta: { fontFamily: Tipografia.seminegrita, fontSize: 14, letterSpacing: 1.2, textTransform: 'uppercase', color: Colors.light.text, marginBottom: 8 },
  grupo: { fontFamily: Tipografia.display, fontSize: 18, color: Colors.light.text, marginTop: 14, marginBottom: 4 },
  vacio: { fontFamily: Tipografia.regular, fontSize: 14, color: Colors.light.textSecondary, paddingVertical: 8 },
  ingrediente: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 9 },
  burbuja: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFF4EE', alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22 },
  textoIngrediente: { flex: 1, fontFamily: Tipografia.regular, fontSize: 16, lineHeight: 22, color: Colors.light.text },
  cantidad: { fontFamily: Tipografia.negrita },
  paso: { flexDirection: 'row', gap: 12, paddingVertical: 10 },
  numero: { width: 26, height: 26, borderRadius: 13, backgroundColor: Marca.primarioTenue, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  textoNumero: { fontFamily: Tipografia.negrita, fontSize: 13, color: Marca.primario },
  textoPaso: { flex: 1, fontFamily: Tipografia.regular, fontSize: 16, lineHeight: 24, color: Colors.light.text },
  seccionNutricion: { paddingHorizontal: 18, paddingTop: 22, borderTopWidth: 8, borderTopColor: '#F7F2EE', marginTop: 12 },

  pie: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: Colors.light.borde,
  },
  selector: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  textoSelector: { flex: 1, fontFamily: Tipografia.media, fontSize: 15, color: Colors.light.textSecondary },
  lista: { borderRadius: Radios.medio, borderWidth: 1, borderColor: Colors.light.borde, paddingHorizontal: 14, maxHeight: 220 },
  opcion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  textoOpcion: { fontFamily: Tipografia.regular, fontSize: 15, color: Colors.light.text },
  opcionElegida: { fontFamily: Tipografia.seminegrita, color: Marca.primario },
  cargando: { minHeight: 56, borderRadius: Radios.pildora, backgroundColor: Marca.primario, alignItems: 'center', justifyContent: 'center' },
  enlacesPie: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  separador: { color: Colors.light.textTenue },
  reportar: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  textoEnlacePie: { fontFamily: Tipografia.regular, fontSize: 13, color: Colors.light.textSecondary },
});
