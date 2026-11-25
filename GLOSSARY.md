# 75 Days Challenge

Aplicación de retos personales de 75 días con seguimiento de hábitos diarios, nutrición y entrenamiento. El dominio se reparte entre dos servicios: uno de identidad y progreso del reto, y otro de salud.

## Language

### El reto

**Reto**:
Un período de 75 días que un usuario se compromete a cumplir, con un conjunto de metas diarias. Un usuario puede tener varios retos, pero solo uno activo.
_Avoid_: Desafío, challenge, plan

**Dificultad**:
El nivel de exigencia de un reto, que determina qué metas diarias se le asignan por defecto. Los valores son `Soft`, `Medium`, `Hard` y `Custom`.
_Avoid_: Nivel, modo, tipo

**Día del reto**:
El número ordinal del día dentro del reto, calculado desde la fecha de inicio. No es la fecha del calendario.
_Avoid_: Día actual, currentDay

**Racha**:
La cantidad de días consecutivos completados con éxito. Se incrementa al completar todas las metas de un día y se reinicia a cero cuando un día queda sin completar.
_Avoid_: Streak, cadena

**Puntos**:
La recompensa numérica acumulada por días completados. Cada día exitoso otorga 10 puntos; desmarcar una meta de un día exitoso resta 10.
_Avoid_: Score, monedas

### Las metas

**Meta diaria**:
Un hábito concreto que el usuario debe cumplir en un día específico del reto, como beber agua o entrenar.
_Avoid_: Tarea, hábito, objetivo

**Plantilla de meta**:
La definición de una meta a nivel del reto, de la cual se copian las metas diarias. Editar una plantilla no modifica los días ya creados.
_Avoid_: GoalTemplate, meta base

**Registro diario**:
El conjunto de metas de un día concreto, junto con el peso, la foto y las notas de ese día. Es la unidad que se marca como exitosa o fallida.
_Avoid_: Log, entrada, día

**Estado del día**:
La situación de un registro diario: `pending` (sin completar), `success` (todas las metas cumplidas) o `fail` (cerrado sin cumplir). El valor `rest` está previsto pero no se usa.
_Avoid_: Status, resultado

### Progreso extendido

**Misión secundaria**:
Un objetivo opcional y acotado en días, independiente del reto principal, que el usuario avanza de a un día por vez.
_Avoid_: Quest, side quest, desafío extra

**Plantilla de misión**:
Una misión del catálogo global que el usuario puede adoptar. Las misiones adoptadas son copias independientes.
_Avoid_: SideQuestTemplate

**Logro**:
Un reconocimiento que se desbloquea al alcanzar un umbral (primer día, racha de 7, 10 pesajes, etc.). Su progreso se recalcula a partir del historial.
_Avoid_: Achievement, medalla, badge

**Onboarding**:
La etapa posterior al registro en la que el usuario completa edad, peso, altura y peso objetivo antes de usar la aplicación.
_Avoid_: Configuración inicial, setup

### Salud

**Perfil de salud**:
Los datos nutricionales de un usuario: metas de calorías y macros, y peso y altura usados para estimar el gasto. Es independiente del reto y se crea de forma perezosa.
_Avoid_: Perfil nutricional, health profile

**Entrada de comida**:
Un alimento consumido en una fecha y una comida del día (desayuno, almuerzo, cena o snack), con sus calorías y macros.
_Avoid_: Meal, comida registrada

**Entrada de entrenamiento**:
Una sesión de actividad física en una fecha, con deporte, duración, intensidad, entorno opcional (en casa, gimnasio o aire libre) y calorías quemadas. Puede ser manual o provenir de Strava.
_Avoid_: Workout, actividad

**Entorno de entrenamiento**:
El lugar donde se realiza una entrada de entrenamiento: `En casa` o `Gimnasio` (ambos cuentan como entrenamiento indoor) o `Aire libre` (outdoor).
_Avoid_: Ubicación, locación

**Ingrediente**:
Un alimento base del catálogo global, con macros por cada 100 gramos. Es la materia prima de los alimentos personalizados.
_Avoid_: Food, alimento base

**Alimento personalizado**:
Una receta creada por un usuario a partir de ingredientes y sus gramos. Sus macros se derivan de los ingredientes al momento de guardarla.
_Avoid_: Custom food, receta

**Cumplimiento de dieta**:
La condición de haber consumido algo y no haber superado la meta calórica del día.
_Avoid_: Diet compliant

**Cumplimiento de entrenamiento**:
La condición de haber acumulado al menos 45 minutos de actividad en el día.
_Avoid_: Workout compliant
