// Genera todos los PNG de marca a partir del logo vectorial.
//
//   node scripts/generar-logos.mjs
//
// El SVG de origen viene con relleno negro; aqui se pinta con el color de marca.
// Se usan PNG y no SVG en la app porque renderizar SVG exigiria react-native-svg,
// un modulo nativo que obliga a recompilar el development build.

import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const PRIMARIO = '#FF6B3A';
const ORIGEN = 'assets/images/logov1svg.svg';

const svg = await readFile(ORIGEN, 'utf8');
const pintado = (color) => Buffer.from(svg.replace(/fill="#000000"/g, `fill="${color}"`));

/** Logo recortado a su contenido, sin margen, con fondo transparente. */
async function logo(color, ancho) {
  return sharp(pintado(color), { density: 110, limitInputPixels: false })
    .trim()
    .resize({ width: ancho, fit: 'inside' })
    .png()
    .toBuffer();
}

/** Coloca el logo centrado en un lienzo cuadrado, ocupando una fraccion del lado. */
async function enLienzo(color, lado, fraccion, fondo) {
  const marca = await logo(color, Math.round(lado * fraccion));
  return sharp({
    create: { width: lado, height: lado, channels: 4, background: fondo },
  })
    .composite([{ input: marca, gravity: 'center' }])
    .png()
    .toBuffer();
}

const TRANSPARENTE = { r: 0, g: 0, b: 0, alpha: 0 };
const BLANCO = { r: 255, g: 255, b: 255, alpha: 1 };

const salidas = {
  // Uso dentro de la app
  'assets/images/logo.png': await logo(PRIMARIO, 1024),
  'assets/images/logo-blanco.png': await logo('#FFFFFF', 1024),

  // Icono de la app: logo naranja sobre blanco
  'assets/images/icon.png': await enLienzo(PRIMARIO, 1024, 0.62, BLANCO),

  // Icono adaptativo de Android. El sistema recorta la capa de primer plano
  // con mascaras distintas segun el fabricante: solo el 66% central es seguro.
  'assets/images/android-icon-foreground.png': await enLienzo(PRIMARIO, 1024, 0.5, TRANSPARENTE),
  'assets/images/android-icon-monochrome.png': await enLienzo('#000000', 1024, 0.5, TRANSPARENTE),

  // Splash nativo: se muestra centrado sobre el color de fondo de app.json
  'assets/images/splash-icon.png': await logo('#FFFFFF', 512),
};

for (const [ruta, buffer] of Object.entries(salidas)) {
  await sharp(buffer).toFile(ruta);
  const { width, height } = await sharp(buffer).metadata();
  console.log(`${ruta.padEnd(46)} ${width}x${height}`);
}
