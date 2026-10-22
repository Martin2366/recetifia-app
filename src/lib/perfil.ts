import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

/** Perfil propio: nombre, foto y los numeros que se muestran en la pestana Perfil. */

export const clavePerfil = ['perfil'] as const;

export type MiPerfil = { avatar: string | null; recetas: number };

export function useMiPerfil() {
  return useQuery({
    queryKey: clavePerfil,
    queryFn: async (): Promise<MiPerfil> => {
      const { data: sesion } = await supabase.auth.getSession();
      const usuario = sesion.session?.user;
      if (!usuario) return { avatar: null, recetas: 0 };
      const [perfil, recetas] = await Promise.all([
        supabase.from('profiles').select('avatar_url').eq('id', usuario.id).maybeSingle(),
        supabase.from('recipes').select('id', { count: 'exact', head: true }),
      ]);
      // Sin foto propia, la de Google si entro con Google
      const deGoogle = (usuario.user_metadata?.avatar_url ?? usuario.user_metadata?.picture) as string | undefined;
      return { avatar: perfil.data?.avatar_url ?? deGoogle ?? null, recetas: recetas.count ?? 0 };
    },
  });
}

const LADO = 400;

function bytesDe(base64: string): Uint8Array {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/** Elige una foto cuadrada, la achica y la deja como foto de perfil. False si se cancelo. */
export function useCambiarAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<boolean> => {
      const elegida = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
      if (elegida.canceled || !elegida.assets[0]) return false;

      const ctx = ImageManipulator.manipulate(elegida.assets[0].uri);
      ctx.resize({ width: LADO, height: LADO });
      const imagen = await (await ctx.renderAsync()).saveAsync({ compress: 0.8, format: SaveFormat.JPEG, base64: true });
      if (!imagen.base64) throw new Error('No pudimos leer la foto.');

      const { data: sesion } = await supabase.auth.getSession();
      const uid = sesion.session?.user.id;
      if (!uid) throw new Error('Sin sesión.');
      const carpeta = `avatares/${uid}`;
      const ruta = `${carpeta}/${Date.now()}.jpg`;

      const subida = await supabase.storage.from('recetas').upload(ruta, bytesDe(imagen.base64), { contentType: 'image/jpeg' });
      if (subida.error) throw subida.error;
      const url = supabase.storage.from('recetas').getPublicUrl(ruta).data.publicUrl;

      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', uid);
      if (error) throw error;

      // Las fotos anteriores ya no se usan
      const { data: viejas } = await supabase.storage.from('recetas').list(carpeta);
      const sobran = (viejas ?? []).map((f) => `${carpeta}/${f.name}`).filter((r) => r !== ruta);
      if (sobran.length) await supabase.storage.from('recetas').remove(sobran);
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: clavePerfil }),
  });
}
