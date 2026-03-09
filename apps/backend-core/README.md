# 75 Days Backend API

Este proyecto contiene el backend para la aplicación "75 Days Challenge", construido con Node.js, Express, TypeScript y Prisma (NeonDB).

## Tecnologías Utilizadas

- **Node.js & Express**: Framework ligero y rápido para la creación del servidor.
- **TypeScript**: Para tipado estático y mayor seguridad en el código y DX.
- **Prisma ORM**: Para el manejo de la base de datos PostgreSQL.
- **NeonDB**: PostgreSQL Serverless rápido y escalable.
- **Zod**: Validación de esquemas en los requests.
- **JWT & Bcryptjs**: Autenticación y cifrado de contraseñas de forma segura.

---

## Estructura del Proyecto

```
backend/
├── prisma/
│   ├── migrations/      # Historial de migraciones SQL
│   └── schema.prisma    # Definición de modelos de datos
├── src/
│   ├── controllers/     # Lógica de negocio de la API
│   ├── middlewares/     # Middleware (ej. autenticación)
│   ├── routes/          # Definición de rutas (Endpoints)
│   ├── utils/           # Utilidades (ej. cliente Prisma)
│   └── index.ts         # Punto de entrada de la aplicación
├── .env                 # Variables de entorno
├── package.json         # Dependencias y scripts
└── tsconfig.json        # Configuración de TypeScript
```

---

## Modelos de Base de Datos (Prisma)

- **User**: Perfil del usuario (nombre, email, hash de contraseña, etc).
- **Challenge**: El reto activo (dificultad, racha actual, días, etc) relacionado a 1 usuario.
- **GoalTemplate**: Las plantillas de las metas (ya sean por defecto o creadas a mano si la dificultad es `Custom`).
- **DailyLog**: El registro diario por cada fecha que el reto esté en curso (relacionado al Challenge).
- **DailyGoal**: Cada una de las metas puntuales a cumplir ese día en particular (relacionado a cada DailyLog).
- **SideQuest**: Misiones extra opcionales para ganar puntos o recompensas.

---

## Ejecución Local

1. Asegúrate de tener Node.js instalado.
2. Clona el repositorio y ubícate en la carpeta `/backend`.
3. Instala las dependencias:
   ```bash
   npm install
   ```
4. Asegúrate que tu archivo `.env` contenga la conexión a tu NeonDB (o Postgres local) en `DATABASE_URL` y tu secreto para JWT en `JWT_SECRET`:
   ```env
   DATABASE_URL="postgresql://usuario:password@host/nombre-bd"
   JWT_SECRET="mi_secreto_muy_seguro"
   ```
5. Genera el cliente de Prisma:
   ```bash
   npx prisma generate
   ```
6. Inicializa el servidor de desarrollo:
   ```bash
   npm run dev
   ```

El servidor correrá por defecto en `http://localhost:3001`.

---

## Endpoints Disponibles

**Todos los endpoints (excepto Login y Register) requieren un Header de autorización:**
`Authorization: Bearer <TU_JWT_TOKEN>`

### Auth (`/api/auth`)
| Método | Ruta | Descripción | Body Requerido |
| --- | --- | --- | --- |
| POST | `/register` | Registra el usuario y arranca su primer reto | `name`, `email`, `password`, `difficulty`, `[customGoalsTemplate]` |
| POST | `/login` | Inicia sesión en la aplicación | `email`, `password` |
| GET | `/me` | Devuelve información sobre el usuario logueado | - |

### Challenges (`/api/challenges`)
| Método | Ruta | Descripción | Body Requerido |
| --- | --- | --- | --- |
| GET | `/current` | Retorna el Challenge activo con todos sus Logs diarios | - |
| POST | `/start` | Empieza un nuevo reto (Desactivando anteriores) | `difficulty`, `[customGoalsTemplate]` |
| POST | `/abandon` | Abandona y archiva el reto activo sin borrarlo | - |

### Daily Logs (`/api/logs`)
| Método | Ruta | Descripción | Body Requerido |
| --- | --- | --- | --- |
| GET | `/` | Retorna un historial de Logs diarios de este Challenge | - |
| PUT | `/:date/goal/:goalId` | Marca un hábito como completado o pendiente y recalcula la racha/puntos | `completed` (boolean) |
| PUT | `/:date/metrics` | Permite subir peso, notas o el link de foto del día | `[weight]`, `[photoUrl]`, `[notes]` |
| POST | `/check-reset` | Evalúa rachas, check de días perdidos y crea el día actual si no existe | - |

### Side Quests (`/api/quests`)
| Método | Ruta | Descripción | Body Requerido |
| --- | --- | --- | --- |
| GET | `/` | Devuelve listado de Misiones Secundarias | - |
| POST | `/` | Crea una nueva misión extra | `title`, `difficulty`, `durationDays` |
| PUT | `/:id/progress`| Sincroniza un +1 en el progreso de días de la quest | - |
