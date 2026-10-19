import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { videoOriginal } from './video-embebido';

describe('videoOriginal', () => {
  it('YouTube normal, Shorts y youtu.be', () => {
    assert.deepEqual(videoOriginal('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.embebido, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0&modestbranding=1');
    const corto = videoOriginal('https://youtube.com/shorts/5_SjyqGF6Yo');
    assert.equal(corto?.vertical, true);
    assert.match(corto?.embebido ?? '', /embed\/5_SjyqGF6Yo/);
    assert.match(videoOriginal('https://youtu.be/abcdefg123')?.embebido ?? '', /embed\/abcdefg123/);
  });

  it('TikTok con id; los enlaces cortos solo se abren afuera', () => {
    const t = videoOriginal('https://www.tiktok.com/@cocinacesar/video/7571550832114666760?u_code=x');
    assert.equal(t?.embebido, 'https://www.tiktok.com/player/v1/7571550832114666760?description=0&music_info=0&rel=0');
    const corto = videoOriginal('https://vm.tiktok.com/ZMabc123/');
    assert.equal(corto?.red, 'TikTok');
    assert.equal(corto?.embebido, null);
  });

  it('Instagram reel y post', () => {
    assert.equal(videoOriginal('https://www.instagram.com/reel/Dai9ZR3O3D9/?igsh=abc')?.embebido, 'https://www.instagram.com/reel/Dai9ZR3O3D9/embed/');
    assert.equal(videoOriginal('https://www.instagram.com/p/DVd6TMBkVIH')?.embebido, 'https://www.instagram.com/reel/DVd6TMBkVIH/embed/');
  });

  it('Facebook: video completo si, enlace de compartir no', () => {
    assert.match(videoOriginal('https://www.facebook.com/Quevivalacocina1/videos/123456789/')?.embebido ?? '', /plugins\/video\.php/);
    assert.equal(videoOriginal('https://www.facebook.com/share/r/1CSVHTa5Y5')?.embebido, null);
  });

  it('webs, texto y vacio no tienen video', () => {
    assert.equal(videoOriginal('https://www.recetasgratis.net/receta-de-pan'), null);
    assert.equal(videoOriginal(null), null);
    assert.equal(videoOriginal('video:abc/def.mp4'), null);
  });
});
