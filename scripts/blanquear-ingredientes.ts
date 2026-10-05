/**
 * Lleva a blanco puro el fondo casi blanco de las fotos de ingredientes, para
 * que no se note un cuadrado gris sobre la hoja blanca. Solo toca los pixeles
 * muy claros y con transicion suave, asi los bordes no quedan dentados.
 *
 *   npx tsx scripts/blanquear-ingredientes.ts
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

// En Windows sharp deja el archivo abierto si lee desde la ruta: se lee a memoria
sharp.cache(false);

const DIR = resolve(__dirname, '../assets/images/ingredientes');
const DESDE = 228; // por debajo no se toca
const HASTA = 246; // desde aqui, blanco puro

async function main() {
  for (const archivo of readdirSync(DIR).filter((f) => f.endsWith('.webp'))) {
    const ruta = resolve(DIR, archivo);
    const { data, info } = await sharp(readFileSync(ruta)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 3) {
      const m = Math.min(data[i], data[i + 1], data[i + 2]);
      if (m < DESDE) continue;
      const t = Math.min(1, (m - DESDE) / (HASTA - DESDE));
      for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] + (255 - data[i + c]) * t);
    }
    const salida = await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } }).webp({ quality: 82 }).toBuffer();
    writeFileSync(ruta, salida);
  }
  console.log('listo');
}

main();
