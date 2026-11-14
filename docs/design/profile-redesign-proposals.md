# Perfil 75 Days — 3 direcciones de diseño

> Documento de planificación. No incluye código de implementación.
> Base analizada: `apps/frontend/app/profile/page.tsx`, `components/AchievementsModal.tsx`,
> `app/globals.css`, `components/Layout.tsx`, `lib/api/users.ts`, `lib/api/health.ts`,
> `apps/backend-core/src/controllers/userController.ts`.

---

## 1. Resumen ejecutivo

El perfil no se siente saturado por tener muchos datos, sino porque **todo pesa lo mismo**:
seis bloques con el mismo radio, el mismo borde, la misma densidad y ocho familias de color
compitiendo. La solución no es esconder información, sino **agruparla en tres secciones con
una jerarquía explícita y una sola voz de color**.

Las tres direcciones comparten la misma arquitectura de información:

1. **Retos** — reto actual + actividades dinámicas.
2. **Salud** — peso, nutrición y actividad deportiva.
3. **Logros** — sección propia, no una tarjeta entre medias.

La diferencia entre las tres propuestas es **cómo se navega** esa arquitectura y **cuánta
personalidad** se le pone encima.

---

## 2. Diagnóstico: por qué se siente saturado

| # | Hallazgo | Evidencia |
|---|----------|-----------|
| 1 | **Ocho familias de color** en una sola pantalla: rose, orange, emerald, yellow, red, blue, purple y el naranja de Strava. | `page.tsx:11-12, 175-177, 268, 343, 410, 645, 766, 793` |
| 2 | **Métricas duplicadas**: los mismos KPIs viven en la cabecera, en el reto y en la barra lateral. | Cabecera `251-256`; reto `277-305`; peso `574-639` |
| 3 | **Todo tiene el mismo peso visual**: mismo `rounded-[1.75rem]`, mismo borde, mismo padding. No hay un bloque que sea "el principal". | `266, 334, 404, 574, 642, 763` |
| 4 | **Tres lenguajes de progreso distintos** (barra, dona, línea) con colores distintos para el mismo concepto. | `294-304`, `676-681`, `592-621`, `687-717` |
| 5 | **Tipografía por debajo del mínimo legible**: `text-[9px]` y `text-[10px]` en datos y estados. | `534, 743, 839, 460` |
| 6 | **Emojis como iconos de logros**, enviados desde el backend, con clases Tailwind de color enviadas también desde el backend. | `userController.ts:94-99`, `AchievementsModal.tsx:37,63` |
| 7 | **Contraste insuficiente en modo claro** en los colores de logros: `text-yellow-500` sobre blanco = **1.92:1**. | Cálculo WCAG sobre `#EAB308` / `#FFFFFF` |
| 8 | **Datos simulados a cero** (`mockWeeklyWorkouts`, `mockCompletedChallenges`) que parecen datos reales. | `page.tsx:184-190, 204` |
| 9 | **Transición global** `* { transition: background-color… }` que anima cada elemento de la app y no respeta `prefers-reduced-motion` de forma global. | `globals.css:391-402` |
| 10 | **El esqueleto de carga bloquea todo el perfil** hasta que responde una sola petición. | `page.tsx:158` |

**Regla que deben cumplir las tres direcciones:** cada métrica vive en **una sola** sección.
La cabecera de identidad no repite estadísticas.

| Métrica | Vive en | Deja de aparecer en |
|---|---|---|
| Día actual / 75, racha | Retos | Cabecera |
| Retos completados | Retos | Cabecera |
| Peso actual, kg perdidos, meta, IMC | Salud · Peso | Cabecera |
| kcal de hoy, macros, comidas | Salud · Nutrición | — |
| Entrenamientos recientes, Strava | Salud · Actividad | — |
| Logros desbloqueados / total | Logros | Cabecera |

---

## 3. Arquitectura de información común

### 3.1 Contenido por sección

**Identidad (cabecera, no es una sección)**
- Avatar, nombre, nivel, "miembro desde", botón Editar.
- Sin estadísticas. Altura objetivo: 88–112 px en móvil.

**01 · Retos**
- Reto actual: nombre, día X/75, barra, estado de hoy, CTA "Continuar el día X" → `/dashboard`.
- Racha y retos completados como datos secundarios.
- Actividades dinámicas: máximo 2–3 activas visibles + **una** CTA "Descubrir actividades"
  que abre un sheet/página con el catálogo completo y el botón Suscribirse.
- Historial de retos completados: solo si hay datos reales; hoy está vacío.

**02 · Salud**
- **Peso**: peso actual, delta desde el inicio, meta, IMC, gráfico de línea con banda de meta.
- **Nutrición**: kcal consumidas / meta, macros, últimas comidas, "+ Registrar comida".
- **Actividad**: entrenamientos recientes, minutos, Strava, "+ Registrar entrenamiento".
- Cada módulo tiene su propio estado vacío y su propia acción. Nunca tres módulos vacíos
  con un texto genérico.

