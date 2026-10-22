-- Version 1.3.0: retencion y conversion.
--
-- cocinadas: el boton "La cocine". Gratis y sin tope; alimenta las estadisticas
-- del perfil y los recordatorios ("guardaste X y nunca la cocinaste").
--
-- usos: lo que el plan gratis tiene contado fuera de las importaciones. Solo
-- se escribe desde usar(), que es quien decide si queda cupo:
--   busqueda: busquedas por ingredientes en Descubrir, por dia (UTC-5)
--   cocina:   sesiones del modo cocina, en total; abrir la misma receta otra
--             vez dentro de 12 h no cuenta de nuevo
-- Plus no anota nada: no tiene tope.

create table public.cocinadas (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  creado    timestamptz not null default now()
);

create index cocinadas_user_idx on public.cocinadas (user_id, creado);
create index cocinadas_recipe_idx on public.cocinadas (recipe_id);

alter table public.cocinadas enable row level security;

create policy "cocinadas propias" on public.cocinadas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.usos (
  id      bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo    text not null check (tipo in ('busqueda', 'cocina')),
  ref     uuid,
  creado  timestamptz not null default now()
);

create index usos_user_tipo_idx on public.usos (user_id, tipo, creado);

-- La app puede leer los suyos; escribir, solo a traves de usar()
alter table public.usos enable row level security;

create policy "usos propios" on public.usos
  for select using (auth.uid() = user_id);

alter table public.ajustes
  add column busquedas_gratis_dia smallint not null default 3,
  add column cocinas_gratis       smallint not null default 3;

-- Lo que le queda hoy a una cuenta, sin gastar nada
create or replace function public.usos_de(quien uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  a public.ajustes;
  -- Con interval el signo es el de ISO (UTC-5); con texto '-05' seria al reves
  hoy timestamptz := date_trunc('day', now() at time zone interval '-05:00') at time zone interval '-05:00';
  busquedas integer;
  cocinas integer;
begin
  select * into a from public.ajustes where id;
  if public.tiene_plus(quien) then
    return jsonb_build_object('plus', true, 'busquedasRestantesHoy', null, 'cocinasRestantes', null,
      'topeBusquedas', a.busquedas_gratis_dia, 'topeCocinas', a.cocinas_gratis);
  end if;
  select count(*) into busquedas from public.usos where user_id = quien and tipo = 'busqueda' and creado >= hoy;
  select count(*) into cocinas from public.usos where user_id = quien and tipo = 'cocina';
  return jsonb_build_object(
    'plus', false,
    'busquedasRestantesHoy', greatest(a.busquedas_gratis_dia - busquedas, 0),
    'cocinasRestantes', greatest(a.cocinas_gratis - cocinas, 0),
    'topeBusquedas', a.busquedas_gratis_dia,
    'topeCocinas', a.cocinas_gratis
  );
end;
$$;

revoke execute on function public.usos_de(uuid) from public, anon, authenticated;

create or replace function public.mis_usos()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.usos_de(auth.uid());
$$;

revoke execute on function public.mis_usos() from public, anon;
grant execute on function public.mis_usos() to authenticated;

-- Gasta un uso si queda cupo. Devuelve {permitido, plus, restantes, tope}.
create or replace function public.usar(tipo text, ref uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  quien uuid := auth.uid();
  u jsonb;
  restantes integer;
  tope integer;
begin
  if quien is null then
    raise exception 'sin sesion';
  end if;
  if tipo not in ('busqueda', 'cocina') then
    raise exception 'tipo desconocido';
  end if;

  -- Dos toques seguidos no deben gastar dos veces
  perform pg_advisory_xact_lock(hashtext(quien::text || tipo));

  u := public.usos_de(quien);
  if (u->>'plus')::boolean then
    return jsonb_build_object('permitido', true, 'plus', true, 'restantes', null, 'tope', null);
  end if;

  if tipo = 'busqueda' then
    restantes := (u->>'busquedasRestantesHoy')::integer;
    tope := (u->>'topeBusquedas')::integer;
  else
    restantes := (u->>'cocinasRestantes')::integer;
    tope := (u->>'topeCocinas')::integer;
    -- Volver a la misma receta mientras se cocina no gasta otra sesion
    if ref is not null and exists (
      select 1 from public.usos x
      where x.user_id = quien and x.tipo = 'cocina' and x.ref = usar.ref and x.creado > now() - interval '12 hours'
    ) then
      return jsonb_build_object('permitido', true, 'plus', false, 'restantes', restantes, 'tope', tope);
    end if;
  end if;

  if restantes <= 0 then
    return jsonb_build_object('permitido', false, 'plus', false, 'restantes', 0, 'tope', tope);
  end if;

  insert into public.usos (user_id, tipo, ref) values (quien, usar.tipo, usar.ref);
  return jsonb_build_object('permitido', true, 'plus', false, 'restantes', restantes - 1, 'tope', tope);
end;
$$;

revoke execute on function public.usar(text, uuid) from public, anon;
grant execute on function public.usar(text, uuid) to authenticated;
