import { useQuery } from '@tanstack/react-query';

import { LIMITES, tienePlus } from './compras';
import { supabase } from './supabase';

/**
 * Lo que le queda al usuario del plan gratis esta semana. El limite de verdad
 * lo hace cumplir la Edge Function "importar"; esto es para mostrarlo y avisar
 * a tiempo, contando lo mismo que cuenta el servidor.
 */
export type Cuota = { plus: boolean; importacionesRestantes: number };

export const claveCuota = ['cuota'] as const;

/** Solo estas fuentes gastan importaciones: las webs y el texto son gratis. */
const FUENTES_CON_LIMITE = ['instagram', 'tiktok', 'youtube', 'facebook', 'pinterest'];

/** Lunes a las 00:00 en UTC-5, igual que el servidor. */
export function inicioDeSemana(ahora = new Date()): Date {
  const DESFASE = 5 * 3600_000;
  const local = new Date(ahora.getTime() - DESFASE);
  const diasDesdeLunes = (local.getUTCDay() + 6) % 7;
  local.setUTCDate(local.getUTCDate() - diasDesdeLunes);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + DESFASE);
}

export function useCuota() {
  return useQuery({
    queryKey: claveCuota,
    queryFn: async (): Promise<Cuota> => {
      const [revenuecat, suscripcion, importadas] = await Promise.all([
        tienePlus(),
        supabase.from('suscripciones').select('plan, expira_en').maybeSingle(),
        supabase
          .from('import_jobs')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'done')
          .in('source_type', FUENTES_CON_LIMITE)
          .gte('created_at', inicioDeSemana().toISOString()),
      ]);

      return {
        // Lo que diga Google Play en el telefono, o lo que confirmo el webhook
        plus:
          revenuecat ||
          (suscripcion.data?.plan === 'plus' &&
            (!suscripcion.data.expira_en || new Date(suscripcion.data.expira_en) > new Date())),
        importacionesRestantes: Math.max(0, LIMITES.importacionesPorSemana - (importadas.count ?? 0)),
      };
    },
  });
}
