import { useQuery } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from './supabase';
import type { BorradorReceta } from './tipos';

/**
 * Importacion con IA desde un enlace (reels, TikTok, YouTube, Pinterest, webs).
 * La Edge Function "importar" responde con el id del trabajo al instante y
 * procesa en segundo plano; aqui se sigue su progreso y se lee el resultado.
 */

export type EtapaImportacion = 'leyendo' | 'escuchando' | 'ordenando' | 'guardando' | 'listo' | 'cache';

export type Trabajo = {
  id: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  stage: EtapaImportacion | null;
  failure_reason: string | null;
  extraction_id: string | null;
  quality: 'complete' | 'partial' | null;
  origin: string | null;
  source_url: string | null;
  source_type: string | null;
  /** Si fallo: lo que si se encontro, para completar la receta a mano. */
  rescate: Rescate | null;
};

export type Rescate = {
  titulo: string;
  autor: string;
  foto: string | null;
  texto: string;
  ingredientes: string[];
  pasos: string[];
};

/** La receta tal como la deja el servidor en la cache compartida. */
export type RecetaImportada = BorradorReceta & {
  confianza?: 'alta' | 'media' | 'baja';
  motivo?: string;
  blog_url?: string | null;
  origin?: string;
  quality?: 'complete' | 'partial';
};

export class LimiteAlcanzado extends Error {}
export class EnlaceInvalido extends Error {}

export async function iniciarImportacion(url: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ jobId: string }>('importar', { body: { url } });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const estado = error.context?.status;
      if (estado === 402) throw new LimiteAlcanzado('Llegaste al límite de importaciones del mes.');
      if (estado === 400) throw new EnlaceInvalido('Ese enlace no parece válido.');
    }
    throw new Error('No pudimos empezar la importación. Revisa tu conexión.');
  }
  if (!data?.jobId) throw new Error('El servidor no respondió como esperábamos.');
  return data.jobId;
}

const TERMINADO = new Set(['done', 'failed']);

/** Sigue el trabajo cada segundo y medio hasta que termina. */
export function useTrabajo(id: string | null) {
  return useQuery({
    queryKey: ['importacion', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<Trabajo> => {
      const { data, error } = await supabase.from('import_jobs').select('*').eq('id', id!).single();
      if (error) throw error;
      return data as Trabajo;
    },
    refetchInterval: (q) => (q.state.data && TERMINADO.has(q.state.data.status) ? false : 1500),
    // Un fallo de red momentaneo no debe cortar el seguimiento
    retry: 5,
  });
}

export async function cargarReceta(extraccionId: string): Promise<RecetaImportada> {
  const { data, error } = await supabase.from('extractions').select('normalized_recipe').eq('id', extraccionId).single();
  if (error) throw error;
  return data.normalized_recipe as RecetaImportada;
}

/** Primera URL dentro de un texto compartido ("Mira este reel https://..."). */
export function primeraUrl(texto: string): string | null {
  return texto.match(/https?:\/\/[^\s"'<>]+/i)?.[0] ?? null;
}