**03 · Logros**
- Resumen: X de Y, barra o anillo de progreso.
- Últimos desbloqueados (3 máximo).
- "Próximo logro" con progreso concreto ("te faltan 2 días").
- "Ver todos" → sheet/página con filtros por categoría.

**Cuenta (pie, no sección)**
- Editar perfil, Ajustes, Cerrar sesión.

### 3.2 Qué se queda como modal/sheet

Se mantienen y se reutilizan: `LogMealModal`, `LogWorkoutModal`, `EditProfileModal`,
`EditMealModal`, `QuickActionsSheet`.

Se mueven fuera de la página:
- Catálogo completo de actividades dinámicas → sheet o ruta `/profile/retos`.
- Todos los logros → sheet de pantalla completa en móvil, página en desktop.

Se elimina como bloque inline:
- La lista completa de "Nuevas actividades disponibles" (`page.tsx:499-564`).
- La cuadrícula de logros dentro del perfil (`page.tsx:359-394`).

### 3.3 Estados

- **Carga**: skeleton **por sección**, no de página completa. La identidad aparece primero.
- **Error**: mensaje inline en la sección afectada + "Reintentar"; el resto sigue usable.
- **Vacío**: una frase + una acción. Sin ilustraciones decorativas.
- **Sin reto activo**: tarjeta con CTA "Empezar un reto", no un borde punteado con texto.

---

## 4. Sistema de tokens común

### 4.1 Dos niveles

**Primitivos** (nombran el valor): `--rose-*`, `--ink-*`, `--lime-*`, `--amber-*`…
**Semánticos** (nombran el trabajo): `--surface-page`, `--text-muted`, `--accent-fill`…

Los componentes solo usan semánticos. Los primitivos existen para que el selector de paleta
del usuario siga funcionando.

| Grupo | Tokens |
|---|---|
| Superficies | `--surface-page`, `--surface-card`, `--surface-inset`, `--surface-raised` |
| Texto | `--text-primary`, `--text-secondary`, `--text-muted`, `--text-on-accent` |
| Bordes | `--border-subtle`, `--border-control` (≥3:1), `--divider` |
| Acción | `--accent-text`, `--accent-fill`, `--accent-fill-hover`, `--on-accent`, `--focus-ring` |
| Estado | `--status-success`, `--status-warning`, `--status-danger`, `--status-info` |
| Datos | `--chart-weight`, `--chart-protein`, `--chart-carb`, `--chart-fat`, `--progress-track`, `--progress-fill` |
| Forma | `--radius-card`, `--radius-sheet`, `--radius-control`, `--section-gap` |

### 4.2 Reglas

1. **Un solo acento por pantalla.** El acento se usa para la acción principal y el progreso.
   Los estados solo aparecen cuando hay un estado real.
2. **Nunca color como único portador de significado.** Todo estado lleva icono + texto.
3. **Bordes de control ≥ 3:1** contra la superficie. Los separadores decorativos pueden ser sutiles.
4. **Texto normal ≥ 4.5:1**; texto grande ≥ 3:1.
5. **Un solo mecanismo de tema**: los tokens se definen bajo `html[data-appearance]`;
   la clase `.dark` queda solo para la variante `dark:` de Tailwind.
6. **Sin emojis como iconos.** Set único: Lucide, trazo 1.5, tamaños 16/20/24.
7. **Sin clases de color enviadas desde la API.** El backend envía `key` + `category` +
   `tier`; el frontend mapea a icono y token.
8. **Transiciones solo en superficies interactivas**, 120–200 ms, y `prefers-reduced-motion`
   desactiva todo lo que no sea cambio de estado.
9. **Radios con escala**: control 10/12, tarjeta 16, sección/sheet 24. No mezclar 1.75rem
   con 2rem al azar.
10. **Espaciado 4/8**: 4, 8, 12, 16, 24, 32, 48.

### 4.3 Migración desde lo actual

| Actual | Nuevo |
|---|---|
| `--app-bg`, `--app-surface`, `--app-surface-raised` | `--surface-page`, `--surface-card`, `--surface-raised` |
| `--app-text`, `--app-text-secondary`, `--app-text-muted` | `--text-primary`, `--text-secondary`, `--text-muted` |
| `--app-border`, `--app-border-strong` | `--border-subtle`, `--border-control` |
| `--profile-hero`, `--profile-shell`, `--profile-stat-*` | Se eliminan; la cabecera usa superficies estándar |
| `--profile-avatar-text`, `--profile-level-*` | `--accent-text` + `--accent-fill` |
| `--color-rose-*` | Se conserva como primitivo del acento (selector de paleta) |

---

## 5. Dirección A — "Índice"

**Idea:** una portada breve con tres entradas. El perfil deja de ser un tablero y pasa a ser
un **índice de tres grupos**; el detalle se abre solo cuando se pide.

