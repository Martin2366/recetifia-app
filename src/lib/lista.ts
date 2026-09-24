import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { nombreComparable, pasilloDe, type Pasillo } from './pasillos';
import { escalarCantidad, formatearCantidad } from './porciones';
import { supabase } from './supabase';
import type { Ingrediente } from './tipos';

/**
 * Lista de compras: gratis y sin limite. Una sola lista por cuenta, ordenada
 * por pasillo del supermercado. Al agregar una receta, los ingredientes que ya
 * estan (mismo nombre y unidad, sin marcar) se suman en vez de duplicarse.
 */

export type ItemLista = {
  id: string;
  list_id: string;
  /** Con cantidad: solo el nombre ("harina"). Sin cantidad: el texto entero ("Sal a gusto"). */
  display_name: string;
  name_normalized: string | null;
  quantity: number | null;
  unit: string | null;
  aisle: Pasillo | null;
  is_checked: boolean;
  recipe_id: string | null;
  position: number;
};

type Nuevo = Omit<ItemLista, 'id' | 'list_id' | 'is_checked' | 'position'>;

export const claveLista = ['lista'] as const;

async function idDeLista(): Promise<string> {
  const { data: existente, error } = await supabase
    .from('shopping_lists')
    .select('id')
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (existente) return existente.id as string;

  const { data: sesion } = await supabase.auth.getSession();
  const usuario = sesion.session?.user.id;
  if (!usuario) throw new Error('Necesitas iniciar sesión.');
  const { data: nueva, error: e2 } = await supabase.from('shopping_lists').insert({ user_id: usuario }).select('id').single();
  if (e2) throw e2;
  return nueva.id as string;
}

/** Texto visible: "500 g harina" si se sabe la cantidad; si no, el texto tal cual. */
export function textoItem(item: Pick<ItemLista, 'quantity' | 'unit' | 'display_name'>): string {
  const c = formatearCantidad(item.quantity, item.unit);
  return c ? [c, item.unit, item.display_name].filter(Boolean).join(' ') : item.display_name;
}

/** Un ingrediente de receta, ya escalado a las porciones elegidas, como item de la lista. */
export function itemDesdeIngrediente(
  ing: Ingrediente,
  recetaId: string,
  porcionesBase: number | null,
  porcionesActuales: number | null
): Nuevo {
  const nombre = ing.name_normalized?.trim();
  const cantidad = ing.quantity != null ? escalarCantidad(ing.quantity, porcionesBase, porcionesActuales) : null;
  // Sin cantidad o sin nombre limpio (ej: "sal y pimienta a gusto"), va el texto original
  const conCantidad = Boolean(nombre) && cantidad != null;
  return {
    display_name: conCantidad ? nombre! : ing.raw_text,
    name_normalized: nombreComparable(nombre || ing.raw_text),
    quantity: conCantidad ? cantidad : null,
    unit: conCantidad ? ing.unit : null,
    aisle: pasilloDe(nombre || ing.raw_text),
    recipe_id: recetaId,
  };
}

export function itemAMano(texto: string): Nuevo {
  return {
    display_name: texto.trim(),
    name_normalized: nombreComparable(texto),
    quantity: null,
    unit: null,
    aisle: pasilloDe(texto),
    recipe_id: null,
  };
}

export function useLista() {
  return useQuery({
    queryKey: claveLista,
    queryFn: async (): Promise<ItemLista[]> => {
      const id = await idDeLista();
      const { data, error } = await supabase.from('shopping_list_items').select('*').eq('list_id', id).order('position');
      if (error) throw error;
      return (data ?? []) as ItemLista[];
    },
  });
}

/** Agrega items. Devuelve cuantos quedaron nuevos y cuantos se sumaron a uno existente. */
export function useAgregarALista() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nuevos: Nuevo[]) => {
      const listId = await idDeLista();
      const { data: actuales, error } = await supabase
        .from('shopping_list_items')
        .select('*')
        .eq('list_id', listId)
        .eq('is_checked', false);
      if (error) throw error;

      let posicion = Date.now() % 1_000_000_000;
      const insertar: (Nuevo & { list_id: string; position: number })[] = [];
      // Lo que ya esta en la lista (sin marcar) y cambia de cantidad
      const sumados = new Map<string, number>();
      const existentes = (actuales ?? []) as ItemLista[];

      for (const n of nuevos) {
        const juntable = (a: Pick<ItemLista, 'name_normalized' | 'unit' | 'quantity'>) =>
          a.name_normalized === n.name_normalized && (a.unit ?? '') === (n.unit ?? '') && a.quantity != null && n.quantity != null;

        const enLista = existentes.find(juntable);
        const enEsteLote = insertar.find(juntable);
        // "Sal a gusto" dos veces es lo mismo: si ya esta, no se repite
        const sinCantidadRepetido =
          n.quantity == null &&
          [...existentes, ...insertar].some((a) => a.quantity == null && a.name_normalized === n.name_normalized);
        if (sinCantidadRepetido) continue;
        if (enLista) {
          const base = sumados.get(enLista.id) ?? Number(enLista.quantity);
          sumados.set(enLista.id, base + n.quantity!);
        } else if (enEsteLote) {
          enEsteLote.quantity = Number(enEsteLote.quantity) + n.quantity!;
        } else {
          insertar.push({ ...n, list_id: listId, position: posicion++ });
        }
      }

      if (insertar.length) {
        const { error: e } = await supabase.from('shopping_list_items').insert(insertar);
        if (e) throw e;
      }
      for (const [id, quantity] of sumados) {
        const { error: e } = await supabase.from('shopping_list_items').update({ quantity }).eq('id', id);
        if (e) throw e;
      }
      return { nuevos: insertar.length, sumados: sumados.size };
    },
    onSettled: () => qc.invalidateQueries({ queryKey: claveLista }),
  });
}

/** Marcar o desmarcar responde al instante; si el servidor falla, se revierte. */
export function useMarcarItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, marcado }: { id: string; marcado: boolean }) => {
      const { error } = await supabase.from('shopping_list_items').update({ is_checked: marcado }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, marcado }) => {
      await qc.cancelQueries({ queryKey: claveLista });
      const previo = qc.getQueryData<ItemLista[]>(claveLista);
      qc.setQueryData<ItemLista[]>(claveLista, (l) => l?.map((i) => (i.id === id ? { ...i, is_checked: marcado } : i)));
      return { previo };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(claveLista, ctx?.previo),
    onSettled: () => qc.invalidateQueries({ queryKey: claveLista }),
  });
}

export function useBorrarDeLista() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return;
      const { error } = await supabase.from('shopping_list_items').delete().in('id', ids);
      if (error) throw error;
    },
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: claveLista });
      const previo = qc.getQueryData<ItemLista[]>(claveLista);
      qc.setQueryData<ItemLista[]>(claveLista, (l) => l?.filter((i) => !ids.includes(i.id)));
      return { previo };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(claveLista, ctx?.previo),
    onSettled: () => qc.invalidateQueries({ queryKey: claveLista }),
  });
}
