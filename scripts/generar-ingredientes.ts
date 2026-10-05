/**
 * Genera las fotos de los ingredientes del filtro de Descubrir con el modelo
 * de imagenes de Gemini, todas en el mismo estilo, y las deja como WebP
 * chicos en assets/images/ingredientes/<id>.webp.
 *
 *   npx tsx scripts/generar-ingredientes.ts                 los que falten
 *   npx tsx scripts/generar-ingredientes.ts pollo huevo     solo esos (rehace)
 *   npx tsx scripts/generar-ingredientes.ts --mapa          solo rehace el mapa
 *
 * Al terminar escribe src/components/descubrir/fotos-ingredientes.ts: React
 * Native necesita un require fijo por imagen.
 *
 * Fondo blanco puro: la hoja donde se muestran tambien es blanca.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

import { INGREDIENTES } from '../src/lib/filtros';

const RAIZ = resolve(__dirname, '..');
const DESTINO = resolve(RAIZ, 'assets/images/ingredientes');
const MODELO = 'gemini-3.1-flash-image';

const clave = readFileSync(resolve(RAIZ, 'spikes/extraction/.env'), 'utf8').match(/^GEMINI_API_KEY=(.*)$/m)?.[1].trim().replace(/^["']|["']$/g, '');

/** Que dibujar, en ingles (el modelo es mas preciso), tal como se compra en LATAM. */
const QUE: Record<string, string> = {
  pollo: 'a whole raw chicken',
  huevo: 'one brown chicken egg',
  pasta: 'a small pile of dry penne pasta',
  arroz: 'a small mound of uncooked white rice',
  'carne-molida': 'a small block of raw ground beef',
  vacuno: 'a raw beef steak',
  cerdo: 'a raw pork loin piece',
  pescado: 'a raw white fish fillet',
  atun: 'an open can of tuna',
  camaron: 'three raw pink shrimp',
  papa: 'two potatoes',
  tomate: 'one ripe red tomato',
  cebolla: 'one brown onion',
  palta: 'one avocado cut in half with the pit',
  choclo: 'one ear of yellow corn with some husk',
  zapallo: 'a wedge of orange pumpkin (squash)',
  zanahoria: 'two carrots with green tops',
  pimenton: 'one red bell pepper',
  brocoli: 'one broccoli floret',
  espinaca: 'a small bunch of fresh spinach leaves',
  champinon: 'three white button mushrooms',
  porotos: 'a small pile of dry red beans',
  lentejas: 'a small pile of dry brown lentils',
  quinoa: 'a small pile of uncooked quinoa',
  avena: 'a small pile of rolled oats',
  queso: 'a wedge of yellow cheese',
  leche: 'a glass of milk',
  platano: 'a small bunch of three bananas',
  manzana: 'one red apple',
  limon: 'one lemon and a lemon half',
  chocolate: 'a few squares of dark chocolate bar',
  tortilla: 'a small stack of flour tortillas',
  pavo: 'a raw turkey breast',
  cordero: 'raw lamb chops',
  tocino: 'a few strips of raw bacon',
  jamon: 'a few folded slices of ham',
  chorizo: 'two red chorizo sausages',
  salchicha: 'three frankfurter hot dog sausages',
  mariscos: 'a few mussels and clams, some open',
  tofu: 'a block of white tofu with one cube cut',
  cebollin: 'a small bunch of green onions (scallions)',
  ajo: 'one garlic bulb and two cloves',
  aji: 'two red chili peppers and one green jalapeno',
  coliflor: 'one cauliflower head',
  lechuga: 'one green lettuce head',
  repollo: 'half a green cabbage',
  pepino: 'one cucumber and a few slices',
  'zapallo-italiano': 'two green zucchini',
  berenjena: 'one eggplant',
  apio: 'a few celery stalks with leaves',
  betarraga: 'two beetroots with a cut half',
  arvejas: 'an open green pea pod with peas',
  'poroto-verde': 'a small bunch of green beans',
  camote: 'two sweet potatoes, one cut showing orange flesh',
  yuca: 'one cassava root with a cut end',
  cilantro: 'a small bunch of fresh cilantro',
  perejil: 'a small bunch of fresh flat-leaf parsley',
  albahaca: 'a small sprig of fresh basil',
  jengibre: 'a piece of fresh ginger root',
  naranja: 'one orange and an orange half',
  frutilla: 'three fresh strawberries',
  arandanos: 'a small pile of blueberries and raspberries',
  pina: 'one pineapple',
  mango: 'one ripe mango',
  durazno: 'two peaches',
  coco: 'a coconut cut in half',
  crema: 'a small glass jar of heavy cream',
  yogur: 'a small glass of plain white yogurt',
  mantequilla: 'a block of butter with a slice cut',
  garbanzos: 'a small pile of dry chickpeas',
  harina: 'a small mound of white flour',
  pan: 'two crusty bread rolls',
  'frutos-secos': 'a small pile of mixed nuts: walnuts, almonds and peanuts',
  aceitunas: 'a small pile of green and black olives',
  miel: 'a small glass jar of honey with a wooden dipper',
};