### 5.1 Estructura de la pantalla

```
┌──────────────────────────────────┐
│ (avatar)  Nombre            Editar│
│           Nivel 6 · mar 2026      │
├──────────────────────────────────┤
│ 01  RETOS                    Día 42│  ← abierto por defecto
│     Reto actual · 42/75           │
│     ▓▓▓▓▓▓▓▓░░░░░░  56%           │
│     [ Continuar el día 42 ]       │
│     3 actividades activas      →  │
├──────────────────────────────────┤
│ 02  SALUD                  72,4 kg│  ← colapsado
│     −3,2 kg · 1.840 kcal hoy      │
├──────────────────────────────────┤
│ 03  LOGROS                    4/12│  ← colapsado
│     Último: Constancia            │
├──────────────────────────────────┤
│ Editar perfil · Ajustes · Salir   │
└──────────────────────────────────┘
```

Cada fila del índice es un **acordeón** (botón + región). En desktop las tres secciones
se muestran expandidas en dos columnas, con una barra lateral de identidad sticky.

### 5.2 Orden de secciones

Identidad → Retos (abierto) → Salud (colapsado) → Logros (colapsado) → Cuenta.

### 5.3 Qué se ve primero en móvil

Avatar + nombre + **Retos abierto**. El primer viewport contiene: identidad, día 42/75,
barra, CTA y el acceso a actividades. Salud y Logros aparecen como dos líneas de resumen.

### 5.4 Componentes recomendados

- `IdentityRow` (avatar 52, nombre, nivel, editar como icono con label accesible).
- `SectionAccordion` (botón `aria-expanded`, `aria-controls`, chevron; sin card anidada).
- `SummaryLine` (una cifra + una frase; soporta 1 o 2 datos).
- `ProgressBar` (4 px, `role="progressbar"`).
- `Sparkline` (SVG, 48×120, sin ejes; resumen de peso).
- `MetricRow` (label + valor + delta).
- `Sheet` (bottom en móvil, lateral 480 px en desktop).
- `EmptyState` (frase + un botón).
- `AchievementRow` (icono Lucide 20, título, fecha en mono, check).

### 5.5 Paleta

Acento único rose, superficies neutras cálidas y grises. Sin degradados, sin sombras,
sin tarjetas tintadas por módulo.

| Rol | Oscuro | Claro |
|---|---|---|
| `--surface-page` | `#0D0E10` | `#F7F6F3` |
| `--surface-card` | `#16171A` | `#FFFFFF` |
| `--surface-inset` | `#1D1F23` | `#FBFAF7` |
| `--border-subtle` | `#2A2C31` | `#E3E1DB` |
| `--border-control` | `#666A71` | `#7D7C74` |
| `--text-primary` | `#F4F4F5` | `#18181B` |
| `--text-secondary` | `#D4D4D8` | `#3F3F46` |
| `--text-muted` | `#A1A1AA` | `#57534E` |
| `--accent-text` | `#F43F5E` | `#BE123C` |
| `--accent-fill` | `#E11D48` | `#BE123C` |
| `--on-accent` | `#FFFFFF` | `#FFFFFF` |
| `--status-success` | `#34D399` | `#047857` |
| `--status-warning` | `#FBBF24` | `#A16207` |
| `--status-danger` | `#F87171` | `#B91C1C` |

**Contraste medido (calculado sobre los pares declarados):**
oscuro — muted 6.99:1, acento 4.88:1, texto sobre acento 4.70:1, borde de control 3.30:1.
claro — muted 7.63:1, acento 6.29:1, texto sobre acento 6.29:1, borde de control 4.19:1.

**Nota de rigor:** el acento (16.4°) y el estado peligro (22.2°) están a 5.8° en OKLCH.
Para no violar "un color, un significado", en A las acciones destructivas **nunca** son un
botón rojo relleno: se representan como botón outline con icono + etiqueta + confirmación.
Si se prefiere separar los tonos, el acento puede moverse a `#DB2777` (0.6°, 21.6° de
separación), pero cambia el rosa de marca.

### 5.6 Tipografías

- **UI y cuerpo:** Inter 400/500/600 (ya cargada).
- **Datos y metadatos:** JetBrains Mono 500 (ya cargada).
- Escala: 12 / 14 / 16 / 20 / 26 / 34. Cuerpo 15–16 px, línea 1.5. Cifras tabulares.
- Sin fuente display nueva: el carácter viene del espacio y de la línea fina, no del tipo.

### 5.7 Logros y progreso

- **Progreso:** cifra primero, barra después. Una sola barra para todo (reto, logro, macros).
- **Logros:** resumen "4 de 12" + barra + 3 filas de desbloqueados + "Próximo" con progreso.
  Bloqueados en gris neutro legible (≥4.5:1), nunca en opacidad 50 %.
