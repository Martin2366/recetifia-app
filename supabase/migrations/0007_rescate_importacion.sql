-- Fase 4 del plan de reseñas: una importacion nunca termina en "no pudimos".
--
-- Cuando la IA no logra armar la receta, el trabajo guarda lo que si se saco
-- por el camino (titulo, autor, foto y el texto de la publicacion). La app lo
-- usa para abrir el editor ya relleno, con el enlace original, en vez de dejar
-- a la persona con las manos vacias.

alter table public.import_jobs add column if not exists rescate jsonb;

comment on column public.import_jobs.rescate is
  'Lo encontrado en una importacion fallida: {titulo, autor, foto, texto}. Null si no hubo nada.';
