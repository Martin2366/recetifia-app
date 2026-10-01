import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotonOnboarding } from '@/components/onboarding/boton';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import type { ColeccionConConteo } from '@/lib/colecciones';
import type { RecetaImportada } from '@/lib/importacion';

import { separarCantidad } from './vista-previa';

/**
 * Una publicacion con varios platos ("6 cenas altas en proteina"): cada plato
 * es una receta aparte. Todas vienen marcadas; se desmarca lo que no interese y
 * se guardan juntas, en la misma coleccion si se elige una.
 */
export function VariasRecetas({
  recetas,
  colecciones,
  guardando,
  alGuardar,
  alCancelar,
}: {
  recetas: RecetaImportada[];
  colecciones: ColeccionConConteo[];
  guardando: boolean;
  alGuardar: (elegidas: RecetaImportada[], coleccionId: string | null) => void;
  alCancelar: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [marcadas, setMarcadas] = useState(() => new Set(recetas.map((_, k) => k)));
  const [abierta, setAbierta] = useState<number | null>(null);
  const [coleccion, setColeccion] = useState<string | null>(null);
  const [eligiendo, setEligiendo] = useState(false);
  const nombreColeccion = colecciones.find((c) => c.id === coleccion)?.name;
  const foto = recetas[0]?.image_path;

  function alternar(k: number) {
    setMarcadas((m) => {
      const n = new Set(m);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  }

  const cuantas = marcadas.size;

  return (
    <View style={estilos.pantalla}>
      <ScrollView contentContainerStyle={{ paddingBottom: 200 + insets.bottom }}>
        <View style={estilos.cabecera}>
          {foto ? (
            <Image source={{ uri: foto }} style={estilos.foto} contentFit="cover" transition={200} />
          ) : (
            <View style={[estilos.foto, estilos.sinFoto]}>
              <MaterialCommunityIcons name="silverware-fork-knife" size={30} color={Marca.primario} />
            </View>
          )}
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={estilos.titulo}>Esta publicación trae {recetas.length} recetas</Text>
            <Text style={estilos.subtitulo}>Cada una se guarda por separado y luego puedes editarla. Desmarca las que no quieras.</Text>
            {recetas[0]?.source_author ? <Text style={estilos.autor}>de {recetas[0].source_author}</Text> : null}
          </View>
        </View>

        {recetas.map((r, k) => {
          const marcada = marcadas.has(k);
          const ingredientes = r.ingredients ?? [];
          const pasos = r.steps ?? [];
          return (
            <View key={k} style={[estilos.tarjeta, marcada && estilos.tarjetaMarcada]}>
              <Pressable
                onPress={() => alternar(k)}
                style={estilos.filaTarjeta}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: marcada }}
                accessibilityLabel={r.title}>
                <MaterialCommunityIcons
                  name={marcada ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                  size={26}
                  color={marcada ? Marca.primario : Colors.light.textTenue}
                />
                <View style={{ flex: 1 }}>
                  <Text style={estilos.nombre}>{r.title}</Text>
                  <Text style={estilos.detalle}>
                    {ingredientes.length} ingredientes · {pasos.length} {pasos.length === 1 ? 'paso' : 'pasos'}
                    {r.servings ? ` · ${r.servings} ${r.servings === 1 ? 'porción' : 'porciones'}` : ''}
                  </Text>
                </View>
              </Pressable>

              <View style={estilos.acciones}>
                <Pressable onPress={() => setAbierta(abierta === k ? null : k)} hitSlop={8} style={estilos.accion}>
                  <Text style={estilos.textoAccion}>{abierta === k ? 'Ocultar' : 'Ver receta'}</Text>
                  <MaterialCommunityIcons name={abierta === k ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.light.textSecondary} />
                </Pressable>
              </View>

              {abierta === k ? (
                <View style={estilos.contenido}>
                  {ingredientes.map((ing, i) => {
                    const [cantidad, resto] = separarCantidad(ing.raw_text);
                    return (
                      <Text key={i} style={estilos.ingrediente}>
                        {ing.emoji || '•'}{'  '}
                        {cantidad ? <Text style={estilos.cantidad}>{cantidad}</Text> : null}
                        {resto}
                      </Text>
                    );
                  })}
                  {pasos.map((p, i) => (
                    <Text key={`p${i}`} style={estilos.paso}>
                      <Text style={estilos.cantidad}>{i + 1}.</Text> {p.text}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
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
          <BotonOnboarding
            texto={cuantas === 0 ? 'Elige al menos una receta' : cuantas === 1 ? 'Guardar 1 receta' : `Guardar ${cuantas} recetas`}
            apagado={cuantas === 0}
            alPulsar={() => alGuardar(recetas.filter((_, k) => marcadas.has(k)), coleccion)}
          />
        )}

        <Pressable onPress={alCancelar} hitSlop={8} style={{ alignSelf: 'center' }}>
          <Text style={estilos.descartar}>Descartar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#FFFFFF' },
  cabecera: { flexDirection: 'row', gap: 16, padding: 18, alignItems: 'center' },
  foto: { width: 84, height: 84, borderRadius: 18 },
  sinFoto: { backgroundColor: Marca.primarioTenue, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: Tipografia.display, fontSize: 21, lineHeight: 27, color: Colors.light.text },
  subtitulo: { fontFamily: Tipografia.regular, fontSize: 14, lineHeight: 20, color: Colors.light.textSecondary },
  autor: { fontFamily: Tipografia.regular, fontSize: 13, color: Colors.light.textSecondary },

  tarjeta: {
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: Radios.medio,
    borderWidth: 1.5,
    borderColor: Colors.light.borde,
    backgroundColor: '#FFFFFF',
  },
  tarjetaMarcada: { borderColor: Marca.primario },
  filaTarjeta: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingBottom: 6 },
  nombre: { fontFamily: Tipografia.seminegrita, fontSize: 16, lineHeight: 21, color: Colors.light.text },
  detalle: { fontFamily: Tipografia.regular, fontSize: 13, color: Colors.light.textSecondary, marginTop: 2 },
  acciones: { flexDirection: 'row', gap: 18, paddingHorizontal: 14, paddingBottom: 12, paddingLeft: 52 },
  accion: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  textoAccion: { fontFamily: Tipografia.media, fontSize: 14, color: Colors.light.textSecondary },
  contenido: { borderTopWidth: 1, borderTopColor: Colors.light.borde, padding: 14, gap: 6 },
  ingrediente: { fontFamily: Tipografia.regular, fontSize: 15, lineHeight: 21, color: Colors.light.text },
  cantidad: { fontFamily: Tipografia.negrita },
  paso: { fontFamily: Tipografia.regular, fontSize: 15, lineHeight: 22, color: Colors.light.text, marginTop: 4 },

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
  descartar: { fontFamily: Tipografia.regular, fontSize: 13, color: Colors.light.textSecondary },
});
