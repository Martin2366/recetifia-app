-- Busqueda de Descubrir: texto libre y filtros. `grupos` es un arreglo JSON de
-- arreglos, uno por categoria: [["ing:pollo","ing:arroz"],["tipo:cena"]].
-- Dentro de un grupo basta una (pollo O arroz); entre grupos, todas (Y cena).
-- Sin tildes ni mayusculas: "champinon" encuentra "Champiñones".

create or replace function public.sin_tildes(t text)
returns text
language sql
immutable
as $$
  select translate(lower(coalesce(t, '')), 'áàäâéèëêíìïîóòöôúùüûñ', 'aaaaeeeeiiiioooouuuun');
$$;

create or replace function public.descubrir_buscar(texto text default '', grupos jsonb default '[]'::jsonb)
returns setof public.descubrir_tarjetas
language sql
stable
security invoker
set search_path = public
as $$
  select t.*
  from public.descubrir_tarjetas t
  join public.extractions e on e.id = t.extraction_id
  where
    (
      coalesce(trim(texto), '') = ''
      or public.sin_tildes(t.titulo) like '%' || public.sin_tildes(trim(texto)) || '%'
      or public.sin_tildes((e.normalized_recipe -> 'ingredients')::text) like '%' || public.sin_tildes(trim(texto)) || '%'
    )
    and not exists (
      select 1 from jsonb_array_elements(coalesce(grupos, '[]'::jsonb)) g
      where not (t.etiquetas && array(select jsonb_array_elements_text(g)))
    )
  -- Primero las que tienen mas de los ingredientes elegidos
  order by
    (select count(*) from jsonb_array_elements(coalesce(grupos, '[]'::jsonb)) g, jsonb_array_elements_text(g) f
      where f = any (t.etiquetas)) desc,
    t.semana desc,
    t.created_at desc;
$$;

revoke all on function public.descubrir_buscar(text, jsonb) from anon, public;
grant execute on function public.descubrir_buscar(text, jsonb) to authenticated;
