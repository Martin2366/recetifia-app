import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotonOnboarding } from '@/components/onboarding/boton';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { dejarBorrador } from '@/lib/borrador';
import { esEnlace, esRedSocial, normalizarEnlace, RecetaNoEncontrada, recetaDesdeWeb } from '@/lib/importar';

/**
 * Importar desde la web: se pega un enlace y se lee la receta de la pagina. Si
 * se escribe texto en vez de un enlace, se busca en Google en el navegador.
 */

const SITIOS = ['recetasgratis.net', 'cookpad.com/cl', 'directoalpaladar.com', 'recetasnestle.com.mx'];

export default function ImportarWeb() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [texto, setTexto] = useState('');
  const [leyendo, setLeyendo] = useState(false);

  async function continuar() {
    const t = texto.trim();
    if (!t) return;
    Keyboard.dismiss();

    if (!esEnlace(t)) {
      await WebBrowser.openBrowserAsync(`https://www.google.com/search?q=${encodeURIComponent(`${t} receta`)}`);
      return;
    }
    const url = normalizarEnlace(t);
    // Reels, TikToks y videos necesitan la IA del servidor (audio incluido)
    if (esRedSocial(url)) {
      router.replace({ pathname: '/importar/procesando', params: { url } });
      return;
    }

    setLeyendo(true);
    try {
      dejarBorrador(await recetaDesdeWeb(url));
      router.replace('/receta/nueva');
    } catch (e) {
      if (e instanceof RecetaNoEncontrada) {
        // Sin datos estructurados: la IA del servidor lee la pagina completa
        router.replace({ pathname: '/importar/procesando', params: { url } });
      } else {
        Alert.alert('No pudimos abrir la página', 'Revisa el enlace y tu conexión, e inténtalo de nuevo.');
      }
    } finally {
      setLeyendo(false);
    }
  }

  const esUrl = esEnlace(texto);

  return (
    <View style={[estilos.pantalla, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={estilos.cabecera}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar">
          <MaterialCommunityIcons name="close" size={26} color={Colors.light.text} />
        </Pressable>
        <Text style={estilos.tituloCabecera}>Desde la web</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <View style={estilos.heroe}>
          <MaterialCommunityIcons name="web" size={40} color={Marca.primario} />
          <Text style={estilos.titulo}>Encuentra cualquier receta</Text>
          <Text style={estilos.subtitulo}>Pega el enlace de una receta, un reel o un TikTok y la traemos ordenada. O escribe qué buscas y te abrimos Google.</Text>

          <View style={estilos.buscador}>
            <MaterialCommunityIcons name={esUrl ? 'link-variant' : 'magnify'} size={22} color={Colors.light.textSecondary} />
            <TextInput
              value={texto}
              onChangeText={setTexto}
              placeholder="Pega un enlace o escribe qué buscas"
              placeholderTextColor={Colors.light.textTenue}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={continuar}
              style={estilos.entrada}
              accessibilityLabel="Enlace o búsqueda"
            />
            {texto ? (
              <Pressable onPress={() => setTexto('')} hitSlop={10} accessibilityLabel="Borrar">
                <MaterialCommunityIcons name="close-circle" size={20} color={Colors.light.textTenue} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={estilos.abajo}>
          {leyendo ? (
            <View style={estilos.leyendo}>
              <ActivityIndicator color={Marca.primario} />
              <Text style={estilos.textoLeyendo}>Leyendo la receta…</Text>
            </View>
          ) : (
            <BotonOnboarding texto={esUrl ? 'Importar receta' : 'Buscar en Google'} alPulsar={continuar} apagado={!texto.trim()} />
          )}

          <Text style={estilos.seccion}>Sitios que funcionan muy bien</Text>
          <View style={estilos.sitios}>
            {SITIOS.map((s) => (
              <Pressable
                key={s}
                onPress={() => WebBrowser.openBrowserAsync(`https://${s}`)}
                style={({ pressed }) => [estilos.sitio, pressed && { opacity: 0.7 }]}
                accessibilityRole="link">
                <MaterialCommunityIcons name="open-in-new" size={14} color={Colors.light.textSecondary} />
                <Text style={estilos.textoSitio}>{s}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={estilos.nota}>Copia el enlace de la receta en el navegador y vuelve a pegarlo aquí.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#FFFFFF' },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, height: 60 },
  tituloCabecera: { fontFamily: Tipografia.display, fontSize: 19, color: Colors.light.text },

  heroe: { backgroundColor: '#F7F2EE', alignItems: 'center', paddingHorizontal: 22, paddingTop: 44, paddingBottom: 34, gap: 10 },
  titulo: { fontFamily: Tipografia.display, fontSize: 30, lineHeight: 38, textAlign: 'center', color: Colors.light.text },
  subtitulo: { fontFamily: Tipografia.regular, fontSize: 15, lineHeight: 21, textAlign: 'center', color: Colors.light.textSecondary, marginBottom: 14 },
  buscador: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 58,
    paddingHorizontal: 18,
    borderRadius: Radios.pildora,
    backgroundColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#7A2E12',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
  },
  entrada: { flex: 1, fontFamily: Tipografia.regular, fontSize: 16, color: Colors.light.text, paddingVertical: 0 },

  abajo: { paddingHorizontal: 22, paddingTop: 24, gap: 14 },
  leyendo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 56 },
  textoLeyendo: { fontFamily: Tipografia.seminegrita, fontSize: 16, color: Colors.light.text },
  seccion: { fontFamily: Tipografia.seminegrita, fontSize: 15, color: Colors.light.text, marginTop: 14 },
  sitios: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sitio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radios.pildora,
    borderWidth: 1,
    borderColor: Colors.light.borde,
  },
  textoSitio: { fontFamily: Tipografia.media, fontSize: 13, color: Colors.light.text },
  nota: { fontFamily: Tipografia.regular, fontSize: 13, color: Colors.light.textSecondary },
});
