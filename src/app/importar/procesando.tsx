import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Escaner } from '@/components/importar/escaner';
import { VistaPrevia } from '@/components/importar/vista-previa';
import { BotonOnboarding } from '@/components/onboarding/boton';
import { Colors, Marca, Tipografia } from '@/constants/theme';
import { dejarBorrador } from '@/lib/borrador';
import { agregarAColeccion, useColecciones } from '@/lib/colecciones';
import { LIMITES } from '@/lib/compras';
import { claveCuota, useCuota } from '@/lib/cuota';
import {
  cargarReceta,
  EnlaceInvalido,
  iniciarImportacion,
  LimiteAlcanzado,
  useTrabajo,
  type RecetaImportada,
  type Rescate as DatosRescate,
} from '@/lib/importacion';
import { recetaDesdeTexto } from '@/lib/importar';
import { useCrearReceta } from '@/lib/recetas';
import { pedirResenaSiToca } from '@/lib/resena';
import type { BorradorReceta, FuenteReceta } from '@/lib/tipos';

/**
 * Importar un enlace con IA: llega desde "Compartir" en Instagram/TikTok o
 * desde la pantalla de la web. Muestra el progreso real y luego la vista previa.
 */
export default function Procesando() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { url } = useLocalSearchParams<{ url: string }>();

  const [intento, setIntento] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [errorInicio, setErrorInicio] = useState<'limite' | 'enlace' | 'red' | null>(null);
  const [receta, setReceta] = useState<RecetaImportada | null>(null);
  const iniciado = useRef(-1);

  const trabajo = useTrabajo(jobId);
  const cuota = useCuota();
  const colecciones = useColecciones();
  const crear = useCrearReceta();
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    // Una sola llamada por intento, aunque React monte el efecto dos veces
    if (!url || iniciado.current === intento) return;
    iniciado.current = intento;
    iniciarImportacion(url)
      .then(setJobId)
      .catch((e) => setErrorInicio(e instanceof LimiteAlcanzado ? 'limite' : e instanceof EnlaceInvalido ? 'enlace' : 'red'));
  }, [url, intento]);

  const t = trabajo.data;
  useEffect(() => {
    if (t?.status !== 'done' || !t.extraction_id || receta) return;
    qc.invalidateQueries({ queryKey: claveCuota });
    cargarReceta(t.extraction_id)
      .then((r) => setReceta({ ...r, extraction_id: t.extraction_id, quality: t.quality ?? r.quality, origin: t.origin ?? r.origin }))
      .catch(() => setErrorInicio('red'));
  }, [t, receta, qc]);

  function reintentar() {
    setErrorInicio(null);
    setJobId(null);
    setReceta(null);
    setIntento((i) => i + 1);
  }

  // La IA no armo la receta, pero algo se encontro: el editor se abre con eso
  // y el enlace original, en vez de dejar a la persona con las manos vacias
  function completarRescate() {
    const r = t?.rescate;
    if (!r) return aMano();
    const fuente = (t?.source_type ?? 'web') as FuenteReceta;
    const deRedes = fuente !== 'web';
    // El caption de una red se lee como receta pegada; el de una web es ruido
    const leido = deRedes && r.texto ? recetaDesdeTexto(r.texto) : null;
    const ingredientes = r.ingredientes.length ? r.ingredientes : (leido?.ingredients?.map((i) => i.raw_text) ?? []);
    let pasos = r.pasos.length ? r.pasos : (leido?.steps?.map((x) => x.text) ?? []);
    // Nada ordenable: el texto de la publicacion entero, para cortarlo a mano
    if (!ingredientes.length && !pasos.length && deRedes && r.texto.trim()) pasos = [r.texto.trim().slice(0, 2000)];

    const borrador: BorradorReceta = {
      title: r.titulo,
      image_path: r.foto,
      source_url: url,
      source_type: fuente,
      source_author: r.autor || null,
      ingredients: ingredientes.map((raw_text) => ({ raw_text })),
      steps: pasos.map((text) => ({ text })),
    };
    dejarBorrador(borrador);
    router.replace('/receta/nueva');
  }

  function aMano() {
    dejarBorrador({ title: '', source_url: url, source_type: t?.source_type as never });
    router.replace('/receta/nueva');
  }

  async function guardar(coleccionId: string | null) {
    if (!receta) return;
    setGuardando(true);
    try {
      const { id, enCola } = await crear.mutateAsync({ ...receta, status: receta.quality === 'partial' ? 'needs_review' : 'complete' });
      if (enCola) {
        // Sin conexion: la receta ya esta a salvo en el telefono y se sube sola
        Alert.alert(
          'Guardada en tu teléfono',
          coleccionId
            ? 'No hay conexión ahora. La receta se sube sola cuando vuelva internet; agrégala a la colección después.'
            : 'No hay conexión ahora. La receta se sube sola cuando vuelva internet.'
        );
        router.replace('/(tabs)');
        return;
      }
      if (coleccionId) await agregarAColeccion(coleccionId, id).catch(() => {});
      qc.invalidateQueries({ queryKey: ['colecciones'] });
      router.replace({ pathname: '/receta/[id]', params: { id } });
      // Con la receta ya a la vista, y solo si ya van 3 buenas
      setTimeout(pedirResenaSiToca, 1500);
    } catch (e) {
      Alert.alert('No pudimos guardarla', e instanceof Error ? e.message : 'Inténtalo de nuevo.');
      setGuardando(false);
    }
  }

  function editar() {
    if (!receta) return;
    dejarBorrador(receta);
    router.replace('/receta/nueva');
  }

  const fallo = errorInicio === 'enlace' || errorInicio === 'red' || t?.status === 'failed';
  const hayRescate = t?.status === 'failed' && Boolean(t.rescate);

  return (
    <View style={[estilos.pantalla, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={estilos.cabecera}>
        <View style={estilos.marca}>
          <View style={estilos.teja}>
            <Image source={require('@/assets/images/logo-blanco.png')} style={estilos.logo} contentFit="contain" />
          </View>
          <Text style={estilos.nombre}>Recetifia</Text>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Text style={estilos.cancelar}>{receta ? 'Cerrar' : 'Cancelar'}</Text>
        </Pressable>
      </View>

      {receta ? (
        <VistaPrevia
          receta={receta}
          plus={cuota.data?.plus ?? false}
          colecciones={colecciones.data ?? []}
          guardando={guardando}
          alGuardar={guardar}
          alEditar={editar}
          alCancelar={() => router.back()}
        />
      ) : errorInicio === 'limite' ? (
        // Primero lo gratis, y Plus al final: nunca se deja a nadie sin salida
        <Estado
          icono="calendar-refresh"
          titulo={`Ya usaste tus ${LIMITES.importacionesPorSemana} de esta semana`}
          texto="Importar desde videos e imágenes se renueva el lunes. Mientras tanto, copia el texto de la publicación y pégalo aquí: eso es gratis y sin límite."
          boton={{ texto: 'Pegar el texto de la receta', alPulsar: () => router.replace('/importar/texto') }}
          secundario={{ texto: 'Escribirla a mano', alPulsar: aMano }}
          terciario={{ texto: 'Importar sin límite con Recetifia+', alPulsar: () => router.replace('/plus') }}
          abajo={insets.bottom}
        />
      ) : hayRescate ? (
        <Rescate
          datos={t!.rescate!}
          alCompletar={completarRescate}
          alVerVideo={() => url && Linking.openURL(url)}
          alReintentar={reintentar}
          abajo={insets.bottom}
        />
      ) : fallo ? (
        <Estado
          icono="text-box-search-outline"
          titulo="No pudimos leer esta receta"
          texto={
            errorInicio === 'enlace'
              ? 'Ese enlace no parece válido. Prueba compartiendo la publicación de nuevo.'
              : errorInicio === 'red'
                ? 'Se cortó la conexión. Revisa tu internet e inténtalo otra vez.'
                : 'No encontramos ingredientes ni pasos en esa publicación. Puedes escribirla a mano: guardamos el enlace para que no la pierdas.'
          }
          boton={{ texto: 'Escribirla a mano', alPulsar: aMano }}
          secundario={{ texto: 'Probar de nuevo', alPulsar: reintentar }}
          abajo={insets.bottom}
        />
      ) : (
        <View style={estilos.centro}>
          <Escaner etapa={t?.stage ?? (jobId ? 'leyendo' : 'iniciando')} />
        </View>
      )}
    </View>
  );
}

/**
 * La IA no armo la receta entera. En vez de un parrafo, se muestra que se
 * encontro (con ✓) y que falta (con ✗), y un solo camino: completarla.
 */
function Rescate({
  datos,
  alCompletar,
  alVerVideo,
  alReintentar,
  abajo,
}: {
  datos: DatosRescate;
  alCompletar: () => void;
  alVerVideo: () => void;
  alReintentar: () => void;
  abajo: number;
}) {
  const items: { texto: string; ok: boolean }[] = [
    { texto: 'Título', ok: Boolean(datos.titulo) },
    { texto: 'Foto', ok: Boolean(datos.foto) },
    { texto: 'Enlace al video', ok: true },
    { texto: datos.ingredientes.length ? `${datos.ingredientes.length} ingredientes` : 'Ingredientes', ok: datos.ingredientes.length > 0 },
    { texto: datos.pasos.length ? `${datos.pasos.length} pasos` : 'Pasos', ok: datos.pasos.length > 0 },
  ];
  return (
    <View style={[estilos.estado, { paddingBottom: abajo + 24 }]}>
      <View style={estilos.centro}>
        <Text style={estilos.titulo}>Nos faltó una parte</Text>
        <Text style={estilos.texto}>Este video no dice todo en voz alta. Te dejamos lo que encontramos: tú agregas el resto.</Text>

        <View style={estilos.tarjetaRescate}>
          <View style={estilos.cabeceraRescate}>
            {datos.foto ? (
              <Image source={{ uri: datos.foto }} style={estilos.fotoRescate} contentFit="cover" />
            ) : (
              <View style={[estilos.fotoRescate, estilos.sinFoto]}>
                <MaterialCommunityIcons name="silverware-fork-knife" size={24} color={Marca.primario} />
              </View>
            )}
            <Text style={estilos.tituloRescate} numberOfLines={2}>
              {datos.titulo || 'Receta sin título'}
            </Text>
          </View>
          {items.map((i) => (
            <View key={i.texto} style={estilos.filaRescate}>
              <MaterialCommunityIcons
                name={i.ok ? 'check-circle' : 'close-circle-outline'}
                size={20}
                color={i.ok ? Marca.exito : Colors.light.textTenue}
              />
              <Text style={[estilos.textoRescate, !i.ok && estilos.textoFalta]}>
                {i.texto}
                {i.ok ? '' : ': lo agregas tú'}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <BotonOnboarding texto="Completar receta" alPulsar={alCompletar} />
      <View style={estilos.filaEnlaces}>
        <Pressable onPress={alVerVideo} style={estilos.secundario} accessibilityRole="button">
          <Text style={estilos.textoSecundario}>Ver el video</Text>
        </Pressable>
        <Pressable onPress={alReintentar} style={estilos.secundario} accessibilityRole="button">
          <Text style={estilos.textoSecundario}>Intentar de nuevo</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Estado({
  icono,
  titulo,
  texto,
  boton,
  secundario,
  terciario,
  abajo,
}: {
  icono: keyof typeof MaterialCommunityIcons.glyphMap;
  titulo: string;
  texto: string;
  boton: { texto: string; alPulsar: () => void };
  secundario: { texto: string; alPulsar: () => void };
  terciario?: { texto: string; alPulsar: () => void };
  abajo: number;
}) {
  return (
    <View style={[estilos.estado, { paddingBottom: abajo + 24 }]}>
      <View style={estilos.centro}>
        <View style={estilos.icono}>
          <MaterialCommunityIcons name={icono} size={38} color={Marca.primario} />
        </View>
        <Text style={estilos.titulo}>{titulo}</Text>
        <Text style={estilos.texto}>{texto}</Text>
      </View>
      <BotonOnboarding texto={boton.texto} alPulsar={boton.alPulsar} />
      <Pressable onPress={secundario.alPulsar} style={estilos.secundario} accessibilityRole="button">
        <Text style={estilos.textoSecundario}>{secundario.texto}</Text>
      </Pressable>
      {terciario ? (
        <Pressable onPress={terciario.alPulsar} style={estilos.secundario} accessibilityRole="button">
          <Text style={[estilos.textoSecundario, estilos.textoPlus]}>{terciario.texto}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#FFFFFF' },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    height: 58,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borde,
  },
  marca: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  teja: { width: 28, height: 28, borderRadius: 8, backgroundColor: Marca.primario, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 17, height: 15 },
  nombre: { fontFamily: Tipografia.display, fontSize: 19, color: Colors.light.text },
  cancelar: { fontFamily: Tipografia.media, fontSize: 16, color: Colors.light.text },

  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  estado: { flex: 1, paddingHorizontal: 28, gap: 10 },
  icono: { width: 78, height: 78, borderRadius: 39, backgroundColor: Marca.primarioTenue, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  titulo: { fontFamily: Tipografia.display, fontSize: 25, textAlign: 'center', color: Colors.light.text },
  texto: { fontFamily: Tipografia.regular, fontSize: 16, lineHeight: 23, textAlign: 'center', color: Colors.light.textSecondary },
  secundario: { alignSelf: 'center', padding: 10 },
  textoPlus: { color: Marca.primario },
  tarjetaRescate: {
    alignSelf: 'stretch',
    marginTop: 12,
    padding: 16,
    gap: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.light.borde,
  },
  cabeceraRescate: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  fotoRescate: { width: 56, height: 56, borderRadius: 14 },
  sinFoto: { backgroundColor: Marca.primarioTenue, alignItems: 'center', justifyContent: 'center' },
  tituloRescate: { flex: 1, fontFamily: Tipografia.display, fontSize: 18, lineHeight: 23, color: Colors.light.text },
  filaRescate: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  textoRescate: { fontFamily: Tipografia.media, fontSize: 15, color: Colors.light.text },
  textoFalta: { color: Colors.light.textSecondary },
  filaEnlaces: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  textoSecundario: { fontFamily: Tipografia.seminegrita, fontSize: 15, color: Colors.light.textSecondary },
});
