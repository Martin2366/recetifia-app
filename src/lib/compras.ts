import { Platform } from 'react-native';

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
  diasPrueba: number;
};

/** Mismo derecho (entitlement) que se configure en el panel de RevenueCat. */
const DERECHO_PLUS = 'plus';

/**
 * Precios de referencia, en USD. Los reales los fija Google Play por pais y
 * llegan desde RevenueCat ya en la moneda local.
 */
export const PLANES_RESPALDO: Record<IdPlan, Plan> = {
  anual: { id: 'anual', precio: 'US$12,99', precioMensual: 'US$1,08', diasPrueba: 3 },
  // Sin prueba a proposito: la prueba empuja hacia el anual
  mensual: { id: 'mensual', precio: 'US$3,99', diasPrueba: 0 },
};

/** Descuento del anual frente a pagar doce meses (12,99 frente a 47,88). */
export const AHORRO_ANUAL = '73%';

/**
 * Limites del plan gratis y de la prueba. Se muestran aqui, pero se hacen
 * cumplir en el servidor por cuenta de usuario: reinstalar la app no los
 * reinicia.
 */
export const LIMITES = {
  importacionesGratisAlMes: 3,
  recetasGratis: 25,
  coleccionesGratis: 1,
  importacionesPrueba: 5,
} as const;

type Valor = boolean | string;

/** Gratis frente a Plus. Lo usan la comparacion de planes y el paywall. */
export const BENEFICIOS: { titulo: string; detalle?: string; gratis: Valor; plus: Valor; estrella?: boolean }[] = [
  {
    titulo: 'Importaciones con IA',
    detalle: 'de reels, TikTok, YouTube y webs',
    gratis: `${LIMITES.importacionesGratisAlMes} al mes`,
    plus: 'Ilimitadas',
    estrella: true,
  },
  { titulo: 'Recetas guardadas', gratis: `Hasta ${LIMITES.recetasGratis}`, plus: 'Ilimitadas' },
  { titulo: 'Colecciones', gratis: String(LIMITES.coleccionesGratis), plus: 'Ilimitadas' },
  { titulo: 'Importar desde fotos y cuadernos', gratis: false, plus: true },
  { titulo: 'Ajuste de porciones y unidades', gratis: false, plus: true },
  { titulo: 'Lista de compras por pasillo', detalle: 'armada desde varias recetas', gratis: 'Simple', plus: true },
  { titulo: 'Recetas sin conexión', gratis: false, plus: true },
  { titulo: 'Ideas de recetas a tu hora', gratis: false, plus: true },
];

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
      modulo.configure({ apiKey: CLAVE! });
      purchases = modulo;
    } catch {
      return null;
    }
  }
  return purchases;
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
      anual: {
        id: 'anual',
        precio: anual.priceString,
        precioMensual: anual.pricePerMonthString ?? undefined,
        diasPrueba: 3,
      },
      mensual: { id: 'mensual', precio: actual.monthly.product.priceString, diasPrueba: 0 },
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
