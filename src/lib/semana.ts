/**
 * Fechas del plan semanal. La semana va de lunes a domingo y las fechas viajan
 * como 'YYYY-MM-DD' en hora local, igual que la columna `day` (date).
 */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
/** Iniciales de lunes a domingo; el miércoles es X, como en los calendarios de habla hispana. */
export const INICIALES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function dos(n: number) {
  return String(n).padStart(2, '0');
}

export function aFecha(d: Date): string {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** Mediodia local: sumar dias nunca cae en otra fecha por un cambio de horario. */
export function deFecha(f: string): Date {
  const [a, m, d] = f.split('-').map(Number);
  return new Date(a, m - 1, d, 12);
}

export function sumarDias(f: string, n: number): string {
  const d = deFecha(f);
  d.setDate(d.getDate() + n);
  return aFecha(d);
}

export function hoy(): string {
  return aFecha(new Date());
}

/** Lunes de la semana de esa fecha (el domingo pertenece a la semana que termina). */
export function lunesDe(f: string): string {
  const dia = deFecha(f).getDay();
  return sumarDias(f, dia === 0 ? -6 : 1 - dia);
}

export function diasDeSemana(lunes: string): string[] {
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

/** "5 – 11 oct", "28 sept – 4 oct" o "29 dic 2026 – 4 ene 2027". */
export function rangoSemana(lunes: string): string {
  const a = deFecha(lunes);
  const b = deFecha(sumarDias(lunes, 6));
  if (a.getFullYear() !== b.getFullYear()) {
    return `${a.getDate()} ${MESES[a.getMonth()]} ${a.getFullYear()} – ${b.getDate()} ${MESES[b.getMonth()]} ${b.getFullYear()}`;
  }
  if (a.getMonth() !== b.getMonth()) return `${a.getDate()} ${MESES[a.getMonth()]} – ${b.getDate()} ${MESES[b.getMonth()]}`;
  return `${a.getDate()} – ${b.getDate()} ${MESES[b.getMonth()]}`;
}

/** "Lunes 5". */
export function nombreDia(f: string): string {
  const d = deFecha(f);
  const n = DIAS[d.getDay()];
  return `${n[0].toUpperCase()}${n.slice(1)} ${d.getDate()}`;
}

/** "lunes 5 oct", para frases como "Cena · lunes 5 oct". */
export function nombreDiaCorto(f: string): string {
  const d = deFecha(f);
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
}

/** "Hoy", "Mañana" o nada. */
export function etiquetaRelativa(f: string, referencia = hoy()): string | null {
  if (f === referencia) return 'Hoy';
  if (f === sumarDias(referencia, 1)) return 'Mañana';
  return null;
}

