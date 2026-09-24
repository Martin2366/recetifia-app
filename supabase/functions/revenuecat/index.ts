// Edge Function "revenuecat": webhook de RevenueCat → tabla suscripciones.
//
// RevenueCat avisa cada compra, renovacion, cancelacion y vencimiento que
// confirma Google Play. Aqui se traduce a "esta cuenta tiene Plus hasta tal
// fecha". Es la fuente de verdad del servidor: la Edge Function "importar"
// consulta esto para no cortarle las importaciones a quien pago.
//
// La app identifica a cada persona en RevenueCat con su id de Supabase
// (Purchases.logIn), asi que app_user_id es un uuid de auth.users.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SECRETO = Deno.env.get('REVENUECAT_WEBHOOK_AUTH') ?? '';
const DERECHO = 'plus';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Eventos que dejan Plus activo hasta expiration_at_ms
const ACTIVAN = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
]);

type Evento = {
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  entitlement_ids?: string[] | null;
  expiration_at_ms?: number | null;
  /** Solo en BILLING_ISSUE: hasta cuando dura la gracia que da Google Play. */
  grace_period_expiration_at_ms?: number | null;
  product_id?: string;
  transferred_from?: string[];
  transferred_to?: string[];
};

function json(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });
}

/** El id de Supabase entre los alias de RevenueCat (los anonimos empiezan con $RCAnonymousID). */
function cuenta(ids: (string | undefined)[]): string | null {
  return ids.find((id) => id && UUID.test(id)) ?? null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'metodo' }, 405);
  // RevenueCat manda en Authorization el valor configurado en su panel
  if (!SECRETO || req.headers.get('Authorization') !== SECRETO) return json({ error: 'no autorizado' }, 401);

  const cuerpo = await req.json().catch(() => null);
  const e = cuerpo?.event as Evento | undefined;
  if (!e?.type) return json({ error: 'sin evento' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const guardar = (userId: string, plus: boolean, expira: number | null | undefined, producto?: string) =>
    admin.from('suscripciones').upsert(
      {
        user_id: userId,
        plan: plus ? 'plus' : 'free',
        expira_en: plus && expira ? new Date(expira).toISOString() : null,
        producto: producto ?? null,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  // La compra pasa de una cuenta a otra (restaurar en otro usuario)
  if (e.type === 'TRANSFER') {
    for (const id of e.transferred_from ?? []) if (UUID.test(id)) await guardar(id, false, null);
    const destino = cuenta(e.transferred_to ?? []);
    if (destino) await guardar(destino, true, null);
    return json({ ok: true });
  }

  const userId = cuenta([e.app_user_id, e.original_app_user_id, ...(e.aliases ?? [])]);
  // Evento de prueba del panel o compra sin identificar: nada que guardar
  if (!userId) return json({ ok: true, ignorado: 'sin cuenta de Supabase' });

  const esPlus = !e.entitlement_ids || e.entitlement_ids.includes(DERECHO);
  if (ACTIVAN.has(e.type) && esPlus) {
    const { error } = await guardar(userId, true, e.expiration_at_ms, e.product_id);
    if (error) return json({ error: error.message }, 500);
  } else if (e.type === 'BILLING_ISSUE' && esPlus && e.grace_period_expiration_at_ms) {
    // Fallo el cobro: durante la gracia de Google Play (7 dias el mensual, 14 el
    // anual) sigue con Plus mientras se reintenta. Si nunca se paga, llega EXPIRATION.
    const { error } = await guardar(userId, true, e.grace_period_expiration_at_ms, e.product_id);
    if (error) return json({ error: error.message }, 500);
  } else if (e.type === 'EXPIRATION') {
    const { error } = await guardar(userId, false, null, e.product_id);
    if (error) return json({ error: error.message }, 500);
  }
  // CANCELLATION y el resto no quitan Plus: vence en su fecha
  return json({ ok: true });
});