const ESTILO =
  'Professional studio product photo, isolated on a pure white background (#FFFFFF), centered, filling about 70% of the frame, ' +
  'slight three-quarter top-down angle, soft natural light, a very soft subtle shadow under it, vibrant natural colors, ' +
  'photorealistic, no plate, no bowl unless needed, no text, no props, square composition.';

async function generar(id: string): Promise<void> {
  const que = QUE[id];
  if (!que) throw new Error(`sin descripcion para ${id}`);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${clave}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${que}. ${ESTILO}` }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } },
    }),
  });
  const json = await res.json();
  const parte = json?.candidates?.[0]?.content?.parts?.find((p: { inlineData?: { data: string } }) => p.inlineData);
  if (!parte) throw new Error(`${id}: ${JSON.stringify(json).slice(0, 300)}`);
  const imagen = sharp(Buffer.from(parte.inlineData.data, 'base64')).resize(256, 256, { fit: 'cover' }).flatten({ background: '#FFFFFF' });
  // A veces el "blanco" sale gris claro: se aclara todo hasta que la esquina sea blanca pura
  // (stats() mide la imagen entera aunque se recorte: se leen los pixeles a mano)
  const { data, info } = await imagen.clone().raw().toBuffer({ resolveWithObject: true });
  let suma = 0;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) for (let c = 0; c < 3; c++) suma += data[(y * info.width + x) * info.channels + c];
  const brillo = suma / (8 * 8 * 3);
  const factor = brillo > 200 && brillo < 254 ? 255 / brillo : 1;
  await imagen.linear(factor, 0).webp({ quality: 82 }).toFile(resolve(DESTINO, `${id}.webp`));
  console.log(`✓ ${id}`);
}

function escribirMapa() {
  const con = INGREDIENTES.map((i) => i.id).filter((id) => existsSync(resolve(DESTINO, `${id}.webp`)));
  const lineas = con.map((id) => `  '${id}': require('@/assets/images/ingredientes/${id}.webp'),`);
  writeFileSync(
    resolve(RAIZ, 'src/components/descubrir/fotos-ingredientes.ts'),
    '// Generado por scripts/generar-ingredientes.ts: no editar a mano.\n\n' +
      '/* eslint-disable @typescript-eslint/no-require-imports */\n' +
      `export const FOTOS_INGREDIENTES: Record<string, number> = {\n${lineas.join('\n')}\n};\n`
  );
  console.log(`mapa: ${con.length} de ${INGREDIENTES.length} con foto`);
}

async function main() {
  mkdirSync(DESTINO, { recursive: true });
  if (process.argv.includes('--mapa')) return escribirMapa();
  const pedidos = process.argv.slice(2);
  const ids = pedidos.length ? pedidos : INGREDIENTES.map((i) => i.id).filter((id) => !existsSync(resolve(DESTINO, `${id}.webp`)));
  // De a 4 a la vez: rapido sin chocar con el limite de la API
  for (let i = 0; i < ids.length; i += 4) {
    await Promise.all(ids.slice(i, i + 4).map((id) => generar(id).catch((e) => console.warn(`✗ ${(e as Error).message}`))));
  }
  escribirMapa();
}

main();
