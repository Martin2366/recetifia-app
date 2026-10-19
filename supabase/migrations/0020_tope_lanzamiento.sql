-- Lanzamiento en produccion: el plan gratis queda en 10 importaciones con IA
-- (videos e imagenes) en total. Todos parten de cero ese dia: quien ya habia
-- usado varias en la prueba cerrada no queda en 0 de golpe.
update public.ajustes set tope_gratis = 10, cuota_desde = now() where id;
alter table public.ajustes alter column tope_gratis set default 10;
