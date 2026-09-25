import { useRouter } from 'expo-router';
import { useIncomingShare } from 'expo-sharing';
import { useEffect } from 'react';

import { primeraUrl } from '@/lib/importacion';

// Lo compartido se limpia de forma asincrona: si la pantalla se redibuja antes,
// llega otra vez el mismo enlace. Se recuerda el ultimo para no abrir (ni
// cobrar) dos importaciones iguales.
let ultimo: { url: string; en: number } | null = null;

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
    if (!url) return;
    if (ultimo && ultimo.url === url && Date.now() - ultimo.en < 10_000) return;
    ultimo = { url, en: Date.now() };
    router.push({ pathname: '/importar/procesando', params: { url } });
  }, [sharedPayloads, clearSharedPayloads, router]);

  return null;
}
