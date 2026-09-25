import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvisosLocales } from '@/components/biblioteca/avisos-locales';
import { HojaAgregar, type DestinoHoja } from '@/components/biblioteca/hoja-agregar';
import { PrimerosPasos } from '@/components/biblioteca/primeros-pasos';
import { useGuia, useObjetivoGuia, type ObjetivoGuia } from '@/components/guia/guia';
import { TarjetaColeccion, TarjetaReceta } from '@/components/biblioteca/tarjetas';
import { Silueta, TONOS } from '@/components/onboarding/formas';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useColecciones } from '@/lib/colecciones';
import { useCuota } from '@/lib/cuota';
import { useLista } from '@/lib/lista';
import { useAlternarFavorita, useRecetas } from '@/lib/recetas';

/**
 * Biblioteca: la pantalla de inicio. Dos pestanas de carpeta (todas las recetas
 * y colecciones) y el boton + que abre la hoja para anadir.
 */

const SUAVE = Easing.bezier(0.22, 1, 0.36, 1);
const FONDO = '#F7F2EE';
const MARGEN = 18;
const SEPARACION = 14;

type Pestana = 'recetas' | 'colecciones';

export default function Biblioteca() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const [pestana, setPestana] = useState<Pestana>('recetas');
  const [hoja, setHoja] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [soloFavoritas, setSoloFavoritas] = useState(false);

  const recetas = useRecetas(busqueda);
  const colecciones = useColecciones();
  const cuota = useCuota();
  const alternarFavorita = useAlternarFavorita();
  const guia = useGuia();
  const { anonima } = useAuth();
  const listaCompras = useLista();

  // La primera vez que se llega aqui, la guia muestra lo importante (una sola vez)
  const listo = !recetas.isLoading && !cuota.isLoading;
  useEffect(() => {
    if (!listo) return;
    const t = setTimeout(() => guia.iniciar(), 900);
    return () => clearTimeout(t);
    // Solo al quedar lista la pantalla; iniciar ya recuerda si se vio
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo]);

  const anchoTarjeta = (W - MARGEN * 2 - SEPARACION) / 2;
  const pieLista = insets.bottom + 170; // aire para la barra flotante y el boton +

  const lista = (recetas.data ?? []).filter((r) => !soloFavoritas || r.is_favorite);
  const bibliotecaVacia = !recetas.isLoading && !busqueda.trim() && (recetas.data ?? []).length === 0;

  function elegir(destino: DestinoHoja) {
    setHoja(false);
    // Deja cerrar la hoja antes de navegar, para que no se vea el salto
    setTimeout(() => {
      if (destino === 'texto') router.push('/importar/texto');
      else if (destino === 'web') router.push('/importar/web');
      else if (destino === 'cero') router.push('/receta/nueva');
      else router.push('/plus');
    }, 220);
  }

  return (
    <View style={[estilos.pantalla, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      <Cabecera
        restantes={cuota.data?.importacionesRestantes}
        plus={cuota.data?.plus ?? false}
        alPulsarCuota={() => router.push('/plus')}
        alPulsarPerfil={() => router.push('/perfil')}
      />

      <AvisosLocales />
      <PrimerosPasos
        tareas={[
          { clave: 'importar', titulo: 'Guarda tu primera receta', hecha: !recetas.isLoading && !bibliotecaVacia, alPulsar: () => setHoja(true) },
          {
            clave: 'coleccion',
            titulo: 'Crea una colección',
            hecha: Boolean(colecciones.data?.length),
            alPulsar: () => {
              setPestana('colecciones');
              setHoja(true);
            },
          },
          { clave: 'lista', titulo: 'Agrega ingredientes a tu lista', hecha: Boolean(listaCompras.data?.length), alPulsar: () => router.push('/lista') },
          { clave: 'respaldo', titulo: 'Respalda tus recetas con Google', hecha: !anonima, alPulsar: () => router.push('/perfil') },
        ]}
      />

      <View style={estilos.pestanas}>
        <PestanaCarpeta texto="Todas las recetas" activa={pestana === 'recetas'} alPulsar={() => setPestana('recetas')} />
        <PestanaCarpeta texto="Colecciones" activa={pestana === 'colecciones'} alPulsar={() => setPestana('colecciones')} guia="colecciones" />
      </View>

      <View style={[estilos.cuerpo, pestana === 'recetas' ? estilos.cuerpoIzquierda : estilos.cuerpoDerecha]}>
        {pestana === 'recetas' ? (
          recetas.isLoading ? (
            <Cargando />
          ) : recetas.error ? (
            <Mensaje titulo="No pudimos cargar tus recetas" texto="Revisa tu conexión e inténtalo de nuevo." accion={{ texto: 'Reintentar', alPulsar: () => recetas.refetch() }} />
          ) : bibliotecaVacia ? (
            <EstadoVacio />
          ) : (
            <FlatList
              data={lista}
              keyExtractor={(r) => r.id}
              numColumns={2}
              columnWrapperStyle={{ gap: SEPARACION }}
              contentContainerStyle={{ paddingHorizontal: MARGEN, paddingBottom: pieLista, rowGap: 20 }}
              keyboardShouldPersistTaps="handled"
              refreshControl={<RefreshControl refreshing={recetas.isRefetching} onRefresh={recetas.refetch} colors={[Marca.primario]} />}
              ListHeaderComponent={
                <Buscador
                  busqueda={busqueda}
                  alBuscar={setBusqueda}
                  soloFavoritas={soloFavoritas}
                  alFavoritas={() => setSoloFavoritas((v) => !v)}
                />
              }
              ListEmptyComponent={
                <Mensaje
                  titulo={soloFavoritas ? 'Aún no tienes favoritas' : 'Sin resultados'}
                  texto={
                    soloFavoritas
                      ? 'Toca el corazón de una receta para tenerla siempre a mano.'
                      : `No encontramos nada para «${busqueda.trim()}». Prueba con un ingrediente.`
                  }
                />
              }
              renderItem={({ item }) => (
                <TarjetaReceta
                  receta={item}
                  ancho={anchoTarjeta}
                  alPulsar={() => router.push({ pathname: '/receta/[id]', params: { id: item.id } })}
                  alFavorita={() => alternarFavorita.mutate({ id: item.id, favorita: !item.is_favorite })}
                />
              )}
            />
          )
        ) : colecciones.isLoading ? (
          <Cargando />
        ) : (
          <FlatList
            data={colecciones.data ?? []}
            keyExtractor={(c) => c.id}
            numColumns={2}
            columnWrapperStyle={{ gap: SEPARACION }}
            contentContainerStyle={[{ paddingHorizontal: MARGEN, paddingTop: 20, paddingBottom: pieLista, rowGap: 20 }, !colecciones.data?.length && { flexGrow: 1 }]}
            refreshControl={<RefreshControl refreshing={colecciones.isRefetching} onRefresh={colecciones.refetch} colors={[Marca.primario]} />}
            ListEmptyComponent={
              <Mensaje
                icono="bookmark-multiple-outline"
                titulo="Tus colecciones"
                texto="Agrupa tus recetas como quieras: postres, almuerzos rápidos, lo de la abuela. Crea la primera con el botón +."
              />
            }
            renderItem={({ item }) => (
              <TarjetaColeccion
                coleccion={item}
                ancho={anchoTarjeta}
                alPulsar={() => router.push({ pathname: '/coleccion/[id]', params: { id: item.id } })}
              />
            )}
          />
        )}

        {bibliotecaVacia && pestana === 'recetas' ? (
          <Image
            source={require('@/assets/images/biblioteca/flecha.png')}
            style={[estilos.flecha, { bottom: insets.bottom + 118 }]}
            contentFit="contain"
            accessible={false}
          />
        ) : null}
      </View>

      <BotonMas abajo={insets.bottom + 96} alPulsar={() => setHoja(true)} />

      <HojaAgregar visible={hoja} alCerrar={() => setHoja(false)} alElegir={elegir} cuota={cuota.data} />
    </View>
  );
}

function Cabecera({
  restantes,
  plus,
  alPulsarCuota,
  alPulsarPerfil,
}: {
  restantes: number | undefined;
  plus: boolean;
  alPulsarCuota: () => void;
  alPulsarPerfil: () => void;
}) {
  const { session } = useAuth();
  const refCuota = useObjetivoGuia('cuota');
  const meta = session?.user.user_metadata ?? {};
  const foto = (meta.avatar_url ?? meta.picture) as string | undefined;
  const nombre = (meta.full_name ?? meta.name ?? session?.user.email ?? '') as string;

  return (
    <View style={estilos.cabecera}>
      <View style={estilos.marca}>
        <View style={estilos.teja}>
          <Image source={require('@/assets/images/logo-blanco.png')} style={estilos.logo} contentFit="contain" />
        </View>
        <Text style={estilos.nombreMarca}>Recetifia</Text>
      </View>

      <View style={estilos.acciones}>
        {plus || restantes !== undefined ? (
          <Pressable
            ref={refCuota}
            collapsable={false}
            onPress={alPulsarCuota}
            accessibilityRole="button"
            accessibilityLabel={plus ? 'Tienes Recetifia Plus' : `Te quedan ${restantes} importaciones gratis de videos e imágenes`}
            style={({ pressed }) => [estilos.chip, pressed && { opacity: 0.8 }]}>
            <MaterialCommunityIcons name={plus ? 'crown' : 'lightning-bolt'} size={18} color={Marca.primario} />
            <Text style={estilos.textoChip}>{plus ? 'Plus' : `${restantes} restantes`}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={alPulsarPerfil} accessibilityRole="button" accessibilityLabel="Tu perfil" style={estilos.avatar}>
          {foto ? (
            <Image source={{ uri: foto }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : nombre.trim() ? (
            <Text style={estilos.inicial}>{nombre.trim()[0].toUpperCase()}</Text>
          ) : (
            // Sin cuenta no hay nombre: un icono en vez de un "?"
            <MaterialCommunityIcons name="account" size={24} color={Colors.light.textSecondary} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

/** Pestana con forma de carpeta: la activa se funde con la hoja blanca de abajo. */
function PestanaCarpeta({
  texto,
  activa,
  alPulsar,
  guia,
}: {
  texto: string;
  activa: boolean;
  alPulsar: () => void;
  guia?: ObjetivoGuia;
}) {
  const refGuia = useObjetivoGuia(guia);
  return (
    <Pressable
      ref={refGuia}
      collapsable={false}
      onPress={alPulsar}
      accessibilityRole="tab"
      accessibilityState={{ selected: activa }}
      style={[estilos.carpeta, activa ? estilos.carpetaActiva : estilos.carpetaInactiva]}>
      <Text style={[estilos.textoCarpeta, activa && estilos.textoCarpetaActiva]}>{texto}</Text>
    </Pressable>
  );
}

function Buscador({
  busqueda,
  alBuscar,
  soloFavoritas,
  alFavoritas,
}: {
  busqueda: string;
  alBuscar: (t: string) => void;
  soloFavoritas: boolean;
  alFavoritas: () => void;
}) {
  return (
    <View style={estilos.buscadorFila}>
      <View style={estilos.buscador}>
        <MaterialCommunityIcons name="magnify" size={21} color={Colors.light.textSecondary} />
        <TextInput
          value={busqueda}
          onChangeText={alBuscar}
          placeholder="Busca por nombre o ingrediente"
          placeholderTextColor={Colors.light.textTenue}
          style={estilos.entrada}
          returnKeyType="search"
          accessibilityLabel="Buscar recetas"
        />
        {busqueda ? (
          <Pressable onPress={() => alBuscar('')} hitSlop={10} accessibilityLabel="Borrar búsqueda">
            <MaterialCommunityIcons name="close-circle" size={19} color={Colors.light.textTenue} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={alFavoritas}
        accessibilityRole="switch"
        accessibilityState={{ checked: soloFavoritas }}
        accessibilityLabel="Ver solo favoritas"
        style={[estilos.favoritas, soloFavoritas && estilos.favoritasActivas]}>
        <MaterialCommunityIcons name={soloFavoritas ? 'heart' : 'heart-outline'} size={21} color={soloFavoritas ? '#FFFFFF' : Colors.light.text} />
      </Pressable>
    </View>
  );
}

/** Biblioteca vacia: bodegon de siluetas y la invitacion a empezar. */
function EstadoVacio() {
  const texto = useSharedValue(0);
  useEffect(() => {
    texto.value = withDelay(500, withTiming(1, { duration: 650, easing: SUAVE }));
  }, [texto]);
  const estiloTexto = useAnimatedStyle(() => ({
    opacity: texto.value,
    transform: [{ translateY: interpolate(texto.value, [0, 1], [14, 0]) }],
  }));

  return (
    <View style={estilos.vacio}>
      <View style={estilos.bodegon} accessible={false}>
        <Silueta icono="glass-mug-variant" color="#F7A8C0" tamano={120} x={0} y={18} giro={-4} retraso={100} />
        <Silueta icono="silverware-spoon" color={TONOS.naranja} tamano={112} x={20} y={20} giro={28} retraso={260} />
        <Silueta icono="bowl" color="#DCEFC6" tamano={118} x={130} y={36} giro={0} retraso={180} />
        <Silueta icono="bowl" color={TONOS.amarillo} tamano={132} x={62} y={30} giro={0} retraso={320} />
        <Silueta icono="silverware-fork" color="#2F6B3A" tamano={100} x={140} y={-2} giro={-62} retraso={420} />
      </View>
      <Animated.View style={[estilos.textosVacio, estiloTexto]}>
        <Text style={estilos.tituloVacio} accessibilityRole="header">
          ¡Vamos a{'\n'}
          <Text style={estilos.resalte}>cocinar!</Text>
        </Text>
        <Text style={estilos.textoVacio}>Empieza agregando tu primera receta</Text>
      </Animated.View>
    </View>
  );
}

function BotonMas({ abajo, alPulsar }: { abajo: number; alPulsar: () => void }) {
  const presion = useSharedValue(1);
  const estilo = useAnimatedStyle(() => ({ transform: [{ scale: presion.value }] }));
  const refGuia = useObjetivoGuia('mas');
  return (
    <Animated.View style={[estilos.mas, { bottom: abajo }, estilo]}>
      <Pressable
        ref={refGuia}
        collapsable={false}
        onPress={alPulsar}
        onPressIn={() => (presion.value = withTiming(0.92, { duration: 90 }))}
        onPressOut={() => (presion.value = withTiming(1, { duration: 160 }))}
        accessibilityRole="button"
        accessibilityLabel="Añadir receta o colección"
        style={estilos.botonMas}>
        <MaterialCommunityIcons name="plus" size={34} color="#FFFFFF" />
      </Pressable>
    </Animated.View>
  );
}

function Cargando() {
  return (
    <View style={estilos.centro}>
      <ActivityIndicator size="large" color={Marca.primario} />
    </View>
  );
}

function Mensaje({
  titulo,
  texto,
  icono,
  accion,
}: {
  titulo: string;
  texto: string;
  icono?: keyof typeof MaterialCommunityIcons.glyphMap;
  accion?: { texto: string; alPulsar: () => void };
}) {
  return (
    <View style={estilos.mensaje}>
      {icono ? (
        <View style={estilos.iconoMensaje}>
          <MaterialCommunityIcons name={icono} size={30} color={Marca.primario} />
        </View>
      ) : null}
      <Text style={estilos.tituloMensaje}>{titulo}</Text>
      <Text style={estilos.textoMensaje}>{texto}</Text>
      {accion ? (
        <Pressable onPress={accion.alPulsar} accessibilityRole="button" style={({ pressed }) => [estilos.reintentar, pressed && { opacity: 0.8 }]}>
          <Text style={estilos.textoReintentar}>{accion.texto}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: FONDO },

  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: MARGEN, paddingTop: 10, paddingBottom: 18 },
  marca: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teja: { width: 34, height: 34, borderRadius: 10, backgroundColor: Marca.primario, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 21, height: 19 },
  nombreMarca: { fontFamily: Tipografia.display, fontSize: 25, color: Colors.light.text },
  acciones: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: Radios.pildora,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE5E0',
  },
  textoChip: { fontFamily: Tipografia.seminegrita, fontSize: 15, color: Colors.light.text },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    backgroundColor: '#EDE5E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inicial: { fontFamily: Tipografia.seminegrita, fontSize: 17, color: Colors.light.textSecondary },

  pestanas: { flexDirection: 'row', paddingHorizontal: 0 },
  carpeta: { paddingHorizontal: 20, height: 48, justifyContent: 'center', borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  carpetaActiva: { backgroundColor: '#FFFFFF' },
  carpetaInactiva: { backgroundColor: '#EFE7E2', marginBottom: 0, marginTop: 4 },
  textoCarpeta: { fontFamily: Tipografia.media, fontSize: 16, color: Colors.light.textSecondary },
  textoCarpetaActiva: { fontFamily: Tipografia.seminegrita, color: Colors.light.text },

  cuerpo: { flex: 1, backgroundColor: '#FFFFFF' },
  cuerpoIzquierda: { borderTopRightRadius: 28 },
  cuerpoDerecha: { borderTopLeftRadius: 28, borderTopRightRadius: 28 },

  buscadorFila: { flexDirection: 'row', gap: 10, paddingTop: 18, paddingBottom: 4 },
  buscador: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: Radios.pildora,
    backgroundColor: '#F6F3F1',
  },
  entrada: { flex: 1, fontFamily: Tipografia.regular, fontSize: 15, color: Colors.light.text, paddingVertical: 0 },
  favoritas: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F6F3F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoritasActivas: { backgroundColor: Marca.primario },

  vacio: { flex: 1, alignItems: 'center', paddingTop: '14%', gap: 26 },
  bodegon: { width: 270, height: 170 },
  textosVacio: { alignItems: 'center', gap: 14, paddingHorizontal: 32 },
  tituloVacio: { fontFamily: Tipografia.display, fontSize: 42, lineHeight: 50, textAlign: 'center', color: Colors.light.text },
  resalte: { color: Marca.primario },
  textoVacio: { fontFamily: Tipografia.media, fontSize: 16, textAlign: 'center', color: Colors.light.textSecondary },
  flecha: { position: 'absolute', right: 70, width: 150, height: 110 },

  mas: { position: 'absolute', right: 20 },
  botonMas: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Marca.primario,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#7A2E12',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },

  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mensaje: { alignItems: 'center', gap: 10, paddingTop: 60, paddingHorizontal: 30 },
  iconoMensaje: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Marca.primarioTenue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tituloMensaje: { fontFamily: Tipografia.display, fontSize: 22, textAlign: 'center', color: Colors.light.text },
  textoMensaje: { fontFamily: Tipografia.regular, fontSize: 15, lineHeight: 21, textAlign: 'center', color: Colors.light.textSecondary },
  reintentar: { marginTop: 8, paddingHorizontal: 22, height: 44, borderRadius: Radios.pildora, backgroundColor: Marca.primario, justifyContent: 'center' },
  textoReintentar: { fontFamily: Tipografia.seminegrita, fontSize: 15, color: '#FFFFFF' },
});