- **Todos los logros:** sheet con filtros (Todas / Constancia / Salud / Retos) y lista de
  2 columnas. Paginación "Ver más" de 12 en 12.
- **Peso:** línea fina con banda de meta; el texto resume ("−3,2 kg; faltan 4,8 kg").
- Sin insignias doradas, sin brillos, sin emojis.

### 5.8 Retos actuales y actividades

- Una tarjeta de reto: etiqueta "Reto actual", nombre, día, barra, estado de hoy y **una**
  CTA primaria "Continuar el día 42".
- Actividades: 2 filas de activas con progreso + enlace "Descubrir actividades".
- El catálogo completo (8+ tarjetas) sale de la página y vive en un sheet.
- El historial de completados solo aparece si hay datos; si no, no se renderiza.

### 5.9 Responsive

- **375:** una columna, 16 px de gutter, acordeones, targets ≥44 px, `pb-28` por la bottom nav.
- **768:** identidad en fila; Salud en 2 columnas dentro de su acordeón; acciones a la derecha.
- **1024:** sidebar de identidad sticky (4 cols) + contenido (8 cols); las tres secciones
  abiertas; el índice actúa como navegación por anclas.
- **1440:** `max-width: 1120px`; misma estructura, más aire.
- El acordeón solo existe en móvil/tablet; en desktop no se oculta contenido.

### 5.10 Accesibilidad

- Acordeones nativos (`<button aria-expanded>` + región), sin `div` clicables.
- Anclas con `scroll-margin-top` equivalente a la altura del header.
- Un solo `h1`; cada sección `h2`; cada tarjeta `h3`.
- Foco visible de 2 px con `--focus-ring` (≥3:1).
- Barras con `role="progressbar"`, `aria-valuenow/min/max` y texto visible equivalente.
- Gráfico de peso con tabla `sr-only` y resumen textual.
- Sin animación de entrada; solo transiciones de estado de 120–150 ms.

### 5.11 Ventajas

- Es la dirección que **más reduce la saturación**: una acción principal y dos resúmenes.
- Lectura en 3 segundos: "día 42, −3,2 kg, 4/12 logros".
- La más accesible y la más barata de construir: reutiliza tipografías y modales.
- Escala bien: un grupo nuevo = una fila más del índice; un logro nuevo = una fila más.

### 5.12 Problemas

- Exige un toque más para llegar a nutrición o actividad.
- En desktop puede sentirse vacía si las secciones no tienen datos.
- El acordeón oculta el detalle que el usuario quizá quiere ver siempre.
- Riesgo de que "Salud" quede enterrada bajo Retos.

---

## 6. Dirección B — "Pulso"

**Idea:** el perfil responde primero **cómo vas**. Una tarjeta de pulso con el día, la racha
y el peso; debajo, tres pestañas que agrupan Retos, Salud y Logros. Un solo acento, tres
números, cero decoración.

### 6.1 Estructura de la pantalla

```
┌──────────────────────────────────┐
│ (av) Nombre · Nivel 6        ✎   │
│ ┌──────────────────────────────┐ │
│ │   ◯ 42/75     racha 12       │ │
│ │   −3,2 kg     4/12 logros    │ │
│ └──────────────────────────────┘ │
│ [ Retos ] [ Salud ] [ Logros ]   │ ← sticky
├──────────────────────────────────┤
│ RETOS                            │
│ Reto actual · día 42 de 75       │
│ ▓▓▓▓▓▓▓▓▓▓░░░░░  56%             │
│ Estado de hoy: 3 de 6 tareas     │
│ [ Continuar el día 42 ]          │
│                                  │
│ Activas (3)                      │
│ ○ Agua · 5/7        ○ Leer · 2/5 │
│ Descubrir actividades         →  │
└──────────────────────────────────┘
```

### 6.2 Orden de secciones

Identidad compacta → Pulso → pestañas (Retos por defecto) → contenido de la pestaña.
En desktop no hay pestañas: las tres secciones se apilan con una sub-navegación sticky,
para no esconder contenido donde hay espacio.

### 6.3 Qué se ve primero en móvil

La tarjeta de pulso: **día 42/75** (anillo), racha y peso. Debajo, la pestaña **Retos**
activa con la CTA "Continuar el día 42". El avatar y el nombre son una fila discreta, no un hero.

### 6.4 Componentes recomendados

- `IdentityRow` compacta (avatar 44, nombre, nivel, editar).
- `PulseCard`: anillo 72 px + 2 métricas secundarias. Máximo 3 números.
- `SectionTabs` con ARIA completo (roving tabindex, flechas, `aria-controls`).
- `ProgressRing` (un valor contra una meta; solo día y kcal).
- `ProgressBar` (listas: logros, actividades).
- `ChallengeCard` (nombre, día, estado de hoy, CTA).
- `QuestRow` / `QuestCard` (dificultad como chip de texto + icono, no solo color).
- `NutritionSummary` (anillo kcal + barra apilada de macros + última comida).
- `WorkoutRow` (deporte, duración, kcal, distancia).
- `AchievementTile` (icono Lucide, título, fecha, progreso).
- `NextAchievementCard` ("te faltan 2 días").
- `Sheet` para registrar y para "ver todos".

