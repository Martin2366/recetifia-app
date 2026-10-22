/**
 * Tiempos dentro del texto de un paso ("hornea 25 minutos", "1 h 30 min",
 * "media hora", "10-12 min"), para ofrecer un temporizador con un toque.
 * Sin IA: la importacion no rellena duration_seconds, asi que se lee el texto.
 */

export type Tiempo = { segundos: number; texto: string };

const NUMEROS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50,
};

const NUM = String.raw`(\d+(?:[.,]\d+)?|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|veinte|treinta|cuarenta|cincuenta)`;
// "10-12", "10 a 12", "10 o 12": se usa el mayor (mejor que sobre y no que falte)
const RANGO = String.raw`${NUM}(?:\s*(?:-|–|a|o)\s*${NUM})?`;
const UNIDAD = String.raw`(horas?|hrs?|h|minutos?|mins?|min|m|segundos?|segs?|s)\b`;

const PATRON = new RegExp(String.raw`(?<![\w])${RANGO}\s*${UNIDAD}(?:\s*(?:y\s*)?(\d+)\s*(minutos?|mins?|min|m)\b)?`, 'gi');
const MEDIA_HORA = /\b(media hora|hora y media|un cuarto de hora|cuarto de hora)\b/gi;

function valor(t: string | undefined): number {
  if (!t) return 0;
  const n = NUMEROS[t.toLowerCase()];
  return n ?? Number(t.replace(',', '.'));
}

function factor(unidad: string): number {
  const u = unidad.toLowerCase();
  if (u.startsWith('h')) return 3600;
  if (u.startsWith('s')) return 1;
  return 60;
}

export function formatoDuracion(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  if (h) return m ? `${h} h ${m} min` : `${h} h`;
  if (m) return s ? `${m} min ${s} s` : `${m} min`;
  return `${s} s`;
}

/** Cuenta regresiva "mm:ss" o "h:mm:ss". */
export function formatoReloj(segundos: number): string {
  const t = Math.max(0, Math.ceil(segundos));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = String(t % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** Tiempos de un paso, sin repetir y en el orden en que aparecen. */
export function tiemposDelPaso(texto: string, durationSeconds?: number | null): Tiempo[] {
  const encontrados: { pos: number; segundos: number }[] = [];
  if (durationSeconds && durationSeconds > 0) encontrados.push({ pos: -1, segundos: durationSeconds });

  for (const m of texto.matchAll(MEDIA_HORA)) {
    const f = m[1].toLowerCase();
    const segundos = f === 'hora y media' ? 5400 : f.includes('cuarto') ? 900 : 1800;
    encontrados.push({ pos: m.index ?? 0, segundos });
  }
  PATRON.lastIndex = 0;
  for (let m = PATRON.exec(texto); m; m = PATRON.exec(texto)) {
    const unidad = m[3];
    // Una letra suelta solo vale pegada a una cifra ("5m"); con palabras confunde
    // "unos" (uno + s) o "una hora" ya cubierta. Se descarta y se sigue buscando
    // justo despues, para no tragarse el "3 minutos" de "unos 3 minutos".
    if (/^[msh]$/i.test(unidad) && !/^\d/.test(m[1])) {
      PATRON.lastIndex = (m.index ?? 0) + 1;
      continue;
    }
    const mayor = Math.max(valor(m[1]), valor(m[2]));
    let segundos = Math.round(mayor * factor(unidad));
    if (m[4]) segundos += Number(m[4]) * 60;
    // Fuera de lo razonable para un temporizador de cocina
    if (segundos < 10 || segundos > 24 * 3600) continue;
    encontrados.push({ pos: m.index ?? 0, segundos });
  }

  const vistos = new Set<number>();
  return encontrados
    .sort((a, b) => a.pos - b.pos)
    .filter((e) => (vistos.has(e.segundos) ? false : (vistos.add(e.segundos), true)))
    .slice(0, 3)
    .map((e) => ({ segundos: e.segundos, texto: formatoDuracion(e.segundos) }));
}
