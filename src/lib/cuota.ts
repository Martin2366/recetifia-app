import { useQuery } from '@tanstack/react-query';

import { LIMITES, tienePlus } from './compras';
import { supabase } from './supabase';

/**
 * Lo que le queda al usuario. El limite de verdad lo hace cumplir la Edge
 * Function "importar"; esto es para mostrarlo y avisar a tiempo. Los topes y la
 * cuenta salen del servidor (mi_cuota), asi un cambio de tope se ve al instante
 * sin publicar otra version.
 */
export type Cuota = { plus: boolean; tope: number; importacionesRestantes: number };

export const claveCuota = ['cuota'] as const;

type CuotaServidor = { plus: boolean; tope: number; usadas: number; restantes: number };

export function useCuota() {
  return useQuery({
    queryKey: claveCuota,
    queryFn: async (): Promise<Cuota> => {
      const [revenuecat, servidor] = await Promise.all([tienePlus(), supabase.rpc('mi_cuota')]);
      if (servidor.error) throw servidor.error;
      const c = servidor.data as CuotaServidor;
      return {
        // Lo que diga Google Play en el telefono, o lo que confirmo el webhook
        plus: revenuecat || c.plus,
        tope: c.tope,
        importacionesRestantes: c.restantes,
      };
    },
  });
}

export type Topes = { gratis: number; plusMes: number };

/** Topes generales, sin sesion: para la bienvenida, la guia y el paywall. */
export function useTopes(): Topes {
  const { data } = useQuery({
    queryKey: ['topes'],
    queryFn: async (): Promise<Topes> => {
      const { data, error } = await supabase.rpc('topes');
      if (error) throw error;
      return data as Topes;
    },
    staleTime: 60 * 60_000,
  });
  return data ?? { gratis: LIMITES.importacionesGratis, plusMes: LIMITES.plusPorMes };
}
