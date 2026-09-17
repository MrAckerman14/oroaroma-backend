# Convencion de ramas y entrega

## Ramas permanentes

- `master`: version estable de produccion. Solo recibe pull requests aprobados.
- `testing`: integracion compartida. Cada push con CI aprobado se despliega automaticamente en `oroaroma-testing.protostages.com`.

Produccion no se despliega desde `testing`. Un release probado se integra a `master` mediante pull request y un despliegue de produccion separado y manual.

## Ramas de trabajo

Todas nacen desde `testing`, tienen un objetivo pequeno y vuelven a `testing` mediante pull request:

- `feature/<area>-<descripcion>`: funcionalidad nueva. Ejemplo: `feature/storage-r2-provider`.
- `fix/<area>-<descripcion>`: correccion funcional normal. Ejemplo: `fix/auth-refresh-session`.
- `bugfix/<area>-<descripcion>`: defecto confirmado durante desarrollo o testing.
- `hotfix/<descripcion>`: incidente urgente de produccion; nace desde `master` y luego se integra tambien a `testing`.
- `release/<version>`: estabilizacion de una version candidata, sin funcionalidades nuevas.
- `chore/<descripcion>`: infraestructura, dependencias o mantenimiento sin cambio funcional.
- `docs/<descripcion>`: documentacion solamente.
- `test/<descripcion>`: cobertura o infraestructura de pruebas.

No se usan ramas personales permanentes. El nombre describe el cambio, no la persona.

## Flujo diario

1. Actualizar referencias remotas: `git fetch --all --prune`.
2. Actualizar `testing`: `git switch testing` y `git pull --ff-only`.
3. Crear la rama: `git switch -c feature/nombre-corto`.
4. Hacer commits pequenos con mensajes imperativos y claros.
5. Abrir un pull request hacia `testing`; CI debe estar verde y otra persona debe revisar cambios de riesgo medio o alto.
6. Fusionar sin commits ajenos ni secretos. El push resultante a `testing` activa el despliegue de pruebas.

## Releases y correcciones urgentes

- Crear `release/vX.Y.Z` desde `testing`, probarla en el entorno de testing y abrir PR hacia `master`.
- Etiquetar el commit aprobado como `vX.Y.Z` despues del merge.
- Para un `hotfix`, crear la rama desde `master`, corregir y verificar, integrar a `master`, y luego integrar el mismo cambio a `testing` para evitar divergencia.

## Reglas de proteccion recomendadas en GitHub

Aplicar a `master` y `testing`:

- exigir pull request;
- exigir que el workflow `CI` finalice correctamente;
- impedir force-push y eliminacion;
- exigir rama actualizada antes del merge;
- exigir al menos una aprobacion para migraciones, autenticacion, permisos, pagos e infraestructura.

## Alcance del despliegue de testing

- Backend: se respalda PostgreSQL, se construye la imagen, se ejecutan migraciones y se verifica `/health`.
- Frontend: se construye una version inmutable y se cambia el enlace `current` de forma atomica.
- La VPS consulta GitHub y solo despliega el SHA de `testing` cuando el workflow `CI` de ese mismo SHA termina en `success`.
- Los secretos permanecen en `/opt/oroaroma-testing/backend/.env`; no se guardan en Git ni en GitHub Actions.
- Los fallos quedan registrados en `journalctl` y no avanzan el SHA desplegado.
