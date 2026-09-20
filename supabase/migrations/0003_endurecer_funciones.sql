-- Cierra las advertencias del Security Advisor de Supabase.
--
-- 1. touch_updated_at no fijaba search_path. Una funcion sin search_path fijo
--    resuelve los nombres segun quien la llame, lo que abre la puerta a que
--    alguien cree un objeto con el mismo nombre en un esquema anterior de la
--    ruta y se ejecute el suyo en lugar del nuestro.
--
-- 2. handle_new_user es SECURITY DEFINER y cualquiera podia ejecutarla
--    directamente. Es una funcion de trigger: la llama Postgres al insertarse
--    una fila en auth.users, nunca un cliente. Al ejecutarla suelta, alguien
--    podria intentar crear perfiles a mano.
--
-- Las funciones de trigger no necesitan permiso EXECUTE para que el trigger
-- funcione: el trigger las invoca por su cuenta.

alter function public.touch_updated_at() set search_path = public;

revoke all on function public.touch_updated_at()  from public, anon, authenticated;
revoke all on function public.handle_new_user()   from public, anon, authenticated;

-- Las funciones de recetas SI las llama la app, asi que conservan EXECUTE para
-- usuarios autenticados. Son SECURITY INVOKER, de modo que RLS sigue aplicando
-- y nadie puede tocar recetas ajenas a traves de ellas.
revoke all on function public.crear_receta(jsonb)                       from public, anon;
revoke all on function public.actualizar_receta(uuid, jsonb)            from public, anon;
revoke all on function public.reemplazar_detalle_receta(uuid, jsonb)    from public, anon;
revoke all on function public.buscar_recetas(text)                      from public, anon;

grant execute on function public.crear_receta(jsonb)            to authenticated;
grant execute on function public.actualizar_receta(uuid, jsonb) to authenticated;
grant execute on function public.buscar_recetas(text)           to authenticated;

-- reemplazar_detalle_receta es un detalle interno, pero necesita EXECUTE:
-- crear_receta es SECURITY INVOKER, asi que la llama con los permisos del
-- usuario. Quitarselo romperia el guardado de recetas.
-- No es un riesgo: tambien es SECURITY INVOKER, de modo que RLS impide tocar
-- nada que no sea del propio usuario.
grant execute on function public.reemplazar_detalle_receta(uuid, jsonb) to authenticated;
