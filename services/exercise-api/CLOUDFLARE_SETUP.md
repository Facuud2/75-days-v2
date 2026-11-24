# Guía Paso a Paso: Desplegar el Microservicio en Cloudflare Workers + R2

Este microservicio (`services/exercise-api`) vive completamente separado de tus Vercel Functions: **0 invocaciones en Vercel**, **0ms de cold start**, y tier gratuito de **100.000 peticiones/día** en Cloudflare Workers + **10 GB gratis/mes** en Cloudflare R2.

---

## Paso 1: Crear tu cuenta gratuita en Cloudflare

1. Entra a **[https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)**.
2. Regístrate con tu correo (plan **Free**, no necesitas pagar nada).
3. En el menú lateral izquierdo, haz clic en **Workers & Pages** → **Overview**.
4. Cloudflare te pedirá elegir un subdominio gratuito para tus Workers (por ejemplo: `tu-usuario.workers.dev`). Elige el que quieras y confirma.

---

## Paso 2: Activar Cloudflare R2 (Opcional — para alojar tus propias imágenes y JSON)

> El Worker ya funciona sin R2 usando su bundle interno y el CDN de dominio público de `free-exercise-db`. Activar R2 te da control total y CDN propio.

1. En el menú lateral izquierdo de Cloudflare Dashboard, haz clic en **R2 Object Storage**.
2. Si es la primera vez, activa R2 (Cloudflare pide tarjeta de verificación por prevención de abuso, pero el tier gratuito incluye **10 GB de almacenamiento + 10 millones de lecturas/mes a $0**).
3. Haz clic en **Create bucket**:
   - **Bucket name:** `75days-exercises-media`
   - **Location:** Automatic
4. (Opcional para URL pública directa) Entra al bucket → **Settings** → **Public access** → habilita `R2.dev subdomain` (o conecta un subdominio propio).
5. Abre `services/exercise-api/wrangler.toml` y descomenta:
   ```toml
   [[r2_buckets]]
   binding = "EXERCISES_BUCKET"
   bucket_name = "75days-exercises-media"
   ```

---

## Paso 3: Autenticarte desde la terminal y desplegar (sin compartir contraseñas)

La forma más segura es **OAuth directo desde tu terminal** (no necesitas pasarme tu contraseña ni tu API token por chat):

```bash
cd services/exercise-api
npm install
npx wrangler login
```

Se abrirá tu navegador → haz clic en **Allow** para autorizar Wrangler.

Luego despliega tu microservicio con un solo comando:

```bash
npm run deploy
```

Wrangler imprimirá tu URL pública en producción, por ejemplo:
`https://seventyfive-days-exercise-api.<tu-subdominio>.workers.dev`

Si activaste R2 y quieres subir el catálogo JSON al bucket:
```bash
npm run upload:r2
```

---

## Paso 4: Conectar el Microservicio a tu App en Vercel (Preview y Producción)

1. Ve a **Vercel Dashboard** → tu proyecto `75-days-v2` → **Settings** → **Environment Variables**.
2. Agrega la variable (solo para **Preview** primero mientras pruebas):
   - **Key:** `NEXT_PUBLIC_EXERCISE_API_URL`
   - **Value:** `https://seventyfive-days-exercise-api.<tu-subdominio>.workers.dev`
3. (Opcional) Si tu dominio de preview o producción es distinto a `*.vercel.app`, agrégalo en `ALLOWED_ORIGINS` dentro de `services/exercise-api/wrangler.toml` y vuelve a ejecutar `npm run deploy`.

---

## ¿Qué datos necesito SI quieres que yo automatice el deploy desde aquí?

Si prefieres que yo corra `wrangler deploy` o configure CI/CD por ti, los únicos 2 datos que tendrías que generar en **Cloudflare Dashboard → My Profile → API Tokens → Create Token** (plantilla *"Edit Cloudflare Workers"* + permiso *"Workers R2 Storage: Edit"*) son:
1. `CLOUDFLARE_ACCOUNT_ID` (lo ves en la barra derecha de Workers & Pages).
2. `CLOUDFLARE_API_TOKEN` (recomendado ponerlo en tu `.env.local` o GitHub Actions Secrets, nunca commiteado en git).

> **Tip:** Si solo haces `npx wrangler login && npm run deploy` en tu máquina y me pasas únicamente la URL pública (`https://seventyfive-days-exercise-api.xxx.workers.dev`), **no hace falta compartir ningún secreto**.
