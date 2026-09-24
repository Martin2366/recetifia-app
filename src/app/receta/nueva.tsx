import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { tomarBorrador } from '@/lib/borrador';
import { borrarBorrador, guardarBorrador, leerBorrador, nuevoId, type BorradorConId } from '@/lib/guardado-local';
import { useActualizarReceta, useCrearReceta, useReceta } from '@/lib/recetas';
import type { BorradorReceta, RecetaCompleta } from '@/lib/tipos';

/**
 * Editor de recetas. Sirve para escribir desde cero, para revisar una receta
 * importada antes de guardarla y para editar una ya guardada (?id=).
 *
 * Todo lo escrito se guarda en el telefono mientras se escribe: si la app se
 * cierra, se cae o se queda sin bateria, la biblioteca ofrece seguir (?borrador=).
 * Y si al guardar no hay conexion, la receta queda en cola y se sube sola.
 */

type Modo = 'nueva' | 'editar';
type Inicio = { borrador: BorradorConId; modo: Modo; recuperado: boolean };

type Linea = { clave: number; texto: string };

let contador = 0;
const linea = (texto = ''): Linea => ({ clave: contador++, texto });

function desdeReceta(r: RecetaCompleta): BorradorConId {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    image_path: r.image_path,
    servings: r.servings,
    prep_minutes: r.prep_minutes,
    cook_minutes: r.cook_minutes,
    source_type: r.source_type ?? 'manual',
    source_url: r.source_url,
    source_author: r.source_author,
    status: r.status,
    nutrition: r.nutrition,
    extraction_id: r.extraction_id,
    ingredients: r.ingredientes.map((i) => ({
      raw_text: i.raw_text,
      quantity: i.quantity,
      unit: i.unit,
      name: i.name_normalized,
      group_label: i.group_label,
      emoji: i.emoji,
    })),
    steps: r.pasos.map((p) => ({ text: p.text, duration_seconds: p.duration_seconds })),
  };
}

export default function EditorReceta() {
  const { id, borrador: idBorrador } = useLocalSearchParams<{ id?: string; borrador?: string }>();
  const existente = useReceta(id);
  // El borrador importado se toma una sola vez, al montar
  const [importado] = useState<BorradorReceta | null>(() => (id || idBorrador ? null : tomarBorrador()));
  const [inicio, setInicio] = useState<Inicio | null>(null);

  useEffect(() => {
    if (inicio) return;
    let vivo = true;
    (async () => {
      let siguiente: Inicio;
      if (id) {
        if (!existente.data) return;
        const local = await leerBorrador(id);
        siguiente = local
          ? { borrador: local.borrador, modo: 'editar', recuperado: true }
          : { borrador: desdeReceta(existente.data), modo: 'editar', recuperado: false };
      } else if (idBorrador) {
        const local = await leerBorrador(idBorrador);
        siguiente = local
          ? { borrador: local.borrador, modo: local.modo, recuperado: true }
          : { borrador: { id: nuevoId(), title: '' }, modo: 'nueva', recuperado: false };
      } else {
        siguiente = { borrador: { ...(importado ?? { title: '' }), id: nuevoId() }, modo: 'nueva', recuperado: false };
      }
      if (vivo) setInicio(siguiente);
    })();
    return () => {
      vivo = false;
    };
  }, [id, idBorrador, existente.data, importado, inicio]);

  function descartarRecuperado() {
    if (!inicio) return;
    borrarBorrador(inicio.borrador.id);
    if (inicio.modo === 'editar' && existente.data) {
      setInicio({ borrador: desdeReceta(existente.data), modo: 'editar', recuperado: false });
    } else {
      setInicio({ borrador: { id: nuevoId(), title: '' }, modo: 'nueva', recuperado: false });
    }
  }

  if (id && existente.error) {
    return (
      <Cargando
        mensaje="No pudimos abrir la receta. Revisa tu conexión."
        alReintentar={() => existente.refetch()}
      />
    );
  }
  if (!inicio) return <Cargando />;

  return (
    <Editor
      key={`${inicio.borrador.id}-${inicio.recuperado}`}
      inicio={inicio}
      alDescartarRecuperado={descartarRecuperado}
    />
  );
}

