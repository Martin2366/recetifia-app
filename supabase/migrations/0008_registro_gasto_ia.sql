-- El freno de gasto sumaba import_jobs, pero esa tabla se borra en cascada con
-- la cuenta del usuario: borrar cuentas (o reinstalar y borrar) escondia lo ya
-- gastado. El gasto va ahora a un registro propio, sin datos del usuario, que
-- sobrevive a cualquier borrado.

create table if not exists public.gasto_ia (
  id      bigint generated always as identity primary key,
  creado  timestamptz not null default now(),
  costo   numeric(10, 6) not null,
  fuente  text
);

create index if not exists gasto_ia_creado_idx on public.gasto_ia (creado);

-- Nadie desde la app lo lee ni lo escribe: solo la Edge Function (service role)
alter table public.gasto_ia enable row level security;

create or replace function public.gasto_ia_del_mes()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(costo), 0)
  from public.gasto_ia
  where creado >= date_trunc('month', now());
$$;

revoke execute on function public.gasto_ia_del_mes() from public, anon, authenticated;
