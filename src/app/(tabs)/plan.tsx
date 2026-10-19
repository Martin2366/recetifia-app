import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Silueta, TONOS } from '@/components/onboarding/formas';
import { HojaPlan, type ModoHojaPlan } from '@/components/plan/hoja-plan';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import {
  COMIDAS,
  ordenarDelDia,
  useCopiarSemana,
  usePasarSemanaALista,
  usePlanSemana,
  useQuitarDelPlan,
  type ItemPlan,
} from '@/lib/plan';
import { deFecha, diasDeSemana, etiquetaRelativa, hoy, INICIALES, lunesDe, nombreDia, rangoSemana, sumarDias } from '@/lib/semana';

/**
 * Plan de la semana. A diferencia de la referencia, la semana se ve entera:
 * una tira de 7 dias arriba y una tarjeta por dia, cada una con su propio +,
 * asi que planear es elegir comida y receta (2 pasos). Desde aqui toda la
 * semana pasa a la lista de compras de un toque.
 */

const FONDO = '#F7F2EE';
/** Alto de la barra de pestanas (sin el borde inferior del telefono). */
const BARRA = 62;
/** Lo que el boton de Descubrir sobresale de la barra, mas un respiro. */
const SOBRE_BARRA = 40;

type Aviso = { texto: string; accion?: { texto: string; alPulsar: () => void } };

