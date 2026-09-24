import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';

/**
 * Guia de primeros pasos: la primera vez que se llega a la biblioteca, un foco
 * recorre lo importante (el +, el contador, colecciones, lista, perfil) con una
 * frase cada uno. Es liviana a proposito: cuatro rectangulos oscuros alrededor
 * del hueco y un anillo, animando solo posicion y opacidad en el hilo de UI.
 */

export type ObjetivoGuia = 'mas' | 'cuota' | 'colecciones' | 'lista' | 'perfil';

const PASOS: { clave: ObjetivoGuia; titulo: string; texto: string }[] = [
  { clave: 'mas', titulo: 'Todo empieza aquí', texto: 'Con el + agregas recetas: desde un reel, pegando el texto o escribiéndola tú.' },
  { clave: 'cuota', titulo: 'Tus importaciones', texto: 'Importar videos es gratis: 10 por semana. Guardar, escribir y organizar, sin límite.' },
  { clave: 'colecciones', titulo: 'Colecciones', texto: 'Agrupa tus recetas en carpetas: postres, almuerzos rápidos, lo de la abuela.' },
  { clave: 'lista', titulo: 'Lista de compras', texto: 'Desde cualquier receta, sus ingredientes llegan aquí, ordenados por pasillo.' },
  { clave: 'perfil', titulo: 'Tu perfil', texto: 'Respalda tus recetas con Google y no las pierdes si cambias de teléfono.' },
];

const CLAVE_VISTA = 'recetifia:guia-vista';
const MARGEN_FOCO = 8;
const SUAVE = Easing.bezier(0.22, 1, 0.36, 1);

type Rect = { x: number; y: number; w: number; h: number };
type Ctx = {
  registrar: (clave: ObjetivoGuia, vista: View | null) => void;
  /** Arranca la guia si nunca se vio (o siempre, con forzar). */
  iniciar: (forzar?: boolean) => void;
  activa: boolean;
};

const GuiaContext = createContext<Ctx | null>(null);

/** Ref para marcar un elemento como objetivo de la guia. */
export function useObjetivoGuia(clave: ObjetivoGuia | undefined) {
  const ctx = useContext(GuiaContext);
  return useCallback((vista: View | null) => (clave ? ctx?.registrar(clave, vista) : undefined), [ctx, clave]);
}

export function useGuia() {
  const ctx = useContext(GuiaContext);
  if (!ctx) throw new Error('useGuia debe usarse dentro de <GuiaProvider>');
  return ctx;
}

export function GuiaProvider({ children }: { children: ReactNode }) {
  const objetivos = useRef(new Map<ObjetivoGuia, View>());
  const raiz = useRef<View>(null);
  const [pasos, setPasos] = useState<typeof PASOS | null>(null);
  const [indice, setIndice] = useState(0);
  const [foco, setFoco] = useState<Rect | null>(null);
  const { width: W, height: H } = useWindowDimensions();

  const registrar = useCallback((clave: ObjetivoGuia, vista: View | null) => {
    if (vista) objetivos.current.set(clave, vista);
    else objetivos.current.delete(clave);
  }, []);

  const iniciar = useCallback(async (forzar = false) => {
    if (!forzar) {
      try {
        if ((await AsyncStorage.getItem(CLAVE_VISTA)) === '1') return;
      } catch {
        // Sin almacenamiento: se muestra, que es lo seguro para alguien nuevo
      }
    }
    // Solo los pasos cuyo objetivo esta en pantalla (el contador puede no estar)
    const disponibles = PASOS.filter((p) => objetivos.current.has(p.clave));
    if (!disponibles.length) return;
    setIndice(0);
    setFoco(null);
    setPasos(disponibles);
  }, []);

  const terminar = useCallback(() => {
    setPasos(null);
    AsyncStorage.setItem(CLAVE_VISTA, '1').catch(() => {});
  }, []);

  // Mide el objetivo del paso actual, relativo a esta capa
  useEffect(() => {
    if (!pasos) return;
    const vista = objetivos.current.get(pasos[indice].clave);
    const capa = raiz.current;
    if (!vista || !capa) return;
    capa.measureInWindow((cx, cy) => {
      vista.measureInWindow((x, y, w, h) => {
        if (!w || !h) return setIndice((i) => (i + 1 < pasos.length ? i + 1 : i));
        setFoco({ x: x - cx - MARGEN_FOCO, y: y - cy - MARGEN_FOCO, w: w + MARGEN_FOCO * 2, h: h + MARGEN_FOCO * 2 });
      });
    });
  }, [pasos, indice, W, H]);

  useEffect(() => {
    if (!pasos) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      terminar();
      return true;
    });
    return () => sub.remove();
  }, [pasos, terminar]);

  function siguiente() {
    if (!pasos) return;
    if (indice + 1 >= pasos.length) terminar();
    else setIndice(indice + 1);
  }

  const valor = useMemo<Ctx>(() => ({ registrar, iniciar, activa: Boolean(pasos) }), [registrar, iniciar, pasos]);

  return (
    <GuiaContext.Provider value={valor}>
      <View ref={raiz} collapsable={false} style={{ flex: 1 }}>
        {children}
        {pasos ? (
          <Capa
            foco={foco}
            paso={pasos[indice]}
            numero={indice + 1}
            total={pasos.length}
            alto={H}
            alSiguiente={siguiente}
            alSaltar={terminar}
          />
        ) : null}
      </View>
    </GuiaContext.Provider>
  );
}

