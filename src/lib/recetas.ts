import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';
import type { BorradorReceta, Ingrediente, Paso, Receta, RecetaCompleta } from './tipos';

export const clavesRecetas = {
  todas: ['recetas'] as const,
  lista: (busqueda: string) => ['recetas', 'lista', busqueda] as const,
  una: (id: string) => ['recetas', id] as const,
};

/** Biblioteca. Con busqueda vacia devuelve todo, ordenado por lo mas reciente. */
export function useRecetas(busqueda = '') {
  const texto = busqueda.trim();

  return useQuery({
    queryKey: clavesRecetas.lista(texto),
    queryFn: async (): Promise<Receta[]> => {
      // La funcion del servidor tambien busca dentro de los ingredientes, que es
      // como la gente busca de verdad ("que hago con pollo").
      const { data, error } = await supabase.rpc('buscar_recetas', { consulta: texto });
      if (error) throw error;
      return (data ?? []) as Receta[];
    },
  });
}

export function useReceta(id: string | undefined) {
  return useQuery({
    queryKey: clavesRecetas.una(id ?? ''),
    enabled: Boolean(id),
    queryFn: async (): Promise<RecetaCompleta> => {
      const [receta, ingredientes, pasos] = await Promise.all([
        supabase.from('recipes').select('*').eq('id', id!).single(),
        supabase.from('recipe_ingredients').select('*').eq('recipe_id', id!).order('position'),
        supabase.from('recipe_steps').select('*').eq('recipe_id', id!).order('position'),
      ]);

      if (receta.error) throw receta.error;
      if (ingredientes.error) throw ingredientes.error;
      if (pasos.error) throw pasos.error;

      return {
        ...(receta.data as Receta),
        ingredientes: (ingredientes.data ?? []) as Ingrediente[],
        pasos: (pasos.data ?? []) as Paso[],
      };
    },
  });
}

export function useCrearReceta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (borrador: BorradorReceta): Promise<string> => {
      const { data, error } = await supabase.rpc('crear_receta', { receta: borrador });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesRecetas.todas }),
  });
}

export function useActualizarReceta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, borrador }: { id: string; borrador: BorradorReceta }) => {
      const { error } = await supabase.rpc('actualizar_receta', { receta_id: id, receta: borrador });
      if (error) throw error;
    },
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: clavesRecetas.una(id) });
      qc.invalidateQueries({ queryKey: clavesRecetas.todas });
    },
  });
}

export function useBorrarReceta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recipes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: clavesRecetas.todas }),
  });
}

/**
 * Favorito con actualizacion optimista: el corazon responde al instante.
 * Si el servidor falla, se revierte y el usuario ve el estado real.
 */
export function useAlternarFavorita() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, favorita }: { id: string; favorita: boolean }) => {
      const { error } = await supabase.from('recipes').update({ is_favorite: favorita }).eq('id', id);
      if (error) throw error;
    },

    onMutate: async ({ id, favorita }) => {
      await qc.cancelQueries({ queryKey: clavesRecetas.todas });
      const previo = qc.getQueriesData<Receta[]>({ queryKey: ['recetas', 'lista'] });

      for (const [clave, lista] of previo) {
        if (!lista) continue;
        qc.setQueryData<Receta[]>(
          clave,
          lista.map((r) => (r.id === id ? { ...r, is_favorite: favorita } : r))
        );
      }
      return { previo };
    },

    onError: (_e, _v, ctx) => {
      for (const [clave, lista] of ctx?.previo ?? []) qc.setQueryData(clave, lista);
    },

    onSettled: () => qc.invalidateQueries({ queryKey: clavesRecetas.todas }),
  });
}
