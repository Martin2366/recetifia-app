import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { identificarCompras } from './compras';
import { limpiarLocales } from './guardado-local';
import { supabase } from './supabase';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

GoogleSignin.configure({
  webClientId,
  scopes: ['profile', 'email'],
  offlineAccess: false,
});

/** Cancelar el dialogo de Google no es un error: no hay que enseñar nada. */
export class InicioCancelado extends Error {
  constructor() {
    super('cancelado');
    this.name = 'InicioCancelado';
  }
}

/** La cuenta de Google elegida ya tiene recetas guardadas en Recetifia. */
export class CuentaEnUso extends Error {
  /** Se reutiliza para cambiar de cuenta sin volver a abrir el selector. */
  constructor(readonly token: string) {
    super('Esa cuenta de Google ya está en Recetifia.');
    this.name = 'CuentaEnUso';
  }
}

type Estado = {
  session: Session | null;
  cargando: boolean;
  /** Sesion sin cuenta: las recetas solo viven ligadas a este telefono. */
  anonima: boolean;
  entrarSinCuenta: () => Promise<void>;
  entrarConGoogle: () => Promise<void>;
  /** Liga Google a la sesion sin cuenta, sin perder nada de lo guardado. */
  respaldarConGoogle: () => Promise<void>;
  /** Olvida la sesion sin cuenta (y sus recetas) y entra con esa cuenta de Google. */
  cambiarACuentaDeGoogle: (token: string) => Promise<void>;
  borrarCuenta: () => Promise<void>;
  salir: () => Promise<void>;
};

const AuthContext = createContext<Estado | null>(null);

/** Abre el selector de cuentas de Google y devuelve el token de identidad. */
async function tokenDeGoogle(): Promise<string> {
  if (!webClientId) {
    throw new Error('Falta EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID en .env. Sin el, Google no puede firmar el token.');
  }
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const respuesta = await GoogleSignin.signIn();
    const idToken = respuesta.data?.idToken;
    if (!idToken) throw new Error('Google no devolvio un token de identidad.');
    return idToken;
  } catch (err) {
    if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) throw new InicioCancelado();
    throw err;
  }
}

async function cerrarGoogle() {
  // Si no, el proximo inicio no vuelve a preguntar la cuenta
  try {
    await GoogleSignin.signOut();
  } catch {
    // Que Google no cierre no invalida nada de lo nuestro.
  }
}

/** Borra el usuario actual y todo lo suyo en el servidor. */
async function borrarEnServidor() {
  const { error } = await supabase.functions.invoke('borrar-cuenta', { method: 'POST' });
  if (error) throw new Error('No pudimos borrar la cuenta. Revisa tu conexión e inténtalo de nuevo.');
}

/**
 * Una sesion guardada puede ser de una cuenta que ya no existe (se borro desde
 * otro telefono). Su token sigue pareciendo valido, pero nada se guardaria. Si
 * el servidor responde que el usuario no existe, se sale; sin red, no se toca.
 */
async function comprobarQueExiste() {
  const { error } = await supabase.auth.getUser();
  if (error && (error.status === 401 || error.status === 403 || error.code === 'user_not_found')) {
    await supabase.auth.signOut({ scope: 'local' });
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return;
      setSession(data.session);
      setCargando(false);
      if (data.session) comprobarQueExiste();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, nueva) => {
      setSession(nueva);
      setCargando(false);
    });

    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Plus sigue a la cuenta, no al telefono: RevenueCat usa el mismo id que Supabase
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!cargando) identificarCompras(userId);
  }, [userId, cargando]);

  const valor = useMemo<Estado>(
    () => ({
      session,
      cargando,
      anonima: Boolean(session?.user.is_anonymous),

      async entrarSinCuenta() {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) throw new Error('No pudimos entrar. Revisa tu conexión e inténtalo de nuevo.');
      },

      async entrarConGoogle() {
        const token = await tokenDeGoogle();
        const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token });
        if (error) throw error;
      },

      async respaldarConGoogle() {
        const token = await tokenDeGoogle();
        const { error } = await supabase.auth.linkIdentity({ provider: 'google', token });
        if (error) {
          if (error.code === 'identity_already_exists') throw new CuentaEnUso(token);
          await cerrarGoogle();
          throw error;
        }
        // El token viejo aun dice is_anonymous; uno nuevo ya trae el correo y el nombre
        await supabase.auth.refreshSession();
      },

      async cambiarACuentaDeGoogle(token) {
        // Lo de esta sesion sin cuenta se borra: no queda nada huerfano en el servidor
        await borrarEnServidor();
        await limpiarLocales();
        const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token });
        if (error) {
          // La sesion anterior ya no existe: se vuelve a la entrada, no a una app rota
          await supabase.auth.signOut({ scope: 'local' });
          await cerrarGoogle();
          throw error;
        }
      },

      async borrarCuenta() {
        await borrarEnServidor();
        await limpiarLocales();
        // El usuario ya no existe: basta con olvidar la sesion en este telefono
        await supabase.auth.signOut({ scope: 'local' });
        await cerrarGoogle();
      },

      async salir() {
        // Primero Supabase: si falla, el usuario sigue dentro y lo sabe.
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        await cerrarGoogle();
      },
    }),
    [session, cargando]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
