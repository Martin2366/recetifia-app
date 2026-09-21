import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, Text, View } from 'react-native';

import { Marca, Tipografia } from '@/constants/theme';

/**
 * Maquetas de "pantalla de celular" para la bienvenida.
 *
 * Son vistas dibujadas, no capturas: no reproducimos contenido ni interfaz de
 * terceros, y pesan cero kilobytes. Los platos son ilustraciones con iconos
 * mientras no haya fotos propias; cuando las haya, basta con pasar `foto`.
 */

export type Fuente = 'instagram' | 'tiktok' | 'youtube' | 'google' | 'galeria' | 'facebook';

type Plato = { fondo: string; plato: string; icono: keyof typeof MaterialCommunityIcons.glyphMap; color: string };

export const FUENTES: {
  id: Fuente;
  nombre: string;
  color: string;
  plato: Plato;
}[] = [
  {
    id: 'instagram',
    nombre: 'Instagram',
    color: '#E1306C',
    plato: { fondo: '#E9DCC9', plato: '#FFF8EE', icono: 'bowl-mix', color: '#C8553D' },
  },
  {
    id: 'tiktok',
    nombre: 'TikTok',
    color: '#111111',
    plato: { fondo: '#D9C7B0', plato: '#FFF8EE', icono: 'noodles', color: '#9A3B1F' },
  },
  {
    id: 'youtube',
    nombre: 'YouTube',
    color: '#FF0000',
    plato: { fondo: '#E6D3C2', plato: '#FFF8EE', icono: 'food-drumstick', color: '#B5651D' },
  },
  {
    id: 'google',
    nombre: 'Google',
    color: '#4285F4',
    plato: { fondo: '#EFE6D8', plato: '#FFFFFF', icono: 'pasta', color: '#D9A13B' },
  },
  {
    id: 'galeria',
    nombre: 'Galería',
    color: '#F4B400',
    plato: { fondo: '#EDE7E1', plato: '#FFFFFF', icono: 'rice', color: '#7A8B3A' },
  },
  {
    id: 'facebook',
    nombre: 'Facebook',
    color: '#1877F2',
    plato: { fondo: '#E3D6C4', plato: '#FFF8EE', icono: 'pizza', color: '#C0392B' },
  },
];

function IconoFuente({ fuente, tamano }: { fuente: Fuente; tamano: number }) {
  const f = FUENTES.find((x) => x.id === fuente)!;
  if (fuente === 'galeria') {
    return <MaterialIcons name="photo-library" size={tamano} color={f.color} />;
  }
  return <FontAwesome6 name={fuente} brand size={tamano} color={f.color} />;
}

/** Icono + nombre de la red, encima de cada tarjeta. */
export function Etiqueta({ fuente, escala = 1 }: { fuente: Fuente; escala?: number }) {
  const f = FUENTES.find((x) => x.id === fuente)!;
  return (
    <View style={[estilos.etiqueta, { gap: 8 * escala }]}>
      <IconoFuente fuente={fuente} tamano={30 * escala} />
      <Text style={[estilos.etiquetaTexto, { fontSize: 18 * escala }]}>{f.nombre}</Text>
    </View>
  );
}

/** Un plato dibujado: fondo de mesa, plato claro y el icono de la comida. */
function Ilustracion({ plato, alto }: { plato: Plato; alto: number }) {
  const diametro = alto * 0.62;
  return (
    <View style={[estilos.foto, { backgroundColor: plato.fondo }]}>
      <View
        style={[
          estilos.plato,
          { width: diametro, height: diametro, borderRadius: diametro / 2, backgroundColor: plato.plato },
        ]}>
        <MaterialCommunityIcons name={plato.icono} size={diametro * 0.52} color={plato.color} />
      </View>
    </View>
  );
}

function BarraComentario({ ancho }: { ancho: number }) {
  return (
    <View style={estilos.barraOscura}>
      <View style={estilos.campoComentario}>
        <Text style={[estilos.textoComentario, { fontSize: Math.max(9, ancho * 0.04) }]} numberOfLines={1}>
          Añade un comentario…
        </Text>
      </View>
    </View>
  );
}

