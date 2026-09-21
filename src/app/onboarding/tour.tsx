import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotonOnboarding } from '@/components/onboarding/boton';
import { Indicacion, Pulso } from '@/components/onboarding/pulso';
import { RECETA_DEMO, Reel } from '@/components/onboarding/reel';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';

/**
 * Recorrido guiado e interactivo: el usuario importa de mentira una receta desde
 * un reel, tocando lo mismo que tocara de verdad. Tres toques y la receta
 * aparece ordenada. Los toques fuera del objetivo sacuden la instruccion.
 */

const SUAVE = Easing.bezier(0.22, 1, 0.36, 1);

type Etapa = 'reel' | 'hoja' | 'android' | 'importando' | 'lista';

const INSTRUCCIONES: Partial<Record<Etapa, { paso: number; texto: string }>> = {
  reel: { paso: 1, texto: 'Viste una receta que te encantó. Toca el avión de papel para compartirla.' },
  hoja: { paso: 2, texto: 'Toca «Compartir en…» para abrir el menú de Android.' },
  android: { paso: 3, texto: 'Elige Recetifia entre tus apps.' },
};

const MENSAJES_CARGA = ['Viendo el reel…', 'Anotando los ingredientes…', 'Ordenando los pasos…'];

export default function Tour() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [etapa, setEtapa] = useState<Etapa>('reel');

  const instruccion = useSharedValue(0);
  const sacudida = useSharedValue(0);
  const hoja = useSharedValue(0);
  const android = useSharedValue(0);

  // Cada instruccion nueva entra desde arriba
  useEffect(() => {
    if (!INSTRUCCIONES[etapa]) return;
    instruccion.value = 0;
    instruccion.value = withDelay(etapa === 'reel' ? 400 : 250, withTiming(1, { duration: 450, easing: SUAVE }));
  }, [etapa, instruccion]);

  function pista() {
    sacudida.value = withSequence(
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 70 }),
      withTiming(-6, { duration: 70 }),
      withTiming(5, { duration: 70 }),
      withTiming(0, { duration: 60 })
    );
  }

  function abrirHoja() {
    setEtapa('hoja');
    hoja.value = withTiming(1, { duration: 420, easing: SUAVE });
  }

  function abrirAndroid() {
    hoja.value = withTiming(0, { duration: 220 });
    setEtapa('android');
    android.value = withDelay(180, withTiming(1, { duration: 420, easing: SUAVE }));
  }

  function importar() {
    android.value = withTiming(0, { duration: 220 });
    setEtapa('importando');
  }

  function terminar() {
    router.push('/onboarding/configurando');
  }

  const estiloInstruccion = useAnimatedStyle(() => ({
    opacity: instruccion.value,
    transform: [{ translateY: interpolate(instruccion.value, [0, 1], [-16, 0]) }, { translateX: sacudida.value }],
  }));
  const estiloVelo = useAnimatedStyle(() => ({ opacity: Math.max(hoja.value, android.value) * 0.5 }));
  const estiloHoja = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(hoja.value, [0, 1], [520, 0]) }] }));
  const estiloAndroid = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(android.value, [0, 1], [560, 0]) }] }));

  const guia = INSTRUCCIONES[etapa];
  const oscuro = etapa === 'reel' || etapa === 'hoja' || etapa === 'android';

  return (
    <View style={estilos.pantalla}>
      <StatusBar style={oscuro ? 'light' : 'dark'} />

      {/* El reel ocupa toda la pantalla; tocar fuera del objetivo da una pista */}
      <Pressable style={StyleSheet.absoluteFill} onPress={pista} accessible={false}>
        <Reel resaltarCompartir={etapa === 'reel'} alCompartir={etapa === 'reel' ? abrirHoja : undefined} paddingInferior={insets.bottom} />
      </Pressable>

      <Animated.View pointerEvents={etapa === 'hoja' || etapa === 'android' ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, estilos.velo, estiloVelo]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={pista} accessible={false} />
      </Animated.View>

      <Animated.View style={[estilos.hoja, { paddingBottom: insets.bottom + 24 }, estiloHoja]}>
        <HojaInstagram activa={etapa === 'hoja'} alCompartirEn={abrirAndroid} />
      </Animated.View>

      <Animated.View style={[estilos.hoja, estilos.hojaAndroid, { paddingBottom: insets.bottom + 56 }, estiloAndroid]}>
        <HojaAndroid activa={etapa === 'android'} alElegir={importar} />
      </Animated.View>

      {etapa === 'importando' ? <Importando alTerminar={() => setEtapa('lista')} /> : null}
      {etapa === 'lista' ? <RecetaLista alContinuar={terminar} paddingInferior={insets.bottom} /> : null}

      {guia ? (
        <Animated.View style={[estilos.instruccion, { top: insets.top + 56 }, estiloInstruccion]} accessibilityLiveRegion="polite">
          <Text style={estilos.pasoInstruccion}>PASO {guia.paso} DE 3</Text>
          <Text style={estilos.textoInstruccion}>{guia.texto}</Text>
        </Animated.View>
      ) : null}

      {etapa !== 'lista' ? (
        <Pressable
          onPress={terminar}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Omitir el recorrido"
          style={({ pressed }) => [estilos.omitir, { top: insets.top + 10, opacity: pressed ? 0.7 : 1 }, !oscuro && estilos.omitirClaro]}>
          <Text style={[estilos.textoOmitir, !oscuro && estilos.textoOmitirClaro]}>Omitir</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// --- Paso 2: la hoja de compartir de Instagram --------------------------------

const CONTACTOS = [
  { nombre: 'Sofi', color: '#F4A259' },
  { nombre: 'Mamá', color: '#E07A5F' },
  { nombre: 'Lucas', color: '#81B29A' },
  { nombre: 'Cami', color: '#9C89B8' },
  { nombre: 'Cocina', color: '#F2CC8F' },
  { nombre: 'Andrés', color: '#5FA8D3' },
  { nombre: 'Vale', color: '#EF8A9A' },
  { nombre: 'Tío Beto', color: '#A3B18A' },
];

function HojaInstagram({ activa, alCompartirEn }: { activa: boolean; alCompartirEn: () => void }) {
  return (
    <View>
      <View style={estilos.asa} />
      <View style={estilos.buscar}>
        <MaterialCommunityIcons name="magnify" size={18} color="#8E8E8E" />
        <Text style={estilos.textoBuscar}>Buscar</Text>
      </View>
      <View style={estilos.contactos}>
        {CONTACTOS.map((c) => (
          <View key={c.nombre} style={estilos.contacto}>
            <View style={[estilos.avatarContacto, { backgroundColor: c.color }]}>
              <Text style={estilos.inicial}>{c.nombre[0]}</Text>
            </View>
            <Text style={estilos.nombreContacto} numberOfLines={1}>
              {c.nombre}
            </Text>
          </View>
        ))}
      </View>
      <View style={estilos.separador} />
      <View style={estilos.filaAcciones}>
        <AccionHoja etiqueta="Añadir a historia" icono={<MaterialCommunityIcons name="plus-circle-outline" size={24} color="#222" />} />
        <AccionHoja etiqueta="Copiar enlace" icono={<MaterialCommunityIcons name="link-variant" size={24} color="#222" />} />
        <AccionHoja etiqueta="WhatsApp" icono={<FontAwesome6 name="whatsapp" brand size={24} color="#25D366" />} />
        <AccionHoja
          etiqueta="Compartir en…"
          icono={<MaterialCommunityIcons name="share-variant" size={23} color="#222" />}
          resaltada={activa}
          alPulsar={activa ? alCompartirEn : undefined}
        />
      </View>
    </View>
  );
}

function AccionHoja({
  etiqueta,
  icono,
  resaltada = false,
  alPulsar,
}: {
  etiqueta: string;
  icono: ReactNode;
  resaltada?: boolean;
  alPulsar?: () => void;
}) {
  return (
    <Pressable onPress={alPulsar} disabled={!alPulsar} accessibilityRole="button" accessibilityLabel={etiqueta} style={estilos.accionHoja}>
      <View style={estilos.circuloAccion}>
        {resaltada ? <Pulso ancho={56} alto={56} radio={28} /> : null}
        {icono}
        {resaltada ? <Indicacion texto="Toca aquí" lado="arriba" /> : null}
      </View>
      <Text style={estilos.etiquetaAccion} numberOfLines={2}>
        {etiqueta}
      </Text>
    </Pressable>
  );
}

// --- Paso 3: la hoja de compartir de Android ----------------------------------

type App = { nombre: string; icono: ReactNode; fondo?: string; recetifia?: boolean };

const APPS: App[] = [
  { nombre: 'Gmail', icono: <MaterialCommunityIcons name="gmail" size={28} color="#EA4335" /> },
  { nombre: 'Drive', icono: <MaterialCommunityIcons name="google-drive" size={28} color="#1FA463" /> },
  { nombre: 'WhatsApp', icono: <FontAwesome6 name="whatsapp" brand size={28} color="#25D366" /> },
  { nombre: 'Mensajes', icono: <MaterialCommunityIcons name="message-text" size={26} color="#1A73E8" /> },
  { nombre: 'Chrome', icono: <MaterialCommunityIcons name="google-chrome" size={28} color="#4285F4" /> },
  {
    nombre: 'Recetifia',
    fondo: Marca.primario,
    recetifia: true,
    icono: <Image source={require('@/assets/images/logo-blanco.png')} style={{ width: 30, height: 26 }} contentFit="contain" />,
  },
  { nombre: 'Telegram', icono: <FontAwesome6 name="telegram" brand size={28} color="#29A9EB" /> },
  { nombre: 'Bluetooth', icono: <MaterialCommunityIcons name="bluetooth" size={26} color="#1A73E8" /> },
];

function HojaAndroid({ activa, alElegir }: { activa: boolean; alElegir: () => void }) {
  return (
    <View>
      <View style={estilos.asa} />
      <View style={estilos.vistaPrevia}>
        <Image source={RECETA_DEMO.foto} style={estilos.miniatura} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text style={estilos.tituloPrevia} numberOfLines={1}>
            {RECETA_DEMO.titulo} en 15 minutos
          </Text>
          <Text style={estilos.enlacePrevia} numberOfLines={1}>
            instagram.com/reel/…
          </Text>
        </View>
        <MaterialCommunityIcons name="content-copy" size={20} color="#555" />
      </View>
      <Text style={estilos.tituloApps}>Compartir con apps</Text>
      <View style={estilos.apps}>
        {APPS.map((a) => {
          const objetivo = a.recetifia && activa;
          return (
            <Pressable
              key={a.nombre}
              onPress={objetivo ? alElegir : undefined}
              disabled={!objetivo}
              accessibilityRole="button"
              accessibilityLabel={a.nombre}
              style={estilos.app}>
              <View style={[estilos.iconoApp, a.fondo ? { backgroundColor: a.fondo } : null]}>
                {objetivo ? <Pulso ancho={60} alto={60} radio={20} /> : null}
                {a.icono}
              </View>
              <Text style={[estilos.nombreApp, a.recetifia && estilos.nombreRecetifia]}>{a.nombre}</Text>
              {objetivo ? <Indicacion texto="Toca aquí" lado="abajo" /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// --- Paso 4: importando -------------------------------------------------------

function Importando({ alTerminar }: { alTerminar: () => void }) {
  const [mensaje, setMensaje] = useState(0);
  const fondo = useSharedValue(0);
  const latido = useSharedValue(0);
  const barra = useSharedValue(0);

  useEffect(() => {
    fondo.value = withTiming(1, { duration: 300 });
    latido.value = withRepeat(withSequence(withTiming(1, { duration: 500 }), withTiming(0, { duration: 500 })), -1);
    barra.value = withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.quad) });
    const t1 = setTimeout(() => setMensaje(1), 1000);
    const t2 = setTimeout(() => setMensaje(2), 2000);
    const t3 = setTimeout(alTerminar, 3200);
    return () => [t1, t2, t3].forEach(clearTimeout);
    // Se programa una vez al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const estiloFondo = useAnimatedStyle(() => ({ opacity: fondo.value }));
  const estiloLogo = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + latido.value * 0.08 }, { rotate: `${(latido.value - 0.5) * 8}deg` }],
  }));
  const estiloBarra = useAnimatedStyle(() => ({ width: `${barra.value * 100}%` }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, estilos.importando, estiloFondo]}>
      <Animated.View style={[estilos.tejaCarga, estiloLogo]}>
        <Image source={require('@/assets/images/logo-blanco.png')} style={{ width: 56, height: 48 }} contentFit="contain" />
      </Animated.View>
      <Text style={estilos.textoCarga} accessibilityLiveRegion="polite">
        {MENSAJES_CARGA[mensaje]}
      </Text>
      <View style={estilos.pistaCarga}>
        <Animated.View style={[estilos.rellenoCarga, estiloBarra]} />
      </View>
    </Animated.View>
  );
}

// --- Paso 5: la receta, ya ordenada -------------------------------------------

function RecetaLista({ alContinuar, paddingInferior }: { alContinuar: () => void; paddingInferior: number }) {
  const insets = useSafeAreaInsets();
  const titulo = useSharedValue(0);
  const tarjeta = useSharedValue(0);
  const pie = useSharedValue(0);

  useEffect(() => {
    titulo.value = withTiming(1, { duration: 500, easing: SUAVE });
    tarjeta.value = withDelay(150, withSpring(1, { damping: 18, stiffness: 120 }));
    pie.value = withDelay(1400, withTiming(1, { duration: 450, easing: SUAVE }));
  }, [titulo, tarjeta, pie]);

  const estiloTitulo = useAnimatedStyle(() => ({
    opacity: titulo.value,
    transform: [{ translateY: interpolate(titulo.value, [0, 1], [12, 0]) }],
  }));
  const estiloTarjeta = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(tarjeta.value, [0, 1], [600, 0]) }] }));
  const estiloPie = useAnimatedStyle(() => ({ opacity: pie.value }));

  return (
    <View style={[StyleSheet.absoluteFill, estilos.lista, { paddingTop: insets.top + 24 }]}>
      <Animated.Text style={[estilos.tituloLista, estiloTitulo]} accessibilityRole="header">
        ¡Receta guardada! 🎉
      </Animated.Text>
      <Animated.Text style={[estilos.subtituloLista, estiloTitulo]}>Así de fácil. Ya está en tu biblioteca.</Animated.Text>

      <Animated.View style={[estilos.tarjeta, estiloTarjeta]}>
        <View style={estilos.asa} />
        <View style={estilos.cabeceraReceta}>
          <Image source={RECETA_DEMO.foto} style={estilos.fotoReceta} contentFit="cover" />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={estilos.nombreReceta}>{RECETA_DEMO.titulo}</Text>
            <View style={estilos.fuenteReceta}>
              <FontAwesome6 name="instagram" brand size={12} color="#E1306C" />
              <Text style={estilos.textoFuente}>{RECETA_DEMO.autor}</Text>
            </View>
            <View style={estilos.chips}>
              <Chip icono="clock-outline" texto="15 min" />
              <Chip icono="account-group-outline" texto="2 porciones" />
            </View>
          </View>
        </View>

        <Text style={estilos.seccion}>Ingredientes</Text>
        {RECETA_DEMO.ingredientes.map((ing, i) => (
          <Ingrediente key={ing.nombre} {...ing} indice={i} />
        ))}
        <Ingrediente emoji="👩‍🍳" cantidad="5 pasos" nombre="listos para el modo cocina" indice={RECETA_DEMO.ingredientes.length} destacado />
      </Animated.View>

      <Animated.View style={[estilos.pieLista, { paddingBottom: paddingInferior + 20 }, estiloPie]}>
        <BotonOnboarding texto="Continuar" alPulsar={alContinuar} />
      </Animated.View>
    </View>
  );
}

