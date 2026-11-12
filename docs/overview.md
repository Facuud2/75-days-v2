# Overview

> Ancla: `docker-compose.yml`, `apps/frontend`, `apps/backend-core`, `apps/backend-health`.
> Confianza: **Leído** + **Medido** (servicios levantados y consultados el 2026-11-11).

## Qué es el sistema

Una aplicación de retos personales de 75 días. El usuario se registra, elige una dificultad (Soft / Medium / Hard / Custom), y a partir de ahí obtiene un **reto** con un conjunto de **metas diarias**. Cada día marca las metas que cumplió; al completarlas todas gana puntos y suma racha. En paralelo lleva un registro de **comida** y **entrenamientos** en un segundo servicio.

## Topología

```
Navegador
   │
   ├── :3000  frontend (Next.js)
   │            ├─ NEXT_PUBLIC_API_URL        → :3001/api
   │            └─ NEXT_PUBLIC_HEALTH_API_URL → :3002/api
   │
   ├── :3001  backend-core   (Express 5, Prisma)  → DB "75days"
   └── :3002  backend-health (Express 4, Prisma)  → DB "75days_health"
```

### Hecho central: el frontend habla con los dos backends directamente

No hay API gateway ni BFF. El navegador llama a `:3001` para identidad y retos, y a `:3002` para nutrición y entrenamiento, con **el mismo JWT**. Esto implica:

- Dos orígenes distintos desde el punto de vista del navegador (dos configuraciones de CORS).
- El token viaja dos veces por sesión a servidores distintos.
- Ningún servicio es la "puerta de entrada" del otro.

### El canal servicio-a-servicio existe pero está desconectado

`backend-core` incluye un cliente HTTP para pedirle a `backend-health` un resumen de cumplimiento diario, y `backend-health` expone el endpoint interno correspondiente, protegido por `x-internal-api-key`.

**Ningún controlador de `backend-core` importa ese cliente.** El canal está construido y probado a mano (responde 200 con la clave correcta y 403 sin ella), pero no participa de ningún flujo. Se documenta como **dormido**, no como vivo.

## Responsabilidades por servicio

| Servicio | Es dueño de | No sabe de |
|---|---|---|
| `backend-core` | Identidad, reto, metas, racha, puntos, misiones, logros | Calorías, comidas, entrenamientos |
| `backend-health` | Perfil nutricional, comidas, entrenamientos, estadísticas | Reto, racha, metas diarias |

No hay claves foráneas entre bases. La única relación es un `userId` que ambas partes guardan como texto, sin integridad referencial.

## Autenticación

Un único JWT HS256 firmado con un secreto compartido por ambos backends, con payload `{ id }` y vencimiento de 7 días. No hay refresh token ni revocación: un token robado es válido hasta que expira, y rotar el secreto invalida todas las sesiones.

El segundo mecanismo, `x-internal-api-key`, solo protege el canal dormido descrito arriba.

## Persistencia

Dos bases PostgreSQL independientes en el mismo servidor. Ambos backends gestionan sus esquemas con migraciones versionadas; health parte de la baseline `20261111040000_init`. La deriva histórica de health queda documentada en `data-model.md`.

## Despliegue

No hay pipeline. `docker-compose.yml` es el único artefacto de orquestación y está pensado para desarrollo: monta el código fuente, instala dependencias en cada arranque y corre los servidores en modo watch. El README del backend menciona NeonDB como base productiva, pero no hay configuración de despliegue en el repositorio.
