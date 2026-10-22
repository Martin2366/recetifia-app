import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import { idsCocinadas } from './cocinadas';
import { HORAS_COCINA, leerRecordatorios } from './preferencias';
import { supabase } from './supabase';

/**
 * Notificaciones locales: las programa el telefono, sin servidor ni costo.
 *   - Recordatorios: 4 dias por semana (lun, mie, vie, dom), uno por dia como
 *     maximo, a la hora que eligio la persona. Se reprograman los proximos 7
 *     dias cada vez que se abre la app o se guarda o cocina algo.
 *   - Temporizadores del modo cocina.
 *   - Aviso 7 dias antes de que se renueve el plan anual.
 * Cada una lleva en `data.url` la pantalla que abre al tocarla.
 */

type Modulo = typeof import('expo-notifications');

let modulo: Modulo | null | undefined;

/** El modulo, o null en la web o en un build sin el modulo nativo (el de desarrollo viejo). */
function notificaciones(): Modulo | null {
  if (modulo !== undefined) return modulo;
  modulo = null;
  if (Platform.OS !== 'android' || !requireOptionalNativeModule('ExpoNotificationScheduler')) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const N = require('expo-notifications') as Modulo;
  N.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  N.setNotificationChannelAsync('recordatorios', {
    name: 'Recordatorios',
    description: 'Ideas para cocinar lo que guardaste',
    importance: N.AndroidImportance.DEFAULT,
  }).catch(() => {});
  N.setNotificationChannelAsync('temporizadores', {
    name: 'Temporizadores',
    description: 'Avisos del modo cocina',
    importance: N.AndroidImportance.HIGH,
    vibrationPattern: [0, 400, 200, 400],
  }).catch(() => {});
  modulo = N;
  return N;
}

export function notificacionesDisponibles() {
  return notificaciones() !== null;
}

export async function tienePermiso(): Promise<boolean> {
  const N = notificaciones();
  if (!N) return false;
  return (await N.getPermissionsAsync()).granted;
}

/** Pide el permiso de Android 13+. Devuelve si quedo concedido. */
export async function pedirPermiso(): Promise<boolean> {
  const N = notificaciones();
  if (!N) return false;
  const actual = await N.getPermissionsAsync();
  if (actual.granted) return true;
  if (!actual.canAskAgain) return false;
  return (await N.requestPermissionsAsync()).granted;
}

/** Abre la pantalla que trae la notificacion tocada (tambien la que abrio la app). */
export function alTocarNotificacion(abrir: (url: string) => void): () => void {
  const N = notificaciones();
  if (!N) return () => {};
  const ir = (r: { notification: { request: { content: { data?: Record<string, unknown> } } } } | null) => {
    const url = r?.notification.request.content.data?.url;
    if (typeof url === 'string') abrir(url);
  };
  // La que abrio la app en frio; se limpia para no repetir el viaje en la proxima apertura
  N.getLastNotificationResponseAsync()
    .then((r) => {
      ir(r);
      if (r) N.clearLastNotificationResponseAsync().catch(() => {});
    })
    .catch(() => {});
  const sub = N.addNotificationResponseReceivedListener(ir);
  return () => sub.remove();
}

async function programar(id: string, fecha: Date, titulo: string, cuerpo: string, url: string, canal: string) {
  const N = notificaciones()!;
  await N.scheduleNotificationAsync({
    identifier: id,
    content: { title: titulo, body: cuerpo, data: { url } },
    trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: fecha, channelId: canal },
  });
}

async function cancelarConPrefijo(prefijo: string) {
  const N = notificaciones();
  if (!N) return;
  const programadas = await N.getAllScheduledNotificationsAsync();
  await Promise.all(
    programadas.filter((n) => n.identifier.startsWith(prefijo)).map((n) => N.cancelScheduledNotificationAsync(n.identifier))
  );
}

// ---------------------------------------------------------------- recordatorios

const DIAS_CON_AVISO = new Set([0, 1, 3, 5]); // domingo, lunes, miercoles, viernes
const DIA_MS = 24 * 60 * 60 * 1000;

let reprogramando: Promise<void> | null = null;

/** Borra los recordatorios pendientes y programa los de los proximos 7 dias. Nunca lanza. */
export function reprogramarRecordatorios(): Promise<void> {
  // Si ya hay una en curso, la siguiente espera y vuelve a calcular con datos frescos
  const siguiente = (reprogramando ?? Promise.resolve()).then(reprogramar).catch(() => {});
  reprogramando = siguiente;
  return siguiente;
}

