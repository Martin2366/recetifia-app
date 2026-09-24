-- Importacion con IA (fase 3): lo que necesita la base de datos.
--
-- 1. Plan del usuario en una tabla que solo escribe el servidor. No va en
--    profiles porque cada usuario puede editar su perfil y se daria Plus solo.
-- 2. import_jobs pasa a ser de solo lectura para el usuario: si pudiera borrar
--    sus trabajos, reiniciaria el contador de importaciones del mes.
-- 3. Nutricion por porcion en la receta y un emoji por ingrediente.
-- 4. Bucket publico para las fotos: las de Instagram y TikTok son enlaces
--    firmados que caducan a los pocos dias.

-- ------------------------------------------------------------------ plan

create table public.suscripciones (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  plan           text not null default 'free' check (plan in ('free', 'plus')),
  actualizado_en timestamptz not null default now()
);

alter table public.suscripciones enable row level security;

-- Cada uno ve su plan; nadie lo escribe desde la app (service_role salta RLS)
create policy "plan propio" on public.suscripciones
  for select to authenticated using (auth.uid() = user_id);

-- ------------------------------------------------------ trabajos de importacion

drop policy "importaciones propias" on public.import_jobs;
create policy "importaciones propias, solo lectura" on public.import_jobs
  for select to authenticated using (auth.uid() = user_id);

-- Resultado de un trabajo terminado: completa, o parcial (faltan pasos o
-- ingredientes). Y de donde salio, para el aviso de la vista previa.
alter table public.import_jobs
  add column quality text check (quality in ('complete', 'partial')),
  add column origin  text;   -- caption | audio | subtitulos | video | web_creador | web | youtube

-- ------------------------------------------------------- nutricion y emojis

alter table public.recipes add column nutrition jsonb;
alter table public.recipe_ingredients add column emoji text;

create or replace function public.crear_receta(receta jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  nueva_id uuid;
  quien    uuid := auth.uid();
begin
  if quien is null then
    raise exception 'sin sesion';
  end if;

  insert into public.recipes (
    user_id, title, description, image_path, servings,
    prep_minutes, cook_minutes, source_type, source_url, source_author,
    status, tags, extraction_id, nutrition
  )
  values (
    quien,
    nullif(trim(receta->>'title'), ''),
    nullif(trim(receta->>'description'), ''),
    receta->>'image_path',
    (receta->>'servings')::integer,
    (receta->>'prep_minutes')::integer,
    (receta->>'cook_minutes')::integer,
    coalesce(receta->>'source_type', 'manual'),
    receta->>'source_url',
    receta->>'source_author',
    coalesce(receta->>'status', 'complete'),
    coalesce(
      (select array_agg(value::text) from jsonb_array_elements_text(receta->'tags')),
      '{}'
    ),
    (receta->>'extraction_id')::uuid,
    receta->'nutrition'
  )
  returning id into nueva_id;

  perform public.reemplazar_detalle_receta(nueva_id, receta);
  return nueva_id;
end;
$$;

create or replace function public.reemplazar_detalle_receta(receta_id uuid, receta jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if receta ? 'ingredients' then
    delete from public.recipe_ingredients where recipe_id = receta_id;
    insert into public.recipe_ingredients (recipe_id, position, raw_text, quantity, unit, name_normalized, note, group_label, emoji)
    select
      receta_id,
      (orden - 1)::integer,
      coalesce(nullif(trim(item->>'raw_text'), ''), trim(item->>'name')),
      (item->>'quantity')::numeric,
      nullif(trim(item->>'unit'), ''),
      nullif(lower(trim(item->>'name')), ''),
      nullif(trim(item->>'note'), ''),
      nullif(trim(item->>'group_label'), ''),
      nullif(trim(item->>'emoji'), '')
    from jsonb_array_elements(receta->'ingredients') with ordinality as t(item, orden)
    where coalesce(nullif(trim(item->>'raw_text'), ''), trim(item->>'name')) is not null;
  end if;

  if receta ? 'steps' then
    delete from public.recipe_steps where recipe_id = receta_id;
    insert into public.recipe_steps (recipe_id, position, text, duration_seconds)
    select
      receta_id,
      (orden - 1)::integer,
      trim(paso->>'text'),
      (paso->>'duration_seconds')::integer
    from jsonb_array_elements(receta->'steps') with ordinality as t(paso, orden)
    where nullif(trim(paso->>'text'), '') is not null;
  end if;
end;
$$;

-- ------------------------------------------------------------------ fotos

insert into storage.buckets (id, name, public)
values ('recetas', 'recetas', true)
on conflict (id) do nothing;
