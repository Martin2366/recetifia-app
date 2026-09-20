import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import type { Receta } from '@/lib/tipos';

const ICONO_FUENTE: Partial<Record<string, keyof typeof MaterialIcons.glyphMap>> = {
  instagram: 'camera-alt',
  tiktok: 'music-note',
  youtube: 'play-circle-outline',
  facebook: 'groups',
  pinterest: 'push-pin',
  web: 'language',
  image: 'image',
  manual: 'edit',
};

export function TarjetaReceta({
  receta,
  onPress,
  onFavorita,
}: {
  receta: Receta;
  onPress: () => void;
  onFavorita: () => void;
}) {
  const colores = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const tiempo = (receta.prep_minutes ?? 0) + (receta.cook_minutes ?? 0);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${receta.title}`}
      style={({ pressed }) => [
        estilos.tarjeta,
        { backgroundColor: colores.backgroundElement, opacity: pressed ? 0.7 : 1 },
      ]}>
      {receta.image_path ? (
        <Image source={{ uri: receta.image_path }} style={estilos.foto} contentFit="cover" transition={150} />
      ) : (
        <View style={[estilos.foto, estilos.sinFoto, { backgroundColor: colores.backgroundSelected }]}>
          <MaterialIcons name="restaurant" size={26} color={colores.textSecondary} />
        </View>
      )}

      <View style={estilos.centro}>
        <ThemedText numberOfLines={2} style={estilos.titulo}>
          {receta.title}
        </ThemedText>

        <View style={estilos.meta}>
          {receta.source_type ? (
            <MaterialIcons
              name={ICONO_FUENTE[receta.source_type] ?? 'language'}
              size={13}
              color={colores.textSecondary}
            />
          ) : null}
          {tiempo > 0 ? (
            <ThemedText type="small" style={{ color: colores.textSecondary }}>
              {tiempo} min
            </ThemedText>
          ) : null}
          {receta.status === 'needs_review' ? (
            <ThemedText type="small" style={estilos.revisar}>
              Por revisar
            </ThemedText>
          ) : null}
        </View>
      </View>

      <Pressable
        onPress={onFavorita}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={receta.is_favorite ? 'Quitar de favoritas' : 'Marcar como favorita'}
        style={estilos.corazon}>
        <MaterialIcons
          name={receta.is_favorite ? 'favorite' : 'favorite-border'}
          size={22}
          color={receta.is_favorite ? '#E0245E' : colores.textSecondary}
        />
      </Pressable>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: 14,
  },
  foto: { width: 68, height: 68, borderRadius: 10 },
  sinFoto: { alignItems: 'center', justifyContent: 'center' },
  centro: { flex: 1, gap: Spacing.one },
  titulo: { fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  revisar: { color: '#B26A00' },
  corazon: { padding: Spacing.one },
});
