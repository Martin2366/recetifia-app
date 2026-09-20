# Puesta en marcha — Fase 1

Hay que hacerlo **en este orden**. Los pasos 3 y 4 dependen de que el build del
paso 2 haya creado la clave de firma, así que no se pueden adelantar.

---

## 1. Supabase

**1.1** Entra en [supabase.com/dashboard](https://supabase.com/dashboard) y crea un proyecto.

- Nombre: `recetifia`
- Contraseña de base de datos: genérala y **guárdala en tu gestor de contraseñas**. No la vas a necesitar a diario, pero recuperarla después es un engorro.
- Región: la más cercana a LATAM que te ofrezca (suele ser `us-east` o `sa-east`).

Tarda un par de minutos en aprovisionarse.

**1.2** Cuando esté listo, ve a **SQL Editor** → **New query**. Abre el archivo
`supabase/migrations/0001_esquema_inicial.sql` de este repositorio, copia **todo**
su contenido, pégalo y pulsa **Run**.

Debe terminar sin errores. Crea las tablas, activa RLS en todas y deja sembrados
los pasillos de supermercado y los sinónimos LATAM.

**1.3** Ve a **Project Settings** → **API Keys**. Supabase tiene ahora cuatro
claves y solo una de ellas se usa en la app:

| Lo que ves | ¿Se usa? | ¿Dónde? |
|---|---|---|
| `sb_publishable_...` | **Sí** | `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| `sb_secret_...` | No todavía | Solo en el servidor, en la Fase 3. **Jamás en la app** |
| Pestaña *Legacy* → `anon public` | No | Versión antigua de la publishable |
| Pestaña *Legacy* → `service_role` | No | Versión antigua de la secret |

**La URL** está en **Project Settings** → **General** → *Project URL*, y tiene
esta forma:

```
https://xxxxxxxxxxxx.supabase.co
```

> Cuidado: la página de **Data API** muestra `https://xxxx.supabase.co/rest/v1/`.
> Ese sufijo **rompe la conexión**. La app necesita la URL a secas.

> La clave publishable es pública por diseño y puede viajar dentro de la app.
> Lo que protege los datos es RLS, no el secreto de esa clave. La `secret` sí es
> peligrosa: se salta RLS por completo. Si alguna vez se te escapa, revócala
> desde esta misma pantalla.

---

## 2. Primer development build

**2.1** Inicia sesión en Expo y enlaza el proyecto:

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest init
```

Te dirá que encontró un proyecto llamado **`recetifia-app`** y preguntará si
quieres enlazarlo. Responde que **sí**. Eso escribe el `projectId` dentro de
`app.json`.

**2.2** Lanza el build:

```bash
npx eas-cli@latest build --profile development --platform android
```

Cuando pregunte por la clave de firma (*"Generate a new Android Keystore?"*),
responde **sí**. EAS la genera y la custodia; es la que identificará tu app en
Google Play para siempre.

Tarda entre 10 y 20 minutos. Al acabar te da un enlace y un **código QR**.

**2.3** Abre el QR con la cámara del celular e instala el APK. Android te
advertirá de que viene de fuera de Play: acéptalo, es tu propia app.

---

## 3. Huella de firma

El build ya creó tu clave. Necesitamos su huella SHA-1 para que Google acepte el
inicio de sesión.

```bash
npx eas-cli@latest credentials --platform android
```

Elige el perfil **development** → **Keystore: Manage everything** y copia el valor
de **SHA-1 Fingerprint**. Tiene esta pinta:

```
A1:B2:C3:D4:E5:F6:...
```

---

## 4. Google Sign-In

**4.1** En [console.cloud.google.com](https://console.cloud.google.com), crea un
proyecto (por ejemplo `recetifia`).

**4.2** **APIs y servicios** → **Pantalla de consentimiento de OAuth**:

- Tipo: **Externo**
- Nombre de la app: `Recetifia`
- Correo de asistencia y de contacto: el tuyo
- Guarda. No hace falta publicarla todavía: en modo de prueba funciona con las
  cuentas que añadas como *usuarios de prueba*. **Añade tu propio correo ahí.**

**4.3** **Credenciales** → **Crear credenciales** → **ID de cliente de OAuth**.
Hay que crear **dos**, y las dos hacen falta:

| Tipo | Para qué | Qué pide |
|---|---|---|
| **Aplicación web** | Firma el `id_token` que valida Supabase | Nada especial |
| **Android** | Autoriza a tu APK a pedir ese token | Paquete `app.recetifia` + el SHA-1 del paso 3 |

Del de tipo **Aplicación web**, copia el **ID de cliente** y el **secreto**.

> Aunque la app sea Android, el ID que va en el `.env` y en Supabase es el
> **web**. El de Android no se escribe en ningún archivo: solo tiene que existir
> y llevar el SHA-1 correcto. Es el punto donde casi todo el mundo se atasca.

**4.4** Vuelve a Supabase → **Authentication** → **Sign In / Providers** →
**Google**. Actívalo y pega ahí el **ID de cliente web** y su **secreto**. Guarda.

---

## 5. Variables de entorno

Copia la plantilla y rellénala:

```bash
cp .env.example .env
```

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=xxxxx.apps.googleusercontent.com
```

`.env` está en `.gitignore` y no se sube al repositorio, que es público.

---

## 6. Arrancar

```bash
npx expo start --dev-client
```

Escanea el QR con la app que instalaste en el paso 2.3. A partir de aquí, cada
vez que guardes un archivo el celular se recarga solo.

**Solo hay que repetir el paso 2 cuando se añada una librería nativa nueva.**
Los cambios de JavaScript, que son la inmensa mayoría, no necesitan recompilar.

---

## Cómo saber que la Fase 1 está terminada

1. La app abre en tu celular y muestra la pantalla de Recetifia.
2. *Continuar con Google* abre el selector de cuentas y entra.
3. Ves las cuatro pestañas y tu nombre y correo en **Perfil**.
4. Cierras la app y la vuelves a abrir: **sigue con la sesión iniciada**
   (eso prueba que el almacenamiento troceado de la sesión funciona).
5. *Cerrar sesión* te devuelve a la pantalla de entrada.
6. En Supabase → **Authentication** → **Users** aparece tu usuario, y en
   **Table Editor** → `profiles` hay una fila con tu nombre.

El punto 6 es el que confirma que el trigger de creación de perfil funciona.

---

## Si algo falla

| Síntoma | Causa casi segura |
|---|---|
| `DEVELOPER_ERROR` al pulsar Google | El SHA-1 o el nombre de paquete del cliente Android de Google no coinciden. Revisa el paso 4.3 |
| Entra pero al reabrir pide login otra vez | Revisa que `EXPO_PUBLIC_SUPABASE_URL` no tenga una barra final |
| `Faltan EXPO_PUBLIC_SUPABASE_URL...` | Falta `.env`, o el servidor de desarrollo se arrancó antes de crearlo: párralo y vuelve a arrancarlo |
| La app no aparece al compartir desde Instagram | Normal todavía: el share target se implementa en la Fase 3. La configuración ya está puesta, pero falta la pantalla que lo recibe |
