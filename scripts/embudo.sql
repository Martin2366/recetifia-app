-- Embudo de cuentas nuevas por semana de llegada (lunes, UTC), sin la cuenta
-- del catalogo. Para ver donde se pierden los desconocidos:
--   npx supabase db query --linked --project-ref ejjduwzqdhdyfqofqxvl -f scripts/embudo.sql
--
-- activadas:  guardaron al menos una receta o terminaron una importacion
-- volvieron:  hicieron algo (receta, importacion, cocinada, modo cocina o
--             busqueda) entre el dia 7 y el 14 desde que llegaron. Solo cuenta
--             para semanas que ya cumplieron 14 dias.
-- tope:       usaron sus importaciones gratis (sin Plus)
-- plus:       tienen Plus vigente hoy

with cuentas as (
  select p.id, p.created_at as llego, date_trunc('week', p.created_at)::date as semana
  from public.profiles p
  where not p.es_catalogo
),
actividad as (
  select user_id, created_at as cuando from public.recipes
  union all select user_id, created_at from public.import_jobs where status = 'done'
  union all select user_id, creado from public.cocinadas
  union all select user_id, creado from public.usos
),
por_cuenta as (
  select
    c.semana,
    c.llego,
    exists (select 1 from actividad a where a.user_id = c.id) as activada,
    exists (
      select 1 from actividad a
      where a.user_id = c.id and a.cuando >= c.llego + interval '7 days' and a.cuando < c.llego + interval '14 days'
    ) as volvio,
    (public.cuota_de(c.id)->>'restantes')::int <= 0 and not public.tiene_plus(c.id) as tope,
    public.tiene_plus(c.id) as plus
  from cuentas c
)
select
  semana,
  count(*) as cuentas,
  count(*) filter (where activada) as activadas,
  round(100.0 * count(*) filter (where activada) / count(*)) as "% activadas",
  case when max(llego) < now() - interval '14 days'
    then round(100.0 * count(*) filter (where volvio) / count(*))
  end as "% volvieron d7-14",
  count(*) filter (where tope) as llegaron_al_tope,
  count(*) filter (where plus) as plus
from por_cuenta
group by semana
order by semana desc;
