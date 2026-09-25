-- Nuevo modelo de cuota (build 6).
--
-- Plan gratis: 10 importaciones con IA desde videos e imagenes EN TOTAL, no por
-- semana. Es un coste de captacion fijo por persona en vez de un gasto que
-- crece cada mes con cada usuario gratis.
-- Plus: "ilimitado para uso normal", con un tope de 120 al mes contra abusos.
--
-- Los topes viven aqui y no en la app: cambiarlos es un UPDATE a public.ajustes
-- y la app los lee al abrir, sin publicar otra version.
-- cuota_desde: solo cuentan las importaciones desde esa fecha. Al activar este
-- modelo todos empiezan con sus 10 completas.

create table if not exists public.ajustes (
  id            boolean primary key default true check (id),
  tope_gratis   int not null default 10,
  tope_plus_mes int not null default 120,
  cuota_desde   timestamptz not null default now()
);

insert into public.ajustes (id) values (true) on conflict (id) do nothing;

alter table public.ajustes enable row level security;
-- Sin politicas: solo se lee a traves de las funciones de abajo

-- Cuota de una cuenta, con la misma regla para la app y la Edge Function.
-- Solo cuentan las importaciones de redes que salieron bien.
create or replace function public.cuota_de(quien uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  a public.ajustes;
  plus boolean := public.tiene_plus(quien);
  tope int;
  usadas int;
begin
  select * into a from public.ajustes where id;
  if plus then
    tope := a.tope_plus_mes;
    select count(*) into usadas from public.import_jobs
      where user_id = quien and status = 'done'
        and source_type in ('instagram', 'tiktok', 'youtube', 'facebook', 'pinterest')
        and created_at >= date_trunc('month', now());
  else
    tope := a.tope_gratis;
    select count(*) into usadas from public.import_jobs
      where user_id = quien and status = 'done'
        and source_type in ('instagram', 'tiktok', 'youtube', 'facebook', 'pinterest')
        and created_at >= a.cuota_desde;
  end if;
  return jsonb_build_object('plus', plus, 'tope', tope, 'usadas', usadas, 'restantes', greatest(0, tope - usadas));
end;
$$;

revoke execute on function public.cuota_de(uuid) from public, anon, authenticated;

-- La app solo puede preguntar por su propia cuenta
create or replace function public.mi_cuota()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.cuota_de(auth.uid());
$$;

revoke execute on function public.mi_cuota() from public, anon;
grant execute on function public.mi_cuota() to authenticated;

-- Los topes de gratis y Plus, sin datos de nadie: para la bienvenida y el paywall
create or replace function public.topes()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('gratis', tope_gratis, 'plusMes', tope_plus_mes) from public.ajustes where id;
$$;

grant execute on function public.topes() to anon, authenticated;
