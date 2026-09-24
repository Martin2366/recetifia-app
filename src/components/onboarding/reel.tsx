import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { memo, type Ref } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Marca, Tipografia } from '@/constants/theme';

/**
 * Maqueta de un reel de recetas, hecha con una foto propia (nada de capturas de
 * terceros). La usan el onboarding y su recorrido guiado.
 */

export const RECETA_DEMO = {
  titulo: 'Espaguetis a la carbonara',
  autor: '@recetasdecasa',
  foto: require('@/assets/images/onboarding/cocina.jpg'),
  ingredientes: [
    { emoji: '🍝', cantidad: '200 g', nombre: 'de espaguetis' },
    { emoji: '🥓', cantidad: '100 g', nombre: 'de panceta' },
    { emoji: '🥚', cantidad: '2', nombre: 'yemas de huevo' },
    { emoji: '🧀', cantidad: '50 g', nombre: 'de queso pecorino' },
    { emoji: '🧂', cantidad: '', nombre: 'Pimienta negra y sal al gusto' },
  ],
};

/** `refCompartir` apunta al avion de papel, para que el recorrido lo resalte encima. */
export const Reel = memo(function Reel({
  escala = 1,
  refCompartir,
  paddingInferior = 0,
}: {
  escala?: number;
  refCompartir?: Ref<View>;
  paddingInferior?: number;
}) {
  const e = (n: number) => n * escala;

  return (
    <View style={estilos.reel}>
      <Image source={RECETA_DEMO.foto} style={StyleSheet.absoluteFill} contentFit="cover" />
      <Image
        source={require('@/assets/images/onboarding/degradado.png')}
        style={StyleSheet.absoluteFill}
        contentFit="fill"
      />

      {/* Acciones de la derecha */}
      <View style={[estilos.acciones, { right: e(10), bottom: e(96) + paddingInferior, gap: e(16) }]}>
        <Accion e={e} icono={<MaterialCommunityIcons name="heart-outline" size={e(28)} color="#FFF" />} cifra="12,4 mil" />
        <Accion e={e} icono={<MaterialCommunityIcons name="comment-outline" size={e(26)} color="#FFF" />} cifra="318" />
        <View style={estilos.accion}>
          <View ref={refCompartir} collapsable={false} style={{ width: e(40), height: e(34), alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome6 name="paper-plane" size={e(23)} color="#FFF" />
          </View>
          <Text style={[estilos.cifra, { fontSize: e(11) }]}>1.024</Text>
        </View>
        <Accion e={e} icono={<MaterialCommunityIcons name="bookmark-outline" size={e(28)} color="#FFF" />} />
      </View>

      {/* Autor y descripcion */}
      <View style={[estilos.pie, { left: e(14), right: e(64), bottom: e(22) + paddingInferior, gap: e(8) }]}>
        <View style={[estilos.autorFila, { gap: e(8) }]}>
          <View style={[estilos.avatar, { width: e(30), height: e(30), borderRadius: e(15) }]}>
            <MaterialCommunityIcons name="chef-hat" size={e(17)} color="#FFF" />
          </View>
          <Text style={[estilos.autor, { fontSize: e(13) }]}>{RECETA_DEMO.autor.slice(1)}</Text>
          <View style={[estilos.seguir, { paddingHorizontal: e(10), paddingVertical: e(3), borderRadius: e(8) }]}>
            <Text style={[estilos.textoSeguir, { fontSize: e(11) }]}>Seguir</Text>
          </View>
        </View>
        <Text style={[estilos.descripcion, { fontSize: e(13), lineHeight: e(18) }]} numberOfLines={2}>
          {RECETA_DEMO.titulo} en 15 minutos 🍝 Receta completa 👇
        </Text>
      </View>
    </View>
  );
});

function Accion({ e, icono, cifra }: { e: (n: number) => number; icono: React.ReactNode; cifra?: string }) {
  return (
    <View style={estilos.accion}>
      <View style={{ height: e(34), justifyContent: 'center' }}>{icono}</View>
      {cifra ? <Text style={[estilos.cifra, { fontSize: e(11) }]}>{cifra}</Text> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  reel: { flex: 1, backgroundColor: '#140C08', overflow: 'hidden' },
  acciones: { position: 'absolute', alignItems: 'center' },
  accion: { alignItems: 'center', gap: 2 },
  cifra: { fontFamily: Tipografia.media, color: '#FFFFFF' },
  pie: { position: 'absolute' },
  autorFila: { flexDirection: 'row', alignItems: 'center' },
  avatar: { backgroundColor: Marca.primario, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFF' },
  autor: { fontFamily: Tipografia.seminegrita, color: '#FFFFFF' },
  seguir: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' },
  textoSeguir: { fontFamily: Tipografia.seminegrita, color: '#FFFFFF' },
  descripcion: { fontFamily: Tipografia.regular, color: '#FFFFFF' },
});
