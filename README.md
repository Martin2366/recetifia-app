# Recetifia

App Android para convertir recetas dispersas de redes sociales en recetas
estructuradas, editables y organizables. En espanol y pensada para LATAM.

> **Estado: Fase 0.** Todavia no hay app. Estamos validando la hipotesis central
> antes de escribir una linea de producto.

## La hipotesis que estamos probando

> Un usuario hispanohablante comparte un reel de cocina a Recetifia, recibe una
> receta estructurada utilizable, y vuelve.

Si la extraccion no da la talla, no hay producto. Por eso lo primero que existe
en este repositorio no es la app, sino la prueba que la cuestiona:
**[spikes/extraction](spikes/extraction/README.md)**.

## Stack

| | |
|---|---|
| App | Expo / React Native (SDK 57), solo Android |
| Backend | Supabase (auth, Postgres + RLS, Storage, Realtime, Edge Functions) |
| IA | Gemini Flash para estructurar · Groq Whisper para transcribir |
| Suscripciones | RevenueCat |
| Builds | EAS Build |

## Estructura

```
spikes/extraction/   Fase 0: mide si se puede extraer una receta utilizable.
                     Codigo desechable, no es produccion.
```

## Alcance de la v1

**Dentro:** login con Google, biblioteca de recetas, importacion desde RRSS,
edicion, colecciones, lista de compras, modo cocina, lectura offline y paywall.

**Fuera, deliberadamente:** plan de comidas, informacion nutricional y busqueda
por ingredientes. El modelo de datos queda preparado para anadirlos sin migrar.
