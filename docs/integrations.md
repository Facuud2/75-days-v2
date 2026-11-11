# Integrations

> Ancla: `apps/backend-health/src/lib`, `apps/backend-health/src/controllers`, `apps/frontend`.
> Confianza: **Leído**. El modo de falla de FatSecret sin credenciales está **Medido**.

## Resumen

| Sistema | Dirección | Protocolo | Requiere | Estado |
|---|---|---|---|---|
| PostgreSQL `75days` | core → DB | TCP | `DATABASE_URL` | Viva |
| PostgreSQL `75days_health` | health → DB | TCP | `DATABASE_URL` | Viva |
| FatSecret | health → externo | HTTPS REST + OAuth2 client credentials | `FATSECRET_CLIENT_ID/SECRET` | Configurable |
| Strava | health ↔ externo | OAuth2 + HTTPS REST | `STRAVA_CLIENT_ID/SECRET` | Configurable |
| Gemini | — | SDK `@google/genai` | `GEMINI_API_KEY` | **Muerta** (SDK nunca importado) |
| backend-core → backend-health | interno | HTTPS REST + API key | `INTERNAL_API_KEY` | **Dormido** |

---

## FatSecret

**Qué hace**: proxy de búsqueda, detalle e importación de alimentos.

**Autenticación**: OAuth2 de credenciales de cliente contra `oauth.fatsecret.com`. El token se cachea en memoria del proceso hasta 60 segundos antes de expirar. Cada reinicio del servicio obliga a pedir uno nuevo.

**Importación**: convierte una porción de FatSecret a macros por 100 g y hace *upsert* de un `Ingredient` global por nombre. Es la vía para ampliar el catálogo; el seed local ya trae 51 ingredientes base, así que la creación de alimentos personalizados no depende de FatSecret (F-10 resuelto).

**Modo de falla**: sin credenciales, la librería lanza al pedir token y el controlador responde 500 con un mensaje genérico. **Medido**: con credenciales vacías, `GET /api/fatsecret/search` falla con 500. La búsqueda de ingredientes locales (`/api/nutrition/custom-foods/ingredients`) responde 200 con `[]`.

**Consecuencia**: en un entorno sin credenciales, la creación de alimentos personalizados es imposible (exige `ingredientId` existente) y la UI que depende de buscar alimentos queda inutilizable.

## Strava

**Qué hace**: conecta la cuenta del usuario y sincroniza actividades de los últimos 30 días como entrenamientos.

**Flujo**: el frontend pide la URL de autorización; el usuario autoriza en Strava; Strava redirige al callback del backend con un código; el backend intercambia el código por tokens, los guarda en el perfil y redirige al perfil del frontend.

**Datos guardados**: access token, refresh token, expiración (epoch en segundos) y athlete id. Los tokens se guardan **en claro**.

**Refresco**: antes de sincronizar, si el token expira en menos de 5 minutos, se refresca y se persiste el nuevo par.

**Deduplicación**: por `externalId` (id de la actividad en Strava), único global.

**Modo de falla**: si Strava no está conectado, la sincronización responde 400. Si la llamada externa falla, 500 con mensaje genérico. El callback nunca falla hacia el usuario: redirige con `?strava=error`.

**Debilidades**: el `state` OAuth es el `userId` en claro (no protege CSRF); el callback no verifica que el usuario exista; no hay revocación al desconectar (no existe endpoint de desconexión).

## Gemini (dependencia muerta)

**Qué hace hoy**: nada. `@google/genai` figura en `package.json` y `GEMINI_API_KEY` en el `.env.example`, pero **ningún archivo del frontend importa el SDK ni lee la variable**. Búsqueda de `genai`, `GoogleGenAI` y `GEMINI` en `apps/frontend` sin resultados fuera de `node_modules`.

**Interpretación**: es un remanente del origen del proyecto como applet de AI Studio (el `package.json` se llama `ai-studio-applet`). Se puede eliminar la dependencia y la variable sin afectar nada.

**Modo de falla**: ninguno, porque no se usa. Si se retoma la feature, hay que escribir la integración desde cero.

## Canal interno core → health

**Qué es**: un cliente HTTP en `backend-core` que consulta el resumen de cumplimiento diario de `backend-health`, protegido por `x-internal-api-key`.

**Estado**: **dormido**. El cliente está escrito y el endpoint responde correctamente (medido: 200 con clave, 403 sin clave, 503 si la clave no está configurada), pero ningún controlador importa el cliente. La función de negocio que lo usaría —cerrar el día según dieta y entrenamiento— no está implementada.

**Consecuencia**: la conformidad de dieta y entrenamiento no influye hoy en la racha ni en los puntos del reto. El reto se mide solo con las metas marcadas a mano.
