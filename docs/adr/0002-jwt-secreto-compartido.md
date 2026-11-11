# Un JWT firmado con secreto compartido como única autenticación entre servicios

`backend-core` emite el token y `backend-health` lo valida con el mismo `JWT_SECRET`, sin llamada de introspección al emisor. El payload solo lleva el `id` del usuario y el token dura 7 días.

**Status**: accepted

**Considered Options**: introspección contra el emisor en cada request; tokens de sesión opacos en una tabla compartida; un proveedor de identidad externo.

**Consequences**: cero latencia agregada y ningún estado compartido, a cambio de que rotar el secreto invalide todas las sesiones y de que no exista revocación individual. Un token filtrado es válido hasta su vencimiento. El secreto debe estar idéntico en ambos servicios o todo `backend-health` responde 401.
