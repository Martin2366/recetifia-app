-- Descubrir avanza solo: pg_cron llama a la funcion `descubrir` cada 10
-- minutos. El secreto NO va aqui (el repo es publico): vive en el Vault con el
-- nombre "catalogo_secreto" y se crea a mano con
--   select vault.create_secret('<secreto>', 'catalogo_secreto');
-- igual al secreto CATALOGO_SECRETO de las Edge Functions.

alter table public.descubrir_candidatos add column importando_desde timestamptz;

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'descubrir',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://ejjduwzqdhdyfqofqxvl.supabase.co/functions/v1/descubrir',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-catalogo-secreto', (select decrypted_secret from vault.decrypted_secrets where name = 'catalogo_secreto')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
