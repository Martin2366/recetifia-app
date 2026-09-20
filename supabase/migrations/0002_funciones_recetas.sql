-- Crear y editar recetas de forma atomica.
--
-- Una receta vive en tres tablas (recipes, recipe_ingredients, recipe_steps).
-- Hacerlo con tres inserts desde el cliente significa que un corte de red a
-- mitad deja una receta sin ingredientes o sin pasos, y el usuario no se entera.
-- Estas funciones lo resuelven en una sola transaccion: o entra todo, o nada.
--
-- Son SECURITY INVOKER a proposito: se ejecutan con los permisos de quien llama,
-- asi que RLS sigue mandando y nadie puede tocar recetas ajenas.

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
    status, tags, extraction_id
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
    (receta->>'extraction_id')::uuid
  )
  returning id into nueva_id;

  perform public.reemplazar_detalle_receta(nueva_id, receta);
  return nueva_id;
end;
$$;

create or replace function public.actualizar_receta(receta_id uuid, receta jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.recipes set
    title         = coalesce(nullif(trim(receta->>'title'), ''), title),
    description   = receta->>'description',
    image_path    = coalesce(receta->>'image_path', image_path),
    servings      = (receta->>'servings')::integer,
    prep_minutes  = (receta->>'prep_minutes')::integer,
    cook_minutes  = (receta->>'cook_minutes')::integer,
    status        = coalesce(receta->>'status', status),
    tags          = coalesce(
                      (select array_agg(value::text) from jsonb_array_elements_text(receta->'tags')),
                      tags
                    )
  where id = receta_id;

  -- Si RLS lo bloqueo, no se actualizo nada: avisamos en vez de fingir exito.
  if not found then
    raise exception 'receta no encontrada o sin permiso';
  end if;

  perform public.reemplazar_detalle_receta(receta_id, receta);
end;
$$;

/**
 * Sustituye ingredientes y pasos por los que vengan en el payload.
 * Borrar y reinsertar es mas simple y mas fiable que reconciliar posiciones,
 * y al ir dentro de la transaccion del llamante no hay ventana de datos rotos.
 */
create or replace function public.reemplazar_detalle_receta(receta_id uuid, receta jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if receta ? 'ingredients' then
    delete from public.recipe_ingredients where recipe_id = receta_id;
    insert into public.recipe_ingredients (recipe_id, position, raw_text, quantity, unit, name_normalized, note, group_label)
    select
      receta_id,
      (orden - 1)::integer,
      coalesce(nullif(trim(item->>'raw_text'), ''), trim(item->>'name')),
      (item->>'quantity')::numeric,
      nullif(trim(item->>'unit'), ''),
      nullif(lower(trim(item->>'name')), ''),
      nullif(trim(item->>'note'), ''),
      nullif(trim(item->>'group_label'), '')
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

-- Busqueda en espanol sobre titulo, descripcion e ingredientes.
-- Buscar solo en el titulo falla justo cuando mas se usa: "que hago con pollo".
create or replace function public.buscar_recetas(consulta text)
returns setof public.recipes
language sql
stable
security invoker
set search_path = public
as $$
  select r.*
  from public.recipes r
  where
    consulta is null or trim(consulta) = ''
    or r.title ilike '%' || consulta || '%'
    or r.description ilike '%' || consulta || '%'
    or exists (
      select 1 from public.recipe_ingredients i
      where i.recipe_id = r.id
        and (i.raw_text ilike '%' || consulta || '%' or i.name_normalized ilike '%' || consulta || '%')
    )
  order by r.created_at desc;
$$;