### 6.5 Paleta

Grafito frío + rose de marca + semánticos fríos. El progreso siempre en acento; el éxito
solo cuando algo está completado; el aviso solo cuando hay un umbral.

| Rol | Oscuro | Claro |
|---|---|---|
| `--surface-page` | `#0E1013` | `#F7F5F2` |
| `--surface-card` | `#171A1F` | `#FFFFFF` |
| `--surface-inset` | `#20242B` | `#FBF9F6` |
| `--border-subtle` | `#2E333B` | `#E4E0D9` |
| `--border-control` | `#6A7180` | `#7A7770` |
| `--text-primary` | `#F5F6F8` | `#18181B` |
| `--text-secondary` | `#D5D9E0` | `#3F3F46` |
| `--text-muted` | `#A5ACB8` | `#57534E` |
| `--accent-text` | `#FB7185` | `#BE123C` |
| `--accent-fill` | `#E11D48` | `#BE123C` |
| `--on-accent` | `#FFFFFF` | `#FFFFFF` |
| `--status-success` | `#34D399` | `#047857` |
| `--status-warning` | `#FBBF24` | `#A16207` |
| `--status-danger` | `#FF5C38` | `#B91C1C` |
| `--status-info` | `#38BDF8` | `#0369A1` |
| `--chart-protein` | `#60A5FA` | `#1D4ED8` |
| `--chart-carb` | `#FB923C` | `#C2410C` |
| `--chart-fat` | `#A78BFA` | `#6D28D9` |

**Contraste medido:** oscuro — muted 7.64:1, acento 6.48:1, texto sobre acento 4.70:1,
borde de control 3.56:1, peligro 5.68:1, macros 6.86 / 7.71 / 6.41:1.
claro — muted 7.63:1, acento 6.29:1, control 4.47:1, macros 6.70 / 5.18 / 7.10:1.

**Separación de tonos (OKLCH):** acento 13.4°, peligro 34.0° (20.6° de separación),
aviso 84.4°, éxito 163.2°, info 232.7°. Los colores de macros son **categorías de dato**,
no estados: siempre van con etiqueta y valor, nunca solos.

### 6.6 Tipografías

- **Titulares y cifras:** Barlow Condensed 600/700. El 42/75 se lee como marcador deportivo.
- **Cuerpo y UI:** Inter 400/500/600.
- **Metadatos:** JetBrains Mono 500 para fechas y unidades.
- Escala: 12 / 14 / 16 / 18 / 24 / 40 / 64. Cifras tabulares en todos los KPIs.
- Solo se carga una fuente nueva (Barlow Condensed), subset latin, `display: swap`.

### 6.7 Logros y progreso

- **Pulso:** anillo de 72 px con "42/75" dentro; dos datos al lado (racha, kg). Sin cuarto dato.
- **Logros:** pestaña propia con anillo "4/12", tarjeta "Siguiente logro" con progreso real,
  cuadrícula 4-up de badges y "Ver todos".
- **Regla de lenguaje:** anillo solo para "un valor contra una meta" (día, kcal); barra para
  listas (logros, actividades). Nunca los dos para lo mismo.
- **Peso:** línea con banda de meta y delta en chip; sin dona.
- **Desbloqueo:** una sola animación de 200 ms al entrar con `?nuevo=`, respetando
  `prefers-reduced-motion`. Sin confeti.

### 6.8 Retos actuales y actividades

- Tarjeta de reto con progreso + **estado de hoy** ("3 de 6 tareas") porque es lo que
  conecta el perfil con la acción diaria.
- Actividades activas como filas compactas con progreso.
- "Descubrir actividades" abre un sheet con el catálogo, dificultad, duración y Suscribirse.
- Suscripción con estado de carga en el propio botón y feedback por toast.
- Retos completados: solo con datos reales, en una fila de 3.

### 6.9 Responsive

- **375:** una columna; pulso + tabs sticky bajo el header; contenido de una pestaña.
  Altura del header + tabs ≤ 168 px para no comerse el viewport.
- **768:** pulso en fila (anillo + 3 datos); Salud en 2 columnas; tabs siguen.
- **1024:** sin tabs; las tres secciones apiladas con sub-nav sticky; Salud en grid
  `2 / 1 / 1` (peso 2 columnas, nutrición y actividad 1).
- **1440:** `max-width: 1200px`; el pulso ocupa 8 columnas y las acciones 4.
- La bottom nav se respeta con `padding-bottom` y `scroll-margin-bottom`.

### 6.10 Accesibilidad

