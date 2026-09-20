-- Recetifia — esquema inicial
--
-- Principios que sigue este esquema:
--   1. Todo dato de usuario lleva RLS. La base de datos es la unica autoridad
--      sobre quien ve que; el cliente nunca decide eso.
--   2. Una receta a medias sigue siendo valida. Solo el titulo es obligatorio.
--   3. `raw_text` de cada ingrediente se conserva siempre, aunque el parseo falle.
--      Medido en la Fase 0: el modo de fallo de la IA es omitir, no inventar,
--      asi que guardar el original permite recuperar lo que se perdio.

-- ---------------------------------------------------------------- utilidades

create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------------ perfiles

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- El perfil se crea solo al registrarse. Si esto falla, el alta falla: preferimos
-- enterarnos en el momento a tener usuarios sin perfil.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------- cache compartida

-- Indexada por la URL canonica. Guarda la extraccion BRUTA, nunca la receta
-- que un usuario haya editado despues: asi nadie hereda los errores de otro.
create table public.extractions (
  id                uuid primary key default gen_random_uuid(),
  source_url_hash   text not null unique,
  source_url        text not null,
  source_type       text not null check (source_type in
                      ('instagram','tiktok','youtube','facebook','pinterest','web','image','text')),
  raw_payload       jsonb,
  normalized_recipe jsonb,
  audio_origin      text,   -- whisper | subtitulos | gemini:youtube
  model_used        text,
  cost_usd          numeric(10,6) default 0,
  created_at        timestamptz not null default now()
);

create index extractions_source_type_idx on public.extractions (source_type);

-- ------------------------------------------------------------------ recetas

create table public.recipes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  description   text,
  image_path    text,
  servings      integer check (servings is null or servings > 0),
  prep_minutes  integer check (prep_minutes is null or prep_minutes >= 0),
  cook_minutes  integer check (cook_minutes is null or cook_minutes >= 0),
  source_type   text check (source_type is null or source_type in
                  ('instagram','tiktok','youtube','facebook','pinterest','web','image','text','manual')),
  source_url    text,
  source_author text,
  status        text not null default 'complete'
                  check (status in ('draft','needs_review','complete')),
  is_favorite   boolean not null default false,
  tags          text[] not null default '{}',
  extraction_id uuid references public.extractions(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index recipes_user_created_idx  on public.recipes (user_id, created_at desc);
create index recipes_user_favorite_idx on public.recipes (user_id) where is_favorite;
create index recipes_tags_idx          on public.recipes using gin (tags);
-- Busqueda en espanol sobre titulo y descripcion
create index recipes_busqueda_idx on public.recipes
  using gin (to_tsvector('spanish', coalesce(title,'') || ' ' || coalesce(description,'')));

create trigger recipes_touch before update on public.recipes
  for each row execute function public.touch_updated_at();

create table public.recipe_ingredients (
  id              uuid primary key default gen_random_uuid(),
  recipe_id       uuid not null references public.recipes(id) on delete cascade,
  position        integer not null default 0,
  raw_text        text not null,          -- siempre, aunque el parseo falle
  quantity        numeric(10,3),
  unit            text,
  name_normalized text,
  note            text,
  group_label     text                    -- "Para la salsa", "Para el relleno"
);

create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id, position);

create table public.recipe_steps (
  id               uuid primary key default gen_random_uuid(),
  recipe_id        uuid not null references public.recipes(id) on delete cascade,
  position         integer not null default 0,
  text             text not null,
  duration_seconds integer
);

create index recipe_steps_recipe_idx on public.recipe_steps (recipe_id, position);

-- -------------------------------------------------------------- colecciones

create table public.collections (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  cover_image_path text,
  position         integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index collections_user_idx on public.collections (user_id, position);

create trigger collections_touch before update on public.collections
  for each row execute function public.touch_updated_at();

create table public.collection_recipes (
  collection_id uuid not null references public.collections(id) on delete cascade,
  recipe_id     uuid not null references public.recipes(id) on delete cascade,
  position      integer not null default 0,
  added_at      timestamptz not null default now(),
  primary key (collection_id, recipe_id)
);

create index collection_recipes_recipe_idx on public.collection_recipes (recipe_id);

-- ---------------------------------------------------------- lista de compras

create table public.aisles (
  id       text primary key,   -- 'verduras', 'carniceria', 'abarrotes'...
  name     text not null,
  position integer not null default 0
);

create table public.shopping_lists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null default 'Mi lista',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shopping_lists_user_idx on public.shopping_lists (user_id, created_at desc);

create trigger shopping_lists_touch before update on public.shopping_lists
  for each row execute function public.touch_updated_at();

create table public.shopping_list_items (
  id              uuid primary key default gen_random_uuid(),
  list_id         uuid not null references public.shopping_lists(id) on delete cascade,
  display_name    text not null,
  name_normalized text,
  quantity        numeric(10,3),
  unit            text,
  aisle           text references public.aisles(id) on delete set null,
  is_checked      boolean not null default false,
  recipe_id       uuid references public.recipes(id) on delete set null,  -- null = a mano
  position        integer not null default 0
);

create index shopping_list_items_list_idx on public.shopping_list_items (list_id, position);

-- ------------------------------------------------------- trabajos de importacion

-- Sirve para dos cosas a la vez: pintar el progreso en la app via Realtime,
-- y medir la calidad y el coste de la importacion en produccion.
create table public.import_jobs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  source_url     text,
  source_type    text,
  status         text not null default 'queued'
                   check (status in ('queued','running','done','failed')),
  stage          text,   -- obteniendo | transcribiendo | estructurando | guardando
  failure_reason text,
  extraction_id  uuid references public.extractions(id) on delete set null,
  recipe_id      uuid references public.recipes(id) on delete set null,
  cost_usd       numeric(10,6) default 0,
  duration_ms    integer,
  created_at     timestamptz not null default now(),
  finished_at    timestamptz
);

