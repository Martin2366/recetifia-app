-- Fase 3 del plan de reseñas: nunca perder nada.
--
-- Una receta guardada sin conexion queda en cola en el telefono y se sube sola
-- cuando vuelve la red. Si la respuesta de un guardado se pierde por el camino,
-- el reintento no debe duplicarla: el telefono genera el id y crear_receta lo
-- respeta, devolviendo la receta existente si ya estaba.

create or replace function public.crear_receta(receta jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  nueva_id uuid;
  quien    uuid := auth.uid();
  pedida   uuid := (receta->>'id')::uuid;
begin
  if quien is null then
    raise exception 'sin sesion';
  end if;

  -- Reintento de un guardado que si llego: se devuelve la misma receta
  if pedida is not null and exists (select 1 from public.recipes where id = pedida and user_id = quien) then
    return pedida;
  end if;

  insert into public.recipes (
    id, user_id, title, description, image_path, servings,
    prep_minutes, cook_minutes, source_type, source_url, source_author,
    status, tags, extraction_id, nutrition
  )
  values (
    coalesce(pedida, gen_random_uuid()),
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
