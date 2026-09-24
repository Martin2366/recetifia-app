-- Fase 5 del plan de reseñas: pagos que no dan miedo.
--
-- El plan de cada cuenta lo escribe el webhook de RevenueCat (Edge Function
-- "revenuecat"), no la app. Asi el servidor sabe quien tiene Plus aunque el
-- telefono mienta o este desconectado, y "pague y no me reconoce el Plus"
-- se corrige solo en cuanto Google Play confirma la compra.
--
-- expira_en: hasta cuando vale lo pagado. Cancelar no quita Plus en el acto:
-- se conserva hasta el final del periodo pagado, como promete Google Play.

alter table public.suscripciones
  add column if not exists expira_en timestamptz,
  add column if not exists producto  text;

comment on column public.suscripciones.expira_en is 'Fin del periodo pagado. Null = sin vencimiento (asignado a mano).';

-- Plus vigente, con la misma regla en todos lados
create or replace function public.tiene_plus(quien uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.suscripciones
    where user_id = quien and plan = 'plus' and (expira_en is null or expira_en > now())
  );
$$;

revoke execute on function public.tiene_plus(uuid) from public, anon, authenticated;
