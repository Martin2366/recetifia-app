-- Descubrir: un catalogo curado de recetas de creadores de redes, armado con
-- el mismo motor de importacion (cada receta es una fila de la cache
-- `extractions`). Lo popular sale de lo que la gente guarda de verdad.

-- La cuenta que carga el catalogo (scripts/catalogo.ts). Sin tope de cuota y
-- la unica que puede escribir en el catalogo.
alter table public.profiles add column es_catalogo boolean not null default false;

-- Cada usuario puede editar su perfil ("perfil propio"), pero esta marca solo
-- se pone desde el servidor (SQL Editor o service_role).
create or replace function public.proteger_es_catalogo()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.es_catalogo is distinct from (case when tg_op = 'UPDATE' then old.es_catalogo else false end) then
    raise exception 'es_catalogo no se puede cambiar desde la app';
  end if;
  return new;
end;
$$;

create trigger profiles_proteger_es_catalogo before insert or update on public.profiles
  for each row execute function public.proteger_es_catalogo();

create or replace function public.es_catalogo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select es_catalogo from public.profiles where id = auth.uid()), false);
$$;

create table public.creadores (
  id         uuid primary key default gen_random_uuid(),
  plataforma text not null check (plataforma in ('instagram', 'tiktok', 'youtube', 'facebook')),
  usuario    text not null,               -- sin @
  nombre     text,
  foto_path  text,                        -- URL publica en Storage: las de las redes caducan
  url        text,
  created_at timestamptz not null default now(),
  unique (plataforma, usuario)
);

create table public.descubrir_recetas (
  id            uuid primary key default gen_random_uuid(),
  extraction_id uuid not null unique references public.extractions(id) on delete cascade,
  creador_id    uuid references public.creadores(id) on delete set null,
  etiquetas     text[] not null default '{}',
  publicada     boolean not null default true,
  -- Si tiene fecha, es la receta del dia de ese dia
  destacada_el  date,
  created_at    timestamptz not null default now()
);

create index descubrir_recetas_creador_idx on public.descubrir_recetas (creador_id);
create index descubrir_recetas_etiquetas_idx on public.descubrir_recetas using gin (etiquetas);

-- Quien guardo que receta del catalogo. Nadie ve los guardados ajenos: solo
-- las cuentas, y solo desde 10 (ver la vista).
create table public.descubrir_guardados (
  receta_id  uuid not null references public.descubrir_recetas(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (receta_id, user_id)
);

create index descubrir_guardados_fecha_idx on public.descubrir_guardados (receta_id, created_at);

alter table public.creadores           enable row level security;
alter table public.descubrir_recetas   enable row level security;
alter table public.descubrir_guardados enable row level security;

create policy "creadores legibles" on public.creadores
  for select to authenticated using (true);
create policy "catalogo escribe creadores" on public.creadores
  for all to authenticated using (public.es_catalogo()) with check (public.es_catalogo());

create policy "catalogo publicado legible" on public.descubrir_recetas
  for select to authenticated using (publicada or public.es_catalogo());
create policy "catalogo escribe recetas" on public.descubrir_recetas
  for all to authenticated using (public.es_catalogo()) with check (public.es_catalogo());

create policy "guardados propios" on public.descubrir_guardados
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Tarjetas listas para pintar. Corre con los permisos del duenio para poder
-- contar guardados de todos, pero solo expone numeros y solo lo publicado.
create view public.descubrir_tarjetas as
select
  r.id,
  r.extraction_id,
  r.etiquetas,
  r.destacada_el,
  r.created_at,
  e.normalized_recipe ->> 'title'       as titulo,
  e.normalized_recipe ->> 'description' as descripcion,
  e.normalized_recipe ->> 'image_path'  as foto,
  nullif(coalesce((e.normalized_recipe ->> 'prep_minutes')::int, 0) + coalesce((e.normalized_recipe ->> 'cook_minutes')::int, 0), 0) as minutos,
  e.source_url,
  e.source_type,
  c.id        as creador_id,
  c.usuario   as creador_usuario,
  c.nombre    as creador_nombre,
  c.foto_path as creador_foto,
  (select count(*) from public.descubrir_guardados g
     where g.receta_id = r.id and g.created_at > now() - interval '7 days')::int as semana,
  (select case when count(*) >= 10 then count(*) end from public.descubrir_guardados g where g.receta_id = r.id)::int as guardados
from public.descubrir_recetas r
join public.extractions e on e.id = r.extraction_id
left join public.creadores c on c.id = r.creador_id
where r.publicada;

revoke all on public.descubrir_tarjetas from anon;
grant select on public.descubrir_tarjetas to authenticated;

-- Inicio de Descubrir en una sola llamada: receta del dia, populares de la
-- semana y creadores en tendencia.
create or replace function public.descubrir_inicio()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  total int;
  del_dia jsonb;
begin
  select count(*) into total from public.descubrir_tarjetas;
  if total = 0 then
    return jsonb_build_object('del_dia', null, 'populares', '[]'::jsonb, 'creadores', '[]'::jsonb);
  end if;

  -- La elegida para hoy; si no hay, una distinta cada dia, fija durante el dia
  select to_jsonb(t) into del_dia from public.descubrir_tarjetas t
    where t.destacada_el = current_date limit 1;
  if del_dia is null then
    select to_jsonb(t) into del_dia from public.descubrir_tarjetas t
      order by t.created_at, t.id
      offset (extract(doy from current_date)::int % total) limit 1;
  end if;

  return jsonb_build_object(
    'del_dia', del_dia,
    'populares', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.semana desc, t.created_at desc)
      from (select * from public.descubrir_tarjetas order by semana desc, created_at desc limit 10) t
    ), '[]'::jsonb),
    'creadores', coalesce((
      select jsonb_agg(x order by x.semana desc, x.recetas desc)
      from (
        select c.id, c.usuario, c.nombre, c.foto_path as foto, c.plataforma,
               count(t.id)::int as recetas, coalesce(sum(t.semana), 0)::int as semana
        from public.creadores c
        join public.descubrir_tarjetas t on t.creador_id = c.id
        group by c.id
        order by semana desc, recetas desc
        limit 12
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.descubrir_inicio() from anon, public;
grant execute on function public.descubrir_inicio() to authenticated;

-- La cuenta del catalogo no tiene tope: lo que importa no es de un usuario.
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
  if exists (select 1 from public.profiles where id = quien and es_catalogo) then
    return jsonb_build_object('plus', true, 'tope', 1000000, 'usadas', 0, 'restantes', 1000000);
  end if;
  select * into a from public.ajustes where id;
  if plus then
    tope := a.tope_plus_mes;
    select count(*) into usadas from public.import_jobs
      where user_id = quien and status = 'done'
        and source_type in ('instagram', 'tiktok', 'youtube', 'facebook', 'pinterest', 'image')
        and created_at >= date_trunc('month', now());
  else
    tope := a.tope_gratis;
    select count(*) into usadas from public.import_jobs
      where user_id = quien and status = 'done'
        and source_type in ('instagram', 'tiktok', 'youtube', 'facebook', 'pinterest', 'image')
        and created_at >= a.cuota_desde;
  end if;
  return jsonb_build_object('plus', plus, 'tope', tope, 'usadas', usadas, 'restantes', greatest(0, tope - usadas));
end;
$$;
