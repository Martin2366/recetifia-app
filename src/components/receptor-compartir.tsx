import { useRouter } from 'expo-router';
import { useIncomingShare } from 'expo-sharing';
import { useEffect } from 'react';

import { dejarFotos, prepararFotos } from '@/lib/fotos';
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
    // Una captura o foto compartida desde la galeria: se importa como foto
    const imagenes = sharedPayloads
      .filter((p) => p.shareType === 'image' || p.mimeType?.startsWith('image/'))
      .map((p) => p.value)
      .filter(Boolean);
    const url = sharedPayloads.map((p) => primeraUrl(p.value ?? '')).find(Boolean);
    clearSharedPayloads();
    if (imagenes.length) {
      if (ultimo && ultimo.url === imagenes[0] && Date.now() - ultimo.en < 10_000) return;
      ultimo = { url: imagenes[0], en: Date.now() };
      prepararFotos(imagenes).then((fotos) => {
        if (!fotos.length) return;
        dejarFotos(fotos);
        router.push({ pathname: '/importar/procesando', params: { fotos: '1' } });
      });
      return;
    }
    if (!url) return;
    if (ultimo && ultimo.url === url && Date.now() - ultimo.en < 10_000) return;
    ultimo = { url, en: Date.now() };
    router.push({ pathname: '/importar/procesando', params: { url } });
  }, [sharedPayloads, clearSharedPayloads, router]);

  return null;
}
