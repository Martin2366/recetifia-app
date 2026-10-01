-- Importar desde una foto (galeria o camara) tambien gasta IA: cuenta en la cuota.

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
