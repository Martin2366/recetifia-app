import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { almacenSeguro } from './secure-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fallar aqui y en voz alta: sin esto la app arranca y falla mucho mas tarde,
  // con un error que no dice nada.
  throw new Error(
    'Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY.\n' +
      'Copia .env.example a .env y rellenalos con los datos de tu proyecto de Supabase.'
  );
}

/**
 * Ninguna consulta espera para siempre: con mala senal, una peticion colgada
 * dejaba la pantalla cargando sin fin. A los 20 s se corta y la app ofrece
 * reintentar (o guarda en el telefono, si era un guardado).
 */
const ESPERA_MAXIMA = 20_000;

function fetchConTiempo(entrada: RequestInfo | URL, opciones?: RequestInit) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), ESPERA_MAXIMA);
  // Si quien llama ya trae su propia senal de cancelacion, tambien se respeta
  opciones?.signal?.addEventListener?.('abort', () => control.abort());
  return fetch(entrada, { ...opciones, signal: control.signal }).finally(() => clearTimeout(reloj));
}

export const supabase = createClient(url, anonKey, {
  global: { fetch: fetchConTiempo },
  auth: {
    storage: almacenSeguro,
    autoRefreshToken: true,
    persistSession: true,
    // No hay redirecciones por URL en una app nativa.
    detectSessionInUrl: false,
  },
});

// Supabase solo renueva el token mientras la app esta en primer plano; si no se
// le avisa, sigue intentandolo en segundo plano y gasta bateria para nada.
AppState.addEventListener('change', (estado) => {
  if (estado === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
