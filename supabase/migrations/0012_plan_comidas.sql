-- Plan de comidas semanal: gratis y sin tope. Cada fila es una comida de un dia
-- (desayuno, almuerzo, cena o snack) con una receta o una nota corta.

create table public.meal_plan_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day        date not null,
  meal       text not null check (meal in ('desayuno', 'almuerzo', 'cena', 'snack')),
  -- Si se borra la receta, sale del plan: no queda una comida vacia
  recipe_id  uuid references public.recipes(id) on delete cascade,
  note       text check (char_length(note) <= 75),
  servings   smallint check (servings > 0),
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  check (recipe_id is not null or note is not null)
);

create index meal_plan_items_user_day_idx on public.meal_plan_items (user_id, day);

alter table public.meal_plan_items enable row level security;

create policy "planes propios" on public.meal_plan_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
