import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';

/**
 * "La cocine": gratis y sin tope. Cada toque es una fila en `cocinadas`.
 * Alimenta el contador del perfil y los recordatorios de recetas pendientes.
 */

export const claveCocinadas = ['cocinadas'] as const;

export type CocinadasReceta = { veces: number; ultima: string | null };

export function useCocinadas(recipeId: string | undefined) {
  return useQuery({
    queryKey: ['cocinadas', 'receta', recipeId ?? ''],
    enabled: Boolean(recipeId),
    queryFn: async (): Promise<CocinadasReceta> => {
      const { data, error, count } = await supabase
        .from('cocinadas')
        .select('creado', { count: 'exact' })
        .eq('recipe_id', recipeId!)
        .order('creado', { ascending: false })
        .limit(1);
      if (error) throw error;
      return { veces: count ?? 0, ultima: data?.[0]?.creado ?? null };
    },
  });
}

export type EstadisticasCocina = { total: number; esteMes: number };

export function useEstadisticasCocina() {
  return useQuery({
    queryKey: ['cocinadas', 'estadisticas'],
    queryFn: async (): Promise<EstadisticasCocina> => {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);
      const [total, mes] = await Promise.all([
        supabase.from('cocinadas').select('id', { count: 'exact', head: true }),
        supabase.from('cocinadas').select('id', { count: 'exact', head: true }).gte('creado', inicioMes.toISOString()),
      ]);
      if (total.error) throw total.error;
      if (mes.error) throw mes.error;
      return { total: total.count ?? 0, esteMes: mes.count ?? 0 };
    },
  });
}

/** Ids de las recetas que ya se cocinaron alguna vez (para los recordatorios). */
export async function idsCocinadas(): Promise<Set<string>> {
  const { data } = await supabase.from('cocinadas').select('recipe_id');
  return new Set((data ?? []).map((f) => f.recipe_id as string));
}

/** Devuelve true si es la primera receta que la persona marca como cocinada. */
export function useMarcarCocinada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (recipeId: string): Promise<{ primera: boolean }> => {
      const { error } = await supabase.from('cocinadas').insert({ recipe_id: recipeId });
      if (error) throw error;
      const { count } = await supabase.from('cocinadas').select('id', { count: 'exact', head: true });
      return { primera: count === 1 };
    },
    onSettled: () => qc.invalidateQueries({ queryKey: claveCocinadas }),
  });
}
