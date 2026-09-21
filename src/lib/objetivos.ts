/**
 * Objetivos que el usuario marca en el onboarding. Solo se ofrecen los que v1
 * cumple de verdad: nada de "comer sano" (no hay nutricion) ni de "planificar
 * comidas" (el plan semanal esta fuera de v1).
 */

export type IdObjetivo = 'guardar' | 'organizar' | 'cocinar-mas' | 'ahorrar' | 'aprender' | 'probar';

export type Objetivo = {
  id: IdObjetivo;
  emoji: string;
  nombre: string;
  /** Lo que se le dice en la pantalla siguiente si es su objetivo principal. */
  respuesta: string;
};

export const OBJETIVOS: Objetivo[] = [
  {
    id: 'guardar',
    emoji: '📲',
    nombre: 'No perder más recetas de redes',
    respuesta:
      'Cada receta que ves en Instagram, TikTok o YouTube queda guardada con un toque. Se acabaron las capturas perdidas en la galería.',
  },
  {
    id: 'organizar',
    emoji: '🗂️',
    nombre: 'Organizar mis recetas',
    respuesta: 'Todas tus recetas en un solo lugar, ordenadas en colecciones y fáciles de encontrar cuando las necesites.',
  },
  {
    id: 'cocinar-mas',
    emoji: '🏠',
    nombre: 'Cocinar más en casa',
    respuesta: 'Con los ingredientes claros y los pasos en orden, cocinar en casa se vuelve más fácil y más seguido.',
  },
  {
    id: 'ahorrar',
    emoji: '💰',
    nombre: 'Ahorrar dinero',
    respuesta: 'Arma tu lista de compras desde tus recetas y lleva solo lo que vas a usar. Menos desperdicio, más ahorro.',
  },
  {
    id: 'aprender',
    emoji: '🔪',
    nombre: 'Mejorar en la cocina',
    respuesta: 'El modo cocina te guía paso a paso, con la pantalla siempre encendida, para que te animes con lo que sea.',
  },
  {
    id: 'probar',
    emoji: '🌮',
    nombre: 'Probar recetas nuevas',
    respuesta: 'Ese plato que se te antojó en un reel puede ser tu cena de hoy. Guárdalo y pruébalo cuando quieras.',
  },
];

export function buscarObjetivo(id: string | undefined): Objetivo | undefined {
  return OBJETIVOS.find((o) => o.id === id);
}
