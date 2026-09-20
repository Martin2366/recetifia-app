/** Tipos del dominio. Espejo del esquema de `supabase/migrations`. */

export type FuenteReceta =
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'facebook'
  | 'pinterest'
  | 'web'
  | 'image'
  | 'text'
  | 'manual';

/**
 * `needs_review` es el estado de una receta importada a la que le falta algo.
 * Medido en la Fase 0: lo habitual es que falten los pasos, no que sobren
 * datos inventados. Por eso se guarda igualmente y se marca, en vez de
 * rechazarla.
 */
export type EstadoReceta = 'draft' | 'needs_review' | 'complete';

export type Ingrediente = {
  id: string;
  recipe_id: string;
  position: number;
  /** Siempre presente, aunque el parseo de cantidad y unidad haya fallado. */
  raw_text: string;
  quantity: number | null;
  unit: string | null;
  name_normalized: string | null;
  note: string | null;
  group_label: string | null;
};

export type Paso = {
  id: string;
  recipe_id: string;
  position: number;
  text: string;
  duration_seconds: number | null;
};

export type Receta = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  image_path: string | null;
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  source_type: FuenteReceta | null;
  source_url: string | null;
  source_author: string | null;
  status: EstadoReceta;
  is_favorite: boolean;
  tags: string[];
  extraction_id: string | null;
  created_at: string;
  updated_at: string;
};

export type RecetaCompleta = Receta & {
  ingredientes: Ingrediente[];
  pasos: Paso[];
};

/** Lo que se manda al crear o editar. Todo opcional salvo el titulo. */
export type BorradorReceta = {
  title: string;
  description?: string | null;
  servings?: number | null;
  prep_minutes?: number | null;
  cook_minutes?: number | null;
  source_type?: FuenteReceta;
  source_url?: string | null;
  source_author?: string | null;
  status?: EstadoReceta;
  tags?: string[];
  ingredients?: { raw_text: string; quantity?: number | null; unit?: string | null; name?: string | null }[];
  steps?: { text: string; duration_seconds?: number | null }[];
};

export type Coleccion = {
  id: string;
  user_id: string;
  name: string;
  cover_image_path: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};
