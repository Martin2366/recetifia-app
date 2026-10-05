/** Etiquetas del catalogo de Descubrir. Modulo puro: lo usa tambien scripts/catalogo.ts. */

export type Etiqueta = { id: string; nombre: string; emoji: string };

/** Lista fija: la usan los chips y el etiquetado del catalogo. */
export const ETIQUETAS: Etiqueta[] = [
  { id: 'rapidas', nombre: 'Menos de 30 min', emoji: '⏱️' },
  { id: 'pollo', nombre: 'Pollo', emoji: '🍗' },
  { id: 'pastas', nombre: 'Pastas', emoji: '🍝' },
  { id: 'postres', nombre: 'Postres', emoji: '🍰' },
  { id: 'carnes', nombre: 'Carnes', emoji: '🥩' },
  { id: 'casera', nombre: 'Comida casera', emoji: '🍲' },
  { id: 'economico', nombre: 'Económico', emoji: '💸' },
  { id: 'ensaladas', nombre: 'Ensaladas', emoji: '🥗' },
  { id: 'pescados', nombre: 'Pescados', emoji: '🐟' },
  { id: 'vegetariano', nombre: 'Vegetariano', emoji: '🌱' },
  { id: 'desayunos', nombre: 'Desayunos', emoji: '🥞' },
  { id: 'compartir', nombre: 'Para compartir', emoji: '🍕' },
  { id: 'peruana', nombre: 'Peruana', emoji: '🇵🇪' },
  { id: 'mexicana', nombre: 'Mexicana', emoji: '🌮' },
];

export function etiqueta(id: string): Etiqueta | undefined {
  return ETIQUETAS.find((e) => e.id === id);
}
