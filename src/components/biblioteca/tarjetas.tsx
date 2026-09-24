import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TONOS } from '@/components/onboarding/formas';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import type { ColeccionConConteo } from '@/lib/colecciones';
import type { Receta } from '@/lib/tipos';

type Icono = keyof typeof MaterialCommunityIcons.glyphMap;

/** Sin foto, cada receta recibe siempre la misma silueta y color (segun su id). */
const RELLENOS: { icono: Icono; color: string }[] = [
  { icono: 'bowl-mix', color: TONOS.naranja },
  { icono: 'food-apple', color: TONOS.verde },
  { icono: 'egg', color: TONOS.amarillo },
  { icono: 'carrot', color: TONOS.durazno },
  { icono: 'fish', color: TONOS.celeste },
  { icono: 'chili-mild', color: TONOS.lila },
];

function relleno(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return RELLENOS[h % RELLENOS.length];
}

const MARCA_FUENTE: Partial<Record<string, 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'pinterest'>> = {
  instagram: 'instagram',
  tiktok: 'tiktok',
  youtube: 'youtube',
  facebook: 'facebook',
  pinterest: 'pinterest',
};

export function TarjetaReceta({
  receta,
  ancho,
  alPulsar,
  alFavorita,
  alMantener,
}: {
  receta: Receta;
  ancho: number;
  alPulsar: () => void;
  alFavorita: () => void;
  /** Mantener presionada: acciones extra, como quitarla de una coleccion. */
  alMantener?: () => void;
}) {
  const tiempo = (receta.prep_minutes ?? 0) + (receta.cook_minutes ?? 0);
  const r = relleno(receta.id);
  const marca = receta.source_type ? MARCA_FUENTE[receta.source_type] : undefined;

  return (
    <Pressable
      onPress={alPulsar}
      onLongPress={alMantener}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${receta.title}`}
      accessibilityActions={alMantener ? [{ name: 'longpress', label: 'Más opciones' }] : undefined}
      onAccessibilityAction={alMantener ? () => alMantener() : undefined}
      style={({ pressed }) => [{ width: ancho, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[estilos.foto, { width: ancho, height: ancho * 1.05 }]}>
        {receta.image_path ? (
          <Image source={{ uri: receta.image_path }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        ) : (
          <View style={[StyleSheet.absoluteFill, estilos.sinFoto, { backgroundColor: `${r.color}26` }]}>
            <MaterialCommunityIcons name={r.icono} size={ancho * 0.42} color={r.color} />
          </View>
        )}
        <Pressable
          onPress={alFavorita}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={receta.is_favorite ? 'Quitar de favoritas' : 'Marcar como favorita'}
          style={estilos.corazon}>
          <MaterialCommunityIcons
            name={receta.is_favorite ? 'heart' : 'heart-outline'}
            size={19}
            color={receta.is_favorite ? Marca.primario : Colors.light.text}
          />
        </Pressable>
        {receta.status === 'needs_review' ? (
          <View style={estilos.revisar}>
            <Text style={estilos.textoRevisar}>Por revisar</Text>
          </View>
        ) : null}
      </View>

      <Text style={estilos.titulo} numberOfLines={2}>
        {receta.title}
      </Text>
      <View style={estilos.meta}>
        {marca ? <FontAwesome6 name={marca} brand size={11} color={Colors.light.textSecondary} /> : null}
        {tiempo > 0 ? (
          <>
            <MaterialCommunityIcons name="clock-outline" size={13} color={Colors.light.textSecondary} />
            <Text style={estilos.textoMeta}>{tiempo} min</Text>
          </>
        ) : null}
      </View>
    </Pressable>
  );
}

export function TarjetaColeccion({ coleccion, ancho, alPulsar }: { coleccion: ColeccionConConteo; ancho: number; alPulsar: () => void }) {
  const r = relleno(coleccion.id);
  return (
    <Pressable
      onPress={alPulsar}
      accessibilityRole="button"
      accessibilityLabel={`${coleccion.name}, ${coleccion.total} recetas`}
      style={({ pressed }) => [{ width: ancho, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[estilos.portada, { height: ancho * 0.9, backgroundColor: `${r.color}22` }]}>
        {/* Una pila de "fichas" detras, como un recetario */}
        <View style={[estilos.ficha, { backgroundColor: `${r.color}55`, transform: [{ rotate: '-7deg' }] }]} />
        <View style={[estilos.ficha, { backgroundColor: '#FFFFFF', transform: [{ rotate: '4deg' }] }]}>
          <MaterialCommunityIcons name={r.icono} size={ancho * 0.26} color={r.color} />
        </View>
      </View>
      <Text style={estilos.titulo} numberOfLines={1}>
        {coleccion.name}
      </Text>
      <Text style={estilos.textoMeta}>
        {coleccion.total} {coleccion.total === 1 ? 'receta' : 'recetas'}
      </Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  foto: { borderRadius: Radios.grande, overflow: 'hidden', backgroundColor: '#F4F1EF' },
  sinFoto: { alignItems: 'center', justifyContent: 'center' },
  corazon: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  revisar: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radios.pildora,
    backgroundColor: '#FFF6E6',
  },
  textoRevisar: { fontFamily: Tipografia.seminegrita, fontSize: 11, color: Marca.aviso },
  titulo: { fontFamily: Tipografia.display, fontSize: 16, lineHeight: 21, color: Colors.light.text, marginTop: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, minHeight: 16 },
  textoMeta: { fontFamily: Tipografia.regular, fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 },

  portada: { borderRadius: Radios.grande, alignItems: 'center', justifyContent: 'center' },
  ficha: {
    position: 'absolute',
    width: '58%',
    height: '66%',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#7A2E12',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
});
