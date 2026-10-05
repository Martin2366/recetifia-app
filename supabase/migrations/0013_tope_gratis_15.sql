-- El tope gratis sube de 10 a 15 importaciones en total. Como la cuota se
-- calcula como tope - usadas desde cuota_desde, quien ya uso algunas recibe
-- 5 mas sobre lo que le quedaba (aplicada el 5 oct 2026).
update public.ajustes set tope_gratis = 15 where id;
alter table public.ajustes alter column tope_gratis set default 15;
