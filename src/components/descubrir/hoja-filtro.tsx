import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { useEspacioConTeclado } from '@/hooks/use-espacio-con-teclado';
import { useConteoBuscar } from '@/lib/descubrir';
import { GRUPOS_INGREDIENTES, INGREDIENTES, partir, sinTildes, type Categoria, type OpcionFiltro } from '@/lib/filtros';

import { FOTOS_INGREDIENTES } from './fotos-ingredientes';
import { exito, toque } from '@/lib/haptica';
import { useUsar, useUsos } from '@/lib/usos';

/**
 * Hoja para filtrar por una categoria. Se pueden marcar varias opciones; el
 * boton dice en vivo cuantas recetas salen con todo lo elegido (esta hoja mas
 * los demas filtros activos y el texto) y se apaga si no sale ninguna.
 *
 * Buscar por ingredientes tiene cupo diario en el plan gratis: gasta una
 * busqueda solo al aplicar un conjunto de ingredientes distinto del que ya se
 * estaba viendo. Contar en vivo, cambiar otras categorias o volver atras no gasta.
 */

const ingredientesDe = (filtros: string[]) =>
  filtros
    .filter((f) => partir(f).categoria === 'ing')
    .sort()
    .join(',');

const SUAVE = Easing.bezier(0.22, 1, 0.36, 1);

