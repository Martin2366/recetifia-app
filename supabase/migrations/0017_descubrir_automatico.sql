-- Descubrir se llena solo: cada semana la funcion `descubrir` busca en Instagram
-- y TikTok los reels de recetas en espanol con mas vistas, los importa con el
-- motor de siempre y los publica con sus numeros reales. Tambien: videos desde
-- la galeria como fuente de importacion.

-- ------------------------------------------------------------- metricas reales

alter table public.descubrir_recetas
  add column plataforma   text,
  add column me_gusta     bigint,
  add column vistas       bigint,
  add column publicado_el timestamptz,
  add column automatica   boolean not null default false;

alter table public.creadores add column seguidores bigint;

-- Tope de gasto propio de Descubrir (Apify + importaciones del catalogo)
alter table public.ajustes add column tope_descubrir_mes_usd numeric(6, 2) not null default 6;

-- --------------------------------------------------------- trabajo interno

-- Cada busqueda semanal: una corrida de Apify por red, asincrona.
create table public.descubrir_busquedas (
  id         uuid primary key default gen_random_uuid(),
  plataforma text not null,
  apify_run  text not null,
  estado     text not null default 'corriendo' check (estado in ('corriendo', 'lista', 'fallida')),
  resultados int,
  created_at timestamptz not null default now()
);

-- Lo que encontro la busqueda, antes de importarlo.
create table public.descubrir_candidatos (
  id           uuid primary key default gen_random_uuid(),
  url          text not null unique,
  plataforma   text not null,
  usuario      text not null,
  nombre       text,
  avatar_url   text,
  seguidores   bigint,
  me_gusta     bigint,
  vistas       bigint,
  publicado_el timestamptz,
  puntaje      double precision not null default 0,
  estado       text not null default 'pendiente' check (estado in ('pendiente', 'importando', 'publicada', 'descartada')),
  job_id       uuid,
  motivo       text,
  created_at   timestamptz not null default now()
);

create index descubrir_candidatos_estado_idx on public.descubrir_candidatos (estado, puntaje desc);

-- Solo el servidor (service_role) las usa: sin politicas, nadie mas las ve
alter table public.descubrir_busquedas  enable row level security;
alter table public.descubrir_candidatos enable row level security;

-- ------------------------------------------------------------ vista y orden

-- Puntaje de popularidad: vistas reales de la publicacion (en TikTok se cuentan
-- mucho mas facil, por eso pesan menos) y lo que se guarda en Recetifia.
create or replace view public.descubrir_tarjetas as
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
  (select case when count(*) >= 10 then count(*) end from public.descubrir_guardados g where g.receta_id = r.id)::int as guardados,
  r.me_gusta,
  r.vistas,
  r.publicado_el,
  coalesce(r.vistas, r.me_gusta * 25, 0)::double precision / (case when r.plataforma = 'tiktok' then 5 else 1 end)
    + (select count(*) from public.descubrir_guardados g where g.receta_id = r.id) * 2000 as puntaje
from public.descubrir_recetas r
join public.extractions e on e.id = r.extraction_id
left join public.creadores c on c.id = r.creador_id
where r.publicada;

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

  -- La elegida para hoy; si no, una de las 20 mas populares, distinta cada dia
  select to_jsonb(t) into del_dia from public.descubrir_tarjetas t
    where t.destacada_el = current_date limit 1;
  if del_dia is null then
    select to_jsonb(x) into del_dia from (
      select * from public.descubrir_tarjetas order by puntaje desc limit 20
    ) x
    order by x.id
    offset (extract(doy from current_date)::int % least(total, 20)) limit 1;
  end if;

  return jsonb_build_object(
    'del_dia', del_dia,
    -- Lo de las ultimas dos semanas primero; si falta, completa con lo demas
    'populares', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.reciente desc, t.puntaje desc)
      from (
        select d.*, d.created_at > now() - interval '14 days' as reciente
        from public.descubrir_tarjetas d
        order by reciente desc, puntaje desc
        limit 10
      ) t
    ), '[]'::jsonb),
    'creadores', coalesce((
      select jsonb_agg(x order by x.puntaje desc)
      from (
        select c.id, c.usuario, c.nombre, c.foto_path as foto, c.plataforma, c.seguidores,
               count(t.id)::int as recetas, sum(t.puntaje) as puntaje
        from public.creadores c
        join public.descubrir_tarjetas t on t.creador_id = c.id
        group by c.id
        order by puntaje desc
        limit 12
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

-- ----------------------------------------------------- videos de la galeria

alter table public.extractions drop constraint extractions_source_type_check;
alter table public.extractions add constraint extractions_source_type_check check (source_type in
  ('instagram', 'tiktok', 'youtube', 'facebook', 'pinterest', 'web', 'image', 'video', 'text'));

alter table public.recipes drop constraint recipes_source_type_check;
alter table public.recipes add constraint recipes_source_type_check check (source_type is null or source_type in
  ('instagram', 'tiktok', 'youtube', 'facebook', 'pinterest', 'web', 'image', 'video', 'text', 'manual'));

-- Privado: cada uno sube a su carpeta; el servidor lo lee y lo borra al terminar
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', false, 52428800, array['video/mp4', 'video/quicktime', 'video/3gpp', 'video/webm', 'video/x-matroska'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "sube videos propios" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Un video de la galeria tambien gasta IA: cuenta en la cuota como una foto
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
        and source_type in ('instagram', 'tiktok', 'youtube', 'facebook', 'pinterest', 'image', 'video')
        and created_at >= date_trunc('month', now());
  else
    tope := a.tope_gratis;
    select count(*) into usadas from public.import_jobs
      where user_id = quien and status = 'done'
        and source_type in ('instagram', 'tiktok', 'youtube', 'facebook', 'pinterest', 'image', 'video')
        and created_at >= a.cuota_desde;
  end if;
  return jsonb_build_object('plus', plus, 'tope', tope, 'usadas', usadas, 'restantes', greatest(0, tope - usadas));
end;
$$;