function Contenido({ fuente, ancho, alto }: { fuente: Fuente; ancho: number; alto: number }) {
  const f = FUENTES.find((x) => x.id === fuente)!;

  if (fuente === 'google') {
    return (
      <View style={estilos.web}>
        <View style={estilos.barraNavegador}>
          <MaterialIcons name="close" size={16} color="#444" />
          <Text style={estilos.dominio} numberOfLines={1}>
            cocinafacil.com
          </Text>
          <MaterialIcons name="more-vert" size={16} color="#444" />
        </View>
        <Text style={[estilos.tituloWeb, { fontSize: ancho * 0.075 }]}>PASTEL DE CHOCLO DE LA ABUELA</Text>
        <View style={{ height: alto * 0.34, marginHorizontal: 12, borderRadius: 6, overflow: 'hidden' }}>
          <Ilustracion plato={f.plato} alto={alto * 0.34} />
        </View>
        {[0.9, 0.75, 0.85, 0.6].map((w, i) => (
          <View key={i} style={[estilos.lineaTexto, { width: `${w * 88}%` }]} />
        ))}
      </View>
    );
  }

  if (fuente === 'galeria') {
    const colores = ['#E9C8A8', '#D6B38D', '#C9D6B0', '#EFD9C3', '#DDBFA6', '#CFC2B0', '#E7D1B8', '#C7B59B', '#E2CFB7', '#D9C4A5', '#EAD7C0', '#CDBB9E'];
    const marcadas = new Set([3, 4, 5]);
    return (
      <View style={estilos.galeria}>
        <View style={estilos.cabeceraGaleria}>
          <Text style={estilos.accionGaleria}>Cancelar</Text>
          <Text style={estilos.tituloGaleria}>Fotos</Text>
          <Text style={[estilos.accionGaleria, { fontFamily: Tipografia.seminegrita }]}>Añadir</Text>
        </View>
        <View style={estilos.rejilla}>
          {colores.map((c, i) => (
            <View key={i} style={[estilos.celda, { backgroundColor: c }]}>
              {i % 3 === 1 ? <MaterialCommunityIcons name="food-steak" size={18} color="#8C5A3C" /> : null}
              {marcadas.has(i) ? (
                <MaterialCommunityIcons name="check-circle" size={16} color="#1877F2" style={estilos.check} />
              ) : null}
            </View>
          ))}
        </View>
      </View>
    );
  }

  // Redes de video: foto a sangre y barra inferior
  return (
    <View style={{ flex: 1 }}>
      <Ilustracion plato={f.plato} alto={alto} />
      {fuente === 'tiktok' ? (
        <View style={estilos.accionesVideo}>
          <FontAwesome6 name="heart" solid size={18} color="#fff" />
          <FontAwesome6 name="comment" solid size={18} color="#fff" />
          <FontAwesome6 name="share" solid size={18} color="#fff" />
        </View>
      ) : null}
      {fuente === 'youtube' ? (
        <View style={estilos.progreso}>
          <View style={[estilos.progresoRelleno, { backgroundColor: f.color }]} />
        </View>
      ) : null}
      <BarraComentario ancho={ancho} />
    </View>
  );
}

/** La tarjeta con forma de celular. */
export function Telefono({ fuente, ancho }: { fuente: Fuente; ancho: number }) {
  const alto = ancho * 2.05;
  return (
    <View style={[estilos.telefono, { width: ancho, height: alto, borderRadius: ancho * 0.1 }]}>
      <Contenido fuente={fuente} ancho={ancho} alto={alto} />
    </View>
  );
}

const estilos = StyleSheet.create({
  etiqueta: { flexDirection: 'row', alignItems: 'center' },
  etiquetaTexto: { fontFamily: Tipografia.seminegrita, color: '#222B2B' },

  telefono: {
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },

  foto: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  plato: {
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#5A3A20',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },

  barraOscura: { backgroundColor: '#111', paddingHorizontal: 10, paddingVertical: 10 },
  campoComentario: { backgroundColor: '#2A2A2A', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  textoComentario: { color: '#9A9A9A', fontFamily: Tipografia.regular },

  accionesVideo: { position: 'absolute', right: 10, bottom: 70, gap: 16, alignItems: 'center' },
  progreso: { position: 'absolute', left: 0, right: 0, bottom: 50, height: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  progresoRelleno: { width: '38%', height: 3 },

  web: { flex: 1, backgroundColor: '#FFFFFF', gap: 10 },
  barraNavegador: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDD',
  },
  dominio: { fontFamily: Tipografia.media, fontSize: 11, color: '#444' },
  tituloWeb: { fontFamily: Tipografia.negrita, color: Marca.primario, paddingHorizontal: 12, lineHeight: undefined },
  lineaTexto: { height: 6, borderRadius: 3, backgroundColor: '#E6E6E6', marginLeft: 12 },

  galeria: { flex: 1, backgroundColor: '#F2F2F4' },
  cabeceraGaleria: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 18,
    paddingBottom: 10,
  },
  accionGaleria: { fontFamily: Tipografia.media, fontSize: 11, color: '#1877F2' },
  tituloGaleria: { fontFamily: Tipografia.seminegrita, fontSize: 11, color: '#222' },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, paddingHorizontal: 2 },
  celda: { width: '32.6%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  check: { position: 'absolute', right: 4, bottom: 4 },
});
