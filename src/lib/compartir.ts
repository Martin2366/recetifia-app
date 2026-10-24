import { Share } from 'react-native';

/**
 * Compartir una receta como texto (WhatsApp, mensajes, notas…): se lee
 * completa sin tener la app, y al final invita a guardarla en Recetifia con un
 * enlace marcado, para saber en Play Console cuantas instalaciones trae.
 */

const ENLACE_APP =
  'https://play.google.com/store/apps/details?id=app.recetifia&referrer=utm_source%3Dcompartir%26utm_medium%3Dapp%26utm_campaign%3Dreceta';

export type RecetaParaCompartir = {
  titulo: string;
  ingredientes: string[];
  pasos: string[];
  porciones?: number | null;
  fuente?: string | null;
};

export function textoParaCompartir(r: RecetaParaCompartir): string {
  const partes = [`🍳 ${r.titulo}`];
  if (r.porciones) partes.push(`Para ${r.porciones} ${r.porciones === 1 ? 'persona' : 'personas'}`);
  if (r.ingredientes.length) partes.push(`\n🛒 Ingredientes\n${r.ingredientes.map((i) => `• ${i}`).join('\n')}`);
  if (r.pasos.length) partes.push(`\n👩‍🍳 Preparación\n${r.pasos.map((p, k) => `${k + 1}. ${p}`).join('\n')}`);
  if (r.fuente) partes.push(`\nReceta original: ${r.fuente}`);
  partes.push(`\nGuárdala y cocínala paso a paso con Recetifia 👉 ${ENLACE_APP}`);
  return partes.join('\n');
}

/** Abre el menu de compartir del telefono. Cancelarlo no es un error. */
export async function compartirReceta(r: RecetaParaCompartir) {
  try {
    await Share.share({ title: r.titulo, message: textoParaCompartir(r) });
  } catch {
    // Sin menu de compartir (o se cerro): no hay nada que avisar
  }
}
