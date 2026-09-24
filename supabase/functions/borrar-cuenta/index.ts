// Edge Function "borrar-cuenta": borra al usuario que la llama y todo lo suyo.
//
// Google Play exige que se pueda borrar la cuenta desde la app, y las reseñas
// de la competencia lo dejan claro: si no funciona, se siente como un robo de
// datos. Todas las tablas del usuario cuelgan de auth.users con on delete
// cascade, asi que basta con borrar el usuario. Las fotos importadas viven en
// la cache compartida (por hash de la URL), no por usuario: no se tocan.

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
};

function json(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'content-type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'metodo' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data } = await admin.auth.getUser(token);
  const usuario = data?.user;
  if (!usuario) return json({ error: 'sesion' }, 401);

  const { error } = await admin.auth.admin.deleteUser(usuario.id);
  if (error) {
    console.error('borrar-cuenta', usuario.id, error.message);
    return json({ error: 'borrado' }, 500);
  }
  return json({ ok: true });
});
