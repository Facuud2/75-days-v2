# Reporte de QA Exploratorio y Auditoría UX — Producción (`75-days-v2.vercel.app`)

**Fecha de ejecución:** 16 de noviembre de 2026 (23:05–23:09 ART, `UTC-3`)  
**Entorno probado:** Producción  
- **Frontend:** `https://75-days-v2.vercel.app` (Vercel)  
- **Backend Core:** `https://seven5-days-v2.onrender.com` (Render)  
- **Backend Health:** `https://seven5-days-v2-1.onrender.com` (Render)  

**Skills aplicadas:** `ux-audit`, `dogfood`, `playwright-skill`, `exploratory-testing`  
**Veredicto general:** **FAIL** (integración Strava rota con `400 Bad Request`, cold-start severo con `net::ERR_ABORTED` en `backend-health`, buscador de alimentos vacío en sugerencias en español, y desfase de fecha UTC vs Local en `/calendar`).

---

## 1. Comparativa rápida: Local vs Producción

| Aspecto | Local (`localhost:3000`) | Producción (`75-days-v2.vercel.app`) |
|---|---|---|
| **Login con Google** | ❌ Error técnico `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | ✅ Abre popup real de Google OAuth (con aviso COOP en consola) |
| **Botón `Crear cuenta` en `/register`** | ❌ Invisible (`opacity: 0`) antes de scrollear | ✅ Visible desde el inicio (`opacity: 0.98`) |
| **`GET /api/sync`** | ❌ `404 Not Found` (contenedor desactualizado) | ✅ `200 OK` |
| **Barra dev `Demo data / Día 1/75`** | ❌ Visible sobre el contenido | ✅ Oculta correctamente |
| **Cold start de Render** | N/A | ❌ `backend-health` tarda >15s en despertar y provoca `net::ERR_ABORTED` |
| **Buscador de comidas (`FatSecret`)** | ❌ `500` (credenciales faltantes) | ⚠️ `200 OK` pero devuelve `{"results":[]}` para `"Pechuga de Pollo"` |
| **Conectar Strava** | ❌ `500` (credenciales faltantes) | ❌ `400 Bad Request` en Strava (`redirect_uri invalid`) |
| **Calendario (UTC vs Local)** | ❌ `Día 1 · Mar 17 Nov · 0 completados` | ❌ Mismo bug (`Día 1 · Mar 17 Nov · 0 completados`) |

---

## 2. Matriz de Funcionalidades Probadas en Producción

| # | Funcionalidad | Ruta | Resultado | Estado |
|---|---|---|---|---|
| 1 | Entrada a la app | `/` | Redirige a `/login` en `2.2s` sin pantalla informativa previa | ⚠️ Fricción UX |
| 2 | Continuar con Google | `/login` | Abre popup oficial de `accounts.google.com` (`client_id=744957325849-...`); consola registra aviso COOP `window.closed` | ⚠️ Funcional con aviso |
| 3 | Registro con Email | `/register` | Formulario visible al 100%; registro responde `201 Created` en `3.59s` | ✅ Funciona |
| 4 | Onboarding (7 pasos) | `/onboarding` | Flujo completo funcional (`PUT /users/profile`, `POST /challenges/start`, `PATCH /complete-onboarding` → `200 OK`), pero sigue pidiendo edad/altura/peso/IMC sin opción de omitir | ⚠️ Fricción UX Alta |
| 5 | Tareas diarias y persistencia | `/dashboard` | Marcar las 4 tareas sube a `100% COMPLETADO` y persiste al recargar (`F5`) | ✅ Funciona |
| 6 | Sincronización `/api/sync` | `/dashboard`, `/profile` | `GET /api/sync` responde `200 OK` | ✅ Funciona |
| 7 | Acción rápida `+` → Comida | `/dashboard` | Con backend dormido: `net::ERR_ABORTED`. Con backend despierto: `GET /api/fatsecret/search?query=Pechuga%20de%20Pollo` devuelve `200 OK` con `{"results":[]}` | ❌ **Bug Alto** |
| 8 | Acción rápida `+` → Entrenamiento | `/dashboard` | Con backend dormido: `net::ERR_ABORTED`. Con backend despierto: `POST /api/workouts` responde `201 Created` (`262.5 kcal`) | ⚠️ Afectado por Cold Start |
| 9 | Calendario (Mapa y Agenda) | `/calendar` | Muestra `Día 1 · 0 completados` y `Mar 17 Nov · Sin registro` pese a tener el Día 1 al `100%` en `/dashboard` | ❌ **Bug Alto** |
| 10 | Perfil y Conectar Strava | `/profile` | Perfil, racha (`1 día`) y logro `Primer Paso` correctos; `Conectar Strava` redirige a Strava y Strava responde **400 Bad Request (`redirect_uri invalid`)** | ❌ **Bug Crítico** |
| 11 | Ajustes | `/settings` | Carga correctamente | ✅ Funciona |
| 12 | Vista móvil (`375×812`) | `/dashboard` | Sin scroll horizontal (`scrollWidth === 375`) y sin barras de debug | ✅ Funciona |

---

## 3. Reporte Detallado de Bugs en Producción

### BUG-PROD-01 [CRÍTICO] — `Conectar Strava` falla con `400 Bad Request` (`redirect_uri invalid`)
- **Secuencia para reproducir:**
  1. Iniciar sesión en `https://75-days-v2.vercel.app`.
  2. Ir a `/profile` → sección `Actividad` → pulsar **Conectar Strava**.