export function HojaFiltro({
  categoria,
  filtros,
  texto,
  alCerrar,
  alAplicar,
}: {
  /** null = cerrada. */
  categoria: Categoria | null;
  /** Todos los filtros activos, de todas las categorias. */
  filtros: string[];
  texto: string;
  alCerrar: () => void;
  /** Los filtros completos, con esta categoria ya reemplazada. */
  alAplicar: (filtros: string[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const visible = categoria != null;
  const [montada, setMontada] = useState(visible);
  const [actual, setActual] = useState<Categoria | null>(categoria);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState('');
  const [sinCupo, setSinCupo] = useState(false);
  const [gastando, setGastando] = useState(false);
  const abierta = useSharedValue(0);
  const usos = useUsos();
  const usar = useUsar();
  const router = useRouter();

  useEffect(() => {
    if (categoria) {
      setActual(categoria);
      setElegidas(new Set(filtros.filter((f) => partir(f).categoria === categoria.id)));
      setBusqueda('');
      setSinCupo(false);
      setMontada(true);
      abierta.value = withTiming(1, { duration: 380, easing: SUAVE });
    } else {
      abierta.value = withTiming(0, { duration: 240 });
      const t = setTimeout(() => setMontada(false), 240);
      return () => clearTimeout(t);
    }
    // Solo al abrir o cerrar: mientras esta abierta, la seleccion es local
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoria, abierta]);

  useEffect(() => {
    if (!visible) return;
    const s = BackHandler.addEventListener('hardwareBackPress', () => {
      alCerrar();
      return true;
    });
    return () => s.remove();
  }, [visible, alCerrar]);

  const resultado = useMemo(() => {
    if (!actual) return filtros;
    return [...filtros.filter((f) => partir(f).categoria !== actual.id), ...elegidas];
  }, [actual, filtros, elegidas]);
  const conteo = useConteoBuscar(texto, resultado, visible);

  const estiloVelo = useAnimatedStyle(() => ({ opacity: abierta.value * 0.45 }));
  const espacio = useEspacioConTeclado();
  const estiloHoja = useAnimatedStyle(() => ({
    // Con el teclado abierto la hoja se achica en vez de salirse por arriba
    height: Math.min(height * 0.88, espacio.value),
    transform: [{ translateY: interpolate(abierta.value, [0, 1], [height, 0]) }],
  }));

  if (!montada || !actual) return null;

  const clave = (o: OpcionFiltro) => `${actual.id}:${o.id}`;
  function alternar(o: OpcionFiltro) {
    toque();
    setElegidas((s) => {
      const n = new Set(s);
      const k = clave(o);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  }

  const q = sinTildes(busqueda.trim());
  const coincide = (o: OpcionFiltro) => !q || sinTildes(o.nombre).includes(q);
  const n = conteo.data;
  const ingredientes = ingredientesDe(resultado);
  const busquedaNueva = ingredientes !== '' && ingredientes !== ingredientesDe(filtros);
  const restantes = usos.data && !usos.data.plus ? usos.data.busquedasRestantesHoy : null;

  async function aplicar() {
    if (busquedaNueva) {
      setGastando(true);
      const r = await usar('busqueda');
      setGastando(false);
      if (!r.permitido) {
        setSinCupo(true);
        return;
      }
    }
    exito();
    alAplicar(resultado);
  }

  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={alCerrar}>
      <Animated.View style={[StyleSheet.absoluteFill, estilos.velo, estiloVelo]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={alCerrar} accessibilityLabel="Cerrar" />
      </Animated.View>

      <KeyboardAvoidingView behavior="padding" style={estilos.contenedorHoja} pointerEvents="box-none">
        <Animated.View style={[estilos.hoja, estiloHoja]}>
          <View style={estilos.asa} />
          <View style={estilos.cabecera}>
            <Pressable onPress={alCerrar} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar" style={estilos.cerrar}>
              <MaterialCommunityIcons name="close" size={26} color={Colors.light.text} />
            </Pressable>
            <Text style={estilos.titulo}>{actual.titulo}</Text>
            <View style={estilos.cerrar} />
          </View>

          <View style={estilos.buscador}>
            <MaterialCommunityIcons name="magnify" size={22} color={Colors.light.textSecondary} />
            <TextInput
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder={actual.buscar}
              placeholderTextColor={Colors.light.textTenue}
              style={estilos.campo}
              returnKeyType="search"
              accessibilityLabel={actual.buscar}
            />
            {busqueda ? (
              <Pressable onPress={() => setBusqueda('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Borrar">
                <MaterialCommunityIcons name="close-circle" size={20} color={Colors.light.textTenue} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
            {actual.id === 'ing' ? (
              q ? (
                <Rejilla opciones={INGREDIENTES.filter(coincide)} elegidas={elegidas} clave={clave} alternar={alternar} />
              ) : (
                <>
                  <Text style={estilos.seccion}>Populares</Text>
                  <Rejilla opciones={INGREDIENTES.filter((i) => i.popular)} elegidas={elegidas} clave={clave} alternar={alternar} />
                  {GRUPOS_INGREDIENTES.map((g) => (
                    <View key={g.id}>
                      <Text style={estilos.seccion}>{g.nombre}</Text>
                      <Rejilla opciones={INGREDIENTES.filter((i) => i.grupo === g.id && !i.popular)} elegidas={elegidas} clave={clave} alternar={alternar} />
                    </View>
                  ))}
                </>
              )
            ) : (
              actual.opciones.filter(coincide).map((o, i) => {
                const marcada = elegidas.has(clave(o));
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => alternar(o)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: marcada }}
                    style={({ pressed }) => [estilos.fila, i > 0 && estilos.filaBorde, pressed && { backgroundColor: '#FFF7F3' }]}>
                    <Text style={estilos.emojiFila}>{o.emoji}</Text>
                    <Text style={estilos.textoFila}>{o.nombre}</Text>
                    <View style={[estilos.casilla, marcada && estilos.casillaMarcada]}>
                      {marcada ? <MaterialCommunityIcons name="check" size={18} color="#FFFFFF" /> : null}
                    </View>
                  </Pressable>
                );
              })
            )}
            {q && !(actual.id === 'ing' ? INGREDIENTES : actual.opciones).some(coincide) ? (
              <Text style={estilos.nada}>Nada con «{busqueda.trim()}».</Text>
            ) : null}
          </ScrollView>

          {sinCupo ? (
            <View style={estilos.sinCupo}>
              <Text style={estilos.tituloSinCupo}>Usaste tus búsquedas por ingredientes de hoy</Text>
              <Text style={estilos.textoSinCupo}>
                Mañana tienes {usos.data?.topeBusquedas ?? 3} más. Con Recetifia+ buscas sin límite. Buscar por nombre sigue libre.
              </Text>
              <Pressable
                onPress={() => {
                  alCerrar();
                  router.push('/plus');
                }}
                accessibilityRole="button"
                style={estilos.verPlus}>
                <Text style={estilos.textoVerPlus}>Ver Recetifia+</Text>
              </Pressable>
            </View>
          ) : actual.id === 'ing' && restantes != null ? (
            <Text style={estilos.cupo}>
              {restantes > 0
                ? `Te quedan ${restantes} ${restantes === 1 ? 'búsqueda' : 'búsquedas'} por ingredientes hoy`
                : 'Hoy ya usaste tus búsquedas por ingredientes'}
            </Text>
          ) : null}

          <View style={[estilos.pie, { paddingBottom: insets.bottom + 12 }]}>
            <Pressable
              onPress={() => setElegidas(new Set())}
              disabled={!elegidas.size}
              accessibilityRole="button"
              style={[estilos.limpiar, !elegidas.size && { opacity: 0.45 }]}>
              <Text style={estilos.textoLimpiar}>Limpiar{elegidas.size ? ` (${elegidas.size})` : ''}</Text>
            </Pressable>
            <Pressable
              onPress={aplicar}
              disabled={n === 0 || gastando}
              accessibilityRole="button"
              style={[estilos.aplicar, n === 0 && estilos.aplicarApagado]}>
              {n == null || gastando ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={estilos.textoAplicar}>{n === 0 ? 'Sin recetas' : n === 1 ? 'Ver 1 receta' : `Ver ${n} recetas`}</Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Ingredientes con su foto, 4 por fila. Los elegidos llevan anillo y check. */
function Rejilla({
  opciones,
  elegidas,
  clave,
  alternar,
}: {
  opciones: OpcionFiltro[];
  elegidas: Set<string>;
  clave: (o: OpcionFiltro) => string;
  alternar: (o: OpcionFiltro) => void;
}) {
  return (
    <View style={estilos.rejilla}>
      {opciones.map((o) => {
        const marcada = elegidas.has(clave(o));
        const foto = FOTOS_INGREDIENTES[o.id];
        return (
          <Pressable
            key={o.id}
            onPress={() => alternar(o)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: marcada }}
            accessibilityLabel={o.nombre}
            style={estilos.ingrediente}>
            <View style={[estilos.circulo, marcada && estilos.circuloMarcado]}>
              {foto ? (
                <Image source={foto} style={estilos.foto} contentFit="contain" />
              ) : (
                <Text style={estilos.emojiIngrediente}>{o.emoji}</Text>
              )}
              {marcada ? (
                <View style={estilos.check}>
                  <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
                </View>
              ) : null}
            </View>
            <Text style={[estilos.nombreIngrediente, marcada && { fontFamily: Tipografia.seminegrita }]} numberOfLines={2}>
              {o.nombre}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  velo: { backgroundColor: '#1A0F0A' },
  contenedorHoja: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  hoja: { borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  asa: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: '#DDD6D2', marginTop: 10, marginBottom: 8 },
  cabecera: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1ECE9' },
  cerrar: { width: 40, height: 40, justifyContent: 'center' },
  titulo: { flex: 1, textAlign: 'center', fontFamily: Tipografia.seminegrita, fontSize: 18, color: Colors.light.text },

  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 50,
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 14,
    borderRadius: Radios.pildora,
    borderWidth: 1.5,
    borderColor: Colors.light.borde,
  },
  campo: { flex: 1, fontFamily: Tipografia.media, fontSize: 16, color: Colors.light.text, paddingVertical: 8 },

  contenido: { paddingHorizontal: 16, paddingBottom: 24 },
  seccion: { fontFamily: Tipografia.negrita, fontSize: 17, color: Colors.light.text, marginTop: 20, marginBottom: 8 },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap' },
  ingrediente: { width: '25%', alignItems: 'center', gap: 4, paddingVertical: 8 },
  circulo: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  circuloMarcado: { borderColor: Marca.primario, backgroundColor: '#FFF7F3' },
  foto: { width: 58, height: 58 },
  emojiIngrediente: { fontSize: 36 },
  check: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Marca.primario,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nombreIngrediente: { textAlign: 'center', fontFamily: Tipografia.media, fontSize: 12, lineHeight: 16, letterSpacing: -0.1, color: Colors.light.text },

  fila: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 62, paddingHorizontal: 4 },
  filaBorde: { borderTopWidth: 1, borderTopColor: '#F1ECE9' },
  emojiFila: { width: 28, fontSize: 22, textAlign: 'center' },
  textoFila: { flex: 1, fontFamily: Tipografia.seminegrita, fontSize: 16, color: Colors.light.text },
  casilla: { width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, borderColor: '#BDB3AD', alignItems: 'center', justifyContent: 'center' },
  casillaMarcada: { backgroundColor: Marca.primario, borderColor: Marca.primario },
  nada: { textAlign: 'center', fontFamily: Tipografia.media, fontSize: 15, color: Colors.light.textSecondary, marginTop: 24 },

  cupo: { textAlign: 'center', fontFamily: Tipografia.media, fontSize: 13, color: Colors.light.textSecondary, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F1ECE9' },
  sinCupo: { gap: 6, padding: 16, borderTopWidth: 1, borderTopColor: '#F1ECE9', backgroundColor: '#FFF7F3' },
  tituloSinCupo: { fontFamily: Tipografia.seminegrita, fontSize: 16, color: Colors.light.text, textAlign: 'center' },
  textoSinCupo: { fontFamily: Tipografia.regular, fontSize: 14, lineHeight: 20, color: Colors.light.textSecondary, textAlign: 'center' },
  verPlus: { alignSelf: 'center', marginTop: 4, paddingHorizontal: 22, paddingVertical: 10, borderRadius: Radios.pildora, borderWidth: 1.5, borderColor: Marca.primario },
  textoVerPlus: { fontFamily: Tipografia.seminegrita, fontSize: 15, color: Marca.primarioTexto },
  pie: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1ECE9', backgroundColor: '#FFFFFF' },
  limpiar: { flex: 1, minHeight: 54, borderRadius: Radios.pildora, backgroundColor: '#F4EEEA', alignItems: 'center', justifyContent: 'center' },
  textoLimpiar: { fontFamily: Tipografia.seminegrita, fontSize: 16, color: Colors.light.text },
  aplicar: { flex: 1.4, minHeight: 54, borderRadius: Radios.pildora, backgroundColor: Marca.primario, alignItems: 'center', justifyContent: 'center' },
  aplicarApagado: { backgroundColor: '#D9CFC9' },
  textoAplicar: { fontFamily: Tipografia.seminegrita, fontSize: 16, color: '#FFFFFF' },
});
