import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { claveCuota } from './cuota';
import { claveLocales, encolar, esErrorDeRed, nuevoId } from './guardado-local';
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

/**
 * Resultado de guardar. `enCola`: no hubo conexion, la receta quedo en el
 * telefono y se sube sola cuando vuelva la red. Nunca se pierde.
 */
export type Guardado = { id: string; enCola: boolean };

export function useCrearReceta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (borrador: BorradorReceta & { id?: string }): Promise<Guardado> => {
      // El id sale del telefono: si hay que reintentar, no se duplica
      const conId = { ...borrador, id: borrador.id ?? nuevoId() };
      const { data, error } = await supabase.rpc('crear_receta', { receta: conId });
      if (error) {
        if (!esErrorDeRed(error)) throw error;
        await encolar(conId, 'nueva');
        return { id: conId.id, enCola: true };
      }
      return { id: data as string, enCola: false };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clavesRecetas.todas });
      qc.invalidateQueries({ queryKey: claveCuota });
      qc.invalidateQueries({ queryKey: claveLocales });
    },
  });
}

export function useActualizarReceta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, borrador }: { id: string; borrador: BorradorReceta }): Promise<Guardado> => {
      const { error } = await supabase.rpc('actualizar_receta', { receta_id: id, receta: borrador });
      if (error) {
        if (!esErrorDeRed(error)) throw error;
        await encolar({ ...borrador, id }, 'editar');
        return { id, enCola: true };
      }
      return { id, enCola: false };
    },
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: clavesRecetas.una(id) });
      qc.invalidateQueries({ queryKey: clavesRecetas.todas });
      qc.invalidateQueries({ queryKey: claveLocales });
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clavesRecetas.todas });
      qc.invalidateQueries({ queryKey: claveCuota });
    },
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
