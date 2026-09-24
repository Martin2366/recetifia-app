import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { claveCuota } from './cuota';
import { supabase } from './supabase';
import type { Coleccion, Receta } from './tipos';

export type ColeccionConConteo = Coleccion & { total: number };

const clave = ['colecciones'] as const;

export function useColecciones() {
  return useQuery({
    queryKey: clave,
    queryFn: async (): Promise<ColeccionConConteo[]> => {
      const { data, error } = await supabase
        .from('collections')
        .select('*, collection_recipes(count)')
        .order('position')
        .order('created_at');
      if (error) throw error;
      return (data ?? []).map((c) => {
        const { collection_recipes, ...resto } = c as Coleccion & { collection_recipes: { count: number }[] };
        return { ...resto, total: collection_recipes?.[0]?.count ?? 0 };
      });
    },
  });
}

export async function agregarAColeccion(coleccionId: string, recetaId: string) {
  const { error } = await supabase.from('collection_recipes').insert({ collection_id: coleccionId, recipe_id: recetaId });
  if (error) throw error;
}

export function useCrearColeccion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nombre: string) => {
      const { data: sesion } = await supabase.auth.getSession();
      const usuario = sesion.session?.user.id;
      if (!usuario) throw new Error('Necesitas iniciar sesión.');
      const { error } = await supabase.from('collections').insert({ name: nombre.trim(), user_id: usuario });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clave });
      qc.invalidateQueries({ queryKey: claveCuota });
    },
  });
}

// --- una coleccion por dentro -------------------------------------------------

/**
 * Regla de oro (una reseña de la competencia perdio 15 recetas por esto):
 * quitar una receta de una coleccion NUNCA la borra de la biblioteca. Aqui solo
 * se tocan filas de collection_recipes; las recetas se borran en otro lado.
 */

export const claveColeccion = (id: string) => ['colecciones', id] as const;

export function useColeccion(id: string | undefined) {
  return useQuery({
    queryKey: claveColeccion(id ?? ''),
    enabled: Boolean(id),
    queryFn: async (): Promise<{ coleccion: Coleccion; recetas: Receta[] }> => {
      const [col, filas] = await Promise.all([
        supabase.from('collections').select('*').eq('id', id!).single(),
        supabase
          .from('collection_recipes')
          .select('added_at, recipes(*)')
          .eq('collection_id', id!)
          .order('added_at', { ascending: false }),
      ]);
      if (col.error) throw col.error;
      if (filas.error) throw filas.error;
      const recetas = (filas.data ?? [])
        .map((f) => (f as unknown as { recipes: Receta | null }).recipes)
        .filter((r): r is Receta => Boolean(r));
      return { coleccion: col.data as Coleccion, recetas };
    },
  });
}

function useInvalidarColecciones() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: clave });
}

export function useAgregarRecetasAColeccion() {
  const invalidar = useInvalidarColecciones();
  return useMutation({
    mutationFn: async ({ coleccionId, recetaIds }: { coleccionId: string; recetaIds: string[] }) => {
      if (!recetaIds.length) return;
      const { error } = await supabase
        .from('collection_recipes')
        .upsert(
          recetaIds.map((recipe_id) => ({ collection_id: coleccionId, recipe_id })),
          { onConflict: 'collection_id,recipe_id', ignoreDuplicates: true }
        );
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}

/** Solo saca la receta de la coleccion: la receta sigue en la biblioteca. */
export function useQuitarDeColeccion() {
  const invalidar = useInvalidarColecciones();
  return useMutation({
    mutationFn: async ({ coleccionId, recetaId }: { coleccionId: string; recetaId: string }) => {
      const { error } = await supabase.from('collection_recipes').delete().eq('collection_id', coleccionId).eq('recipe_id', recetaId);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}

export function useRenombrarColeccion() {
  const invalidar = useInvalidarColecciones();
  return useMutation({
    mutationFn: async ({ id, nombre }: { id: string; nombre: string }) => {
      const { error } = await supabase.from('collections').update({ name: nombre.trim() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}

/** Borra la coleccion (la carpeta). Las recetas que tenia quedan en la biblioteca. */
export function useBorrarColeccion() {
  const invalidar = useInvalidarColecciones();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('collections').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}
