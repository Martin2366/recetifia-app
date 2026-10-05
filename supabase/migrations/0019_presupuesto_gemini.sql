-- El credito de Gemini es prepagado y chico: Descubrir cuenta su gasto desde
-- la ultima recarga (no solo desde el dia 1) y con un tope bajo, para que lo
-- demas quede para las importaciones de las personas.
alter table public.ajustes add column credito_desde timestamptz not null default now();

-- Recarga del 5 oct 2026: US$5 para unas dos semanas. Descubrir usa como mucho US$1.
update public.ajustes set credito_desde = now(), tope_descubrir_mes_usd = 1 where id;
