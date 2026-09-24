import type { BorradorReceta } from './tipos';

/**
 * Borrador que una pantalla de importacion le pasa al editor. Va en memoria
 * solo durante el salto de pantalla: una receta entera no cabe comoda en los
 * parametros de la ruta. En cuanto el editor lo recibe, lo guarda en el
 * telefono (guardado-local.ts), asi que cerrar la app no lo pierde.
 */
let pendiente: BorradorReceta | null = null;

export function dejarBorrador(borrador: BorradorReceta) {
  pendiente = borrador;
}

/** Lo entrega una sola vez. */
export function tomarBorrador(): BorradorReceta | null {
  const b = pendiente;
  pendiente = null;
  return b;
}
