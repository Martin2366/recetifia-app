/**
 * Escalado de cantidades al cambiar las porciones.
 *
 * Esto se ve en cada receta y un fallo aqui arruina la comida sin dar la cara,
 * asi que va aparte y con tests.
 */

const FRACCIONES: [number, string][] = [
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [1 / 2, '½'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
];

/**
 * Margen para dar por buena una fraccion. Ajustado a 0,02 a proposito: con 0,04
 * un 1,7 se convertia en 1⅔, que es reescribir la cantidad del creador con un
 * 5 % de error. Mejor mostrar 1,7 que mentir con una fraccion bonita.
 */
const TOLERANCIA = 0.02;

/** Unidades donde un decimal largo no aporta nada: nadie pesa 133,333 g. */
const UNIDADES_ENTERAS = new Set(['g', 'gr', 'gramo', 'gramos', 'ml', 'kcal']);

export function escalarCantidad(
  cantidad: number | null | undefined,
  porcionesOriginales: number | null | undefined,
  porcionesDeseadas: number | null | undefined
): number | null {
  if (cantidad == null || !Number.isFinite(cantidad)) return null;
  if (!porcionesOriginales || !porcionesDeseadas) return cantidad;
  if (porcionesOriginales <= 0 || porcionesDeseadas <= 0) return cantidad;
  return (cantidad * porcionesDeseadas) / porcionesOriginales;
}

/**
 * Formatea para una cocina, no para una hoja de calculo: fracciones cuando las
 * hay, enteros cuando la unidad lo pide, y como mucho un decimal.
 */
export function formatearCantidad(cantidad: number | null | undefined, unidad?: string | null): string {
  if (cantidad == null || !Number.isFinite(cantidad)) return '';

  const u = (unidad ?? '').trim().toLowerCase();

  if (UNIDADES_ENTERAS.has(u)) {
    return String(cantidad >= 10 ? Math.round(cantidad) : Math.round(cantidad * 10) / 10);
  }

  const entero = Math.floor(cantidad);
  const resto = cantidad - entero;

  if (resto < TOLERANCIA) return String(entero);

  for (const [valor, simbolo] of FRACCIONES) {
    if (Math.abs(resto - valor) < TOLERANCIA) {
      return entero > 0 ? `${entero}${simbolo}` : simbolo;
    }
  }

  // Sin fraccion limpia: un decimal basta para cocinar.
  const redondeado = Math.round(cantidad * 10) / 10;
  return String(Number.isInteger(redondeado) ? redondeado : redondeado.toFixed(1));
}

/**
 * Texto final del ingrediente ya escalado.
 * Si no se pudo parsear la cantidad, se devuelve el texto original tal cual:
 * mas vale mostrar lo que dijo el creador que una linea inventada.
 */
export function textoIngredienteEscalado(
  ingrediente: { raw_text: string; quantity: number | null; unit: string | null; name_normalized: string | null },
  porcionesOriginales: number | null | undefined,
  porcionesDeseadas: number | null | undefined
): string {
  if (ingrediente.quantity == null) return ingrediente.raw_text;

  const escalada = escalarCantidad(ingrediente.quantity, porcionesOriginales, porcionesDeseadas);
  const cantidad = formatearCantidad(escalada, ingrediente.unit);
  if (!cantidad) return ingrediente.raw_text;

  const nombre = ingrediente.name_normalized?.trim();
  const unidad = ingrediente.unit?.trim();

  if (!nombre) return ingrediente.raw_text;
  return [cantidad, unidad, nombre].filter(Boolean).join(' ');
}