function Chip({ icono, texto }: { icono: keyof typeof MaterialCommunityIcons.glyphMap; texto: string }) {
  return (
    <View style={estilos.chip}>
      <MaterialCommunityIcons name={icono} size={13} color={Colors.light.textSecondary} />
      <Text style={estilos.textoChip}>{texto}</Text>
    </View>
  );
}

function Ingrediente({
  emoji,
  cantidad,
  nombre,
  indice,
  destacado = false,
}: {
  emoji: string;
  cantidad: string;
  nombre: string;
  indice: number;
  destacado?: boolean;
}) {
  // Aparecen uno a uno, como si se fueran escribiendo
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(500 + indice * 140, withTiming(1, { duration: 400, easing: SUAVE }));
  }, [v, indice]);
  const estilo = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ translateX: interpolate(v.value, [0, 1], [-14, 0]) }],
  }));
  return (
    <Animated.View style={[estilos.ingrediente, destacado && estilos.ingredienteDestacado, estilo]}>
      <Text style={estilos.emojiIngrediente}>{emoji}</Text>
      <Text style={estilos.textoIngrediente}>
        {cantidad ? <Text style={estilos.cantidad}>{cantidad} </Text> : null}
        {nombre}
      </Text>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#000' },

  omitir: {
    position: 'absolute',
    right: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radios.pildora,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  omitirClaro: { backgroundColor: '#F1F2F2', borderColor: Colors.light.borde },
  textoOmitir: { fontFamily: Tipografia.media, fontSize: 14, color: '#FFFFFF' },
  textoOmitirClaro: { color: Colors.light.textSecondary },

  instruccion: {
    position: 'absolute',
    left: 16,
    right: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    gap: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  pasoInstruccion: { fontFamily: Tipografia.negrita, fontSize: 12, letterSpacing: 0.8, color: Marca.primario },
  textoInstruccion: { fontFamily: Tipografia.seminegrita, fontSize: 16, lineHeight: 22, color: Colors.light.text },

  velo: { backgroundColor: '#000' },
  hoja: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
  },
  hojaAndroid: { backgroundColor: '#F3F0F4', borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  asa: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#D0D0D0', marginTop: 10, marginBottom: 14 },

  buscar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFEFEF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  textoBuscar: { fontFamily: Tipografia.regular, fontSize: 14, color: '#8E8E8E' },
  contactos: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, rowGap: 14 },
  contacto: { width: '25%', alignItems: 'center', gap: 6 },
  avatarContacto: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  inicial: { fontFamily: Tipografia.seminegrita, fontSize: 20, color: '#FFFFFF' },
  nombreContacto: { fontFamily: Tipografia.regular, fontSize: 12, color: '#222' },
  // Aire extra arriba de las acciones: ahi aparece el globo "Toca aqui"
  separador: { height: StyleSheet.hairlineWidth, backgroundColor: '#DBDBDB', marginTop: 16, marginBottom: 40 },
  filaAcciones: { flexDirection: 'row' },
  accionHoja: { width: '25%', alignItems: 'center', gap: 6 },
  circuloAccion: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#EFEFEF', alignItems: 'center', justifyContent: 'center' },
  etiquetaAccion: { fontFamily: Tipografia.regular, fontSize: 11, lineHeight: 14, textAlign: 'center', color: '#222' },

  vistaPrevia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 10,
  },
  miniatura: { width: 44, height: 44, borderRadius: 10 },
  tituloPrevia: { fontFamily: Tipografia.seminegrita, fontSize: 14, color: '#1F1F1F' },
  enlacePrevia: { fontFamily: Tipografia.regular, fontSize: 12, color: '#5F5F5F' },
  tituloApps: { fontFamily: Tipografia.media, fontSize: 13, color: '#5F5F5F', marginTop: 18, marginBottom: 12, marginLeft: 4 },
  apps: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 18 },
  app: { width: '25%', alignItems: 'center', gap: 6 },
  iconoApp: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  nombreApp: { fontFamily: Tipografia.regular, fontSize: 12, color: '#1F1F1F' },
  nombreRecetifia: { fontFamily: Tipografia.seminegrita },

  importando: { backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', gap: 22, paddingHorizontal: 48 },
  tejaCarga: {
    width: 104,
    height: 104,
    borderRadius: 28,
    backgroundColor: Marca.primario,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#7A2E12',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  textoCarga: { fontFamily: Tipografia.seminegrita, fontSize: 17, color: Colors.light.text },
  pistaCarga: { alignSelf: 'stretch', height: 6, borderRadius: 3, backgroundColor: '#F1E6E0', overflow: 'hidden' },
  rellenoCarga: { height: 6, borderRadius: 3, backgroundColor: Marca.primario },

  lista: { backgroundColor: '#FFF7F3' },
  tituloLista: { fontFamily: Tipografia.display, fontSize: 30, lineHeight: 38, textAlign: 'center', color: Colors.light.text },
  subtituloLista: {
    fontFamily: Tipografia.regular,
    fontSize: 16,
    textAlign: 'center',
    color: Colors.light.textSecondary,
    marginTop: 6,
  },
  tarjeta: {
    flex: 1,
    marginTop: 24,
    marginHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 110, // hueco para el boton, que flota encima
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#7A2E12',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 },
  },
  cabeceraReceta: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  fotoReceta: { width: 84, height: 84, borderRadius: 18 },
  nombreReceta: { fontFamily: Tipografia.display, fontSize: 19, lineHeight: 24, color: Colors.light.text },
  fuenteReceta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  textoFuente: { fontFamily: Tipografia.regular, fontSize: 12, color: Colors.light.textSecondary },
  chips: { flexDirection: 'row', gap: 6, marginTop: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radios.pildora,
    backgroundColor: '#F4F5F5',
  },
  textoChip: { fontFamily: Tipografia.media, fontSize: 11, color: Colors.light.textSecondary },
  seccion: { fontFamily: Tipografia.seminegrita, fontSize: 18, color: Colors.light.text, marginTop: 20, marginBottom: 8 },
  ingrediente: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.borde,
  },
  ingredienteDestacado: {
    borderBottomWidth: 0,
    marginTop: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: Marca.primarioTenue,
  },
  emojiIngrediente: { fontSize: 18 },
  textoIngrediente: { flex: 1, fontFamily: Tipografia.regular, fontSize: 15, color: Colors.light.text },
  cantidad: { fontFamily: Tipografia.seminegrita },
  pieLista: { position: 'absolute', left: 24, right: 24, bottom: 0, paddingTop: 12 },
});
