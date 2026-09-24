import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { supabase } from './supabase';
import type { BorradorReceta } from './tipos';

/**
 * Lo que vive en el telefono para que nada se pierda:
 *
 * - Borradores: lo que se esta escribiendo en el editor, guardado cada pocos
 *   segundos. Si la app se cierra, se cae o se queda sin bateria, la biblioteca
 *   ofrece seguir donde quedo.
 * - Pendientes: recetas que se guardaron sin conexion. Se suben solas cuando
 *   vuelve la red; el id lo genera el telefono, asi que reintentar no duplica.
 */

const CLAVE_BORRADORES = 'recetifia:borradores';
const CLAVE_PENDIENTES = 'recetifia:pendientes';

/** Borrador con id fijo: el de la receta nueva que sera, o el de la que se edita. */
export type BorradorConId = BorradorReceta & { id: string };

export type BorradorLocal = {
  borrador: BorradorConId;
  modo: 'nueva' | 'editar';
  guardadoEn: number;
};

export type Pendiente = {
  borrador: BorradorConId;
  modo: 'nueva' | 'editar';
  encoladoEn: number;
  /** De quien es: si en el telefono entra otra cuenta, no se sube a la suya. */
  usuario?: string;
  /** El servidor la rechazo por algo que reintentar no arregla. */
  error?: string;
};

export const claveLocales = ['locales'] as const;

/** uuid v4. Basta para ids de receta: no es un secreto. */
export function nuevoId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (x) => {
    const r = (Math.random() * 16) | 0;
    return (x === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function leer<T>(clave: string): Promise<Record<string, T>> {
  try {
    const crudo = await AsyncStorage.getItem(clave);
    return crudo ? (JSON.parse(crudo) as Record<string, T>) : {};
  } catch {
    return {};
  }
}

async function escribir<T>(clave: string, valor: Record<string, T>) {
  try {
    await AsyncStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Sin espacio o sin almacenamiento: no hay a donde mas guardarlo.
  }
}

// --- borradores ---------------------------------------------------------------

/** Si el borrador no tiene nada escrito, no vale la pena guardarlo. */
function tieneContenido(b: BorradorReceta) {
  return Boolean(b.title?.trim() || b.ingredients?.some((i) => i.raw_text.trim()) || b.steps?.some((s) => s.text.trim()));
}

export async function guardarBorrador(borrador: BorradorConId, modo: BorradorLocal['modo']) {
  const todos = await leer<BorradorLocal>(CLAVE_BORRADORES);
  if (tieneContenido(borrador)) todos[borrador.id] = { borrador, modo, guardadoEn: Date.now() };
  else delete todos[borrador.id];
  await escribir(CLAVE_BORRADORES, todos);
}

export async function leerBorrador(id: string): Promise<BorradorLocal | null> {
  return (await leer<BorradorLocal>(CLAVE_BORRADORES))[id] ?? null;
}

export async function borrarBorrador(id: string) {
  const todos = await leer<BorradorLocal>(CLAVE_BORRADORES);
  delete todos[id];
  await escribir(CLAVE_BORRADORES, todos);
}

// --- pendientes ---------------------------------------------------------------

async function usuarioActual(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id;
}

export async function encolar(borrador: BorradorConId, modo: Pendiente['modo']) {
  const todos = await leer<Pendiente>(CLAVE_PENDIENTES);
  todos[borrador.id] = { borrador, modo, encoladoEn: Date.now(), usuario: await usuarioActual() };
  await escribir(CLAVE_PENDIENTES, todos);
}

export async function descartarPendiente(id: string) {
  const todos = await leer<Pendiente>(CLAVE_PENDIENTES);
  delete todos[id];
  await escribir(CLAVE_PENDIENTES, todos);
}

/**
 * Sin respuesta del servidor (sin red, se corto, tardo demasiado). Un error con
 * codigo de Postgres o HTTP es una respuesta: reintentar no lo arregla.
 */
export function esErrorDeRed(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const { code, message, name } = e as { code?: string; message?: string; name?: string };
  if (name === 'AbortError' || name === 'TimeoutError') return true;
  if (code && code !== '') return false;
  return /network|fetch|abort|timeout|tiempo|conexi/i.test(message ?? '');
}

async function subirUna(p: Pendiente) {
  if (p.modo === 'nueva') {
    const { error } = await supabase.rpc('crear_receta', { receta: p.borrador });
    if (error) throw error;
  } else {
    const { error } = await supabase.rpc('actualizar_receta', { receta_id: p.borrador.id, receta: p.borrador });
    if (error) throw error;
  }
}

let subiendo = false;

/** Sube lo que se pueda, en orden. Se detiene en el primer error de red. */
export async function subirPendientes(): Promise<number> {
  if (subiendo) return 0;
  subiendo = true;
  let subidas = 0;
  try {
    const todos = await leer<Pendiente>(CLAVE_PENDIENTES);
    const usuario = await usuarioActual();
    if (!usuario) return 0;
    const orden = Object.values(todos)
      .filter((p) => !p.error && p.usuario === usuario)
      .sort((a, b) => a.encoladoEn - b.encoladoEn);
    for (const p of orden) {
      try {
        await subirUna(p);
        await descartarPendiente(p.borrador.id);
        subidas++;
      } catch (e) {
        if (esErrorDeRed(e)) break;
        // Se queda guardada y visible, con el motivo, en vez de perderse
        const actuales = await leer<Pendiente>(CLAVE_PENDIENTES);
        if (actuales[p.borrador.id]) {
          actuales[p.borrador.id].error = (e as { message?: string })?.message || 'El servidor no la aceptó.';
          await escribir(CLAVE_PENDIENTES, actuales);
        }
      }
    }
  } finally {
    subiendo = false;
  }
  return subidas;
}

/** Al borrar la cuenta: nada de ella queda en el telefono. */
export async function limpiarLocales() {
  try {
    await AsyncStorage.multiRemove([CLAVE_BORRADORES, CLAVE_PENDIENTES]);
  } catch {
    // nada que hacer
  }
}

// --- hooks --------------------------------------------------------------------

export function useLocales() {
  return useQuery({
    queryKey: claveLocales,
    queryFn: async () => {
      const [borradores, pendientes, usuario] = await Promise.all([
        leer<BorradorLocal>(CLAVE_BORRADORES),
        leer<Pendiente>(CLAVE_PENDIENTES),
        usuarioActual(),
      ]);
      return {
        borradores: Object.values(borradores).sort((a, b) => b.guardadoEn - a.guardadoEn),
        pendientes: Object.values(pendientes)
          .filter((p) => p.usuario === usuario)
          .sort((a, b) => a.encoladoEn - b.encoladoEn),
      };
    },
    // Es almacenamiento local: leerlo es barato y tiene que estar al dia
    staleTime: 0,
  });
}

/**
 * Sube las pendientes al abrir la app, al volver a ella y cada 20 s mientras
 * quede alguna. Va una sola vez, en el layout de las pestanas.
 */
export function useSubidaAutomatica() {
  const qc = useQueryClient();
  const locales = useLocales();
  const hayPendientes = Boolean(locales.data?.pendientes.some((p) => !p.error));

  useEffect(() => {
    async function intentar() {
      const subidas = await subirPendientes();
      if (subidas) qc.invalidateQueries({ queryKey: ['recetas'] });
      qc.invalidateQueries({ queryKey: claveLocales });
    }
    intentar();
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') intentar();
    });
    const intervalo = hayPendientes ? setInterval(intentar, 20_000) : null;
    return () => {
      sub.remove();
      if (intervalo) clearInterval(intervalo);
    };
  }, [qc, hayPendientes]);
}
