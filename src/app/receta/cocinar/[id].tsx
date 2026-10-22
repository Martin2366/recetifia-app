import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Marca, MaxContentWidth, Radios, Spacing, Tipografia } from '@/constants/theme';
import { useMarcarCocinada } from '@/lib/cocinadas';
import { exito, toque } from '@/lib/haptica';
import { cancelarTemporizador, pedirPermiso, programarTemporizador, reprogramarRecordatorios } from '@/lib/notificaciones';
import { textoIngredienteEscalado } from '@/lib/porciones';
import { useReceta } from '@/lib/recetas';
import { pedirResenaSiToca } from '@/lib/resena';
import { formatoDuracion, formatoReloj, tiemposDelPaso } from '@/lib/tiempos';

/**
 * Modo cocina: toda la receta en una lista para ir marcando. Cada ingrediente y
 * cada paso tiene su check (blanco → naranja, con un saltito) y se tacha al
 * marcarlo. Los pasos que dicen un tiempo traen su temporizador. "La cocine"
 * esta siempre disponible; cuando todo esta marcado, ademas, se destaca.
 * El cupo del plan gratis se descuenta antes de entrar (detalle de la receta).
 */

type Temporizador = { id: string; fin: number; titulo: string; aviso: string | null };

const ATAJOS_MINUTOS = [1, 5, 10, 15];

