import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, BackHandler, KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotonOnboarding } from '@/components/onboarding/boton';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { useCrearColeccion } from '@/lib/colecciones';
import type { Cuota } from '@/lib/cuota';

/**
 * Hoja inferior del boton +. Navega entre vistas dentro de la misma hoja, como
 * la referencia: menu → anadir receta → foto, redes o coleccion.
 */

const SUAVE = Easing.bezier(0.22, 1, 0.36, 1);
type Icono = keyof typeof MaterialCommunityIcons.glyphMap;
type Vista = 'menu' | 'receta' | 'foto' | 'redes' | 'coleccion';

export type DestinoHoja = 'texto' | 'web' | 'cero' | 'plus';

export function HojaAgregar({
  visible,
  alCerrar,
  alElegir,
  cuota,
}: {
  visible: boolean;
  alCerrar: () => void;
  /** La hoja se cierra y la pantalla navega. */
  alElegir: (destino: DestinoHoja) => void;
  cuota: Cuota | undefined;
}) {
  const insets = useSafeAreaInsets();
  const [vista, setVista] = useState<Vista>('menu');
  const [montada, setMontada] = useState(visible);
  const abierta = useSharedValue(0);
  const cambio = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      setVista('menu');
      setMontada(true);
      abierta.value = withTiming(1, { duration: 380, easing: SUAVE });
    } else {
      abierta.value = withTiming(0, { duration: 240 });
      const t = setTimeout(() => setMontada(false), 240);
      return () => clearTimeout(t);
    }
  }, [visible, abierta]);

  function ir(v: Vista) {
    cambio.value = 0;
    cambio.value = withTiming(1, { duration: 280, easing: SUAVE });
    setVista(v);
  }

  function volver() {
    if (vista === 'menu') alCerrar();
    else if (vista === 'foto' || vista === 'redes') ir('receta');
    else ir('menu');
  }

  // Atras de Android retrocede una vista antes de cerrar
  useEffect(() => {
    if (!visible) return;
    const s = BackHandler.addEventListener('hardwareBackPress', () => {
      volver();
      return true;
    });
    return () => s.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, vista]);

  const estiloVelo = useAnimatedStyle(() => ({ opacity: abierta.value * 0.45 }));
  const estiloHoja = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(abierta.value, [0, 1], [600, 0]) }] }));
  const estiloVista = useAnimatedStyle(() => ({
    opacity: cambio.value,
    transform: [{ translateX: interpolate(cambio.value, [0, 1], [18, 0]) }],
  }));

  if (!montada) return null;

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={volver}>
      <Animated.View style={[StyleSheet.absoluteFill, estilos.velo, estiloVelo]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={alCerrar} accessibilityLabel="Cerrar" />
      </Animated.View>

      {/* La hoja sube con el teclado: al nombrar una coleccion, el campo queda a la vista */}
      <KeyboardAvoidingView behavior="padding" style={estilos.contenedorHoja} pointerEvents="box-none">
        <Animated.View style={[estilos.hoja, { paddingBottom: insets.bottom + 20 }, estiloHoja]}>
        <View style={estilos.asa} />
        <Animated.View style={estiloVista}>
          {vista === 'menu' ? (
            <View style={estilos.columna}>
              <Fila icono="file-document-outline" titulo="Añadir una receta" detalle="Impórtala desde cualquier lado" alPulsar={() => ir('receta')} />
              <Fila
                icono="bookmark-multiple-outline"
                titulo="Crear una colección"
                detalle="Agrupa recetas: postres, almuerzos…"
                alPulsar={() => ir('coleccion')}
              />
            </View>
          ) : null}

          {vista === 'receta' ? (
            <View style={estilos.columna}>
              <Cabecera titulo="Añadir una receta" alVolver={volver} />
              <Pressable onPress={() => ir('redes')} style={({ pressed }) => [estilos.tarjeta, estilos.redes, pressed && estilos.presionada]}>
                <LogosRedes />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={estilos.titulo}>Desde redes sociales</Text>
                  <Text style={estilos.detalle}>Comparte a Recetifia desde la app</Text>
                </View>
              </Pressable>
              <View style={estilos.rejilla}>
                <Cuadro icono="image-outline" titulo="Desde una foto" alPulsar={() => ir('foto')} />
                {/* Texto y web no gastan importaciones: nunca se bloquean */}
                <Cuadro icono="format-text" titulo="Desde un texto" alPulsar={() => alElegir('texto')} />
                <Cuadro icono="link-variant" titulo="Desde la web" alPulsar={() => alElegir('web')} />
                <Cuadro icono="pencil-outline" titulo="Escribir desde cero" alPulsar={() => alElegir('cero')} />
              </View>
              {cuota && !cuota.plus ? (
                <Text style={estilos.nota}>
                  Te quedan {cuota.importacionesRestantes} de {cuota.tope} importaciones gratis de videos e imágenes.
                  Texto, web y a mano: sin límite.
                </Text>
              ) : null}
            </View>
          ) : null}

          {vista === 'foto' ? (
            <View style={estilos.columna}>
              <Cabecera titulo="Desde una foto" alVolver={volver} />
              <Fila icono="image-multiple-outline" titulo="Elegir de la galería" alPulsar={pronto} />
              <Fila icono="camera-outline" titulo="Tomar una foto" alPulsar={pronto} />
              <Text style={estilos.nota}>Ideal para recetas de cuadernos, libros o una captura.</Text>
            </View>
          ) : null}

          {vista === 'redes' ? (
            <View style={estilos.columna}>
              <Cabecera titulo="Desde redes sociales" alVolver={volver} />
              <Paso n={1} texto="Abre el reel o video en Instagram, TikTok, YouTube o Facebook." />
              <Paso n={2} texto="Toca Compartir y elige Recetifia en la lista de apps." />
              <Paso n={3} texto="Recetifia lee la publicación, escucha el video y mira lo que aparece escrito, y arma la receta en español." />
              <Text style={estilos.nota}>
                Si algo falta, te dejamos lo que encontramos para completarla. Las importaciones que fallan no se cuentan.
              </Text>
              <BotonOnboarding texto="Entendido" alPulsar={alCerrar} />
              <Pressable onPress={() => alElegir('web')} style={estilos.enlace} accessibilityRole="button">
                <Text style={estilos.textoEnlace}>¿Ya copiaste el enlace? Pégalo aquí</Text>
              </Pressable>
            </View>
          ) : null}

          {vista === 'coleccion' ? <VistaColeccion alVolver={volver} alListo={alCerrar} /> : null}
        </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function pronto() {
  Alert.alert('Muy pronto', 'Estamos terminando la importación desde fotos. Mientras tanto, puedes pegar el texto de la receta.');
}

/** Colecciones sin tope: organizar tus recetas nunca se cobra. */
function VistaColeccion({ alVolver, alListo }: { alVolver: () => void; alListo: () => void }) {
  const [nombre, setNombre] = useState('');
  const crear = useCrearColeccion();

  async function guardar() {
    try {
      await crear.mutateAsync(nombre);
      alListo();
    } catch (e) {
      Alert.alert('No pudimos crearla', e instanceof Error ? e.message : 'Inténtalo de nuevo.');
    }
  }

  return (
    <View style={estilos.columna}>
      <Cabecera titulo="Crear una colección" alVolver={alVolver} />
      <TextInput
        value={nombre}
        onChangeText={setNombre}
        placeholder="Ej: Postres de la abuela"
        placeholderTextColor={Colors.light.textTenue}
        style={estilos.campo}
        autoFocus
        maxLength={40}
        returnKeyType="done"
        onSubmitEditing={() => nombre.trim() && guardar()}
        accessibilityLabel="Nombre de la colección"
      />
      {crear.isPending ? (
        <View style={estilos.cargando}>
          <ActivityIndicator color="#FFF" />
        </View>
      ) : (
        <BotonOnboarding texto="Crear colección" alPulsar={guardar} apagado={!nombre.trim()} />
      )}
    </View>
  );
}

function Cabecera({ titulo, alVolver }: { titulo: string; alVolver: () => void }) {
  return (
    <View style={estilos.cabecera}>
      <Pressable onPress={alVolver} hitSlop={12} accessibilityRole="button" accessibilityLabel="Volver" style={estilos.atras}>
        <MaterialCommunityIcons name="chevron-left" size={28} color={Colors.light.text} />
      </Pressable>
      <Text style={estilos.tituloCabecera}>{titulo}</Text>
      <View style={estilos.atras} />
    </View>
  );
}

function Fila({ icono, titulo, detalle, alPulsar }: { icono: Icono; titulo: string; detalle?: string; alPulsar: () => void }) {
  return (
    <Pressable onPress={alPulsar} accessibilityRole="button" style={({ pressed }) => [estilos.tarjeta, estilos.fila, pressed && estilos.presionada]}>
      <Burbuja icono={icono} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={estilos.titulo}>{titulo}</Text>
        {detalle ? <Text style={estilos.detalle}>{detalle}</Text> : null}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color={Colors.light.textSecondary} />
    </Pressable>
  );
}

function Cuadro({ icono, titulo, alPulsar }: { icono: Icono; titulo: string; alPulsar: () => void }) {
  return (
    <Pressable onPress={alPulsar} accessibilityRole="button" style={({ pressed }) => [estilos.tarjeta, estilos.cuadro, pressed && estilos.presionada]}>
      <Burbuja icono={icono} />
      <Text style={estilos.titulo}>{titulo}</Text>
    </Pressable>
  );
}

function Burbuja({ icono }: { icono: Icono }) {
  return (
    <View style={estilos.burbuja}>
      <MaterialCommunityIcons name={icono} size={22} color={Marca.primario} />
    </View>
  );
}

/** Tres logos montados uno sobre otro. */
function LogosRedes() {
  const logos: { nombre: 'instagram' | 'tiktok' | 'youtube'; fondo: string }[] = [
    { nombre: 'instagram', fondo: '#E1306C' },
    { nombre: 'tiktok', fondo: '#111111' },
    { nombre: 'youtube', fondo: '#FF0000' },
  ];
  return (
    <View style={estilos.logos}>
      {logos.map((l, i) => (
        <View key={l.nombre} style={[estilos.logo, { backgroundColor: l.fondo, marginLeft: i ? -10 : 0, zIndex: 3 - i }]}>
          <FontAwesome6 name={l.nombre} brand size={15} color="#FFF" />
        </View>
      ))}
    </View>
  );
}

function Paso({ n, texto }: { n: number; texto: string }): ReactNode {
  return (
    <View style={estilos.paso}>
      <View style={estilos.numero}>
        <Text style={estilos.textoNumero}>{n}</Text>
      </View>
      <Text style={estilos.textoPaso}>{texto}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  velo: { backgroundColor: '#1A0F0A' },
  contenedorHoja: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  hoja: {
    paddingHorizontal: 18,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  asa: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: '#DDD6D2', marginTop: 10, marginBottom: 18 },
  columna: { gap: 12 },

  cabecera: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  atras: { width: 36, height: 36, justifyContent: 'center' },
  tituloCabecera: { flex: 1, textAlign: 'center', fontFamily: Tipografia.display, fontSize: 21, color: Colors.light.text },

  tarjeta: {
    borderRadius: Radios.grande - 4,
    borderWidth: 1.5,
    borderColor: Colors.light.borde,
    backgroundColor: '#FFFFFF',
  },
  presionada: { backgroundColor: '#FFF7F3', borderColor: '#FBD9C9' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 16 },
  redes: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 18, paddingVertical: 20 },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  cuadro: { width: '48.3%', minHeight: 116, padding: 16, gap: 12 },
  burbuja: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Marca.primarioTenue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { fontFamily: Tipografia.seminegrita, fontSize: 16, lineHeight: 21, color: Colors.light.text },
  detalle: { fontFamily: Tipografia.regular, fontSize: 14, lineHeight: 19, color: Colors.light.textSecondary },
  logos: { flexDirection: 'row' },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nota: { fontFamily: Tipografia.regular, fontSize: 13, textAlign: 'center', color: Colors.light.textSecondary, marginTop: 2 },

  paso: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 4 },
  numero: { width: 32, height: 32, borderRadius: 16, backgroundColor: Marca.primario, alignItems: 'center', justifyContent: 'center' },
  textoNumero: { fontFamily: Tipografia.negrita, fontSize: 15, color: '#FFFFFF' },
  textoPaso: { flex: 1, fontFamily: Tipografia.media, fontSize: 15, lineHeight: 21, color: Colors.light.text },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: Radios.medio,
    backgroundColor: '#FFF6E6',
  },
  textoAviso: { flex: 1, fontFamily: Tipografia.media, fontSize: 14, color: Marca.aviso },

  campo: {
    minHeight: 54,
    borderRadius: Radios.grande - 4,
    borderWidth: 1.5,
    borderColor: Colors.light.borde,
    paddingHorizontal: 16,
    fontFamily: Tipografia.media,
    fontSize: 17,
    color: Colors.light.text,
  },
  cargando: { minHeight: 56, borderRadius: Radios.pildora, backgroundColor: Marca.primario, alignItems: 'center', justifyContent: 'center' },
  enlace: { alignSelf: 'center', padding: 8 },
  textoEnlace: { fontFamily: Tipografia.seminegrita, fontSize: 15, color: Colors.light.textSecondary },
});