create index import_jobs_user_idx on public.import_jobs (user_id, created_at desc);

-- ------------------------------------------------- sinonimos de ingredientes

-- Palta/aguacate, choclo/elote, frijol/poroto/caraota. Sin esto la lista de
-- compras duplica entradas y la busqueda falla entre paises.
create table public.ingredient_synonyms (
  id        uuid primary key default gen_random_uuid(),
  canonical text not null,
  variant   text not null,
  country   text,
  unique (variant, country)
);

create index ingredient_synonyms_canonical_idx on public.ingredient_synonyms (canonical);

-- ==================================================================== RLS ===

alter table public.profiles            enable row level security;
alter table public.recipes             enable row level security;
alter table public.recipe_ingredients  enable row level security;
alter table public.recipe_steps        enable row level security;
alter table public.collections         enable row level security;
alter table public.collection_recipes  enable row level security;
alter table public.shopping_lists      enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.import_jobs         enable row level security;
alter table public.extractions         enable row level security;
alter table public.ingredient_synonyms enable row level security;
alter table public.aisles              enable row level security;

-- Perfiles: cada quien el suyo
create policy "perfil propio" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Tablas con user_id directo
create policy "recetas propias" on public.recipes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "colecciones propias" on public.collections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "listas propias" on public.shopping_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "importaciones propias" on public.import_jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Tablas hijas: se comprueba la pertenencia a traves del padre
create policy "ingredientes de recetas propias" on public.recipe_ingredients
  for all
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()));

create policy "pasos de recetas propias" on public.recipe_steps
  for all
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()));

create policy "recetas de colecciones propias" on public.collection_recipes
  for all
  using (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()));

create policy "items de listas propias" on public.shopping_list_items
  for all
  using (exists (select 1 from public.shopping_lists l where l.id = list_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.shopping_lists l where l.id = list_id and l.user_id = auth.uid()));

-- Tablas globales: lectura para quien haya iniciado sesion, escritura solo
-- desde el servidor (service_role se salta RLS, asi que no lleva politica).
create policy "cache legible" on public.extractions
  for select to authenticated using (true);

create policy "sinonimos legibles" on public.ingredient_synonyms
  for select to authenticated using (true);

create policy "pasillos legibles" on public.aisles
  for select to authenticated using (true);

-- ============================================================ datos semilla ===

insert into public.aisles (id, name, position) values
  ('frutas-verduras', 'Frutas y verduras',      10),
  ('carniceria',      'Carnes y aves',          20),
  ('pescaderia',      'Pescados y mariscos',    30),
  ('lacteos',         'Lácteos y huevos',       40),
  ('panaderia',       'Panadería',              50),
  ('abarrotes',       'Abarrotes y despensa',   60),
  ('condimentos',     'Aliños y condimentos',   70),
  ('congelados',      'Congelados',             80),
  ('bebidas',         'Bebidas',                90),
  ('limpieza',        'Limpieza y hogar',      100),
  ('otros',           'Otros',                 110);

-- Semilla minima de sinonimos LATAM. Se amplia con el uso real.
insert into public.ingredient_synonyms (canonical, variant, country) values
  ('aguacate',      'palta',        null),
  ('maiz tierno',   'choclo',       null),
  ('maiz tierno',   'elote',        null),
  ('maiz tierno',   'jojoto',       null),
  ('frijol',        'poroto',       null),
  ('frijol',        'caraota',      null),
  ('frijol',        'habichuela',   null),
  ('platano',       'banana',       null),
  ('platano',       'guineo',       null),
  ('platano',       'cambur',       null),
  ('durazno',       'melocoton',    null),
  ('betarraga',     'remolacha',    null),
  ('betarraga',     'betabel',      null),
  ('camote',        'batata',       null),
  ('camote',        'boniato',      null),
  ('mani',          'cacahuate',    null),
  ('ají',           'chile',        null),
  ('ají',           'pimiento',     null),
  ('arveja',        'guisante',     null),
  ('arveja',        'chicharo',     null),
  ('zapallo',       'calabaza',     null),
  ('zapallo',       'auyama',       null),
  ('papa',          'patata',       null),
  ('jugo',          'zumo',         null),
  ('crema de leche','nata',         null),
  ('pomelo',        'toronja',      null),
  ('frutilla',      'fresa',        null),
  ('damasco',       'albaricoque',  null),
  ('poroto verde',  'ejote',        null),
  ('poroto verde',  'judia verde',  null);