- Tabs reales: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`,
  panel `role="tabpanel"`, flechas ←/→, Home/End, foco visible.
- En desktop, si se sustituyen por anclas, no duplicar IDs ni roles.
- El anillo lleva texto visible ("42/75") y `role="progressbar"`; el color no informa solo.
- El chip de dificultad lleva palabra ("Fácil"), no solo color.
- El estado de hoy lleva icono + texto.
- Los gráficos tienen resumen textual y tabla alternativa.
- Contraste verificado en ambos temas; foco ≥3:1; targets ≥44 px.

### 6.11 Ventajas

- Responde "¿cómo voy?" antes que nada, que es el trabajo real del perfil en un reto de 75 días.
- Reduce la saturación **por estructura**: una sección visible cada vez en móvil.
- Escala de forma natural: sección nueva = pestaña nueva; métrica nueva = módulo de Salud.
- Mantiene la energía del producto sin los ocho colores actuales.
- El pulso es un componente reutilizable en dashboard y calendario.

### 6.12 Problemas

- Las pestañas esconden contenido; Logros puede recibir menos visitas.
- Conviven header de app + tabs + bottom nav: hay que cuidar la altura en móvil.
- Requiere implementar ARIA de tabs correctamente; mal hecho es peor que un scroll.
- El anillo y la tarjeta de pulso pueden volver a introducir densidad si se añaden métricas.

---

## 7. Dirección C — "Bitácora"

**Idea:** el perfil como **cuaderno de entrenamiento**. Tipografía editorial, números grandes,
una regla de 75 marcas y logros como sellos. Es la opción con más carácter y la que menos se
parece a una app de fitness genérica.

### 7.1 Estructura de la pantalla

```
┌──────────────────────────────────┐
│ BITÁCORA · MARZO 2026            │
│ Nombre                        ✎  │
│                                  │
│ 42                               │
│ de 75 · racha 12                 │
│ ─────────────────────────────    │
│ ▮▮▮▮▮▮▮▮▮▮▮▮▯▯▯▯▯▯▯▯▯▯▯▯▯▯       │
├──────────────────────────────────┤
│ 01 Retos  02 Salud  03 Logros    │ ← chips/anclas
├──────────────────────────────────┤
│ 01 — RETOS                       │
│ Reto actual                      │
│ ...                              │
│ ACTIVIDADES · ÍNDICE             │
│ 01 Agua 7 días        Suscribir  │
│ 02 Leer 5 días        Suscribir  │
└──────────────────────────────────┘
```

### 7.2 Orden de secciones

Portada (nombre + día + regla de 75) → índice de capítulos → 01 Retos → 02 Salud → 03 Logros
→ colofón (cuenta).

### 7.3 Qué se ve primero en móvil

La portada: **"42"** en serif a 72 px, "de 75", racha, y la regla de 75 marcas. Debajo, el
índice de capítulos. Es lo más memorable de las tres y lo que menos se parece a un dashboard.

### 7.4 Componentes recomendados

- `Masthead` (kicker "BITÁCORA", mes, nombre, editar como enlace de texto).
- `DayRule`: 75 marcas, 10 por grupo, con marcas completadas en acento y la actual con
  un punto; texto alternativo "42 de 75 días completados".
- `ChapterIndex` (chips/anclas con número y título).
- `ChapterHeader` ("01 — RETOS", hairlines).
- `StampGrid` (logros como sellos 3-up con fecha en mono).
- `LedgerRow` (dato + valor + delta, alineado como tabla).
- `ActivityIndexRow` (número, título, duración, "Suscribir" como botón de texto).
- `InlineStat` (cifra serif + etiqueta).
- `Sheet` para registrar y ver todos.

### 7.5 Paleta

Tinta verde-negra + papel cálido. El acento es lima en el preset "Bitácora"; como el selector
de paleta del usuario reasigna el ramp de acento, cambiar a soft-blue o bamboo mantiene el
layout y solo cambia la tinta. En claro, el acento se oscurece para poder usarse como texto.

| Rol | Oscuro | Claro |
|---|---|---|
| `--surface-page` | `#0D0F0E` | `#F4F3EC` |
| `--surface-card` | `#161918` | `#FFFFFF` |
| `--surface-inset` | `#1F2321` | `#FAF9F3` |
| `--border-subtle` | `#2D322F` | `#E0DED4` |
| `--border-control` | `#6A736A` | `#7C7F74` |
| `--text-primary` | `#F2F4F0` | `#151714` |
| `--text-secondary` | `#CDD3CE` | `#3A3D38` |
| `--text-muted` | `#9BA49D` | `#55584F` |
| `--accent-text` | `#D6F26B` | `#3F6212` |
| `--accent-fill` | `#C7E85A` | `#4D7C0F` |
| `--on-accent` | `#15180A` | `#FFFFFF` |
| `--status-success` | `#34D399` | `#047857` |
| `--status-warning` | `#FB923C` | `#B45309` |
| `--status-danger` | `#F87171` | `#B91C1C` |
| `--status-info` | `#7DD3FC` | `#0369A1` |

