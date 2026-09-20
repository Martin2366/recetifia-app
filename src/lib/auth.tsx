import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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

type Estado = {
  session: Session | null;
  cargando: boolean;
  entrarConGoogle: () => Promise<void>;
  salir: () => Promise<void>;
};

const AuthContext = createContext<Estado | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return;
      setSession(data.session);
      setCargando(false);
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

  const valor = useMemo<Estado>(
    () => ({
      session,
      cargando,

      async entrarConGoogle() {
        if (!webClientId) {
          throw new Error(
            'Falta EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID en .env. Sin el, Google no puede firmar el token.'
          );
        }

        try {
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
          const respuesta = await GoogleSignin.signIn();
          const idToken = respuesta.data?.idToken;
          if (!idToken) throw new Error('Google no devolvio un token de identidad.');

          const { error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: idToken,
          });
          if (error) throw error;
        } catch (err) {
          if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
            throw new InicioCancelado();
          }
          throw err;
        }
      },

      async salir() {
        // Primero Supabase: si falla, el usuario sigue dentro y lo sabe.
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        // Cerrar tambien en Google, o el proximo inicio no preguntara la cuenta.
        try {
          await GoogleSignin.signOut();
        } catch {
          // Que Google no cierre no invalida el cierre de sesion de la app.
        }
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
