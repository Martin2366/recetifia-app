-- La cuenta del catalogo guarda la foto de cada creador en Storage (las URLs
-- de las redes caducan en dias). Solo ella y solo dentro de recetas/creadores/.
create policy "catalogo sube fotos de creadores" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recetas' and (storage.foldername(name))[1] = 'creadores' and public.es_catalogo());

create policy "catalogo reemplaza fotos de creadores" on storage.objects
  for update to authenticated
  using (bucket_id = 'recetas' and (storage.foldername(name))[1] = 'creadores' and public.es_catalogo());
