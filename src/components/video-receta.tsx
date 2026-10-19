import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { createElement, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { videoOriginal } from '@/lib/video-embebido';

/**
 * El video original de la receta, dentro de la app y con el reproductor de su
 * red. Al principio es solo una tarjeta con la foto y ▶: el reproductor (y su
 * gasto de datos y memoria) se carga recien al tocar. Si la red no deja verlo
 * aqui, queda el boton para abrirlo en su app.
 */
export function VideoReceta({ sourceUrl, foto, ancho }: { sourceUrl: string | null | undefined; foto: string | null; ancho: number }) {
  const { height } = useWindowDimensions();
  const video = videoOriginal(sourceUrl);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState(false);
  if (!video) return null;

  const abrirAfuera = () => Linking.openURL(video.original).catch(() => {});
  const alto = video.vertical ? Math.min(ancho * (16 / 9), height * 0.65) : ancho * (9 / 16);

  // Sin reproductor posible: solo el boton para ir a la red
  if (!video.embebido || fallo) {
    return (
      <Pressable onPress={abrirAfuera} accessibilityRole="link" style={({ pressed }) => [estilos.enlace, pressed && { opacity: 0.8 }]}>
        <MaterialCommunityIcons name="play-circle-outline" size={22} color={Marca.primarioTexto} />
        <Text style={estilos.textoEnlace} maxFontSizeMultiplier={1.3}>
          Ver el video en {video.red}
        </Text>
        <MaterialCommunityIcons name="open-in-new" size={16} color={Marca.primarioTexto} />
      </Pressable>
    );
  }

  if (!abierto) {
    return (
      <Pressable
        onPress={() => setAbierto(true)}
        accessibilityRole="button"
        accessibilityLabel={`Reproducir el video en ${video.red}`}
        style={({ pressed }) => [estilos.portada, { width: ancho, height: Math.min(alto, ancho * 0.8) }, pressed && { opacity: 0.92 }]}>
        {foto ? <Image source={{ uri: foto }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" /> : null}
        <View style={estilos.velo} />
        <View style={estilos.play}>
          <MaterialCommunityIcons name="play" size={38} color="#FFFFFF" />
        </View>
        <Text style={estilos.textoPortada} maxFontSizeMultiplier={1.3}>
          Ver el video en {video.red}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={[estilos.marco, { width: ancho, height: alto }]}>
        {Platform.OS === 'web' ? (
          // En la web (vista previa) no hay WebView: el mismo reproductor en un iframe
          createElement('iframe', {
            src: video.embebido,
            style: { border: 0, width: '100%', height: '100%' },
            allow: 'autoplay; encrypted-media; fullscreen; picture-in-picture',
            onLoad: () => setCargando(false),
          })
        ) : (
          <WebView
            source={{ uri: video.embebido }}
            style={estilos.web}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            allowsFullscreenVideo
            javaScriptEnabled
            domStorageEnabled
            // La persona ya pidio verlo: el reproductor puede arrancar solo
            originWhitelist={['https://*']}
            setSupportMultipleWindows={false}
            onLoadEnd={() => setCargando(false)}
            onError={() => setFallo(true)}
            onHttpError={(e) => e.nativeEvent.statusCode >= 400 && setFallo(true)}
            // El reproductor navega dentro de su propio dominio; cualquier otro
            // enlace (perfil, "ver en la app") se abre afuera y no aqui
            onShouldStartLoadWithRequest={(r) => {
              if (!r.isTopFrame || r.url.startsWith('about:') || mismoDominio(r.url, video.embebido!)) return true;
              Linking.openURL(r.url).catch(() => {});
              return false;
            }}
          />
        )}
        {cargando ? (
          <View style={[StyleSheet.absoluteFill, estilos.cargando]}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : null}
      </View>
      <Pressable onPress={abrirAfuera} hitSlop={8} accessibilityRole="link" style={estilos.abrirAfuera}>
        <Text style={estilos.textoAbrirAfuera} maxFontSizeMultiplier={1.3}>
          Abrir en {video.red}
        </Text>
        <MaterialCommunityIcons name="open-in-new" size={14} color={Colors.light.textSecondary} />
      </Pressable>
    </View>
  );
}

function mismoDominio(url: string, embebido: string): boolean {
  try {
    const raiz = (h: string) => h.split('.').slice(-2).join('.');
    return raiz(new URL(url).hostname) === raiz(new URL(embebido).hostname);
  } catch {
    return false;
  }
}

const estilos = StyleSheet.create({
  portada: {
    borderRadius: Radios.grande - 4,
    overflow: 'hidden',
    backgroundColor: '#2A211D',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  velo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(20,12,8,0.35)',
  },
  play: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,107,58,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  textoPortada: {
    fontFamily: Tipografia.seminegrita,
    fontSize: 15,
    color: '#FFFFFF',
  },
  marco: {
    borderRadius: Radios.grande - 4,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  web: { flex: 1, backgroundColor: '#000000' },
  cargando: { alignItems: 'center', justifyContent: 'center' },
  enlace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radios.pildora,
    backgroundColor: Marca.primarioTenue,
  },
  textoEnlace: {
    fontFamily: Tipografia.seminegrita,
    fontSize: 15,
    color: Marca.primarioTexto,
  },
  abrirAfuera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
  },
  textoAbrirAfuera: {
    fontFamily: Tipografia.media,
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
});