export default function ModoCocina() {
  const { id, porciones: porcionesParam } = useLocalSearchParams<{ id: string; porciones?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: receta, isLoading } = useReceta(id);
  const marcar = useMarcarCocinada();

  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [temporizadores, setTemporizadores] = useState<Temporizador[]>([]);
  const [ahora, setAhora] = useState(Date.now());
  const [eligiendoTiempo, setEligiendoTiempo] = useState(false);
  const terminadosAvisados = useRef<Set<string>>(new Set());

  // Las manos estan ocupadas: la pantalla no se apaga mientras se cocina
  useKeepAwake();

  // Un reloj para las cuentas regresivas; solo corre si hay temporizadores
  useEffect(() => {
    if (!temporizadores.length) return;
    const intervalo = setInterval(() => setAhora(Date.now()), 500);
    const sub = AppState.addEventListener('change', () => setAhora(Date.now()));
    return () => {
      clearInterval(intervalo);
      sub.remove();
    };
  }, [temporizadores.length]);

  // Al llegar a cero: vibra una vez y se queda marcado como terminado
  useEffect(() => {
    for (const t of temporizadores) {
      if (t.fin <= ahora && !terminadosAvisados.current.has(t.id)) {
        terminadosAvisados.current.add(t.id);
        exito();
      }
    }
  }, [ahora, temporizadores]);

  if (isLoading || !receta) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" color={Marca.primario} />
      </View>
    );
  }

  const base = receta.servings;
  const actuales = porcionesParam ? Number(porcionesParam) : base;
  const total = receta.ingredientes.length + receta.pasos.length;
  const hechos = marcados.size;
  const todoListo = total > 0 && hechos === total;

  function alternar(clave: string) {
    toque();
    setMarcados((previos) => {
      const copia = new Set(previos);
      if (copia.has(clave)) copia.delete(clave);
      else copia.add(clave);
      return copia;
    });
  }

  async function iniciarTemporizador(segundos: number, titulo: string) {
    toque();
    // El permiso se pide aqui, cuando se entiende para que sirve
    await pedirPermiso();
    const fin = Date.now() + segundos * 1000;
    const aviso = await programarTemporizador(new Date(fin), titulo, `/receta/cocinar/${receta!.id}`);
    setAhora(Date.now());
    setTemporizadores((previos) => [...previos, { id: `${fin}-${previos.length}`, fin, titulo, aviso }]);
  }

  function quitarTemporizador(t: Temporizador) {
    cancelarTemporizador(t.aviso);
    setTemporizadores((previos) => previos.filter((x) => x.id !== t.id));
  }

  async function laCocine() {
    try {
      const { primera } = await marcar.mutateAsync(receta!.id);
      exito();
      reprogramarRecordatorios();
      temporizadores.forEach((t) => cancelarTemporizador(t.aviso));
      router.back();
      setTimeout(() => {
        Alert.alert('¡Buen provecho! 🎉', 'Quedó registrada en tus recetas cocinadas.');
        if (primera) setTimeout(() => pedirResenaSiToca({ trasCocinar: true }), 1200);
      }, 400);
    } catch {
      Alert.alert('No se guardó', 'Revisa tu conexión e inténtalo de nuevo.');
    }
  }

  return (
    <View style={[estilos.pantalla, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      <View style={estilos.cabecera}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Salir del modo cocina">
          <MaterialIcons name="close" size={26} color={Colors.light.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={estilos.titulo} numberOfLines={1}>
            {receta.title}
          </Text>
          <Text style={estilos.progresoTexto}>
            {hechos} de {total} listos
          </Text>
        </View>
        <Pressable onPress={() => setEligiendoTiempo((v) => !v)} hitSlop={8} accessibilityRole="button" style={estilos.botonReloj}>
          <MaterialIcons name="timer" size={20} color={Marca.primarioTexto} />
          <Text style={estilos.textoReloj}>Temporizador</Text>
        </Pressable>
      </View>
      <View style={estilos.barra}>
        <View style={[estilos.barraLlena, { width: `${total ? (hechos / total) * 100 : 0}%` }]} />
      </View>

      {eligiendoTiempo ? (
        <View style={estilos.atajos}>
          {ATAJOS_MINUTOS.map((m) => (
            <Pressable
              key={m}
              onPress={() => {
                setEligiendoTiempo(false);
                iniciarTemporizador(m * 60, `Pasaron ${m} min`);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [estilos.pildora, pressed && { opacity: 0.7 }]}>
              <Text style={estilos.textoPildora}>{m} min</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <ScrollView contentContainerStyle={[estilos.contenido, { paddingBottom: 140 + insets.bottom + temporizadores.length * 56 }]}>
        {actuales && base && actuales !== base ? (
          <Text style={estilos.nota}>Cantidades para {actuales} {actuales === 1 ? 'persona' : 'personas'}.</Text>
        ) : null}

        {receta.ingredientes.length ? <Text style={estilos.seccion}>Ingredientes</Text> : null}
        {receta.ingredientes.map((ing, k) => (
          <View key={ing.id}>
            {ing.group_label && ing.group_label !== receta.ingredientes[k - 1]?.group_label ? (
              <Text style={estilos.grupo}>{ing.group_label}</Text>
            ) : null}
            <FilaCheck
              marcado={marcados.has(`i-${ing.id}`)}
              alPulsar={() => alternar(`i-${ing.id}`)}
              texto={`${ing.emoji ? `${ing.emoji} ` : ''}${textoIngredienteEscalado(ing, base, actuales)}`}
            />
          </View>
        ))}

        {receta.pasos.length ? <Text style={estilos.seccion}>Preparación</Text> : null}
        {receta.pasos.map((paso, i) => {
          const clave = `p-${paso.id}`;
          const tiempos = tiemposDelPaso(paso.text, paso.duration_seconds);
          return (
            <FilaCheck
              key={paso.id}
              marcado={marcados.has(clave)}
              alPulsar={() => alternar(clave)}
              numero={i + 1}
              texto={paso.text}>
              {tiempos.length ? (
                <View style={estilos.tiempos}>
                  {tiempos.map((t) => (
                    <Pressable
                      key={t.segundos}
                      onPress={() => iniciarTemporizador(t.segundos, `Paso ${i + 1}: ${formatoDuracion(t.segundos)}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`Iniciar temporizador de ${t.texto}`}
                      style={({ pressed }) => [estilos.pildora, pressed && { opacity: 0.7 }]}>
                      <MaterialIcons name="timer" size={15} color={Marca.primarioTexto} />
                      <Text style={estilos.textoPildora}>{t.texto}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </FilaCheck>
          );
        })}

        {total === 0 ? <Text style={estilos.nota}>Esta receta no tiene ingredientes ni pasos guardados.</Text> : null}
      </ScrollView>

      <View style={[estilos.pie, { paddingBottom: insets.bottom + 12 }]}>
        {temporizadores.map((t) => {
          const resta = (t.fin - ahora) / 1000;
          const listo = resta <= 0;
          return (
            <View key={t.id} style={[estilos.temporizador, listo && estilos.temporizadorListo]}>
              <MaterialIcons name={listo ? 'alarm-on' : 'timer'} size={20} color={listo ? '#FFFFFF' : Marca.primarioTexto} />
              <Text style={[estilos.textoTemporizador, listo && { color: '#FFFFFF' }]} numberOfLines={1}>
                {t.titulo}
              </Text>
              <Text style={[estilos.reloj, listo && { color: '#FFFFFF' }]}>{listo ? '¡Tiempo!' : formatoReloj(resta)}</Text>
              <Pressable onPress={() => quitarTemporizador(t)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Quitar temporizador">
                <MaterialIcons name="close" size={20} color={listo ? '#FFFFFF' : Colors.light.textSecondary} />
              </Pressable>
            </View>
          );
        })}
        <BotonListo destacado={todoListo} ocupado={marcar.isPending} alPulsar={laCocine} />
      </View>
    </View>
  );
}

/** Una linea con su check: blanco con borde, y naranja con un salto al marcarlo. */
function FilaCheck({
  marcado,
  alPulsar,
  texto,
  numero,
  children,
}: {
  marcado: boolean;
  alPulsar: () => void;
  texto: string;
  numero?: number;
  children?: React.ReactNode;
}) {
  const escala = useSharedValue(1);
  const primera = useRef(true);

  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    escala.value = withSequence(withTiming(1.3, { duration: 110 }), withSpring(1, { damping: 7, stiffness: 260 }));
  }, [marcado, escala]);

  const estiloCheck = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }));

  return (
    <Pressable
      onPress={alPulsar}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcado }}
      style={({ pressed }) => [estilos.fila, pressed && { opacity: 0.85 }]}>
      <Animated.View style={[estilos.check, marcado && estilos.checkMarcado, estiloCheck]}>
        {marcado ? <MaterialIcons name="check" size={18} color="#FFFFFF" /> : null}
      </Animated.View>
      <View style={{ flex: 1, gap: 8 }}>
        <Text style={[estilos.textoFila, marcado && estilos.tachado]}>
          {numero ? <Text style={estilos.numero}>{numero}. </Text> : null}
          {texto}
        </Text>
        {children}
      </View>
    </Pressable>
  );
}

function BotonListo({ destacado, ocupado, alPulsar }: { destacado: boolean; ocupado: boolean; alPulsar: () => void }) {
  const pulso = useSharedValue(1);

  useEffect(() => {
    pulso.value = destacado
      ? withRepeat(withSequence(withTiming(1.04, { duration: 500 }), withTiming(1, { duration: 500 })), 3, false)
      : withTiming(1, { duration: 150 });
  }, [destacado, pulso]);

  const estilo = useAnimatedStyle(() => ({ transform: [{ scale: pulso.value }] }));

  return (
    <Animated.View style={estilo}>
      <Pressable
        onPress={alPulsar}
        disabled={ocupado}
        accessibilityRole="button"
        style={({ pressed }) => [estilos.listo, !destacado && estilos.listoSuave, (pressed || ocupado) && { opacity: 0.8 }]}>
        {ocupado ? (
          <ActivityIndicator color={destacado ? '#FFFFFF' : Marca.primario} />
        ) : (
          <>
            <MaterialIcons name="check-circle" size={22} color={destacado ? '#FFFFFF' : Marca.primario} />
            <Text style={[estilos.textoListo, !destacado && { color: Marca.primario }]}>
              {destacado ? '¡Todo listo! La cociné' : 'La cociné'}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#FFFFFF' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },

  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.three, paddingVertical: 10 },
  titulo: { fontFamily: Tipografia.display, fontSize: 20, color: Colors.light.text },
  progresoTexto: { fontFamily: Tipografia.media, fontSize: 13, color: Colors.light.textSecondary },
  botonReloj: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radios.pildora,
    backgroundColor: Marca.primarioTenue,
  },
  textoReloj: { fontFamily: Tipografia.seminegrita, fontSize: 13, color: Marca.primarioTexto },
  barra: { height: 4, marginHorizontal: Spacing.three, borderRadius: 2, backgroundColor: Colors.light.borde, overflow: 'hidden' },
  barraLlena: { height: 4, backgroundColor: Marca.primario },
  atajos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: Spacing.three, paddingTop: 12 },

  contenido: { padding: Spacing.three, gap: 4, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  nota: { fontFamily: Tipografia.regular, fontSize: 14, color: Colors.light.textSecondary },
  seccion: { fontFamily: Tipografia.display, fontSize: 22, color: Colors.light.text, marginTop: 18, marginBottom: 6 },
  grupo: { fontFamily: Tipografia.seminegrita, fontSize: 16, color: Colors.light.text, marginTop: 10, marginBottom: 2 },

  fila: { flexDirection: 'row', gap: 14, paddingVertical: 12, alignItems: 'flex-start' },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#C9CECE',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkMarcado: { backgroundColor: Marca.primario, borderColor: Marca.primario },
  textoFila: { fontFamily: Tipografia.regular, fontSize: 18, lineHeight: 27, color: Colors.light.text },
  tachado: { textDecorationLine: 'line-through', color: Colors.light.textTenue },
  numero: { fontFamily: Tipografia.negrita },

  tiempos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pildora: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radios.pildora,
    borderWidth: 1.5,
    borderColor: Marca.primario,
    backgroundColor: '#FFF7F3',
  },
  textoPildora: { fontFamily: Tipografia.seminegrita, fontSize: 14, color: Marca.primarioTexto },

  pie: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.three,
    paddingTop: 12,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 14,
    shadowColor: '#7A2E12',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
  },
  temporizador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    minHeight: 48,
    borderRadius: Radios.medio,
    backgroundColor: Marca.primarioTenue,
  },
  temporizadorListo: { backgroundColor: Marca.primario },
  textoTemporizador: { flex: 1, fontFamily: Tipografia.media, fontSize: 14, color: Colors.light.text },
  reloj: { fontFamily: Tipografia.negrita, fontSize: 18, color: Marca.primarioTexto, fontVariant: ['tabular-nums'] },
  listo: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: Radios.pildora,
    backgroundColor: Marca.primario,
  },
  listoSuave: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: Marca.primario },
  textoListo: { fontFamily: Tipografia.seminegrita, fontSize: 17, color: '#FFFFFF' },
});
