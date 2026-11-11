# El cierre del día lo dispara el cliente, no el servidor

No hay cron ni job programado. El frontend llama a `check-reset` al iniciar sesión; ese endpoint calcula el día del reto, cierra el día anterior como `fail`, ajusta la racha y crea el registro del día actual.

**Status**: accepted

**Considered Options**: un cron nocturno por zona horaria; cierre perezoso al leer el reto; cierre por evento desde el cliente.

**Consequences**: no hace falta infraestructura de scheduling y el "hoy" respeta la zona del navegador, pero el estado del reto depende de que el usuario abra la aplicación. Un usuario que deja de entrar conserva una racha que debería haberse roto. El cálculo del día también depende de un desfase de zona horaria que envía el cliente y no se valida.
