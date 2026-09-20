# Fase 0 — Spike de extracción

Prueba desechable que decide si Recetifia se construye o se replantea. **No es código de producción.**

Responde a una sola pregunta:

> ¿Se puede sacar una receta utilizable desde un enlace de Instagram/TikTok/YouTube/Pinterest, gratis o casi?

## Puesta en marcha

```bash
cd spikes/extraction
cp .env.example .env
```

Rellena `GEMINI_API_KEY` en `.env` ([AI Studio](https://aistudio.google.com/apikey)), y después averigua qué modelos tiene tu clave:

```bash
npm run models
```

Copia uno de la lista (interesa un **Flash**: barato y suficiente) y ponlo en `GEMINI_MODEL`.

`GROQ_API_KEY` es opcional: solo hace falta para transcribir audio, y en este spike la transcripción únicamente se aplica a archivos locales que tú indiques. **El spike no descarga video de las redes** — eso es justamente lo que estamos evitando construir.

## Preparar los enlaces

```bash
cp urls.sample.txt urls.txt
```

Pon tus **enlaces reales**, uno por línea. La mezcla que buscamos:

| Fuente | Cantidad |
|---|---|
| Reels de Instagram | 8 |
| TikToks | 8 |
| YouTube (Shorts o vídeos) | 4 |
| Pines de Pinterest | 4 |
| Blogs de cocina | 4 |

Todos de cuentas **en español** y elegidos con un criterio: *"esto es lo que yo guardaría"*. Un spike con enlaces que no representan el uso real no mide nada.

Para probar la transcripción en un caso concreto, añade un archivo local después de una barra vertical:

```
https://www.tiktok.com/@alguien/video/123  |  media/ese-video.mp4
```

## Ejecutar

```bash
npm start
```

Va enlace por enlace, esperando entre llamadas para no chocar con el límite del tier gratuito (~15 peticiones/minuto).

## Qué produce

| Archivo | Para qué |
|---|---|
| `out/revision.md` | **El importante.** Cada receta extraída, para que la puntúes de 1 a 5 a mano |
| `out/resultados.csv` | Métricas por enlace: ruta, coste, tokens, latencia, confianza |
| `out/resultados.json` | Volcado completo, incluido el texto crudo obtenido |

## Cómo funciona

Se para en cuanto tiene suficiente, empezando por lo más barato:

1. **oEmbed** de la plataforma → título, autor, miniatura y caption
2. **Open Graph** de la página → descripción
3. **¿El caption enlaza a un blog?** → `schema.org/Recipe` en JSON-LD. *Gratis, exacto, sin IA*
4. **Audio** (solo si diste un archivo local y hay texto insuficiente)
5. **Gemini Flash** con esquema JSON forzado → receta estructurada

El paso 3 lleva un **control de calidad**: muchos blogs publican un `Recipe` incompleto (ingredientes colapsados en una sola cadena, sin pasos). Cuando eso pasa no se descarta, se le pasa a la IA junto con el texto del cuerpo de la página.

## La puerta de decisión

Fijada **antes** de mirar los datos, para no engañarnos luego:

| Resultado | Qué hacemos |
|---|---|
| **≥ 70 %** utilizable | Seguimos con la arquitectura prevista |
| **40–70 %** | Seguimos, pero el fallback de captura/vídeo pasa a primer plano en la UI |
| **< 40 %** | Paramos: proveedor de pago, o pivotar a "captura primero" |

El script imprime un porcentaje automático, pero **el que decide es el tuyo**, el de `out/revision.md`. La heurística automática no sabe si una receta se puede cocinar.

## Hallazgos ya confirmados

- **YouTube funciona bien.** oEmbed + descripción del vídeo dan miles de caracteres de texto.
- **Hay blogs que bloquean bots.** Allrecipes responde 403. Es una limitación real, no un fallo del script.
- **La calidad del JSON-LD varía muchísimo.** Encontramos páginas cuyo `Recipe` trae un solo ingrediente y ningún paso. De ahí el control de calidad.
- **Falta verificar lo más importante:** Instagram y TikTok, que solo se pueden probar con enlaces reales tuyos.
