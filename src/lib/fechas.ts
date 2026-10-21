/**
 * La biblioteca agrupada por el dia en que se guardo cada receta, para que no
 * se pierdan entre muchas importadas. Modulo puro (tiene tests).
 */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "2026-10-21", en hora local. */
function diaLocal(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

/** "Hoy, 21 de octubre de 2026", "Ayer, 20 de octubre de 2026" o "3 de mayo de 2026". */
export function textoDia(iso: string, ahora = new Date()): string {
  const f = new Date(iso);
  const largo = `${f.getDate()} de ${MESES[f.getMonth()]} de ${f.getFullYear()}`;
  const ayer = new Date(ahora);
  ayer.setDate(ahora.getDate() - 1);
  if (diaLocal(f) === diaLocal(ahora)) return `Hoy, ${largo}`;
  if (diaLocal(f) === diaLocal(ayer)) return `Ayer, ${largo}`;
  return largo;
}

export type FilaBiblioteca<T> = { tipo: 'fecha'; clave: string; texto: string } | { tipo: 'recetas'; clave: string; recetas: T[] };

/**
 * Recetas (ya ordenadas de la mas nueva a la mas vieja) en filas de `columnas`,
 * con un encabezado cada vez que cambia el dia.
 */
export function agruparPorDia<T extends { id: string; created_at: string }>(recetas: T[], columnas = 2, ahora = new Date()): FilaBiblioteca<T>[] {
  const filas: FilaBiblioteca<T>[] = [];
  let dia = '';
  let fila: T[] = [];
  const cerrarFila = () => {
    if (fila.length) filas.push({ tipo: 'recetas', clave: fila.map((r) => r.id).join('|'), recetas: fila });
    fila = [];
  };
  for (const r of recetas) {
    const d = diaLocal(new Date(r.created_at));
    if (d !== dia) {
      cerrarFila();
      dia = d;
      filas.push({ tipo: 'fecha', clave: `fecha-${d}`, texto: textoDia(r.created_at, ahora) });
    }
    fila.push(r);
    if (fila.length === columnas) cerrarFila();
  }
  cerrarFila();
  return filas;
}