- **Resultado obtenido:**
  - `GET https://seven5-days-v2-1.onrender.com/api/strava/auth` responde `200 OK` y redirige al navegador a:
    ```
    https://www.strava.com/oauth/authorize?client_id=209501&response_type=code&redirect_uri=https%3A%2F%2Fseven5-days-v2-1.onrender.com%2Fapi%2Fstrava%2Fcallback&...
    ```
  - Strava rechaza la autorización con **HTTP 400**:
    ```json
    {"message":"Bad Request","errors":[{"resource":"Application","field":"redirect_uri","code":"invalid"}]}
    ```
- **Causa raíz:** En el panel de desarrolladores de Strava (`client_id=209501`), el **Authorization Callback Domain** no incluye `seven5-days-v2-1.onrender.com` (probablemente quedó configurado con `localhost` o un dominio anterior).

### BUG-PROD-02 [CRÍTICO / INFRA] — Cold Start de `backend-health` en Render provoca `net::ERR_ABORTED`
- **Secuencia para reproducir:**
  1. Registrarse o iniciar sesión tras unos minutos de inactividad.
  2. Abrir inmediatamente `+` → **Registrar comida** o **Registrar entrenamiento**.
- **Evidencia de red:**
  - `GET https://seven5-days-v2-1.onrender.com/api/nutrition/custom-foods/ingredients` → `net::ERR_ABORTED`
  - `GET https://seven5-days-v2-1.onrender.com/api/fatsecret/search?query=Pechuga%20de%20Pollo&page=0` → `net::ERR_ABORTED`
  - `POST https://seven5-days-v2-1.onrender.com/api/workouts` → `net::ERR_ABORTED`
- **Causa raíz:** Al usar Render free tier, `backend-core` (`seven5-days-v2.onrender.com`) despierta durante el login/onboarding (~3.6s), pero `backend-health` (`seven5-days-v2-1.onrender.com`) sigue dormido hasta que el usuario intenta registrar comida, entrenamiento o abrir `/profile`, tardando ~15–30 segundos en responder.
- **Impacto en usuario promedio:** El usuario intenta guardar un entrenamiento o buscar una comida, no ve respuesta o falla silenciosamente, y asume que la app no funciona.

### BUG-PROD-03 [ALTO] — Buscador de comidas devuelve resultados vacíos (`{"results":[]}`) para sugerencias propias de la app
- **Secuencia para reproducir:**
  1. Con `backend-health` ya despierto, abrir `+` → **Registrar comida**.
  2. Pulsar la sugerencia rápida **"Pechuga de Pollo"** que muestra la propia UI.
- **Resultado obtenido:**
  - `GET https://seven5-days-v2-1.onrender.com/api/fatsecret/search?query=Pechuga%20de%20Pollo&page=0` responde `200 OK` con `{"results":[]}`.
  - La UI muestra: `"No se encontraron resultados para 'Pechuga de Pollo'."`
- **Causa raíz probable:** El endpoint de FatSecret en `backend-health` está capturando un error de API (ej. IP no autorizada en whitelist de FatSecret desde Render, o búsqueda en español contra catálogo en inglés) y devolviendo `results: []`, o las sugerencias rápidas en español no devuelven coincidencias.

### BUG-PROD-04 [ALTO] — Desfase de fecha UTC vs Local en `/calendar`
- **Secuencia para reproducir:**
  1. Crear reto y completar 4/4 tareas del Día 1 a las `23:06 ART (UTC-3)` del `16 de noviembre`.
  2. Ir a `/calendar` (vistas `Mapa` y `Agenda`).
- **Resultado obtenido:**
  - `/dashboard` muestra `Lunes, 16 De Noviembre` y `100% COMPLETADO`.
  - `/profile` muestra `Racha: 1 día` y logro `Primer Paso (16 nov)`.
  - `/calendar` muestra `Día 1 · 0 completados · 0 no cumplidos` y en `Agenda`: `Día 1 · Mar 17 Nov · Sin registro` (toma la fecha UTC `2026-11-17T02:06:29.232Z` de `startDate` en lugar de la fecha local del usuario).

### BUG-PROD-05 [BAJO] — Aviso de consola `Cross-Origin-Opener-Policy` en Login con Google
- **Evidencia de consola:**
  `Cross-Origin-Opener-Policy policy would block the window.closed call.` (al abrir el popup de Google Identity Services desde `/login`).

---

## 4. Recomendaciones Priorizadas para Producción

1. **Corregir Strava OAuth:** En [strava.com/settings/api](https://www.strava.com/settings/api) para la app `209501`, actualizar el *Authorization Callback Domain* a `seven5-days-v2-1.onrender.com`.
2. **Mitigar Cold Start de `backend-health`:**
   - Hacer un ping ligero (`GET /health`) a `NEXT_PUBLIC_HEALTH_API_URL` en segundo plano apenas el usuario entra a `/login` o `/onboarding`, para que `backend-health` ya esté despierto cuando llegue a `/dashboard`.
   - Mostrar un indicador claro de carga / reintento si el servidor de salud está despertando, en lugar de fallar silenciosamente.
3. **Revisar FatSecret en producción:** Verificar logs de Render de `seven5-days-v2-1` al buscar `"Pechuga de Pollo"` (confirmar si FatSecret rechaza la IP dinámica de Render o requiere búsqueda en inglés / fallback a catálogo local de ingredientes).
4. **Corregir zona horaria en `/calendar`:** Derivar la fecha de cada día del calendario usando el mismo criterio de fecha local (`timezoneOffset`) que usa `/dashboard`.
5. **Simplificar la entrada (UX):** Permitir omitir los pasos de edad, altura y peso en `/onboarding` y reducir el combo `7 pasos onboarding + 9 pasos tour` para que un usuario promedio pueda empezar su Día 1 sin fricción ni desconfianza.
