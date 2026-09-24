import { useRouter } from 'expo-router';
import { useIncomingShare } from 'expo-sharing';
import { useEffect } from 'react';

import { primeraUrl } from '@/lib/importacion';

/**
 * Recibe lo que el usuario comparte a Recetifia desde otra app (el reel de
 * Instagram, el TikTok, la web) y abre la importacion. Va dentro de las
 * pestanas: si llega sin sesion, espera a que el usuario entre.
 */
export function ReceptorCompartir() {
  const router = useRouter();
  const { sharedPayloads, clearSharedPayloads } = useIncomingShare();

  useEffect(() => {
    if (!sharedPayloads.length) return;
    const url = sharedPayloads.map((p) => primeraUrl(p.value ?? '')).find(Boolean);
    clearSharedPayloads();
    if (url) router.push({ pathname: '/importar/procesando', params: { url } });
  }, [sharedPayloads, clearSharedPayloads, router]);

  return null;
}
