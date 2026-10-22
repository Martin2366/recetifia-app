import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { tienePlus } from './compras';
import { supabase } from './supabase';

/**
 * Lo que el plan gratis tiene contado ademas de las importaciones: busquedas
 * por ingredientes (por dia) y sesiones del modo cocina (en total). El servidor
 * (rpc usar) decide; los topes viven en public.ajustes y se cambian sin build.
 */
export type TipoUso = 'busqueda' | 'cocina';

export type Usos = {
  plus: boolean;
  busquedasRestantesHoy: number | null;
  cocinasRestantes: number | null;
  topeBusquedas: number;
  topeCocinas: number;
};

export type ResultadoUso = { permitido: boolean; plus: boolean; restantes: number | null; tope: number | null };

export const claveUsos = ['usos'] as const;

export function useUsos() {
  return useQuery({
    queryKey: claveUsos,
    queryFn: async (): Promise<Usos> => {
      const [revenuecat, servidor] = await Promise.all([tienePlus(), supabase.rpc('mis_usos')]);
      if (servidor.error) throw servidor.error;
      const u = servidor.data as Usos;
      // Igual que la cuota: si Google Play ya dio Plus, no se espera al webhook
      return revenuecat ? { ...u, plus: true, busquedasRestantesHoy: null, cocinasRestantes: null } : u;
    },
  });
}

/** Gasta un uso si queda cupo. Ante la duda (sin red, error), deja pasar. */
export function useUsar() {
  const qc = useQueryClient();
  return useCallback(
    async (tipo: TipoUso, ref?: string): Promise<ResultadoUso> => {
      const { data, error } = await supabase.rpc('usar', { tipo, ref: ref ?? null });
      qc.invalidateQueries({ queryKey: claveUsos });
      if (error) return { permitido: true, plus: false, restantes: null, tope: null };
      const r = data as ResultadoUso;
      if (!r.permitido && (await tienePlus())) return { ...r, permitido: true, plus: true };
      return r;
    },
    [qc]
  );
}