function Cargando({ mensaje, alReintentar }: { mensaje?: string; alReintentar?: () => void }) {
  const router = useRouter();
  return (
    <View style={estilos.cargando}>
      {mensaje ? (
        <>
          <Text style={estilos.textoCargando}>{mensaje}</Text>
          <Pressable onPress={alReintentar} style={estilos.botonReintentar} accessibilityRole="button">
            <Text style={estilos.textoReintentar}>Reintentar</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
            <Text style={estilos.cancelar}>Volver</Text>
          </Pressable>
        </>
      ) : (
        <ActivityIndicator color={Marca.primario} size="large" />
      )}
    </View>
  );
}

function Editor({ inicio, alDescartarRecuperado }: { inicio: Inicio; alDescartarRecuperado: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const crear = useCrearReceta();
  const actualizar = useActualizarReceta();
  const guardando = crear.isPending || actualizar.isPending;

  const { modo } = inicio;
  const origen = inicio.borrador;
  const importada = modo === 'nueva' && Boolean(origen.source_type && origen.source_type !== 'manual');
  const tiempoOriginal = (origen.prep_minutes ?? 0) + (origen.cook_minutes ?? 0);

  const [titulo, setTitulo] = useState(origen.title ?? '');
  const [porciones, setPorciones] = useState(origen.servings ?? 2);
  const [tiempo, setTiempo] = useState(tiempoOriginal ? String(tiempoOriginal) : '');
  const [ingredientes, setIngredientes] = useState<Linea[]>(() =>
    origen.ingredients?.length ? origen.ingredients.map((i) => linea(i.raw_text)) : [linea()]
  );
  const [pasos, setPasos] = useState<Linea[]>(() => (origen.steps?.length ? origen.steps.map((s) => linea(s.text)) : [linea()]));
  const [enfocar, setEnfocar] = useState<number | null>(null);
  const [recuperado, setRecuperado] = useState(inicio.recuperado);

  const puedeGuardar = titulo.trim().length > 0 && !guardando;

  /** La receta tal como esta en pantalla, lista para guardar. */
  function construir(): BorradorConId {
    const ing = ingredientes.map((i) => i.texto.trim()).filter(Boolean);
    const pas = pasos.map((p) => p.texto.trim()).filter(Boolean);
    const minutos = Number(tiempo) || null;
    const mismoTiempo = minutos === (tiempoOriginal || null);
    const completa = ing.length > 0 && pas.length > 0;

    return {
      ...origen,
      title: titulo.trim(),
      servings: porciones,
      // Si no se toco el tiempo, se respetan preparacion y coccion por separado
      prep_minutes: mismoTiempo ? (origen.prep_minutes ?? minutos) : minutos,
      cook_minutes: mismoTiempo ? (origen.cook_minutes ?? null) : null,
      source_type: origen.source_type ?? 'manual',
      status: completa || (modo === 'nueva' && !importada) ? 'complete' : modo === 'editar' ? origen.status : 'needs_review',
      // Lo que la IA supo de cada ingrediente se conserva si su texto no cambio
      ingredients: ing.map((raw_text) => {
        const o = origen.ingredients?.find((x) => x.raw_text === raw_text);
        return { raw_text, quantity: o?.quantity, unit: o?.unit, name: o?.name, emoji: o?.emoji, group_label: o?.group_label };
      }),
      steps: pas.map((text) => ({ text, duration_seconds: origen.steps?.find((s) => s.text === text)?.duration_seconds ?? null })),
    };
  }

  // --- guardado automatico en el telefono ---------------------------------------
  // Como estaba al abrir: sirve para saber si se toco algo
  const inicial = useRef<string | null>(null);
  if (inicial.current === null) inicial.current = JSON.stringify(construir());
  const actual = useRef(construir);
  actual.current = construir;

  function guardarEnTelefono() {
    const b = actual.current();
    const serializado = JSON.stringify(b);
    // Abrir una receta para editarla y salir sin tocar nada no deja borrador
    if (modo === 'editar' && serializado === inicial.current && !recuperado) return borrarBorrador(b.id);
    return guardarBorrador(b, modo);
  }

  useEffect(() => {
    const t = setTimeout(guardarEnTelefono, 600);
    return () => clearTimeout(t);
    // Se guarda cada vez que cambia algo de lo que se ve
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titulo, porciones, tiempo, ingredientes, pasos]);

  useEffect(() => {
    // Al salir de la app no se espera al temporizador: puede no volver a correr
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active') guardarEnTelefono();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tocado() {
    return JSON.stringify(actual.current()) !== inicial.current || recuperado;
  }

  function cancelar() {
    const vacia = !titulo.trim() && !ingredientes.some((i) => i.texto.trim()) && !pasos.some((p) => p.texto.trim());
    // Una importada sin tocar tambien se confirma: descartarla gasta una importacion
    if (vacia || (!tocado() && !importada)) {
      borrarBorrador(origen.id);
      return router.back();
    }
    Alert.alert(
      modo === 'editar' ? '¿Descartar los cambios?' : '¿Descartar la receta?',
      modo === 'editar' ? 'La receta queda como estaba.' : 'Se borrará lo que escribiste.',
      [
        { text: 'Seguir editando', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: async () => {
            await borrarBorrador(origen.id);
            router.back();
          },
        },
      ]
    );
  }

  async function guardar() {
    const receta = construir();
    try {
      const resultado =
        modo === 'editar' ? await actualizar.mutateAsync({ id: receta.id, borrador: receta }) : await crear.mutateAsync(receta);
      await borrarBorrador(receta.id);

      if (resultado.enCola) {
        Alert.alert(
          'Guardada en tu teléfono',
          'No hay conexión ahora. Tu receta está a salvo y se sube sola cuando vuelva internet.'
        );
        if (modo === 'editar') router.back();
        else router.replace('/(tabs)');
      } else if (modo === 'editar') {
        router.back();
      } else {
        router.replace({ pathname: '/receta/[id]', params: { id: resultado.id } });
      }
    } catch (err) {
      // Lo escrito sigue en el telefono: el error no borra nada
      Alert.alert(
        'No pudimos guardar la receta',
        `${err instanceof Error ? err.message : 'Inténtalo de nuevo.'}\n\nLo que escribiste sigue guardado en tu teléfono.`
      );
    }
  }

  function agregar(lista: 'ing' | 'paso') {
    const nueva = linea();
    setEnfocar(nueva.clave);
    if (lista === 'ing') setIngredientes((l) => [...l, nueva]);
    else setPasos((l) => [...l, nueva]);
  }

  const dominio = origen.source_url?.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  const tituloCabecera = modo === 'editar' ? 'Editar receta' : importada ? 'Revisar receta' : 'Nueva receta';

  return (
    <KeyboardAvoidingView style={[estilos.pantalla, { paddingTop: insets.top }]} behavior="height">
      <StatusBar style="dark" />
      <View style={estilos.cabecera}>
        <Pressable onPress={cancelar} hitSlop={10} accessibilityRole="button">
          <Text style={estilos.cancelar}>Cancelar</Text>
        </Pressable>
        <Text style={estilos.tituloCabecera}>{tituloCabecera}</Text>
        {guardando ? (
          <ActivityIndicator color={Marca.primario} />
        ) : (
          <Pressable onPress={guardar} disabled={!puedeGuardar} hitSlop={10} accessibilityRole="button" accessibilityState={{ disabled: !puedeGuardar }}>
            <Text style={[estilos.guardar, !puedeGuardar && estilos.guardarApagado]}>Guardar</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={[estilos.cuerpo, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
        {recuperado ? (
          <View style={[estilos.aviso, estilos.avisoRecuperado]}>
            <MaterialCommunityIcons name="content-save-check-outline" size={20} color={Marca.exito} />
            <Text style={[estilos.textoAviso, estilos.textoRecuperado]}>Recuperamos lo que estabas escribiendo.</Text>
            <Pressable
              onPress={() => {
                setRecuperado(false);
                alDescartarRecuperado();
              }}
              hitSlop={8}
              accessibilityRole="button">
              <Text style={estilos.enlaceAviso}>{modo === 'editar' ? 'Descartar' : 'Empezar de cero'}</Text>
            </Pressable>
          </View>
        ) : importada ? (
          <View style={estilos.aviso}>
            <MaterialCommunityIcons name="text-box-check-outline" size={20} color={Marca.aviso} />
            <Text style={estilos.textoAviso}>
              Revisa que todo esté bien antes de guardar{dominio ? ` · de ${dominio}` : ''}.
            </Text>
          </View>
        ) : null}

        <View style={estilos.bloque}>
          <TextInput
            value={titulo}
            onChangeText={setTitulo}
            placeholder="Título"
            placeholderTextColor={Colors.light.textTenue}
            style={estilos.titulo}
            multiline
            autoFocus={modo === 'nueva' && !importada && !recuperado}
            accessibilityLabel="Título de la receta"
          />
        </View>

        <View style={estilos.bloque}>
          <Pressable
            onPress={() => Alert.alert('Muy pronto', 'Pronto podrás agregar una foto desde la galería o la cámara.')}
            style={[estilos.fila, estilos.filaBorde]}
            accessibilityRole="button">
            <Text style={estilos.etiqueta}>Foto</Text>
            {origen.image_path ? (
              <Image source={{ uri: origen.image_path }} style={estilos.miniatura} contentFit="cover" />
            ) : (
              <View style={estilos.camara}>
                <MaterialCommunityIcons name="camera-outline" size={24} color={Colors.light.text} />
              </View>
            )}
          </Pressable>
          <View style={[estilos.fila, estilos.filaBorde]}>
            <Text style={estilos.etiqueta}>Porciones</Text>
            <View style={estilos.contador}>
              <BotonRedondo icono="minus" alPulsar={() => setPorciones((p) => Math.max(1, p - 1))} etiqueta="Menos porciones" />
              <Text style={estilos.numero}>{porciones}</Text>
              <BotonRedondo icono="plus" alPulsar={() => setPorciones((p) => Math.min(50, p + 1))} etiqueta="Más porciones" />
            </View>
          </View>

          <View style={estilos.fila}>
            <Text style={estilos.etiqueta}>Tiempo total</Text>
            <View style={estilos.tiempo}>
              <TextInput
                value={tiempo}
                onChangeText={(t) => setTiempo(t.replace(/[^0-9]/g, ''))}
                placeholder="30"
                placeholderTextColor={Colors.light.textTenue}
                keyboardType="number-pad"
                maxLength={4}
                style={estilos.entradaTiempo}
                accessibilityLabel="Minutos en total"
              />
              <Text style={estilos.unidad}>min</Text>
            </View>
          </View>
        </View>

        <View style={estilos.bloque}>
          <Text style={estilos.seccion}>Ingredientes</Text>
          {ingredientes.map((l) => (
            <Renglon
              key={l.clave}
              valor={l.texto}
              marca={<View style={estilos.punto} />}
              placeholder="Ej: 2 tazas de harina"
              enfocar={enfocar === l.clave}
              alCambiar={(t) => setIngredientes((ls) => ls.map((x) => (x.clave === l.clave ? { ...x, texto: t } : x)))}
              alQuitar={() => setIngredientes((ls) => (ls.length > 1 ? ls.filter((x) => x.clave !== l.clave) : [linea()]))}
              alEnviar={() => agregar('ing')}
            />
          ))}
          <Agregar texto="Agregar ingrediente" alPulsar={() => agregar('ing')} />
        </View>

        <View style={estilos.bloque}>
          <Text style={estilos.seccion}>Preparación</Text>
          {pasos.map((l, i) => (
            <Renglon
              key={l.clave}
              valor={l.texto}
              multiline
              marca={
                <View style={estilos.numeroPaso}>
                  <Text style={estilos.textoNumeroPaso}>{i + 1}</Text>
                </View>
              }
              placeholder="Describe este paso"
              enfocar={enfocar === l.clave}
              alCambiar={(t) => setPasos((ls) => ls.map((x) => (x.clave === l.clave ? { ...x, texto: t } : x)))}
              alQuitar={() => setPasos((ls) => (ls.length > 1 ? ls.filter((x) => x.clave !== l.clave) : [linea()]))}
            />
          ))}
          <Agregar texto="Agregar paso" alPulsar={() => agregar('paso')} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Renglon({
  valor,
  marca,
  placeholder,
  enfocar,
  multiline = false,
  alCambiar,
  alQuitar,
  alEnviar,
}: {
  valor: string;
  marca: React.ReactNode;
  placeholder: string;
  enfocar: boolean;
  multiline?: boolean;
  alCambiar: (t: string) => void;
  alQuitar: () => void;
  alEnviar?: () => void;
}) {
  const ref = useRef<TextInput>(null);
  return (
    <View style={estilos.renglon}>
      {marca}
      <TextInput
        ref={ref}
        value={valor}
        onChangeText={alCambiar}
        placeholder={placeholder}
        placeholderTextColor={Colors.light.textTenue}
        autoFocus={enfocar}
        multiline={multiline}
        submitBehavior={alEnviar ? 'submit' : undefined}
        returnKeyType={alEnviar ? 'next' : 'default'}
        onSubmitEditing={alEnviar}
        style={estilos.entradaRenglon}
      />
      <Pressable onPress={alQuitar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Quitar">
        <MaterialCommunityIcons name="close" size={18} color={Colors.light.textTenue} />
      </Pressable>
    </View>
  );
}

function Agregar({ texto, alPulsar }: { texto: string; alPulsar: () => void }) {
  return (
    <Pressable onPress={alPulsar} style={estilos.agregar} accessibilityRole="button">
      <MaterialCommunityIcons name="plus" size={22} color={Marca.primario} />
      <Text style={estilos.textoAgregar}>{texto}</Text>
    </Pressable>
  );
}

function BotonRedondo({ icono, alPulsar, etiqueta }: { icono: 'plus' | 'minus'; alPulsar: () => void; etiqueta: string }) {
  return (
    <Pressable onPress={alPulsar} hitSlop={6} accessibilityRole="button" accessibilityLabel={etiqueta} style={estilos.botonRedondo}>
      <MaterialCommunityIcons name={icono} size={18} color={Colors.light.text} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#F7F2EE' },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    height: 58,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borde,
  },
  cancelar: { fontFamily: Tipografia.media, fontSize: 16, color: Colors.light.textSecondary },
  tituloCabecera: { fontFamily: Tipografia.display, fontSize: 18, color: Colors.light.text },
  guardar: { fontFamily: Tipografia.negrita, fontSize: 16, color: Marca.primario },
  guardarApagado: { color: '#FFC7B2' },

  cuerpo: { gap: 12, paddingTop: 12 },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 14,
    padding: 12,
    borderRadius: Radios.medio,
    backgroundColor: '#FFF6E6',
  },
  textoAviso: { flex: 1, fontFamily: Tipografia.media, fontSize: 14, lineHeight: 19, color: Marca.aviso },
  avisoRecuperado: { backgroundColor: '#EAF8EF' },
  textoRecuperado: { color: '#17803D' },
  enlaceAviso: { fontFamily: Tipografia.seminegrita, fontSize: 14, color: Colors.light.textSecondary },

  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, backgroundColor: '#F7F2EE' },
  textoCargando: { fontFamily: Tipografia.media, fontSize: 16, lineHeight: 23, textAlign: 'center', color: Colors.light.text },
  botonReintentar: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: Radios.pildora, backgroundColor: Marca.primario },
  textoReintentar: { fontFamily: Tipografia.seminegrita, fontSize: 16, color: '#FFFFFF' },

  bloque: { backgroundColor: '#FFFFFF', paddingHorizontal: 18, paddingVertical: 6 },
  titulo: { fontFamily: Tipografia.display, fontSize: 26, lineHeight: 34, color: Colors.light.text, paddingVertical: 12 },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 64 },
  filaBorde: { borderBottomWidth: 1, borderBottomColor: '#F1ECE9' },
  etiqueta: { fontFamily: Tipografia.seminegrita, fontSize: 16, color: Colors.light.text },
  camara: {
    width: 56,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.light.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniatura: { width: 56, height: 48, borderRadius: 12 },
  contador: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  numero: { fontFamily: Tipografia.seminegrita, fontSize: 17, color: Colors.light.text, minWidth: 22, textAlign: 'center' },
  botonRedondo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: Colors.light.borde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tiempo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  entradaTiempo: {
    minWidth: 60,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: Radios.chico,
    backgroundColor: '#F6F3F1',
    textAlign: 'center',
    fontFamily: Tipografia.seminegrita,
    fontSize: 16,
    color: Colors.light.text,
  },
  unidad: { fontFamily: Tipografia.regular, fontSize: 15, color: Colors.light.textSecondary },

  seccion: { fontFamily: Tipografia.display, fontSize: 22, color: Colors.light.text, paddingTop: 12, paddingBottom: 4 },
  renglon: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, borderBottomWidth: 1, borderBottomColor: '#F1ECE9' },
  punto: { width: 7, height: 7, borderRadius: 4, backgroundColor: Marca.primario },
  numeroPaso: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Marca.primarioTenue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoNumeroPaso: { fontFamily: Tipografia.negrita, fontSize: 12, color: Marca.primario },
  entradaRenglon: { flex: 1, fontFamily: Tipografia.regular, fontSize: 16, lineHeight: 22, color: Colors.light.text, paddingVertical: 10 },
  agregar: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54 },
  textoAgregar: { fontFamily: Tipografia.media, fontSize: 16, color: Marca.primario },
});
