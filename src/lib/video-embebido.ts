/**
 * El video original de una receta, con el reproductor oficial de su red para
 * verlo dentro de la app. Nunca se copia ni se guarda el video: se muestra
 * desde la red, con su creador. Modulo puro (tiene tests).
 */

export type Red = 'YouTube' | 'TikTok' | 'Instagram' | 'Facebook';

export type VideoOriginal = {
  red: Red;
  /** Para abrirlo en la app de la red si el reproductor no carga. */
  original: string;
  /** Reproductor embebido; null si esa URL no se puede embeber (enlaces cortos). */
  embebido: string | null;
  /** Reels, Shorts y TikTok son verticales; YouTube normal es 16:9. */
  vertical: boolean;
};

function comoUrl(texto: string): URL | null {
  try {
    return new URL(texto.startsWith('http') ? texto : `https://${texto}`);
  } catch {
    return null;
  }
}

export function videoOriginal(sourceUrl: string | null | undefined): VideoOriginal | null {
  if (!sourceUrl) return null;
  const u = comoUrl(sourceUrl.trim());
  if (!u) return null;
  const host = u.hostname.replace(/^(www\.|m\.|mobile\.)/, '');
  const original = u.toString();

  if (host === 'youtu.be' || host.endsWith('youtube.com')) {
    const corto = u.pathname.match(/^\/shorts\/([\w-]{6,})/);
    const id =
      host === 'youtu.be'
        ? u.pathname.slice(1).split('/')[0]
        : (corto?.[1] ?? u.searchParams.get('v') ?? u.pathname.match(/^\/(?:embed|live)\/([\w-]{6,})/)?.[1] ?? '');
    return {
      red: 'YouTube',
      original,
      embebido: /^[\w-]{6,}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0&modestbranding=1` : null,
      vertical: Boolean(corto),
    };
  }

  if (host.endsWith('tiktok.com')) {
    const id = u.pathname.match(/\/video\/(\d{6,})/)?.[1];
    return {
      red: 'TikTok',
      original,
      // Los enlaces cortos (vm.tiktok.com) no traen el id: se abren en TikTok
      embebido: id ? `https://www.tiktok.com/player/v1/${id}?description=0&music_info=0&rel=0` : null,
      vertical: true,
    };
  }

  if (host.endsWith('instagram.com')) {
    const codigo = u.pathname.match(/^\/(?:reel|reels|p|tv)\/([\w-]{5,})/)?.[1];
    return {
      red: 'Instagram',
      original,
      embebido: codigo ? `https://www.instagram.com/reel/${codigo}/embed/` : null,
      vertical: true,
    };
  }

  if (host.endsWith('facebook.com') || host === 'fb.watch') {
    // Solo las direcciones completas de un video; las de "compartir" no embeben
    const esVideo = /\/(videos|reel|watch)\b/.test(u.pathname) || u.searchParams.has('v');
    return {
      red: 'Facebook',
      original,
      embebido: esVideo && !u.pathname.startsWith('/share') ? `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(original)}&show_text=false` : null,
      vertical: /\/reel\b/.test(u.pathname),
    };
  }

  return null;
}
