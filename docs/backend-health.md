# backend-health

> Ancla: `apps/backend-health/src`.
> Confianza: **Leído**; los puntos marcados **Medido** se verificaron contra el servicio corriendo.

## Rol

Es el microservicio de salud: perfil nutricional, registro de comidas, registro de entrenamientos, agregación de estadísticas y dos integraciones externas (FatSecret para alimentos, Strava para actividades).

## Entrada

Un proceso Express **4** en el puerto 3002, escuchando en `0.0.0.0`. Monta seis routers públicos bajo `/api` y uno interno bajo `/internal`. Todos los routers públicos aplican autenticación JWT a nivel de router, salvo el callback de Strava, que llega desde fuera y no puede llevar el token del usuario.

## Diferencia crítica con backend-core: Express 4

En Express 4 los errores de una función `async` **no** se propagan al manejador de errores. Solo el controlador interno y los de FatSecret y Strava envuelven su cuerpo en `try/catch`. Los de nutrición, entrenamientos, alimentos personalizados y estadísticas no lo hacen.

Consecuencia: si Prisma falla en esos controladores (base caída, tabla ausente, violación de constraint), la promesa se rechaza sin respuesta y **la petición queda colgada** hasta que el cliente corta. No hay manejador de errores global registrado. Ver `findings.md` F-08.

## Modelo de dominio

Cada usuario tiene un perfil nutricional que se crea perezosamente: si no existe, la lectura de metas devuelve valores por defecto sin persistirlos, y el primer `PUT` de metas lo crea. El perfil también guarda peso y altura, que alimentan la estimación de calorías, y los tokens de Strava.

Las comidas y los entrenamientos son registros planos con fecha en formato `YYYY-MM-DD` como texto, indexados por usuario y fecha. No hay relación con el reto ni con el día del reto.

## Estimación de calorías

El gasto se estima con una fórmula basada en MET por deporte, multiplicada por peso, duración, un factor de intensidad y un ajuste por longitud de pierna derivado de la altura.

El ajuste biomecánico se aplica a `running`, `walking` y `cycling`. `walking` no es un deporte aceptado por la validación de entrenamientos manuales, pero sí puede llegar desde Strava, que mapea actividades de caminata a ese valor. El registro se guarda igual porque la columna es texto libre.

Si el usuario envía `caloriesBurned`, se respeta como valor manual y no se estima.

## Estadísticas

Tres vistas: diaria, semanal (7 días desde una fecha) y mensual (todos los días del mes). Las tres comparten un constructor de resumen por día que consulta comidas y entrenamientos por separado.

Consecuencia: la vista semanal hace 14 consultas y la mensual hasta 62, en paralelo. Funciona, pero el costo crece linealmente con el rango y no hay caché. Ver `findings.md` F-09.

El balance neto se calcula como consumido menos quemado; el "restante para la meta" se calcula solo contra lo consumido, sin descontar lo quemado. Son dos criterios distintos en el mismo objeto de respuesta.

## Integración con FatSecret

Un proxy con autenticación de cliente: obtiene un token OAuth de credenciales de cliente, lo cachea en memoria hasta poco antes de expirar, y expone búsqueda, detalle e importación.

La importación es la única vía práctica de poblar el catálogo de ingredientes: convierte una porción de FatSecret a macros por 100 g y hace *upsert* del ingrediente por nombre. El seed local ya trae **51 ingredientes base** con macros por 100 g (F-10 resuelto el 2026-11-11), así que se pueden crear alimentos personalizados sin credenciales. FatSecret sigue siendo necesario para buscar alimentos que no estén en ese catálogo.

## Integración con Strava

Flujo OAuth clásico. La URL de autorización se pide autenticada y embebe el `userId` como `state`; el callback intercambia el código por tokens, los guarda en el perfil y redirige al perfil del frontend con un parámetro de resultado.

La sincronización pide las actividades de los últimos 30 días, descarta las que ya existen por `externalId`, mapea el tipo de actividad a un deporte interno y la intensidad a partir del *suffer score*, y crea el entrenamiento con la fuente `strava`. Las calorías usan los kilojulios de Strava cuando existen, con conversión a kilocalorías.

Rarezas:

- El `state` es el identificador del usuario, no un valor aleatorio de un solo uso: no protege contra CSRF en el callback.
- Los tokens de acceso y refresco se guardan en claro en la base.
- El controlador instancia su propio cliente Prisma en lugar de usar el compartido, lo que crea un pool de conexiones adicional.
- El callback no valida que el usuario del `state` exista.

## Canal interno

`/internal/summary/:userId/:date` responde si el usuario cumplió la dieta (consumió algo y no superó la meta) y si entrenó al menos 45 minutos. Requiere `x-internal-api-key`; si la clave no está configurada, responde 503 y rechaza todo.

**Medido**: con clave válida responde 200; sin clave, 403. Su único consumidor previsto es el cliente de `backend-core`, que nunca lo importa. Es un canal **dormido**.

## Estado actual

**Medido**: el servicio responde, valida JWT emitidos por `backend-core`, y devuelve metas por defecto, estadísticas diarias y entrenamientos del día. El catálogo tiene **51 ingredientes base** sembrados (F-10 resuelto). El esquema se crea y actualiza mediante la baseline `20261111040000_init` y `prisma migrate deploy`.
