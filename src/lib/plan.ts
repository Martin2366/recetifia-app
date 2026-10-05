import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { itemDesdeIngrediente, useAgregarALista } from './lista';
import { sumarDias } from './semana';
import { supabase } from './supabase';
import type { Ingrediente } from './tipos';

/**
 * Plan de comidas semanal (`meal_plan_items`): gratis y sin tope. Las fechas
 * estan en `semana.ts`.
 */

export type Comida = 'desayuno' | 'almuerzo' | 'cena' | 'snack';
type Icono = keyof typeof MaterialCommunityIcons.glyphMap;

export const COMIDAS: { id: Comida; nombre: string; icono: Icono }[] = [
  { id: 'desayuno', nombre: 'Desayuno', icono: 'weather-sunset-up' },
  { id: 'almuerzo', nombre: 'Almuerzo', icono: 'white-balance-sunny' },
  { id: 'cena', nombre: 'Cena', icono: 'weather-night' },
  { id: 'snack', nombre: 'Snack', icono: 'cookie-outline' },
];

export const MAX_NOTA = 75;

export type ItemPlan = {
  id: string;
  day: string;
  meal: Comida;
  recipe_id: string | null;
  note: string | null;
  servings: number | null;
  position: number;
  recipes: { id: string; title: string; image_path: string | null; servings: number | null } | null;
};

export type NuevoItemPlan = { day: string; meal: Comida; recipe_id?: string | null; note?: string | null; servings?: number | null };

/** Desayuno, almuerzo, cena y snack, en ese orden; dentro de cada uno, por posicion. */
export function ordenarDelDia(items: ItemPlan[]): ItemPlan[] {
  const orden = (c: Comida) => COMIDAS.findIndex((x) => x.id === c);
  return [...items].sort((a, b) => orden(a.meal) - orden(b.meal) || a.position - b.position);
}

// ---------------------------------------------------------------- datos

export const clavePlan = ['plan'] as const;
const claveSemana = (lunes: string) => ['plan', lunes] as const;

export function usePlanSemana(lunes: string) {
  return useQuery({
    queryKey: claveSemana(lunes),
    queryFn: async (): Promise<ItemPlan[]> => {
      const { data, error } = await supabase
        .from('meal_plan_items')
        .select('id, day, meal, recipe_id, note, servings, position, recipes(id, title, image_path, servings)')
        .gte('day', lunes)
        .lte('day', sumarDias(lunes, 6))
        .order('position');
      if (error) throw error;
      return (data ?? []) as unknown as ItemPlan[];
    },
  });
}

export function useAgregarAlPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nuevo: NuevoItemPlan) => {
      const { error } = await supabase.from('meal_plan_items').insert({ ...nuevo, position: Date.now() % 1_000_000_000 });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: clavePlan }),
  });
}

/** Cambiar de dia o de comida. Se ve al instante si el destino esta en la misma semana. */
export function useMoverEnPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, day, meal }: { id: string; day: string; meal: Comida }) => {
      const { error } = await supabase.from('meal_plan_items').update({ day, meal }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, day, meal }) => {
      await qc.cancelQueries({ queryKey: clavePlan });
      const previo = qc.getQueriesData<ItemPlan[]>({ queryKey: clavePlan });
      for (const [clave, lista] of previo) {
        if (!lista) continue;
        const lunes = clave[1] as string;
        const dentro = day >= lunes && day <= sumarDias(lunes, 6);
        qc.setQueryData<ItemPlan[]>(
          clave,
          lista.flatMap((i) => (i.id !== id ? [i] : dentro ? [{ ...i, day, meal }] : []))
        );
      }
      return { previo };
    },
    onError: (_e, _v, ctx) => {
      for (const [clave, lista] of ctx?.previo ?? []) qc.setQueryData(clave, lista);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: clavePlan }),
  });
}

export function useQuitarDelPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return;
      const { error } = await supabase.from('meal_plan_items').delete().in('id', ids);
      if (error) throw error;
    },
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: clavePlan });
      const previo = qc.getQueriesData<ItemPlan[]>({ queryKey: clavePlan });
      for (const [clave, lista] of previo) {
        if (lista) qc.setQueryData<ItemPlan[]>(clave, lista.filter((i) => !ids.includes(i.id)));
      }
      return { previo };
    },
    onError: (_e, _v, ctx) => {
      for (const [clave, lista] of ctx?.previo ?? []) qc.setQueryData(clave, lista);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: clavePlan }),
  });
}

/** Copia las comidas de una semana a la siguiente, mismo dia y comida. */
export function useCopiarSemana() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: ItemPlan[]) => {
      if (!items.length) return;
      const { error } = await supabase.from('meal_plan_items').insert(
        items.map((i) => ({
          day: sumarDias(i.day, 7),
          meal: i.meal,
          recipe_id: i.recipe_id,
          note: i.note,
          servings: i.servings,
          position: i.position,
        }))
      );
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: clavePlan }),
  });
}

/**
 * Todas las recetas de la semana a la lista de compras, con las porciones de
 * cada comida. La misma receta dos veces se compra dos veces; la lista ya
 * suma lo repetido (dos recetas con cebolla = una linea).
 */
export function usePasarSemanaALista() {
  const agregar = useAgregarALista();
  return useMutation({
    mutationFn: async (items: ItemPlan[]) => {
      const conReceta = items.filter((i) => i.recipe_id && i.recipes);
      const ids = [...new Set(conReceta.map((i) => i.recipe_id!))];
      if (!ids.length) return { nuevos: 0, sumados: 0 };
      const { data, error } = await supabase.from('recipe_ingredients').select('*').in('recipe_id', ids).order('position');
      if (error) throw error;
      const ingredientes = (data ?? []) as Ingrediente[];
      const nuevos = conReceta.flatMap((i) =>
        ingredientes
          .filter((ing) => ing.recipe_id === i.recipe_id)
          .map((ing) => itemDesdeIngrediente(ing, i.recipe_id!, i.recipes!.servings, i.servings ?? i.recipes!.servings))
      );
      return agregar.mutateAsync(nuevos);
    },
  });
}
