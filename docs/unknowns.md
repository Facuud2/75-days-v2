# Unknowns

> Lo que **no** se pudo determinar, y qué se intentó antes de desistir.
> "Sin incógnitas" sería una afirmación, así que este documento existe aunque esté corto.

## 1. Comportamiento de FatSecret y Strava con credenciales reales

**No determinado**: si el mapeo de respuestas, la conversión de porciones y la sincronización funcionan contra las APIs reales.

**Qué se intentó**: lectura completa de `lib/fatsecret.ts` y `stravaController.ts`; prueba de los endpoints sin credenciales (devuelven 500 con mensaje genérico). No hay credenciales en el repositorio ni en el entorno.

**Por dónde seguir**: obtener credenciales de prueba de ambas plataformas y ejecutar los flujos con una cuenta sandbox.

## 2. Contenido del entorno de producción

**No determinado**: qué valores tenían `DATABASE_URL`, `JWT_SECRET`, `INTERNAL_API_KEY` y las credenciales de integración en la nube. El historial menciona una subida a la nube el 2026-03-11, pero no hay configuración de despliegue versionada.

**Qué se intentó**: búsqueda de archivos de despliegue, workflows, `Dockerfile` de producción y referencias a NeonDB. Solo existe el README del backend que la menciona.

**Por dónde seguir**: revisar el panel del proveedor (Neon y el host del frontend) si la cuenta sigue activa.

## 3. Intención original de las funcionalidades a medias

**No determinado**: si misiones, logros y el canal interno core→health estaban planificados para completarse o se abandonaron.

**Qué se intentó**: lectura del código (está completo y cableado en frontend y backend, lo que sugiere que se intentó terminar), historial de commits (el último día se agregaron "retos y pequeños detalles de planes"), y ramas (`logrosdeverdadverdad` sugiere un intento de logros "de verdad").

**Por dónde seguir**: preguntar al dueño. Es una decisión de producto, no un dato del código.

## 4. Cuál versión de las metas por defecto es la correcta

**No determinado**: hay dos catálogos distintos para `Soft`, `Medium` y `Hard`. No hay forma de saber desde el código cuál refleja la regla de negocio del reto de 75 días.

**Qué se intentó**: comparación línea por línea de ambos catálogos y búsqueda de documentación o tests. No hay ninguno de los dos.

**Por dónde seguir**: decisión del dueño (ver `PLAN.md` §12).

## 5. Cobertura real del frontend en navegador

**No determinado**: si todas las pantallas renderizan y funcionan con datos reales. Se verificó que las 8 rutas responden 200 en SSR y que el frontend compila, pero no se recorrió cada flujo en un navegador con un usuario real.

**Qué se intentó**: `curl` a las 8 rutas (todas 200), revisión de logs de `next dev` (sin errores de compilación), lectura del código de páginas y stores.

**Por dónde seguir**: Fase 3 del plan con Playwright; hoy no hay ningún test de navegador.

## 6. Rendimiento bajo carga

**No determinado**: latencia y comportamiento con muchos usuarios o historiales largos. El perfil recalcula todo el historial en cada lectura (F-05) y las estadísticas hacen hasta 62 consultas por request (F-09), pero no se midió con volúmenes reales.

**Qué se intentó**: análisis estático del patrón de consultas y conteo de operaciones por request.

**Por dónde seguir**: sembrar datos sintéticos (por ejemplo 365 días de historial) y medir con k6.
