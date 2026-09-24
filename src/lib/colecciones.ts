import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { claveCuota } from './cuota';
import { supabase } from './supabase';
import type { Coleccion } from './tipos';

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
