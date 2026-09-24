import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import type { Nutricion } from '@/lib/tipos';

/**
 * Nutricion por porcion, estimada por la IA al importar. En el plan gratis se
 * ve borrosa: el texto se dibuja solo con su sombra difuminada (el truco
 * funciona en Android sin modulos nativos de desenfoque).
 */

const MACROS = [
  { clave: 'proteinas_g', nombre: 'Proteínas', color: '#F28BB5', icono: 'food-drumstick' },
  { clave: 'carbohidratos_g', nombre: 'Carbohidratos', color: '#F6C443', icono: 'barley' },
  { clave: 'grasas_g', nombre: 'Grasas', color: '#8FD6C0', icono: 'water' },
] as const;

export function TarjetaNutricion({ nutricion, bloqueada }: { nutricion: Nutricion; bloqueada: boolean }) {
  const router = useRouter();
  const borroso = bloqueada ? estilos.borroso : null;

  return (
    <View style={estilos.tarjeta}>
      <Text style={estilos.titulo}>Nutrición</Text>
      <Text style={estilos.subtitulo}>Por porción · estimación</Text>

      <View style={estilos.fila}>
        {/* Anillo en tres colores, uno por macronutriente */}
        <View style={estilos.anillo}>
          <View style={[StyleSheet.absoluteFill, estilos.arco, { borderTopColor: MACROS[0].color, borderRightColor: MACROS[0].color, transform: [{ rotate: '-20deg' }] }]} />
          <View style={[StyleSheet.absoluteFill, estilos.arco, { borderBottomColor: MACROS[1].color, transform: [{ rotate: '-20deg' }] }]} />
          <View style={[StyleSheet.absoluteFill, estilos.arco, { borderLeftColor: MACROS[2].color, transform: [{ rotate: '-20deg' }] }]} />
          <Text style={[estilos.calorias, borroso]}>{nutricion.calorias ?? '—'}</Text>
          <Text style={estilos.unidad}>calorías</Text>
        </View>

        <View style={estilos.macros}>
          {MACROS.map((m) => (
            <View key={m.clave} style={estilos.macro}>
              <MaterialCommunityIcons name={m.icono} size={20} color={m.color} />
              <Text style={estilos.nombreMacro}>{m.nombre}:</Text>
              <Text style={[estilos.valorMacro, borroso]}>{nutricion[m.clave] != null ? `${Math.round(nutricion[m.clave]!)} g` : '—'}</Text>
            </View>
          ))}
        </View>
      </View>

      {bloqueada ? (
        <Pressable onPress={() => router.push('/plus')} accessibilityRole="button" style={({ pressed }) => [estilos.desbloquear, pressed && { opacity: 0.85 }]}>
          <MaterialCommunityIcons name="lock-outline" size={16} color="#FFFFFF" />
          <Text style={estilos.textoDesbloquear}>Desbloquéala con Recetifia+</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    padding: 18,
    gap: 2,
    borderRadius: Radios.grande,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.light.borde,
  },
  titulo: { fontFamily: Tipografia.seminegrita, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', color: Colors.light.text },
  subtitulo: { fontFamily: Tipografia.regular, fontSize: 13, color: Colors.light.textSecondary },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 22, marginTop: 14 },
  anillo: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  arco: { borderRadius: 60, borderWidth: 10, borderColor: 'transparent' },
  calorias: { fontFamily: Tipografia.negrita, fontSize: 26, color: Colors.light.text },
  unidad: { fontFamily: Tipografia.regular, fontSize: 12, color: Colors.light.textSecondary },
  macros: { flex: 1, gap: 12 },
  macro: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nombreMacro: { fontFamily: Tipografia.media, fontSize: 14, color: Colors.light.text },
  valorMacro: { fontFamily: Tipografia.seminegrita, fontSize: 14, color: Colors.light.text },
  borroso: { color: 'transparent', textShadowColor: 'rgba(34, 43, 43, 0.55)', textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 } },
  desbloquear: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: Radios.pildora,
    backgroundColor: Marca.primario,
  },
  textoDesbloquear: { fontFamily: Tipografia.seminegrita, fontSize: 14, color: '#FFFFFF' },
});
