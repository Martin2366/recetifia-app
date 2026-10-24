import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
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

import { BotonOnboarding } from '@/components/onboarding/boton';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { useEspacioConTeclado } from '@/hooks/use-espacio-con-teclado';
import { COMIDAS, MAX_NOTA, useAgregarAlPlan, useMoverEnPlan, type Comida, type ItemPlan } from '@/lib/plan';
import { useRecetas } from '@/lib/recetas';
import { deFecha, diasDeSemana, etiquetaRelativa, hoy, INICIALES, nombreDiaCorto, sumarDias } from '@/lib/semana';
import { exito } from '@/lib/haptica';

/**
 * Hoja para el plan. Dos vistas: cuando (dia y comida) y que (receta o nota).
 * Elegir la comida ya avanza: no hay boton "Continuar". La misma hoja sirve
 * para el + de un dia, para "Añadir al plan" desde una receta y para mover
 * una comida a otro dia.
 */

const SUAVE = Easing.bezier(0.22, 1, 0.36, 1);

export type ModoHojaPlan =
  | { tipo: 'nuevo'; lunes: string; dia?: string }
  | { tipo: 'receta'; receta: { id: string; title: string }; porciones: number | null }
  | { tipo: 'mover'; item: ItemPlan; lunes: string };

type Vista = 'cuando' | 'que';

