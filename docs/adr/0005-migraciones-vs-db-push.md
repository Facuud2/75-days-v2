# Migraciones versionadas en core, `db push` en health

`backend-core` mantiene migraciones SQL versionadas; `backend-health` aplica su esquema con `db push`, sin historial.

**Status**: accepted (con consecuencias negativas conocidas)

**Considered Options**: migraciones en ambos; `db push` en ambos; migraciones generadas desde un esquema único compartido.

**Consequences**: `db push` es rápido durante el prototipado, pero no deja rastro de los cambios ni permite revertir. El resultado ya es visible: dos modelos del esquema de core (`SideQuestTemplate` y `Achievement`) nunca llegaron a la base porque no se generó su migración, y `prisma migrate status` no lo detecta. Se recomienda migrar health a migraciones versionadas antes de cualquier cambio de esquema.