async function reprogramar() {
  const N = notificaciones();
  if (!N) return;
  await cancelarConPrefijo('rec-');
  const prefs = await leerRecordatorios();
  if (!prefs.activos || !(await tienePermiso())) return;
  const { data: sesion } = await supabase.auth.getSession();
  if (!sesion.session) return;

  // Recetas guardadas hace mas de 2 dias y nunca cocinadas: las que se olvidan
  const [{ data: recetas }, cocinadas] = await Promise.all([
    supabase
      .from('recipes')
      .select('id, title')
      .lt('created_at', new Date(Date.now() - 2 * DIA_MS).toISOString())
      .order('created_at', { ascending: false })
      .limit(60),
    idsCocinadas(),
  ]);
  const pendientes = (recetas ?? []).filter((r) => !cocinadas.has(r.id));

  const hora = HORAS_COCINA.find((h) => h.id === prefs.hora) ?? HORAS_COCINA[2];
  const ahora = new Date();
  // Rota segun la semana del anio: no se repite siempre la misma receta
  let turno = Math.floor(ahora.getTime() / (7 * DIA_MS));

  for (let d = 0; d < 7; d++) {
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + d, hora.hora, hora.minuto);
    if (fecha <= ahora || !DIAS_CON_AVISO.has(fecha.getDay())) continue;
    const id = `rec-${fecha.toISOString().slice(0, 10)}`;
    if (fecha.getDay() === 0) {
      await programar(id, fecha, 'Arma tu semana 🗓️', 'Elige qué vas a cocinar estos días y arma la lista de compras de una vez.', '/plan', 'recordatorios');
    } else if (pendientes.length) {
      const receta = pendientes[turno++ % pendientes.length];
      await programar(id, fecha, '¿La hacemos hoy? 🍳', `Guardaste «${receta.title}» y todavía no la cocinas.`, `/receta/${receta.id}`, 'recordatorios');
    } else {
      await programar(id, fecha, '¿Qué cocinamos hoy?', 'Mira las recetas nuevas en Descubrir.', '/descubrir', 'recordatorios');
    }
  }
}

// ---------------------------------------------------------------- temporizadores

/** Programa el aviso de un temporizador. Devuelve su id, o null si no hay notificaciones. */
export async function programarTemporizador(fin: Date, titulo: string, url: string): Promise<string | null> {
  if (!notificaciones() || !(await tienePermiso())) return null;
  const id = `tmp-${fin.getTime()}-${Math.round(Math.random() * 1e6)}`;
  try {
    await programar(id, fin, '⏱ ¡Tiempo!', titulo, url, 'temporizadores');
    return id;
  } catch {
    return null;
  }
}

export async function cancelarTemporizador(id: string | null) {
  const N = notificaciones();
  if (!N || !id) return;
  await N.cancelScheduledNotificationAsync(id).catch(() => {});
}

// ---------------------------------------------------------------- renovacion

const FECHA_LARGA = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long' });

/**
 * Aviso honesto 7 dias antes de que se renueve el plan anual. Con `renovacion`
 * null (mensual, cancelado o sin Plus) solo borra el aviso pendiente.
 */
export async function programarAvisoRenovacion(renovacion: Date | null) {
  if (!notificaciones()) return;
  try {
    await cancelarConPrefijo('renov-');
    if (!renovacion || !(await tienePermiso())) return;
    const aviso = new Date(renovacion.getTime() - 7 * DIA_MS);
    aviso.setHours(10, 0, 0, 0);
    if (aviso <= new Date()) return;
    await programar(
      `renov-${renovacion.getTime()}`,
      aviso,
      'Tu plan anual se renueva pronto',
      `Recetifia+ se renueva el ${FECHA_LARGA.format(renovacion)}. Si quieres, puedes cancelarlo antes en Google Play.`,
      '/perfil',
      'recordatorios'
    );
  } catch {
    // Sin aviso no se rompe nada
  }
}

/** Al borrar la cuenta: nada programado debe sobrevivir. */
export async function cancelarTodo() {
  const N = notificaciones();
  if (!N) return;
  await N.cancelAllScheduledNotificationsAsync().catch(() => {});
}
