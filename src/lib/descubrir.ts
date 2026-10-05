import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { cargarReceta, type RecetaImportada } from './importacion';
import { clavesRecetas, useCrearReceta } from './recetas';
import { supabase } from './supabase';

/**
 * Descubrir: catalogo curado de recetas de creadores (scripts/catalogo.ts).
 * Cada receta es una extraccion de la cache compartida, asi que guardarla en
 * la biblioteca no pasa por la IA y no gasta importaciones.
 */

export { ETIQUETAS, etiqueta, type Etiqueta } from './etiquetas';

export type TarjetaDescubrir = {
  id: string;
  extraction_id: string;
  etiquetas: string[];
  titulo: string;
  descripcion: string | null;
  foto: string | null;
  minutos: number | null;
  source_url: string;
  source_type: string;
  creador_id: string | null;
  creador_usuario: string | null;
  creador_nombre: string | null;
  creador_foto: string | null;
  /** Solo desde 10: con menos no se muestra (nada de cifras infladas ni tristes). */
  guardados: number | null;
};

export type Creador = {
  id: string;
  usuario: string;
  nombre: string | null;
  foto: string | null;
  plataforma: string;
  recetas: number;
};

export type InicioDescubrir = {
  del_dia: TarjetaDescubrir | null;
  populares: TarjetaDescubrir[];
  creadores: Creador[];
};

export type TipoLista = 'populares' | 'creador' | 'etiqueta';

/** El catalogo cambia poco: se pide de nuevo cada 10 minutos como mucho. */
const FRESCO = 10 * 60 * 1000;

export const claveDescubrir = ['descubrir'] as const;

export function useDescubrirInicio() {
  return useQuery({
    queryKey: [...claveDescubrir, 'inicio'],
    staleTime: FRESCO,
    queryFn: async (): Promise<InicioDescubrir> => {
      const { data, error } = await supabase.rpc('descubrir_inicio');
      if (error) throw error;
      return data as InicioDescubrir;
    },
  });
}

export function useDescubrirLista(tipo: TipoLista, valor?: string) {
  return useQuery({
    queryKey: [...claveDescubrir, 'lista', tipo, valor ?? ''],
    staleTime: FRESCO,
    queryFn: async (): Promise<TarjetaDescubrir[]> => {
      let q = supabase.from('descubrir_tarjetas').select('*');
      if (tipo === 'creador') q = q.eq('creador_id', valor!).order('created_at', { ascending: false });
      else if (tipo === 'etiqueta') q = q.contains('etiquetas', [valor!]).order('semana', { ascending: false }).order('created_at', { ascending: false });
      else q = q.order('semana', { ascending: false }).order('created_at', { ascending: false }).limit(20);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as TarjetaDescubrir[];
    },
  });
}

export function useCreador(id: string | undefined) {
  return useQuery({
    queryKey: [...claveDescubrir, 'creador', id ?? ''],
    enabled: Boolean(id),
    staleTime: FRESCO,
    queryFn: async () => {
      const { data, error } = await supabase.from('creadores').select('*').eq('id', id!).single();
      if (error) throw error;
      return data as { id: string; usuario: string; nombre: string | null; foto_path: string | null; url: string | null; plataforma: string };
    },
  });
}

/** Una tarjeta del catalogo con su receta completa (ingredientes y pasos). */
export function useRecetaDescubrir(id: string | undefined) {
  return useQuery({
    queryKey: [...claveDescubrir, 'receta', id ?? ''],
    enabled: Boolean(id),
    staleTime: FRESCO,
    queryFn: async (): Promise<{ tarjeta: TarjetaDescubrir; receta: RecetaImportada }> => {
      const { data, error } = await supabase.from('descubrir_tarjetas').select('*').eq('id', id!).single();
      if (error) throw error;
      const tarjeta = data as TarjetaDescubrir;
      return { tarjeta, receta: await cargarReceta(tarjeta.extraction_id) };
    },
  });
}

/** Extracciones que ya estan en tu biblioteca: los marcadores salen llenos. */
export function useMisExtracciones() {
  return useQuery({
    queryKey: [...clavesRecetas.todas, 'extracciones'],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from('recipes').select('extraction_id').not('extraction_id', 'is', null);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.extraction_id as string));
    },
  });
}

/** Si ya esta en tu biblioteca, el id de tu receta. */
export function useYaGuardada(extraccionId: string | undefined) {
  return useQuery({
    queryKey: [...clavesRecetas.todas, 'de-extraccion', extraccionId ?? ''],
    enabled: Boolean(extraccionId),
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.from('recipes').select('id').eq('extraction_id', extraccionId!).limit(1).maybeSingle();
      if (error) throw error;
      return (data?.id as string | undefined) ?? null;
    },
  });
}

/**
 * Guarda una receta del catalogo en la biblioteca. Usa la receta ya extraida:
 * no pasa por `importar`, asi que no gasta importaciones. Si ya la tenias,
 * devuelve la tuya en vez de duplicarla.
 */
export function useGuardarDeDescubrir() {
  const qc = useQueryClient();
  const crear = useCrearReceta();
  return useMutation({
    mutationFn: async (tarjeta: Pick<TarjetaDescubrir, 'id' | 'extraction_id'>): Promise<{ id: string; yaEstaba: boolean }> => {
      const { data: previa } = await supabase.from('recipes').select('id').eq('extraction_id', tarjeta.extraction_id).limit(1).maybeSingle();
      if (previa) return { id: previa.id as string, yaEstaba: true };

      const receta = await cargarReceta(tarjeta.extraction_id);
      const { otras: _otras, confianza: _c, motivo: _m, blog_url: _b, origin: _o, quality, ...borrador } = receta;
      const { id } = await crear.mutateAsync({
        ...borrador,
        extraction_id: tarjeta.extraction_id,
        status: quality === 'partial' ? 'needs_review' : 'complete',
      });
      // El guardado alimenta "Más populares"; si falla, la receta igual quedo guardada
      await supabase.from('descubrir_guardados').insert({ receta_id: tarjeta.id });
      return { id, yaEstaba: false };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clavesRecetas.todas });
      qc.invalidateQueries({ queryKey: claveDescubrir });
    },
  });
}

/** "@usuario" para mostrar. */
export function arroba(usuario: string | null | undefined): string {
  if (!usuario) return '';
  return usuario.startsWith('@') ? usuario : `@${usuario}`;
}
