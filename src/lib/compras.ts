import { Linking, LogBox, Platform } from 'react-native';

/**
 * Suscripciones de Recetifia+ con RevenueCat.
 *
 * Mientras no haya clave de RevenueCat (EXPO_PUBLIC_REVENUECAT_ANDROID_KEY) la
 * app funciona en "modo demostracion": el paywall muestra los precios de
 * respaldo y comprar no cobra nada. RevenueCat se carga de forma perezosa para
 * que un build sin el modulo nativo no se caiga al importar este archivo.
 */

export type IdPlan = 'anual' | 'mensual';

export type Plan = {
  id: IdPlan;
  /** Precio total del periodo, ya formateado en la moneda local. */
  precio: string;
  /** Solo en el anual: lo que sale al mes. */
  precioMensual?: string;
};

/** Mismo derecho (entitlement) que se configure en el panel de RevenueCat. */
const DERECHO_PLUS = 'plus';

/**
 * Precios de referencia, en USD. Los reales los fija Google Play por pais (en
 * moneda local) y llegan desde RevenueCat. Sin prueba de Google Play: pide
 * tarjeta, y "me cobraron la prueba" es de las quejas mas repetidas. El plan
 * gratis ya sirve para probar la app de verdad.
 */
export const PLANES_RESPALDO: Record<IdPlan, Plan> = {
  anual: { id: 'anual', precio: 'US$9,99', precioMensual: 'US$0,83' },
  mensual: { id: 'mensual', precio: 'US$1,99' },
};

/** Descuento del anual frente a pagar doce meses (9,99 frente a 23,88). */
export const AHORRO_ANUAL = '58%';

/** Pagina de Google Play donde se ve, cambia o cancela la suscripcion. */
export function abrirGestionDeSuscripcion() {
  return Linking.openURL('https://play.google.com/store/account/subscriptions?package=app.recetifia');
}

/**
 * Limites del plan gratis y de la prueba. Se muestran aqui, pero se hacen
 * cumplir en el servidor por cuenta de usuario (Edge Function "importar").
 * Guardar, escribir, organizar y la lista de compras no tienen tope.
 */
export const LIMITES = {
  /** Lo unico limitado del plan gratis: importar con IA desde videos e imagenes. */
  importacionesPorSemana: 15,
} as const;

const CLAVE = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

type ModuloPurchases = typeof import('react-native-purchases').default;
type Paquete = import('react-native-purchases').PurchasesPackage;

let purchases: ModuloPurchases | null = null;
let paquetes: Partial<Record<IdPlan, Paquete>> = {};

export function comprasDisponibles(): boolean {
  return Platform.OS === 'android' && Boolean(CLAVE);
}

function sdk(): ModuloPurchases | null {
  if (!comprasDisponibles()) return null;
  if (!purchases) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const modulo = require('react-native-purchases').default as ModuloPurchases;
      // Mientras RevenueCat no tenga productos de Google Play, el SDK registra un
      // error al pedir las ofertas por su cuenta. Es esperado: el paywall usa los
      // precios de respaldo. Solo se oculta ese aviso de la pantalla de desarrollo.
      if (__DEV__) LogBox.ignoreLogs(['Error fetching offerings']);
      modulo.configure({ apiKey: CLAVE! });
      purchases = modulo;
    } catch {
      return null;
    }
  }
  return purchases;
}

/**
 * Liga las compras a la cuenta de Supabase: asi Plus sigue a la persona (otro
 * telefono, reinstalar) y el webhook sabe a quien darselo. Se llama al cambiar
 * de sesion.
 */
export async function identificarCompras(userId: string | null) {
  const p = sdk();
  if (!p) return;
  try {
    if (userId) await p.logIn(userId);
    else if (!(await p.isAnonymous())) await p.logOut();
  } catch {
    // Sin red: se reintenta en el proximo cambio de sesion o al abrir la app
  }
}

/** Planes con los precios locales de Google Play, o los de respaldo. */
export async function cargarPlanes(): Promise<Record<IdPlan, Plan>> {
  const p = sdk();
  if (!p) return PLANES_RESPALDO;
  try {
    const ofertas = await p.getOfferings();
    const actual = ofertas.current;
    if (!actual?.annual || !actual.monthly) return PLANES_RESPALDO;
    paquetes = { anual: actual.annual, mensual: actual.monthly };
    const anual = actual.annual.product;
    return {
      anual: { id: 'anual', precio: anual.priceString, precioMensual: anual.pricePerMonthString ?? undefined },
      mensual: { id: 'mensual', precio: actual.monthly.product.priceString },
    };
  } catch {
    return PLANES_RESPALDO;
  }
}

export type ResultadoCompra = 'comprado' | 'cancelado' | 'demostracion' | 'error';

export async function comprar(plan: IdPlan): Promise<ResultadoCompra> {
  const p = sdk();
  const paquete = paquetes[plan];
  if (!p || !paquete) return 'demostracion';
  try {
    const { customerInfo } = await p.purchasePackage(paquete);
    return customerInfo.entitlements.active[DERECHO_PLUS] ? 'comprado' : 'error';
  } catch (e) {
    return (e as { userCancelled?: boolean }).userCancelled ? 'cancelado' : 'error';
  }
}

/** Si la cuenta tiene Recetifia+ activo (incluida la prueba). Sin RevenueCat, siempre no. */
export async function tienePlus(): Promise<boolean> {
  const p = sdk();
  if (!p) return false;
  try {
    const info = await p.getCustomerInfo();
    return Boolean(info.entitlements.active[DERECHO_PLUS]);
  } catch {
    return false;
  }
}

export async function restaurarCompras(): Promise<boolean> {
  const p = sdk();
  if (!p) return false;
  try {
    const info = await p.restorePurchases();
    return Boolean(info.entitlements.active[DERECHO_PLUS]);
  } catch {
    return false;
  }
}
