# Plan de trabajo: lo que aprendimos de las reseñas negativas

Guía de producto desde el 24 de septiembre de 2026. Sale de leer 83 reseñas de
1 y 2 estrellas de la app de referencia (los PDF están en `reseñas/`). Cuando
una decisión anterior choque con esto, manda esto.

## Principios

1. **Gratis de verdad.** Guardar, escribir, organizar, la lista de compras y el
   modo cocina no tienen tope. Solo se limita la importación con IA desde
   videos e imágenes: **15 por semana** en el plan gratis (subido de 10 el 25 sep).
2. **Se dice desde la primera pantalla.** "Gratis. Sin tarjeta." aparece antes
   de cualquier pregunta. Nada de paywall en el onboarding.
3. **Primero sirve, después se vende.** Plus se ofrece solo cuando la persona
   llega al límite o lo busca. La X siempre está visible.
4. **Nunca se pierde nada.** Todo lo que se escribe se guarda en el teléfono al
   instante. Ninguna carga termina en una pantalla vacía.
5. **Una importación nunca termina en "no pudimos".** Se entrega lo que se sacó,
   con el enlace original, para completarlo a mano. Las fallidas no cuentan.
6. **Sin cuenta para empezar.** La cuenta de Google es para respaldar, y borrarla
   funciona con un toque.
7. **No se pide reseña** hasta que la persona tenga 3 importaciones buenas.
8. **Pensada para LATAM:** precios locales bajos, teléfonos de gama baja, datos
   móviles caros, todo en español.

## Fase 1: onboarding corto y sin cuenta

Dolores: cobro escondido, demasiadas preguntas, cuenta obligatoria, pantallas
que se quedan cargando.

- Onboarding nuevo, menos de un minuto: **bienvenida** (con "Gratis. Sin
  tarjeta.") → **cómo funciona y qué es gratis** (una pantalla) → **tour**
  (el del desenfoque) → biblioteca vacía que invita a importar la primera.
- Se eliminan: objetivos, genial, fuentes, momento, compatible, configurando,
  oferta, planes, recordatorio, paywall y cuenta. Los permisos de notificación
  se piden después y en contexto, no al entrar.
- Sesión anónima de Supabase al terminar el tour. `Guardian` deja pasar con esa
  sesión. Hay que activar "Anonymous sign-ins" en el proyecto de Supabase.
- Perfil: "Respalda tus recetas con Google", que vincula la cuenta anónima sin
  perder nada, y "Borrar mi cuenta y mis datos", que funciona de verdad (Edge
  Function que borra usuario, recetas y archivos).

## Fase 2: límites honestos y control del gasto

Dolores: límites absurdos, cobro sorpresa. Restricción: 30 USD al mes.

- `LIMITES`: recetas y colecciones sin tope; importaciones con IA 10 por semana.
  La Edge Function `importar` ya limita en el servidor (hoy 3 al mes): se cambia
  a ventana semanal y solo cuentan las exitosas.
- Pegar texto, escribir a mano e importar desde webs con receta estructurada no
  gastan importaciones (casi no cuestan).
- Contador visible y honesto: "Te quedan 7 de 10 esta semana. Se renuevan el
  lunes."
- Freno de gasto: si el gasto del mes se acerca al techo, la importación pasa
  solo a caption y web (lo barato) y avisa, en vez de fallar.

## Fase 3: nunca perder nada

Dolores: receta de una hora borrada, ediciones que no se guardan, pantallas en
blanco o negras, borrar duplicados.

- `borrador.ts` pasa a guardar en el teléfono (AsyncStorage) cada pocos segundos,
  y se recupera al volver a abrir.
- Guardar una receta funciona sin conexión: queda en cola y se sube cuando hay
  red. Nunca se descarta por "sin conexión".
- Cada carga tiene tiempo límite y botón de reintentar. Límite de errores global
  que muestra una pantalla amable en vez de cerrar la app.
- En colecciones, "Quitar de esta colección" y "Eliminar receta" son acciones
  distintas y la segunda pide confirmación.

## Fase 4: importación que no deja tirado

Dolores: "no pudimos encontrar la receta", videos sin voz, Facebook, idioma raro.

- Si falla, se abre el editor con lo que se sacó más el texto del post, y el
  enlace original siempre queda guardado en la receta.
- El prompt fuerza a leer el texto escrito en pantalla, y la salida siempre en
  español.
- Probar y dejar documentado qué funciona de Instagram, TikTok, YouTube y
  Facebook, y decirlo con honestidad en la app.

Qué lee hoy cada fuente (Edge Function `importar`):

| Fuente | Texto de la publicación | Audio | Texto en pantalla |
|---|---|---|---|
| Instagram, TikTok, Facebook | Sí | Subtítulos o Whisper | Gemini mira el video si el audio no trae los pasos |
| YouTube | Descripción | Gemini escucha el video | Gemini |
| Pinterest, webs | Página (JSON-LD si hay) | No | No |

En modo ahorro (gasto del mes ≥ `TOPE_GASTO_MES_USD`) solo se usa el texto.
El gasto se anota en `gasto_ia`, que no se borra con las cuentas.

## Fase 5: Plus y pagos que no dan miedo

Dolores: cobros sin avisar, prueba con tarjeta, Plus pagado que no se reconoce,
sin reembolso.

- Plus = importaciones sin límite más extras (se definen en esta fase).
- Sin prueba de Google Play (pide tarjeta). Si hay prueba, es de Plus por 7 días
  activada desde el servidor, sin tarjeta, y termina sola sin cobrar.
- Precios locales bajos en Play, del orden de USD 1,99 al mes y USD 9,99 al año,
  a confirmar al crear los productos.
- Perfil: "Gestionar o cancelar suscripción" (abre Play), "Restaurar compra" y
  estado de Plus comprobado con RevenueCat al abrir la app.
- Pedido de reseña (API de Google) solo tras 3 importaciones exitosas, una vez.

## Fase 6: gama baja

- Probar en un Android de gama baja: arranque, memoria, tamaño del APK.
- Imágenes livianas y animaciones que se apagan si el teléfono va lento.
