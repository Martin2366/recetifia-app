import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { BotonOnboarding } from '@/components/onboarding/boton';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';

/**
 * Minitour de la primera importacion: cuatro tarjetas, una por camino (redes,
 * foto, web, texto), cada una con "Probar" para ir directo. Se ve la primera
 * vez que se toca "Añadir una receta" y se repite con "¿Cómo funciona?".
 */

const CLAVE = 'recetifia:tour-importar';

export type CaminoImportar = 'redes' | 'foto' | 'web' | 'texto';

type Icono = keyof typeof MaterialCommunityIcons.glyphMap;

const PASOS: { camino: CaminoImportar; icono: Icono; titulo: string; texto: string; gratis: boolean }[] = [
  {
    camino: 'redes',
    icono: 'share-variant',
    titulo: 'Desde redes sociales',
    texto: 'En Instagram, TikTok, YouTube o Facebook toca Compartir y elige Recetifia. Leemos la publicación, escuchamos el video y miramos lo escrito.',
    gratis: false,
  },
  {
    camino: 'foto',
    icono: 'camera-outline',
    titulo: 'Desde una foto',
    texto: 'Elige una captura de tu galería o fotografía un libro o un cuaderno. Si trae varias recetas, las separamos.',
    gratis: false,
  },
  {
    camino: 'web',
    icono: 'web',
    titulo: 'Desde la web',
    texto: 'Pega el enlace de un blog de cocina, o escribe qué buscas. Traemos los ingredientes y los pasos, sin anuncios.',
    gratis: true,
  },
  {
    camino: 'texto',
    icono: 'format-text',
    titulo: 'Desde un texto',
    texto: '¿Te la mandaron por WhatsApp o la tienes en notas? Pega el texto y la ordenamos en ingredientes y pasos.',
    gratis: true,
  },
];

/** Si el minitour todavia no se vio. Ante la duda, si: es lo seguro para alguien nuevo. */
export async function tourImportarPendiente(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CLAVE)) !== '1';
  } catch {
    return true;
  }
}

export function TourImportar({ alProbar, alTerminar }: { alProbar: (c: CaminoImportar) => void; alTerminar: () => void }) {
  const [i, setI] = useState(0);
  const paso = PASOS[i];
  const ultimo = i === PASOS.length - 1;

  function marcarVisto() {
    AsyncStorage.setItem(CLAVE, '1').catch(() => {});
  }

  function terminar() {
    marcarVisto();
    alTerminar();
  }

  return (
    <View style={estilos.columna}>
      <View style={estilos.cabecera}>
        <Text style={estilos.contador}>
          {i + 1} de {PASOS.length} · Cómo importar
        </Text>
        <Pressable onPress={terminar} hitSlop={10} accessibilityRole="button">
          <Text style={estilos.saltar}>Saltar</Text>
        </Pressable>
      </View>

      <Animated.View key={paso.camino} entering={FadeIn.duration(260)} style={estilos.tarjeta}>
        <View style={estilos.burbuja}>
          <MaterialCommunityIcons name={paso.icono} size={30} color={Marca.primario} />
        </View>
        <Text style={estilos.titulo}>{paso.titulo}</Text>
        <Text style={estilos.texto}>{paso.texto}</Text>
        <View style={[estilos.etiqueta, paso.gratis && estilos.etiquetaGratis]}>
          <Text style={[estilos.textoEtiqueta, paso.gratis && estilos.textoEtiquetaGratis]}>
            {paso.gratis ? 'Gratis y sin límite' : 'Usa 1 importación'}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            marcarVisto();
            alProbar(paso.camino);
          }}
          hitSlop={8}
          accessibilityRole="button"
          style={estilos.probar}>
          <Text style={estilos.textoProbar}>Probar ahora</Text>
          <MaterialCommunityIcons name="arrow-right" size={18} color={Marca.primario} />
        </Pressable>
      </Animated.View>

      <View style={estilos.puntos}>
        {PASOS.map((p, k) => (
          <View key={p.camino} style={[estilos.punto, k === i && estilos.puntoActivo]} />
        ))}
      </View>

      <BotonOnboarding texto={ultimo ? 'Entendido' : 'Siguiente'} alPulsar={() => (ultimo ? terminar() : setI(i + 1))} />
    </View>
  );
}

const estilos = StyleSheet.create({
  columna: { gap: 14 },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  contador: { fontFamily: Tipografia.negrita, fontSize: 12, letterSpacing: 0.8, color: Marca.primario, textTransform: 'uppercase' },
  saltar: { fontFamily: Tipografia.seminegrita, fontSize: 15, color: Colors.light.textSecondary },
  tarjeta: {
    alignItems: 'center',
    gap: 10,
    padding: 20,
    borderRadius: Radios.grande,
    borderWidth: 1.5,
    borderColor: Colors.light.borde,
    minHeight: 270,
  },
  burbuja: { width: 64, height: 64, borderRadius: 32, backgroundColor: Marca.primarioTenue, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: Tipografia.display, fontSize: 22, color: Colors.light.text, textAlign: 'center' },
  texto: { fontFamily: Tipografia.regular, fontSize: 15, lineHeight: 22, color: Colors.light.textSecondary, textAlign: 'center' },
  etiqueta: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radios.pildora, backgroundColor: '#FFF4EE' },
  etiquetaGratis: { backgroundColor: '#EAF7EE' },
  textoEtiqueta: { fontFamily: Tipografia.seminegrita, fontSize: 13, color: Marca.primario },
  textoEtiquetaGratis: { color: Marca.exito },
  probar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  textoProbar: { fontFamily: Tipografia.seminegrita, fontSize: 15, color: Marca.primario },
  puntos: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  punto: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.light.borde },
  puntoActivo: { width: 20, backgroundColor: Marca.primario },
});
