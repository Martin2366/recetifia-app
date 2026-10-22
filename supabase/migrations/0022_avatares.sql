-- Foto de perfil: cada quien sube la suya a recetas/avatares/{su id}/.
-- El bucket "recetas" ya es publico (las fotos de recetas se ven sin sesion);
-- el nombre lleva la fecha, asi cambiarla no choca con la cache de la imagen.

create policy "ve sus avatares" on storage.objects
  for select to authenticated
  using (bucket_id = 'recetas' and (storage.foldername(name))[1] = 'avatares' and (storage.foldername(name))[2] = auth.uid()::text);

create policy "sube su avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recetas' and (storage.foldername(name))[1] = 'avatares' and (storage.foldername(name))[2] = auth.uid()::text);

create policy "borra sus avatares" on storage.objects
  for delete to authenticated
  using (bucket_id = 'recetas' and (storage.foldername(name))[1] = 'avatares' and (storage.foldername(name))[2] = auth.uid()::text);
