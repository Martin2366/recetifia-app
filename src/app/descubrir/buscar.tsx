import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radios, Tipografia } from '@/constants/theme';

/**
 * Buscador de Descubrir. Por ahora llega hasta "Explora recetas por": lo que
 * abre cada tarjeta y la busqueda por texto vienen en la siguiente etapa.
 */

type Forma = { id: string; nombre: string; emoji: string; fondo: string };

const FORMAS: Forma[] = [
  { id: 'ingredientes', nombre: 'Ingredientes', emoji: '🥕', fondo: '#DCEFC6' },
  { id: 'tipo', nombre: 'Tipo de comida', emoji: '🍽️', fondo: '#DCE8FF' },
  { id: 'dieta', nombre: 'Dieta', emoji: '🌱', fondo: '#FCE1EA' },
  { id: 'cocina', nombre: 'Cocina', emoji: '🌎', fondo: '#E8DCF7' },
  { id: 'ocasion', nombre: 'Ocasión', emoji: '🎉', fondo: '#FFE7A8' },
  { id: 'metodo', nombre: 'Método', emoji: '🔥', fondo: '#FFD3C2' },
];

export default function Buscar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [texto, setTexto] = useState('');

  return (
    <View style={[estilos.pantalla, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={estilos.barra}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Volver" style={estilos.atras}>
          <MaterialCommunityIcons name="chevron-left" size={30} color={Colors.light.text} />
        </Pressable>
        <View style={estilos.campo}>
          <MaterialCommunityIcons name="magnify" size={22} color={Colors.light.textSecondary} />
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder="¿Qué te gustaría cocinar?"
            placeholderTextColor={Colors.light.textTenue}
            style={estilos.entrada}
            autoFocus
            returnKeyType="search"
            accessibilityLabel="Buscar recetas"
          />
          {texto ? (
            <Pressable onPress={() => setTexto('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Borrar">
              <MaterialCommunityIcons name="close-circle" size={20} color={Colors.light.textTenue} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <Text style={estilos.subtitulo}>Explora recetas por</Text>
      <View style={estilos.rejilla}>
        {FORMAS.map((f) => (
          <Pressable
            key={f.id}
            accessibilityRole="button"
            style={({ pressed }) => [estilos.tarjeta, { backgroundColor: f.fondo }, pressed && { transform: [{ scale: 0.97 }] }]}>
            <Text style={estilos.emoji}>{f.emoji}</Text>
            <Text style={estilos.nombre}>{f.nombre}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#F7F2EE' },
  barra: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 10 },
  atras: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  campo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 50,
    marginRight: 8,
    paddingHorizontal: 14,
    borderRadius: Radios.pildora,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE5E0',
  },
  entrada: { flex: 1, fontFamily: Tipografia.media, fontSize: 16, color: Colors.light.text, paddingVertical: 8 },
  subtitulo: { fontFamily: Tipografia.seminegrita, fontSize: 15, color: Colors.light.textSecondary, paddingHorizontal: 20, marginTop: 16, marginBottom: 12 },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, paddingHorizontal: 16 },
  tarjeta: { width: '48.4%', minHeight: 96, padding: 16, borderRadius: 16, justifyContent: 'space-between' },
  emoji: { fontSize: 26 },
  nombre: { fontFamily: Tipografia.negrita, fontSize: 17, color: Colors.light.text },
});