**Contraste medido:** oscuro — muted 6.90:1, acento 14.14:1, tinta sobre acento 12.96:1,
borde de control 3.60:1, peligro 6.40:1. claro — muted 7.25:1, acento 7.08:1,
texto sobre acento 4.99:1, control 4.08:1.

**Separación de tonos (OKLCH):** acento 119.5°, éxito 163.2°, aviso 55.9°, peligro 22.2°,
info 230.3°. Todas las diferencias superan 15°. El acento lima **nunca** se usa como texto
en claro: para texto se usa `#3F6212`.

### 7.6 Tipografías

- **Display y capítulos:** Fraunces 500/600 (serif variable, óptica grande). Solo ≥20 px.
- **Cuerpo y UI:** Inter 400/500/600.
- **Datos, fechas y marcas:** JetBrains Mono 400/500.
- Escala: 12 / 14 / 16 / 20 / 26 / 38 / 72. El 72 es exclusivo del día del reto.
- Se carga una fuente nueva (Fraunces), subset latin, con ejes limitados para no pesar.

### 7.7 Logros y progreso

- **Progreso del reto:** regla de 75 marcas, no un anillo. Cada 10 marcas un espacio; la
  marca actual con un punto. Es el detalle memorable de la dirección.
- **Peso:** línea fina con dos anotaciones (inicio y hoy) y el delta como cifra serif.
- **Nutrición:** ledger de cifras (kcal, P/C/G) con una barra apilada pequeña; sin dona.
- **Logros:** "Medallero" como sellos; desbloqueados con hairline de acento y fecha en mono;
  bloqueados con progreso "3/7" en texto. Categorías como capítulos.
- **Todos los logros:** página/sheet con filtros y sellos 3-up; no se degrada el contraste
  de los bloqueados.

### 7.8 Retos actuales y actividades

- Apertura de capítulo: "RETO ACTUAL", nombre, y el día como cifra grande; estado de hoy
  en una línea; CTA de texto subrayado o botón outline (no relleno).
- Actividades como **índice numerado**: 01, 02, 03 con duración y "Suscribir" al final.
  Menos tarjetas, más lista: reduce ruido y escala a 20 actividades.
- El catálogo completo es una página de índice, no una cuadrícula de tarjetas.

### 7.9 Responsive

- **375:** una columna; portada con 72 px; chips de capítulo con scroll horizontal y
  botones de navegación visibles; regla de 75 con marcas de 3 px.
- **768:** portada en dos columnas (día + datos); Salud en 2 columnas; sellos 4-up.
- **1024:** índice de capítulos sticky a la izquierda (3 cols) + contenido (9 cols);
  grid asimétrico para Salud (peso 7 / nutrición 5; actividad 12).
- **1440:** `max-width: 1160px`; medidas de texto limitadas a 68 caracteres.
- En desktop se mantiene el aire editorial; no se convierte en dashboard.

### 7.10 Accesibilidad

- La regla de 75 lleva texto alternativo y `role="img"` con `aria-label` completo; si es
  interactiva, cada marca debe ser focusable o existir una vista de lista equivalente.
- Fraunces solo en tamaños grandes; el cuerpo siempre Inter para legibilidad.
- Chips de capítulo como enlaces/anclas, no como tabs falsas; foco visible.
- Sellos con nombre y fecha en texto, no solo icono.
- Sin animaciones de tinta ni parallax; transición de 150 ms en hover/foco.
- Contraste de todos los pares declarados verificado; el lima no se usa como texto en claro.

### 7.11 Ventajas

- Es la más **distintiva y memorable**; no se confunde con otra app de fitness.
- La regla de 75 y el día en serif comunican el reto mejor que un anillo genérico.
- El índice de actividades escala muy bien a muchos retos sin añadir tarjetas.
- El modo claro tipo papel es especialmente agradable para lectura.

### 7.12 Problemas

- Es la más costosa: fuente nueva, layout editorial, regla de 75 y sellos.
- Más riesgo de accesibilidad por la tipografía serif y los elementos gráficos.
- El carácter editorial puede chocar con el resto de la app (dashboard y calendario siguen
  un lenguaje más convencional).
- Menos "escaneable" que A o B: la lectura es más pausada.
- Si el usuario cambia de paleta, el lima pierde protagonismo y la identidad se diluye.

---

## 8. Comparativa

Puntuación 1–5 según las prioridades del brief.

| Criterio | A · Índice | B · Pulso | C · Bitácora |
|---|---|---|---|
| Mobile-first | 5 | 4 | 4 |
| Lectura rápida | 5 | 5 | 3 |
| Jerarquía visual | 5 | 4 | 4 |
| Accesibilidad | 5 | 4 | 3 |
| Pocos elementos decorativos | 5 | 4 | 3 |
| Escalabilidad (más logros/estadísticas) | 4 | 5 | 4 |
| Identidad / memorabilidad | 2 | 4 | 5 |
| Esfuerzo de implementación | Bajo | Medio | Alto |
| Riesgo de regresión | Bajo | Medio | Alto |
| Encaje con el resto de la app | 4 | 5 | 3 |

