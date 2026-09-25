import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { dejarBorrador } from '@/lib/borrador';
import { recetaDesdeTexto } from '@/lib/importar';

/**
 * Importar desde texto pegado (WhatsApp, notas, la descripcion de un reel). Se
 * ordena en el telefono, sin IA, y se abre en el editor para revisarla.
 */
export default function ImportarTexto() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [texto, setTexto] = useState('');
  const [consejos, setConsejos] = useState(true);

  const listo = texto.trim().split(/\n/).filter((l) => l.trim()).length >= 2;

  function importar() {
    dejarBorrador(recetaDesdeTexto(texto));
    router.replace('/receta/nueva');
  }

  return (
    <KeyboardAvoidingView style={[estilos.pantalla, { paddingTop: insets.top }]} behavior="padding">
      <StatusBar style="dark" />
      <View style={estilos.cabecera}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar">
          <MaterialCommunityIcons name="close" size={26} color={Colors.light.text} />
        </Pressable>
        <Text style={estilos.titulo}>Desde un texto</Text>
        <Pressable onPress={importar} disabled={!listo} hitSlop={12} accessibilityRole="button" accessibilityState={{ disabled: !listo }}>
          <Text style={[estilos.importar, !listo && estilos.importarApagado]}>Importar</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={estilos.cuerpo} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => setConsejos((v) => !v)} style={estilos.consejos} accessibilityRole="button" accessibilityState={{ expanded: consejos }}>
          <View style={estilos.filaConsejos}>
            <MaterialCommunityIcons name="lightbulb-on-outline" size={22} color={Marca.primario} />
            <Text style={estilos.tituloConsejos}>Consejos para importar</Text>
            <MaterialCommunityIcons name={consejos ? 'chevron-up' : 'chevron-down'} size={22} color={Colors.light.textSecondary} />
          </View>
          {consejos ? (
            <Text style={estilos.textoConsejos}>
              Pon el nombre del plato en la primera línea y cada ingrediente y cada paso en su propia línea. Si el texto trae
              los títulos «Ingredientes» y «Preparación», mejor todavía.
            </Text>
          ) : null}
        </Pressable>

        <TextInput
          value={texto}
          onChangeText={setTexto}
          placeholder="Escribe o pega la receta completa"
          placeholderTextColor={Colors.light.textTenue}
          multiline
          autoFocus
          textAlignVertical="top"
          style={estilos.entrada}
          accessibilityLabel="Texto de la receta"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#FFFFFF' },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borde,
  },
  titulo: { fontFamily: Tipografia.display, fontSize: 19, color: Colors.light.text },
  importar: { fontFamily: Tipografia.negrita, fontSize: 17, color: Marca.primario },
  importarApagado: { color: '#FFC7B2' },

  cuerpo: { padding: 18, gap: 18, flexGrow: 1 },
  consejos: { padding: 16, borderRadius: Radios.grande - 4, backgroundColor: '#FFF7F3', gap: 8 },
  filaConsejos: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tituloConsejos: { flex: 1, fontFamily: Tipografia.seminegrita, fontSize: 16, color: Colors.light.text },
  textoConsejos: { fontFamily: Tipografia.regular, fontSize: 14, lineHeight: 20, color: Colors.light.textSecondary },
  entrada: { flex: 1, minHeight: 320, fontFamily: Tipografia.regular, fontSize: 17, lineHeight: 25, color: Colors.light.text },
});