export function HojaPlan({
  modo,
  alCerrar,
  alListo,
}: {
  /** null = cerrada. */
  modo: ModoHojaPlan | null;
  alCerrar: () => void;
  /** Despues de guardar, con un texto corto para avisar ("Cena del lunes 5 oct"). */
  alListo?: (texto: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const visible = modo != null;
  const [montada, setMontada] = useState(visible);
  // El ultimo modo se conserva mientras la hoja baja, para que no se vacie al cerrar
  const [actual, setActual] = useState<ModoHojaPlan | null>(modo);
  const [vista, setVista] = useState<Vista>('cuando');
  const [dia, setDia] = useState(hoy());
  const [comida, setComida] = useState<Comida | null>(null);
  const abierta = useSharedValue(0);
  const cambio = useSharedValue(1);
  const agregar = useAgregarAlPlan();
  const mover = useMoverEnPlan();

  useEffect(() => {
    if (modo) {
      setActual(modo);
      setVista('cuando');
      setComida(modo.tipo === 'mover' ? modo.item.meal : null);
      setDia(diaInicial(modo));
      setMontada(true);
      abierta.value = withTiming(1, { duration: 380, easing: SUAVE });
    } else {
      abierta.value = withTiming(0, { duration: 240 });
      const t = setTimeout(() => setMontada(false), 240);
      return () => clearTimeout(t);
    }
  }, [modo, abierta]);

  function ir(v: Vista) {
    cambio.value = 0;
    cambio.value = withTiming(1, { duration: 280, easing: SUAVE });
    setVista(v);
  }

  function volver() {
    if (vista === 'que') ir('cuando');
    else alCerrar();
  }

  useEffect(() => {
    if (!visible) return;
    const s = BackHandler.addEventListener('hardwareBackPress', () => {
      volver();
      return true;
    });
    return () => s.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, vista]);

  const nombreComida = COMIDAS.find((c) => c.id === comida)?.nombre ?? '';
  const resumen = `${nombreComida} del ${nombreDiaCorto(dia)}`;

  async function elegirComida(c: Comida) {
    setComida(c);
    if (!actual) return;
    if (actual.tipo === 'nuevo') {
      ir('que');
      return;
    }
    const texto = `${COMIDAS.find((x) => x.id === c)!.nombre} del ${nombreDiaCorto(dia)}`;
    try {
      if (actual.tipo === 'receta') {
        await agregar.mutateAsync({ day: dia, meal: c, recipe_id: actual.receta.id, servings: actual.porciones });
      } else {
        mover.mutate({ id: actual.item.id, day: dia, meal: c });
      }
      exito();
      alCerrar();
      alListo?.(texto);
    } catch {
      Alert.alert('No se guardó', 'Revisa tu conexión e inténtalo de nuevo.');
    }
  }

  async function guardar(nuevo: { recipe_id?: string; note?: string }) {
    if (!comida) return;
    try {
      await agregar.mutateAsync({ day: dia, meal: comida, ...nuevo });
      exito();
      alCerrar();
      alListo?.(resumen);
    } catch {
      Alert.alert('No se guardó', 'Revisa tu conexión e inténtalo de nuevo.');
    }
  }

  const estiloVelo = useAnimatedStyle(() => ({ opacity: abierta.value * 0.45 }));
  const estiloHoja = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(abierta.value, [0, 1], [700, 0]) }] }));
  const estiloVista = useAnimatedStyle(() => ({
    opacity: cambio.value,
    transform: [{ translateX: interpolate(cambio.value, [0, 1], [18, 0]) }],
  }));

  if (!montada || !actual) return null;

  const titulo =
    actual.tipo === 'receta' ? 'Añadir al plan' : actual.tipo === 'mover' ? 'Mover a otro día' : '¿Cuándo?';
  const dias = actual.tipo === 'receta' ? Array.from({ length: 14 }, (_, i) => sumarDias(hoy(), i)) : diasDeSemana(actual.lunes);

  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={volver}>
      <Animated.View style={[StyleSheet.absoluteFill, estilos.velo, estiloVelo]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={alCerrar} accessibilityLabel="Cerrar" />
      </Animated.View>

      <KeyboardAvoidingView behavior="padding" style={estilos.contenedorHoja} pointerEvents="box-none">
        <Animated.View style={[estilos.hoja, { paddingBottom: insets.bottom + 20 }, estiloHoja]}>
          <View style={estilos.asa} />
          <Animated.View style={estiloVista}>
            {vista === 'cuando' ? (
              <View style={estilos.columna}>
                <Cabecera titulo={titulo} alCerrar={alCerrar} />
                {actual.tipo === 'receta' ? (
                  <Text style={estilos.subtitulo} numberOfLines={1}>
                    {actual.receta.title}
                  </Text>
                ) : null}

                <Text style={estilos.etiqueta}>Día</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.dias}>
                  {dias.map((d) => (
                    <ChipDia key={d} fecha={d} activo={d === dia} alPulsar={() => setDia(d)} />
                  ))}
                </ScrollView>

                <Text style={estilos.etiqueta}>Comida</Text>
                <View style={estilos.rejilla}>
                  {COMIDAS.map((c) => {
                    const activa = comida === c.id;
                    const ocupado = (agregar.isPending || mover.isPending) && activa;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => elegirComida(c.id)}
                        disabled={agregar.isPending}
                        accessibilityRole="button"
                        accessibilityState={{ selected: activa }}
                        style={({ pressed }) => [estilos.cuadro, activa && estilos.cuadroActivo, pressed && estilos.presionada]}>
                        {ocupado ? (
                          <ActivityIndicator color={Marca.primario} />
                        ) : (
                          <MaterialCommunityIcons name={c.icono} size={26} color={activa ? Marca.primario : Colors.light.textSecondary} />
                        )}
                        <Text style={[estilos.textoCuadro, activa && { color: Colors.light.text }]}>{c.nombre}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={estilos.nota}>
                  {actual.tipo === 'nuevo' ? 'Elige la comida y luego la receta.' : 'Toca la comida y listo.'}
                </Text>
              </View>
            ) : (
              <VistaQue titulo={resumen} alVolver={() => ir('cuando')} alCerrar={alCerrar} guardando={agregar.isPending} alGuardar={guardar} />
            )}
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function diaInicial(modo: ModoHojaPlan): string {
  if (modo.tipo === 'mover') return modo.item.day;
  if (modo.tipo === 'receta') return hoy();
  if (modo.dia) return modo.dia;
  // Sin dia: hoy si cae en la semana que se esta viendo; si no, el lunes
  const h = hoy();
  return h >= modo.lunes && h <= sumarDias(modo.lunes, 6) ? h : modo.lunes;
}

function ChipDia({ fecha, activo, alPulsar }: { fecha: string; activo: boolean; alPulsar: () => void }) {
  const d = deFecha(fecha);
  const relativa = etiquetaRelativa(fecha);
  return (
    <Pressable
      onPress={alPulsar}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      accessibilityLabel={nombreDiaCorto(fecha)}
      style={[estilos.chip, activo && estilos.chipActivo]}>
      <Text style={[estilos.inicial, activo && estilos.textoActivo]}>{relativa ?? INICIALES[(d.getDay() + 6) % 7]}</Text>
      <Text style={[estilos.numeroDia, activo && estilos.textoActivo]}>{d.getDate()}</Text>
    </Pressable>
  );
}

function VistaQue({
  titulo,
  alVolver,
  alCerrar,
  guardando,
  alGuardar,
}: {
  titulo: string;
  alVolver: () => void;
  alCerrar: () => void;
  guardando: boolean;
  alGuardar: (n: { recipe_id?: string; note?: string }) => void;
}) {
  const { height } = useWindowDimensions();
  const [pestana, setPestana] = useState<'receta' | 'nota'>('receta');
  const [busqueda, setBusqueda] = useState('');
  const [nota, setNota] = useState('');
  const recetas = useRecetas(busqueda);
  const lista = recetas.data ?? [];
  const sinRecetas = !recetas.isLoading && !lista.length && !busqueda.trim();
  const alto = useMemo(() => Math.min(height * 0.5, 440), [height]);
  // Con el teclado abierto la lista cede espacio: el resto de la hoja (cabecera,
  // segmento, enlace y margenes) mide unos 250 y tiene que seguir a la vista
  const espacio = useEspacioConTeclado();
  const estiloLista = useAnimatedStyle(() => ({ height: Math.max(140, Math.min(alto, espacio.value - 250)) }));

  return (
    <View style={estilos.columna}>
      <View style={estilos.cabecera}>
        <Pressable onPress={alVolver} hitSlop={12} accessibilityRole="button" accessibilityLabel="Volver" style={estilos.atras}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={Colors.light.text} />
        </Pressable>
        <Text style={estilos.tituloCabecera} numberOfLines={1}>
          {titulo}
        </Text>
        <View style={estilos.atras} />
      </View>

      {/* Segmento en pildora en vez de pestanas subrayadas */}
      <View style={estilos.segmento}>
        {(['receta', 'nota'] as const).map((p) => (
          <Pressable
            key={p}
            onPress={() => setPestana(p)}
            accessibilityRole="tab"
            accessibilityState={{ selected: pestana === p }}
            style={[estilos.opcion, pestana === p && estilos.opcionActiva]}>
            <MaterialCommunityIcons
              name={p === 'receta' ? 'bookmark-outline' : 'pencil-outline'}
              size={18}
              color={pestana === p ? Colors.light.text : Colors.light.textSecondary}
            />
            <Text style={[estilos.textoOpcion, pestana === p && estilos.textoOpcionActiva]}>{p === 'receta' ? 'Una receta' : 'Una nota'}</Text>
          </Pressable>
        ))}
      </View>

      {pestana === 'receta' ? (
        <Animated.View style={estiloLista}>
          {sinRecetas ? (
            <View style={estilos.vacio}>
              <Text style={estilos.emoji}>📖</Text>
              <Text style={estilos.tituloVacio}>Todavía no tienes recetas</Text>
              <Text style={estilos.nota}>Guarda una desde un reel, una web o escríbela. Mientras, puedes anotar algo en «Una nota».</Text>
              <Pressable onPress={() => setPestana('nota')} hitSlop={8} style={estilos.enlace} accessibilityRole="button">
                <Text style={estilos.textoEnlace}>Escribir una nota</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={estilos.buscador}>
                <MaterialCommunityIcons name="magnify" size={22} color={Colors.light.textSecondary} />
                <TextInput
                  value={busqueda}
                  onChangeText={setBusqueda}
                  placeholder="Buscar en tus recetas"
                  placeholderTextColor={Colors.light.textTenue}
                  style={estilos.campoBusqueda}
                  returnKeyType="search"
                  accessibilityLabel="Buscar recetas"
                />
              </View>
              {recetas.isLoading ? (
                <ActivityIndicator color={Marca.primario} style={{ marginTop: 24 }} />
              ) : (
                <FlatList
                  data={lista}
                  keyExtractor={(r) => r.id}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingVertical: 8, gap: 8 }}
                  ListEmptyComponent={<Text style={[estilos.nota, { marginTop: 24 }]}>Nada con «{busqueda.trim()}».</Text>}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => alGuardar({ recipe_id: item.id })}
                      disabled={guardando}
                      accessibilityRole="button"
                      style={({ pressed }) => [estilos.filaReceta, pressed && estilos.presionada]}>
                      <View style={estilos.miniatura}>
                        {item.image_path ? (
                          <Image cachePolicy="memory-disk" source={{ uri: item.image_path }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                        ) : (
                          <MaterialCommunityIcons name="silverware-fork-knife" size={20} color={Marca.primarioSuave} />
                        )}
                      </View>
                      <Text style={estilos.tituloReceta} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <MaterialCommunityIcons name="plus-circle" size={26} color={Marca.primario} />
                    </Pressable>
                  )}
                />
              )}
            </>
          )}
        </Animated.View>
      ) : (
        <View style={estilos.columna}>
          <TextInput
            value={nota}
            onChangeText={setNota}
            placeholder="Ej: comer afuera, sobras del domingo"
            placeholderTextColor={Colors.light.textTenue}
            style={estilos.campo}
            autoFocus
            maxLength={MAX_NOTA}
            returnKeyType="done"
            onSubmitEditing={() => nota.trim() && alGuardar({ note: nota.trim() })}
            accessibilityLabel="Nota"
          />
          <Text style={estilos.contador}>
            {nota.length} / {MAX_NOTA}
          </Text>
          {guardando ? (
            <View style={estilos.cargando}>
              <ActivityIndicator color="#FFF" />
            </View>
          ) : (
            <BotonOnboarding texto="Guardar nota" alPulsar={() => alGuardar({ note: nota.trim() })} apagado={!nota.trim()} />
          )}
        </View>
      )}
      <Pressable onPress={alCerrar} hitSlop={8} style={estilos.enlace} accessibilityRole="button">
        <Text style={estilos.textoEnlace}>Cancelar</Text>
      </Pressable>
    </View>
  );
}

