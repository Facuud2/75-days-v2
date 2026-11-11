# Los logros se calculan al leer el perfil, no por eventos

Las seis definiciones de logro están codificadas en el controlador del perfil. En cada `GET /users/profile` se recalcula el progreso desde todo el historial del usuario y se hace upsert de cada logro.

**Status**: accepted

**Considered Options**: emitir eventos de dominio al completar un día y actualizar el logro en ese momento; un job periódico; cálculo puro sin persistencia.

**Consequences**: no hay que instrumentar cada acción que podría desbloquear un logro, y agregar un logro nuevo funciona retroactivamente sobre el historial existente. A cambio, una lectura escribe, el costo crece con el historial y el perfil puede fallar por una escritura. `challengesCompleted` nunca se incrementa, así que el logro que depende de él no puede desbloquearse.
