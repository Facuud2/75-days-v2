# Dos servicios separados por dominio, con bases de datos independientes

El sistema se parte en `backend-core` (identidad, reto, metas, misiones, logros) y `backend-health` (nutrición, entrenamientos, estadísticas), cada uno con su propia base PostgreSQL y sin claves foráneas cruzadas.

**Status**: accepted

**Considered Options**: un único backend monolítico; dos servicios sobre una misma base; dos servicios con bases separadas.

**Consequences**: el aislamiento permite desarrollar y desplegar salud sin tocar el reto, pero obliga a mantener la consistencia del `userId` a nivel de aplicación. No hay transacciones que abarquen ambos dominios, y borrar un usuario deja datos huérfanos en la otra base. La duplicación de middleware de autenticación y de cliente Prisma es consecuencia directa.
