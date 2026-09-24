import { Linking } from 'react-native';

/** Paginas legales publicadas con GitHub Pages desde la carpeta docs/ del repo. */
const BASE = 'https://martin2366.github.io/recetifia-app';

export const LEGAL = {
  privacidad: `${BASE}/privacidad.html`,
  terminos: `${BASE}/terminos.html`,
  borrarCuenta: `${BASE}/borrar-cuenta.html`,
};

export function abrirLegal(pagina: keyof typeof LEGAL) {
  return Linking.openURL(LEGAL[pagina]);
}