---

## 9. Recomendación

**Recomiendo la Dirección B — "Pulso", aplicando la disciplina de tokens y estados de A.**

### Por qué

1. **El trabajo del perfil en un reto de 75 días es responder "¿cómo voy?".** B lo hace en
   el primer viewport con tres números, sin repetir métricas en tres sitios.
2. **Resuelve la saturación por estructura, no por decoración.** En móvil se ve un grupo a
   la vez; el pulso sustituye al hero + cuatro KPIs + tarjeta de reto que hoy compiten.
3. **Conserva la motivación sin el ruido actual.** Un solo acento, un solo lenguaje de
   progreso por tipo de dato, y el estado de hoy conectado con la acción diaria.
4. **Escala.** Añadir "Sueño" o "Pasos" es un módulo de Salud; añadir una categoría de logros
   es un filtro; añadir una sección es una pestaña. Nada obliga a rediseñar.
5. **Es la más coherente con el resto de la app**, que ya usa una navegación superior y una
   bottom nav; unas pestañas internas de 3 elementos son un patrón conocido.

### Qué tomar de las otras

- **De A:** la cabecera de identidad sin estadísticas, los estados vacíos con una sola acción,
  la disciplina de un único acento y la escala de radios/espaciado.
- **De C:** la regla de 75 marcas como detalle opcional dentro del pulso (en lugar del anillo,
  si se quiere más carácter sin cargar una fuente nueva).

### Cuándo elegir otra

- **A** si el equipo quiere el menor esfuerzo, la menor regresión y la máxima claridad;
  es la opción más segura.
- **C** si el objetivo es diferenciación de marca y hay presupuesto para rediseñar también
  dashboard y calendario para que no se sientan de otra app.

---

## 10. Plan de implementación (sin código)

**Fase 0 — Tokens y limpieza (1 sprint corto)**
- Consolidar `--app-*` y `--profile-*` en superficies/texto/borde/acento/estado.
- Eliminar colores por módulo y clases de color venidas de la API.
- Normalizar radios, espaciados y tamaños mínimos de texto (nada por debajo de 12 px).
- Corregir contraste en modo claro; medir los pares renderizados.

**Fase 1 — Arquitectura**
- Cabecera de identidad sin KPIs.
- Tres contenedores: Retos, Salud, Logros.
- Repartir métricas según la tabla de la sección 2.
- Skeletons por sección; errores inline.

**Fase 2 — Contenido**
- Retos: tarjeta actual + actividades activas + "Descubrir" en sheet.
- Salud: peso, nutrición, actividad con acción propia.
- Logros: resumen, últimos, siguiente, "Ver todos" con filtros.
- Sustituir el modal de logros por sheet/página y eliminar emojis.

**Fase 3 — Datos y rendimiento**
- Backend de logros: `key`, `category`, `tier` en lugar de emoji + clase de color.
- No renderizar métricas sin datos (quitar los `mock*` en cero).
- Carga diferida de Recharts; sparkline SVG en el pulso.
- Medir LCP y JS inicial antes/después.

**Fase 4 — Validación**
- axe-core sin Critical/Serious.
- Teclado completo en 375, 768 y 1024.
- Lector de pantalla (VoiceOver/TalkBack) en el flujo de registro de comida y logros.
- Zoom 200 %, `prefers-reduced-motion`, ancho 320 px.
- Prueba de 3 segundos: ¿el usuario responde día, tendencia de peso y próxima acción?

---

## 11. Validación de color

Los valores de contraste de este documento están **calculados sobre los pares de tokens
declarados** (fórmula WCAG 2.x, luminancia relativa). No se han medido aún en el navegador
con el tema aplicado, por lo que quedan como **pendientes de verificación**:

- contraste renderizado con opacidades y fondos compuestos;
- modo claro y oscuro en la app real;
- foco visible sobre cada superficie;
- gráficos y chips con sus etiquetas;
- axe-core y teclado.

Todos los pares de texto principal, secundario y muted superan 4.5:1; los bordes de control
superan 3:1; el texto sobre rellenos de acento supera 4.5:1 en las tres direcciones.

---

## 12. Decisiones abiertas para el equipo

1. ¿Se mantiene rose como acento por defecto en las tres, o C usa el preset lima?
2. ¿El detalle de cada sección es una ruta (`/profile/salud`) o un sheet?
3. ¿Las pestañas de B se convierten en anclas en desktop o se mantienen?
4. ¿Se cambia el contrato de logros del backend en esta iteración o se mapea en el frontend?
5. ¿Se elimina el historial de retos completados hasta que existan datos reales?
