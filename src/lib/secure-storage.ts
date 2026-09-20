import * as SecureStore from 'expo-secure-store';

/**
 * Adaptador de almacenamiento para la sesion de Supabase.
 *
 * SecureStore no admite valores de mas de 2048 bytes y una sesion de Supabase
 * los supera con facilidad: el usuario entra, la sesion se guarda a medias y
 * aparece desconectado al reabrir la app, sin ningun error visible. Por eso
 * partimos el valor en trozos y guardamos aparte cuantos son.
 */

const TAMANO_TROZO = 1536; // margen holgado bajo el limite de 2048 bytes

const claveContador = (clave: string) => `${clave}__n`;
const claveTrozo = (clave: string, i: number) => `${clave}__${i}`;

async function borrarTrozos(clave: string, cuantos: number) {
  const borrados = [];
  for (let i = 0; i < cuantos; i++) borrados.push(SecureStore.deleteItemAsync(claveTrozo(clave, i)));
  await Promise.all(borrados);
}

export const almacenSeguro = {
  async getItem(clave: string): Promise<string | null> {
    try {
      const contador = await SecureStore.getItemAsync(claveContador(clave));
      if (contador == null) {
        // Valor guardado antes de trocear, o valor corto
        return await SecureStore.getItemAsync(clave);
      }
      const total = Number(contador);
      const trozos: string[] = [];
      for (let i = 0; i < total; i++) {
        const trozo = await SecureStore.getItemAsync(claveTrozo(clave, i));
        if (trozo == null) return null; // falta un trozo: la sesion no sirve
        trozos.push(trozo);
      }
      return trozos.join('');
    } catch {
      return null;
    }
  },

  async setItem(clave: string, valor: string): Promise<void> {
    try {
      const anterior = Number((await SecureStore.getItemAsync(claveContador(clave))) ?? 0);
      if (anterior) await borrarTrozos(clave, anterior);
      await SecureStore.deleteItemAsync(clave);

      const trozos: string[] = [];
      for (let i = 0; i < valor.length; i += TAMANO_TROZO) {
        trozos.push(valor.slice(i, i + TAMANO_TROZO));
      }
      for (let i = 0; i < trozos.length; i++) {
        await SecureStore.setItemAsync(claveTrozo(clave, i), trozos[i]);
      }
      await SecureStore.setItemAsync(claveContador(clave), String(trozos.length));
    } catch {
      // Sin almacenamiento seguro la sesion no persiste, pero la app sigue viva.
    }
  },

  async removeItem(clave: string): Promise<void> {
    try {
      const total = Number((await SecureStore.getItemAsync(claveContador(clave))) ?? 0);
      if (total) await borrarTrozos(clave, total);
      await SecureStore.deleteItemAsync(claveContador(clave));
      await SecureStore.deleteItemAsync(clave);
    } catch {
      // nada que hacer
    }
  },
};
