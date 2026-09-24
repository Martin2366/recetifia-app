-- Fase 2 del plan de reseñas: limites honestos y freno de gasto.
--
-- 1. Recetas y colecciones dejan de tener tope en el plan gratis (el tope solo
--    vivia en la app; aqui no hay nada que quitar).
-- 2. La cuota de importaciones pasa a ser semanal y solo para videos e
--    imagenes; la cuenta la Edge Function "importar".
-- 3. Gasto en IA del mes, para que la importacion pase a modo ahorro antes de
--    superar el presupuesto de validacion.

create index if not exists import_jobs_creado_idx on public.import_jobs (created_at);

create or replace function public.gasto_ia_del_mes()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(cost_usd), 0)
  from public.import_jobs
  where created_at >= date_trunc('month', now());
$$;

-- Solo la Edge Function (service role) lo consulta: el gasto no es asunto del usuario
revoke execute on function public.gasto_ia_del_mes() from public, anon, authenticated;