function Capa({
  foco,
  paso,
  numero,
  total,
  alto,
  alSiguiente,
  alSaltar,
}: {
  foco: Rect | null;
  paso: (typeof PASOS)[number];
  numero: number;
  total: number;
  alto: number;
  alSiguiente: () => void;
  alSaltar: () => void;
}) {
  // El hueco se desliza de un objetivo al siguiente
  const x = useSharedValue(foco?.x ?? 0);
  const y = useSharedValue(foco?.y ?? 0);
  const w = useSharedValue(foco?.w ?? 0);
  const h = useSharedValue(foco?.h ?? 0);
  const latido = useSharedValue(0);

  useEffect(() => {
    if (!foco) return;
    // El primer foco aparece en su sitio; los siguientes se deslizan
    if (w.value === 0) {
      x.value = foco.x;
      y.value = foco.y;
      w.value = foco.w;
      h.value = foco.h;
      return;
    }
    const t = { duration: 380, easing: SUAVE };
    x.value = withTiming(foco.x, t);
    y.value = withTiming(foco.y, t);
    w.value = withTiming(foco.w, t);
    h.value = withTiming(foco.h, t);
  }, [foco, x, y, w, h]);

  useEffect(() => {
    latido.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.out(Easing.quad) }), -1, false);
  }, [latido]);

  const arriba = useAnimatedStyle(() => ({ height: Math.max(0, y.value) }));
  const abajo = useAnimatedStyle(() => ({ top: y.value + h.value }));
  const izquierda = useAnimatedStyle(() => ({ top: y.value, height: h.value, width: Math.max(0, x.value) }));
  const derecha = useAnimatedStyle(() => ({ top: y.value, height: h.value, left: x.value + w.value }));
  const anillo = useAnimatedStyle(() => ({
    left: x.value,
    top: y.value,
    width: w.value,
    height: h.value,
    opacity: 1 - latido.value * 0.7,
    transform: [{ scale: 1 + latido.value * 0.08 }],
  }));

  // La tarjeta va del lado con mas espacio
  const tarjetaArriba = foco ? foco.y + foco.h / 2 > alto / 2 : false;
  const posicionTarjeta = foco
    ? tarjetaArriba
      ? { bottom: alto - foco.y + 16 }
      : { top: foco.y + foco.h + 16 }
    : { top: alto / 2 - 80 };

  return (
    <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)} style={StyleSheet.absoluteFill}>
      {/* Tocar lo oscuro avanza: nadie queda atrapado */}
      <Pressable style={StyleSheet.absoluteFill} onPress={alSiguiente} accessible={false}>
        <Animated.View style={[estilos.velo, { top: 0, left: 0, right: 0 }, arriba]} />
        <Animated.View style={[estilos.velo, { left: 0, right: 0, bottom: 0 }, abajo]} />
        <Animated.View style={[estilos.velo, { left: 0 }, izquierda]} />
        <Animated.View style={[estilos.velo, { right: 0 }, derecha]} />
      </Pressable>
      {foco ? <Animated.View pointerEvents="none" style={[estilos.anillo, anillo]} /> : null}

      <Animated.View
        key={paso.clave}
        entering={FadeIn.duration(260).delay(120)}
        style={[estilos.tarjeta, posicionTarjeta]}
        accessibilityLiveRegion="polite">
        <Text style={estilos.contador}>
          {numero} de {total}
        </Text>
        <Text style={estilos.titulo}>{paso.titulo}</Text>
        <Text style={estilos.texto}>{paso.texto}</Text>
        <View style={estilos.acciones}>
          <Pressable onPress={alSaltar} hitSlop={10} accessibilityRole="button">
            <Text style={estilos.saltar}>{numero < total ? 'Saltar' : ''}</Text>
          </Pressable>
          <Pressable
            onPress={alSiguiente}
            accessibilityRole="button"
            style={({ pressed }) => [estilos.boton, pressed && { opacity: 0.85 }]}>
            <Text style={estilos.textoBoton}>{numero < total ? 'Siguiente' : '¡A cocinar!'}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  velo: { position: 'absolute', backgroundColor: 'rgba(24, 14, 9, 0.72)' },
  anillo: { position: 'absolute', borderRadius: 22, borderWidth: 3, borderColor: Marca.primario },
  tarjeta: {
    position: 'absolute',
    left: 20,
    right: 20,
    padding: 18,
    gap: 6,
    borderRadius: Radios.grande,
    backgroundColor: '#FFFFFF',
  },
  contador: { fontFamily: Tipografia.negrita, fontSize: 12, letterSpacing: 0.8, color: Marca.primario },
  titulo: { fontFamily: Tipografia.display, fontSize: 22, color: Colors.light.text },
  texto: { fontFamily: Tipografia.regular, fontSize: 15, lineHeight: 22, color: Colors.light.textSecondary },
  acciones: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  saltar: { fontFamily: Tipografia.seminegrita, fontSize: 15, color: Colors.light.textSecondary },
  boton: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: Radios.pildora, backgroundColor: Marca.primario },
  textoBoton: { fontFamily: Tipografia.seminegrita, fontSize: 15, color: '#FFFFFF' },
});
