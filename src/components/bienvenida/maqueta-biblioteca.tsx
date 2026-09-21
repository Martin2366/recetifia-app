import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Marca, Tipografia } from '@/constants/theme';

import { FOTOS } from './telefono';

/**
 * Maqueta de la pantalla "Mis recetas" dentro de un marco de celular.
 *
 * Es provisional: cuando haya recetas importadas de verdad, se sustituye por una
 * captura real de la app, igual que hace la referencia.
 */

const FOTO = [FOTOS.instagram, FOTOS.tiktok, FOTOS.facebook, FOTOS.youtube, FOTOS.google].filter(Boolean) as number[];
const foto = (i: number) => FOTO[i % FOTO.length];

const COLECCIONES = [
  { nombre: 'Postres', cuantas: 15, fotos: [0, 1, 2] },
  { nombre: 'Almuerzos', cuantas: 12, fotos: [1, 3, 0] },
  { nombre: 'Salsas', cuantas: 10, fotos: [2, 0, 3] },
  { nombre: 'Pollo', cuantas: 18, fotos: [3, 2, 1] },
];

// Cada miniatura enfoca una zona distinta de la captura para no repetir encuadre
const ENCUADRES = ['center', 'top', 'bottom'] as const;

function Mosaico({ fotos, ancho }: { fotos: number[]; ancho: number }) {
  const alto = ancho * 0.9;
  return (
    <View style={[estilos.mosaico, { width: ancho, height: alto }]}>
      <Image source={foto(fotos[0])} style={{ width: ancho, height: alto * 0.55 }} contentFit="cover" contentPosition="center" />
      <View style={estilos.filaMosaico}>
        {fotos.slice(1).map((f, i) => (
          <Image
            key={i}
            source={foto(f)}
            style={{ flex: 1, height: alto * 0.45 - 2 }}
            contentFit="cover"
            contentPosition={ENCUADRES[(i + 1) % ENCUADRES.length]}
          />
        ))}
      </View>
    </View>
  );
}

export function MaquetaBiblioteca({ ancho }: { ancho: number }) {
  const alto = Math.round(ancho * 2.08);
  const marco = Math.max(5, ancho * 0.025);
  const interior = ancho - marco * 2;
  const anchoTarjeta = (interior - 12 * 2 - 10) / 2;
  const escala = ancho / 280; // la maqueta se diseno a 280 de ancho

  return (
    <View style={[estilos.marco, { width: ancho, height: alto, borderRadius: ancho * 0.13, padding: marco }]}>
      <View style={[estilos.pantalla, { borderRadius: ancho * 0.11 }]}>
        <View style={estilos.cabecera}>
          <View style={estilos.marca}>
            <Image source={require('@/assets/images/logo.png')} style={{ width: 16 * escala, height: 14 * escala }} contentFit="contain" />
            <Text style={[estilos.nombreMarca, { fontSize: 13 * escala }]}>Recetifia</Text>
          </View>
          <Text style={[estilos.titulo, { fontSize: 20 * escala, lineHeight: 26 * escala }]}>Mis recetas</Text>

          <View style={estilos.pestanas}>
            <View style={[estilos.pestana, estilos.pestanaActiva]}>
              <Text style={[estilos.textoPestana, { fontSize: 10 * escala, color: Colors.light.text }]}>Colecciones</Text>
            </View>
            <View style={estilos.pestana}>
              <Text style={[estilos.textoPestana, { fontSize: 10 * escala }]}>Todas</Text>
            </View>
          </View>

          <View style={estilos.buscador}>
            <MaterialIcons name="search" size={13 * escala} color={Colors.light.textTenue} />
            <Text style={[estilos.textoBuscador, { fontSize: 10 * escala }]}>Buscar</Text>
          </View>
        </View>

        <View style={estilos.rejilla}>
          {COLECCIONES.map((c) => (
            <View key={c.nombre} style={{ width: anchoTarjeta }}>
              <Mosaico fotos={c.fotos} ancho={anchoTarjeta} />
              <Text style={[estilos.nombreColeccion, { fontSize: 10.5 * escala }]}>{c.nombre}</Text>
              <Text style={[estilos.cuantas, { fontSize: 9 * escala }]}>{c.cuantas} recetas</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  marco: {
    backgroundColor: '#1B1F1F',
    elevation: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  pantalla: { flex: 1, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  cabecera: { paddingHorizontal: 12, paddingTop: 18, gap: 6 },
  marca: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  nombreMarca: { fontFamily: Tipografia.negrita, color: Marca.primario },
  titulo: { fontFamily: Tipografia.display, color: Colors.light.text },
  pestanas: { flexDirection: 'row', gap: 6, marginTop: 2 },
  pestana: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: Colors.light.background },
  pestanaActiva: { backgroundColor: Marca.primarioTenue },
  textoPestana: { fontFamily: Tipografia.media, color: Colors.light.textSecondary },
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: Colors.light.borde,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
    marginTop: 2,
  },
  textoBuscador: { fontFamily: Tipografia.regular, color: Colors.light.textTenue },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 12, paddingTop: 12 },
  mosaico: { borderRadius: 10, overflow: 'hidden', gap: 2, backgroundColor: '#FFF' },
  filaMosaico: { flexDirection: 'row', gap: 2 },
  nombreColeccion: { fontFamily: Tipografia.seminegrita, color: Colors.light.text, marginTop: 5 },
  cuantas: { fontFamily: Tipografia.regular, color: Colors.light.textSecondary },
});
