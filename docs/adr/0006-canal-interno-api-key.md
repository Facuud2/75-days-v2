# Canal interno core→health protegido por API key compartida

`backend-health` expone `/internal/*` protegido por el header `x-internal-api-key`, y `backend-core` incluye un cliente para consumirlo. El objetivo era que core pudiera consultar el cumplimiento de dieta y entrenamiento para cerrar el día.

**Status**: proposed (implementado pero no cableado)

**Considered Options**: llamada directa con el JWT del usuario; acceso compartido a la base; API key de servicio.

**Consequences**: el canal está construido y responde correctamente, pero ningún controlador de core importa el cliente, así que la conformidad de dieta y entrenamiento no influye en la racha ni en los puntos. Si se activa, conviene revisar el manejo de fallos: el cliente lanza si el servicio no responde, y el cierre del día tendría que decidir qué hacer con esa caída.
