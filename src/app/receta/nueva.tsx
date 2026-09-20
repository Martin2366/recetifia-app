import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useCrearReceta } from '@/lib/recetas';

/** Una linea por ingrediente o paso. Se ignoran las vacias y las vinetas sueltas. */
function aLineas(texto: string): string[] {
  return texto
    .split('\n')
    .map((l) => l.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean);
}

export default function NuevaReceta() {
  const router = useRouter();
  const crear = useCrearReceta();
  const colores = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];

  const [titulo, setTitulo] = useState('');
  const [porciones, setPorciones] = useState('');
  const [minutos, setMinutos] = useState('');
  const [ingredientes, setIngredientes] = useState('');
  const [pasos, setPasos] = useState('');

  const puedeGuardar = titulo.trim().length > 0 && !crear.isPending;

  async function guardar() {
    try {
      const id = await crear.mutateAsync({
        title: titulo.trim(),
        servings: porciones ? Number(porciones) : null,
        prep_minutes: minutos ? Number(minutos) : null,
        source_type: 'manual',
        ingredients: aLineas(ingredientes).map((l) => ({ raw_text: l })),
        steps: aLineas(pasos).map((t) => ({ text: t })),
      });
      router.replace({ pathname: '/receta/[id]', params: { id } });
    } catch (err) {
      Alert.alert('No pudimos guardar la receta', err instanceof Error ? err.message : 'Inténtalo de nuevo.');
    }
  }

  const campo = [estilos.campo, { backgroundColor: colores.backgroundElement, color: colores.text }];

  return (
    <KeyboardAvoidingView
      style={estilos.pantalla}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <View style={estilos.grupo}>
          <ThemedText type="smallBold">Nombre del plato</ThemedText>
          <TextInput
            value={titulo}
            onChangeText={setTitulo}
            placeholder="Pollo al curry"
            placeholderTextColor={colores.textSecondary}
            style={campo}
            autoFocus
            accessibilityLabel="Nombre del plato"
          />
        </View>

        <View style={estilos.fila}>
          <View style={[estilos.grupo, estilos.mitad]}>
            <ThemedText type="smallBold">Porciones</ThemedText>
            <TextInput
              value={porciones}
              onChangeText={(t) => setPorciones(t.replace(/[^0-9]/g, ''))}
              placeholder="4"
              placeholderTextColor={colores.textSecondary}
              keyboardType="number-pad"
              style={campo}
              accessibilityLabel="Número de porciones"
            />
          </View>
          <View style={[estilos.grupo, estilos.mitad]}>
            <ThemedText type="smallBold">Minutos</ThemedText>
            <TextInput
              value={minutos}
              onChangeText={(t) => setMinutos(t.replace(/[^0-9]/g, ''))}
              placeholder="30"
              placeholderTextColor={colores.textSecondary}
              keyboardType="number-pad"
              style={campo}
              accessibilityLabel="Minutos de preparación"
            />
          </View>
        </View>

        <View style={estilos.grupo}>
          <ThemedText type="smallBold">Ingredientes</ThemedText>
          <ThemedText type="small" style={estilos.ayuda}>
            Uno por línea, tal como lo dirías: «2 tazas de harina».
          </ThemedText>
          <TextInput
            value={ingredientes}
            onChangeText={setIngredientes}
            placeholder={'2 tazas de harina\n3 huevos\nSal al gusto'}
            placeholderTextColor={colores.textSecondary}
            style={[...campo, estilos.area]}
            multiline
            accessibilityLabel="Ingredientes, uno por línea"
          />
        </View>

        <View style={estilos.grupo}>
          <ThemedText type="smallBold">Preparación</ThemedText>
          <ThemedText type="small" style={estilos.ayuda}>
            Un paso por línea.
          </ThemedText>
          <TextInput
            value={pasos}
            onChangeText={setPasos}
            placeholder={'Precalentar el horno a 180°C\nMezclar los secos\nHornear 25 minutos'}
            placeholderTextColor={colores.textSecondary}
            style={[...campo, estilos.area]}
            multiline
            accessibilityLabel="Pasos de preparación, uno por línea"
          />
        </View>
      </ScrollView>

      <View style={[estilos.pie, { backgroundColor: colores.background }]}>
        <Pressable
          onPress={guardar}
          disabled={!puedeGuardar}
          accessibilityRole="button"
          style={({ pressed }) => [
            estilos.boton,
            { backgroundColor: colores.text, opacity: !puedeGuardar ? 0.4 : pressed ? 0.8 : 1 },
          ]}>
          {crear.isPending ? (
            <ActivityIndicator color={colores.background} />
          ) : (
            <ThemedText style={{ color: colores.background, fontWeight: '600' }}>Guardar receta</ThemedText>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  grupo: { gap: Spacing.one },
  fila: { flexDirection: 'row', gap: Spacing.three },
  mitad: { flex: 1 },
  campo: { borderRadius: 12, padding: Spacing.three, fontSize: 16, minHeight: 48 },
  area: { minHeight: 130, textAlignVertical: 'top' },
  ayuda: { opacity: 0.6 },
  pie: { padding: Spacing.three },
  boton: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