export default function Plan() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [lunes, setLunes] = useState(() => lunesDe(hoy()));
  const [hoja, setHoja] = useState<ModoHojaPlan | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const plan = usePlanSemana(lunes);
  const quitar = useQuitarDelPlan();
  const copiar = useCopiarSemana();
  const pasar = usePasarSemanaALista();
  const scroll = useRef<ScrollView>(null);
  const posiciones = useRef<Record<string, number>>({});

  const hoyFecha = hoy();
  const estaSemana = lunesDe(hoyFecha) === lunes;
  const dias = useMemo(() => diasDeSemana(lunes), [lunes]);
  const items = useMemo(() => plan.data ?? [], [plan.data]);
  const porDia = useMemo(() => {
    const m: Record<string, ItemPlan[]> = {};
    for (const d of dias) m[d] = [];
    for (const i of items) m[i.day]?.push(i);
    for (const d of dias) m[d] = ordenarDelDia(m[d]);
    return m;
  }, [dias, items]);
  const recetas = items.filter((i) => i.recipe_id && i.recipes);

  // El aviso se va solo
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  // Una vez por semana, al cargar: arriba, o directo a hoy si ya hay comidas
  // (con la semana vacia se deja ver el saludo de arriba)
  const desplazada = useRef<string | null>(null);
  useEffect(() => {
    if (plan.isLoading || desplazada.current === lunes) return;
    desplazada.current = lunes;
    const t = setTimeout(() => {
      const y = estaSemana && items.length ? posiciones.current[hoyFecha] : 0;
      scroll.current?.scrollTo({ y: Math.max(0, (y ?? 0) - 8), animated: false });
    }, 60);
    return () => clearTimeout(t);
  }, [lunes, estaSemana, hoyFecha, plan.isLoading, items.length]);

  function irADia(d: string) {
    const y = posiciones.current[d];
    if (y != null) scroll.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  }

  function acciones(item: ItemPlan) {
    Alert.alert(item.recipes?.title ?? item.note ?? 'Comida', undefined, [
      { text: 'Cambiar día o comida', onPress: () => setHoja({ tipo: 'mover', item, lunes }) },
      { text: 'Quitar del plan', style: 'destructive', onPress: () => quitar.mutate([item.id]) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  function menu() {
    const opciones: Parameters<typeof Alert.alert>[2] = [];
    if (items.length) {
      opciones.push({
        text: 'Copiar a la próxima semana',
        onPress: async () => {
          try {
            await copiar.mutateAsync(items);
            setAviso({ texto: 'Semana copiada', accion: { texto: 'Ver', alPulsar: () => setLunes(sumarDias(lunes, 7)) } });
          } catch {
            Alert.alert('No se copió', 'Revisa tu conexión e inténtalo de nuevo.');
          }
        },
      });
      opciones.push({
        text: 'Vaciar esta semana',
        style: 'destructive',
        onPress: () =>
          Alert.alert('¿Vaciar la semana?', 'Se quitan las comidas del plan. Tus recetas no se tocan.', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Vaciar', style: 'destructive', onPress: () => quitar.mutate(items.map((i) => i.id)) },
          ]),
      });
    }
    opciones.push({ text: 'Cerrar', style: 'cancel' });
    Alert.alert('Plan de la semana', items.length ? undefined : 'Cuando agregues comidas, aquí puedes copiarlas o vaciar la semana.', opciones);
  }

  async function pasarALista() {
    try {
      const r = await pasar.mutateAsync(items);
      const partes = [r.nuevos ? `${r.nuevos} ${r.nuevos === 1 ? 'producto nuevo' : 'productos nuevos'}` : '', r.sumados ? `${r.sumados} sumados` : '']
        .filter(Boolean)
        .join(' y ');
      setAviso({
        texto: partes ? `A tu lista: ${partes}` : 'Todo ya estaba en tu lista',
        accion: { texto: 'Ver lista', alPulsar: () => router.navigate('/lista') },
      });
    } catch {
      Alert.alert('No se agregó', 'Revisa tu conexión e inténtalo de nuevo.');
    }
  }

  const abajo = insets.bottom + BARRA;

  return (
    <View style={[estilos.pantalla, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={estilos.cabecera}>
        <Text style={estilos.titulo} accessibilityRole="header">
          Plan
        </Text>
        <Pressable onPress={menu} hitSlop={8} accessibilityRole="button" accessibilityLabel="Más opciones" style={estilos.botonMenu}>
          <MaterialCommunityIcons name="dots-horizontal" size={24} color={Colors.light.text} />
        </Pressable>
      </View>

      <View style={estilos.semana}>
        <Pressable onPress={() => setLunes(sumarDias(lunes, -7))} hitSlop={10} accessibilityRole="button" accessibilityLabel="Semana anterior" style={estilos.flecha}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={Colors.light.text} />
        </Pressable>
        <View style={estilos.centroSemana}>
          <Text style={estilos.rango}>{rangoSemana(lunes)}</Text>
          {estaSemana ? (
            <Text style={estilos.estaSemana}>Esta semana</Text>
          ) : (
            <Pressable onPress={() => setLunes(lunesDe(hoyFecha))} hitSlop={6} accessibilityRole="button" style={estilos.chipVolver}>
              <MaterialCommunityIcons name="calendar-today" size={13} color={Marca.primario} />
              <Text style={estilos.textoVolver}>Ir a esta semana</Text>
            </Pressable>
          )}
        </View>
        <Pressable onPress={() => setLunes(sumarDias(lunes, 7))} hitSlop={10} accessibilityRole="button" accessibilityLabel="Semana siguiente" style={estilos.flecha}>
          <MaterialCommunityIcons name="chevron-right" size={26} color={Colors.light.text} />
        </Pressable>
      </View>

      <View style={estilos.tira}>
        {dias.map((d, i) => {
          const esHoy = d === hoyFecha;
          const conComidas = (porDia[d]?.length ?? 0) > 0;
          return (
            <Pressable key={d} onPress={() => irADia(d)} accessibilityRole="button" accessibilityLabel={nombreDia(d)} style={estilos.diaTira}>
              <Text style={[estilos.inicialTira, esHoy && { color: Marca.primario }]}>{INICIALES[i]}</Text>
              <View style={[estilos.circuloTira, esHoy && estilos.circuloHoy]}>
                <Text style={[estilos.numeroTira, esHoy && { color: '#FFFFFF' }]}>{deFecha(d).getDate()}</Text>
              </View>
              <View style={[estilos.punto, conComidas && { backgroundColor: Marca.primario }]} />
            </Pressable>
          );
        })}
      </View>

      {plan.isLoading ? (
        <View style={estilos.centro}>
          <ActivityIndicator color={Marca.primario} size="large" />
        </View>
      ) : plan.error ? (
        <View style={estilos.centro}>
          <Text style={estilos.tituloVacio}>No pudimos cargar tu plan</Text>
          <Text style={estilos.textoVacio}>Revisa tu conexión e inténtalo de nuevo.</Text>
          <Pressable onPress={() => plan.refetch()} style={estilos.boton} accessibilityRole="button">
            <Text style={estilos.textoBoton}>Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          ref={scroll}
          contentContainerStyle={[estilos.contenido, { paddingBottom: abajo + SOBRE_BARRA + (recetas.length ? 70 : 10) }]}
          refreshControl={<RefreshControl refreshing={plan.isRefetching} onRefresh={plan.refetch} colors={[Marca.primario]} />}>
          {!items.length ? <Bienvenida /> : null}
          {dias.map((d) => (
            <View key={d} onLayout={(e) => (posiciones.current[d] = e.nativeEvent.layout.y)}>
              <TarjetaDia
                fecha={d}
                hoyFecha={hoyFecha}
                items={porDia[d] ?? []}
                alAgregar={() => setHoja({ tipo: 'nuevo', lunes, dia: d })}
                alAbrir={(item) => (item.recipe_id ? router.push(`/receta/${item.recipe_id}`) : acciones(item))}
                alAcciones={acciones}
              />
            </View>
          ))}
        </ScrollView>
      )}

      {recetas.length ? (
        <Animated.View entering={FadeInDown} exiting={FadeOutDown} style={[estilos.flotante, { bottom: abajo + SOBRE_BARRA }]}>
          <Pressable
            onPress={pasarALista}
            disabled={pasar.isPending}
            accessibilityRole="button"
            style={({ pressed }) => [estilos.botonLista, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}>
            {pasar.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="basket-plus-outline" size={22} color="#FFFFFF" />
                <Text style={estilos.textoLista}>Pasar la semana a la lista</Text>
                <View style={estilos.contador}>
                  <Text style={estilos.textoContador}>{recetas.length}</Text>
                </View>
              </>
            )}
          </Pressable>
        </Animated.View>
      ) : null}

      {aviso ? (
        <Animated.View entering={FadeInDown} exiting={FadeOutDown} style={[estilos.aviso, { bottom: abajo + SOBRE_BARRA + (recetas.length ? 66 : 0) }]}>
          <MaterialCommunityIcons name="check-circle" size={20} color={Marca.exito} />
          <Text style={estilos.textoAviso} numberOfLines={2}>
            {aviso.texto}
          </Text>
          {aviso.accion ? (
            <Pressable
              onPress={() => {
                aviso.accion!.alPulsar();
                setAviso(null);
              }}
              hitSlop={8}
              accessibilityRole="button">
              <Text style={estilos.accionAviso}>{aviso.accion.texto}</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}

      <HojaPlan modo={hoja} alCerrar={() => setHoja(null)} alListo={(t) => setAviso({ texto: `Listo: ${t}` })} />
    </View>
  );
}

/** Semana vacia: un saludo arriba, pero las tarjetas de los dias se siguen viendo. */
function Bienvenida() {
  return (
    <View style={estilos.bienvenida}>
      <View style={estilos.dibujo}>
        <Silueta icono="calendar-heart" color={TONOS.naranja} tamano={58} x={26} y={4} giro={-8} retraso={60} />
        <Silueta icono="food-apple" color={TONOS.verde} tamano={34} x={0} y={40} giro={-14} retraso={200} />
        <Silueta icono="pot-steam" color={TONOS.amarillo} tamano={36} x={78} y={38} giro={10} retraso={320} />
      </View>
      <Text style={estilos.tituloBienvenida}>¡Vamos a planear tu semana!</Text>
    </View>
  );
}

function TarjetaDia({
  fecha,
  hoyFecha,
  items,
  alAgregar,
  alAbrir,
  alAcciones,
}: {
  fecha: string;
  hoyFecha: string;
  items: ItemPlan[];
  alAgregar: () => void;
  alAbrir: (item: ItemPlan) => void;
  alAcciones: (item: ItemPlan) => void;
}) {
  const relativa = etiquetaRelativa(fecha, hoyFecha);
  const pasado = fecha < hoyFecha;
  const esHoy = fecha === hoyFecha;

  return (
    <Animated.View layout={LinearTransition.duration(220)} style={[estilos.tarjeta, esHoy && estilos.tarjetaHoy, pasado && { opacity: 0.6 }]}>
      <View style={estilos.cabeceraDia}>
        <Text style={estilos.nombreDia}>{nombreDia(fecha)}</Text>
        {relativa ? (
          <View style={[estilos.etiquetaDia, esHoy && { backgroundColor: Marca.primario }]}>
            <Text style={[estilos.textoEtiquetaDia, esHoy && { color: '#FFFFFF' }]}>{relativa}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        <Pressable onPress={alAgregar} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Añadir al ${nombreDia(fecha)}`} style={estilos.mas}>
          <MaterialCommunityIcons name="plus" size={20} color={Marca.primario} />
        </Pressable>
      </View>

      {items.length ? (
        <View style={estilos.comidas}>
          {items.map((item) => (
            <FilaComida key={item.id} item={item} alPulsar={() => alAbrir(item)} alAcciones={() => alAcciones(item)} />
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

function FilaComida({ item, alPulsar, alAcciones }: { item: ItemPlan; alPulsar: () => void; alAcciones: () => void }) {
  const comida = COMIDAS.find((c) => c.id === item.meal)!;
  const receta = item.recipes;
  return (
    <View style={estilos.fila}>
      <Pressable
        onPress={alPulsar}
        onLongPress={alAcciones}
        accessibilityRole="button"
        style={({ pressed }) => [estilos.contenidoFila, pressed && { backgroundColor: '#FFF7F3' }]}>
        {receta ? (
          <View style={estilos.miniatura}>
            {receta.image_path ? (
              <Image cachePolicy="memory-disk" source={{ uri: receta.image_path }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
            ) : (
              <MaterialCommunityIcons name="silverware-fork-knife" size={18} color={Marca.primarioSuave} />
            )}
          </View>
        ) : (
          <View style={[estilos.miniatura, estilos.miniaturaNota]}>
            <MaterialCommunityIcons name="pencil-outline" size={18} color={Colors.light.textSecondary} />
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <View style={estilos.tipoComida}>
            <MaterialCommunityIcons name={comida.icono} size={13} color={Marca.primario} />
            <Text style={estilos.textoTipo}>{comida.nombre}</Text>
          </View>
          <Text style={[estilos.tituloComida, !receta && estilos.tituloNota]} numberOfLines={2}>
            {receta?.title ?? item.note}
          </Text>
        </View>
      </Pressable>
      <Pressable onPress={alAcciones} hitSlop={10} accessibilityRole="button" accessibilityLabel="Opciones" style={estilos.opciones}>
        <MaterialCommunityIcons name="dots-vertical" size={20} color={Colors.light.textTenue} />
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: FONDO },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6 },
  titulo: { fontFamily: Tipografia.display, fontSize: 30, color: Colors.light.text },
  botonMenu: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EFE7E2', alignItems: 'center', justifyContent: 'center' },

  semana: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  flecha: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  centroSemana: { flex: 1, alignItems: 'center', gap: 2 },
  rango: { fontFamily: Tipografia.seminegrita, fontSize: 17, color: Colors.light.text },
  estaSemana: { fontFamily: Tipografia.media, fontSize: 13, color: Marca.primarioTexto },
  chipVolver: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  textoVolver: { fontFamily: Tipografia.seminegrita, fontSize: 13, color: Marca.primarioTexto },

  tira: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    paddingVertical: 8,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE5E0',
  },
  diaTira: { flex: 1, alignItems: 'center', gap: 4 },
  inicialTira: { fontFamily: Tipografia.media, fontSize: 12, color: Colors.light.textSecondary },
  circuloTira: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  circuloHoy: { backgroundColor: Marca.primario },
  numeroTira: { fontFamily: Tipografia.seminegrita, fontSize: 15, color: Colors.light.text },
  punto: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },

  contenido: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  bienvenida: { alignItems: 'center', gap: 6, paddingVertical: 8 },
  dibujo: { width: 112, height: 80 },
  tituloBienvenida: { textAlign: 'center', fontFamily: Tipografia.display, fontSize: 22, lineHeight: 28, color: Colors.light.text },

  tarjeta: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE5E0',
  },
  tarjetaHoy: { borderColor: '#FBC9B3', borderWidth: 1.5 },
  cabeceraDia: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nombreDia: { fontFamily: Tipografia.seminegrita, fontSize: 16, color: Colors.light.text },
  etiquetaDia: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radios.pildora, backgroundColor: Marca.primarioTenue },
  textoEtiquetaDia: { fontFamily: Tipografia.seminegrita, fontSize: 12, color: Marca.primarioTexto },
  mas: { width: 32, height: 32, borderRadius: 16, backgroundColor: Marca.primarioTenue, alignItems: 'center', justifyContent: 'center' },

  comidas: { gap: 4 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  contenidoFila: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, borderRadius: Radios.chico },
  miniatura: {
    width: 48,
    height: 48,
    borderRadius: Radios.chico,
    overflow: 'hidden',
    backgroundColor: Marca.primarioTenue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniaturaNota: { backgroundColor: '#F4EEEA' },
  tipoComida: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  textoTipo: { fontFamily: Tipografia.negrita, fontSize: 12, color: Colors.light.text },
  tituloComida: { fontFamily: Tipografia.seminegrita, fontSize: 15, lineHeight: 20, color: Colors.light.text },
  tituloNota: { fontFamily: Tipografia.regular, fontStyle: 'italic', color: Colors.light.textSecondary },
  opciones: { width: 28, height: 36, alignItems: 'center', justifyContent: 'center' },

  flotante: { position: 'absolute', left: 16, right: 16 },
  botonLista: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: Radios.pildora,
    backgroundColor: Colors.light.text,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  textoLista: { fontFamily: Tipografia.seminegrita, fontSize: 16, color: '#FFFFFF' },
  contador: { minWidth: 24, height: 24, paddingHorizontal: 6, borderRadius: 12, backgroundColor: Marca.primario, alignItems: 'center', justifyContent: 'center' },
  textoContador: { fontFamily: Tipografia.negrita, fontSize: 13, color: '#FFFFFF' },

  aviso: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radios.medio,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE5E0',
    elevation: 6,
    shadowColor: '#7A2E12',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  textoAviso: { flex: 1, fontFamily: Tipografia.media, fontSize: 14, color: Colors.light.text },
  accionAviso: { fontFamily: Tipografia.seminegrita, fontSize: 14, color: Marca.primarioTexto },

  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32, paddingBottom: 120 },
  tituloVacio: { fontFamily: Tipografia.display, fontSize: 24, textAlign: 'center', color: Colors.light.text },
  textoVacio: { fontFamily: Tipografia.regular, fontSize: 15, lineHeight: 22, textAlign: 'center', color: Colors.light.textSecondary },
  boton: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: Radios.pildora, backgroundColor: Marca.primario },
  textoBoton: { fontFamily: Tipografia.seminegrita, fontSize: 16, color: '#FFFFFF' },
});