function Cabecera({ titulo, alCerrar }: { titulo: string; alCerrar: () => void }) {
  return (
    <View style={estilos.cabecera}>
      <View style={estilos.atras} />
      <Text style={estilos.tituloCabecera}>{titulo}</Text>
      <Pressable onPress={alCerrar} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar" style={[estilos.atras, { alignItems: 'flex-end' }]}>
        <MaterialCommunityIcons name="close" size={24} color={Colors.light.text} />
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  velo: { backgroundColor: '#1A0F0A' },
  contenedorHoja: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  hoja: { paddingHorizontal: 18, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: '#FFFFFF' },
  asa: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: '#DDD6D2', marginTop: 10, marginBottom: 18 },
  columna: { gap: 12 },

  cabecera: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  atras: { width: 36, height: 36, justifyContent: 'center' },
  tituloCabecera: { flex: 1, textAlign: 'center', fontFamily: Tipografia.display, fontSize: 21, color: Colors.light.text },
  subtitulo: { textAlign: 'center', fontFamily: Tipografia.media, fontSize: 15, color: Colors.light.textSecondary, marginTop: -8 },
  etiqueta: { fontFamily: Tipografia.seminegrita, fontSize: 14, color: Colors.light.textSecondary, marginTop: 4 },

  dias: { gap: 8, paddingRight: 8 },
  chip: {
    minWidth: 52,
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
    borderRadius: Radios.medio,
    borderWidth: 1.5,
    borderColor: Colors.light.borde,
    backgroundColor: '#FFFFFF',
  },
  chipActivo: { backgroundColor: Marca.primario, borderColor: Marca.primario },
  inicial: { fontFamily: Tipografia.media, fontSize: 12, color: Colors.light.textSecondary },
  numeroDia: { fontFamily: Tipografia.negrita, fontSize: 18, color: Colors.light.text },
  textoActivo: { color: '#FFFFFF' },

  rejilla: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  cuadro: {
    width: '48.5%',
    minHeight: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radios.grande - 4,
    borderWidth: 1.5,
    borderColor: Colors.light.borde,
    backgroundColor: '#FFFFFF',
  },
  cuadroActivo: { borderColor: Marca.primario, backgroundColor: '#FFF7F3' },
  presionada: { backgroundColor: '#FFF7F3', borderColor: '#FBD9C9' },
  textoCuadro: { fontFamily: Tipografia.seminegrita, fontSize: 15, color: Colors.light.textSecondary },
  nota: { fontFamily: Tipografia.regular, fontSize: 13, lineHeight: 19, textAlign: 'center', color: Colors.light.textSecondary },

  segmento: { flexDirection: 'row', padding: 4, borderRadius: Radios.pildora, backgroundColor: '#F4EEEA' },
  opcion: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: Radios.pildora },
  opcionActiva: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#7A2E12',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  textoOpcion: { fontFamily: Tipografia.media, fontSize: 15, color: Colors.light.textSecondary },
  textoOpcionActiva: { fontFamily: Tipografia.seminegrita, color: Colors.light.text },

  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: Radios.pildora,
    borderWidth: 1.5,
    borderColor: Colors.light.borde,
  },
  campoBusqueda: { flex: 1, fontFamily: Tipografia.media, fontSize: 16, color: Colors.light.text, paddingVertical: 8 },
  filaReceta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    paddingRight: 12,
    borderRadius: Radios.medio,
    borderWidth: 1,
    borderColor: '#F1ECE9',
  },
  miniatura: {
    width: 52,
    height: 52,
    borderRadius: Radios.chico,
    overflow: 'hidden',
    backgroundColor: Marca.primarioTenue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tituloReceta: { flex: 1, fontFamily: Tipografia.seminegrita, fontSize: 15, lineHeight: 20, color: Colors.light.text },

  vacio: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  emoji: { fontSize: 44 },
  tituloVacio: { fontFamily: Tipografia.display, fontSize: 20, color: Colors.light.text },

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
  contador: { alignSelf: 'flex-end', marginTop: -6, fontFamily: Tipografia.media, fontSize: 13, color: Colors.light.textTenue },
  cargando: { minHeight: 56, borderRadius: Radios.pildora, backgroundColor: Marca.primario, alignItems: 'center', justifyContent: 'center' },
  enlace: { alignSelf: 'center', padding: 8 },
  textoEnlace: { fontFamily: Tipografia.seminegrita, fontSize: 15, color: Colors.light.textSecondary },
});
