# Oro Aroma API v2

Backend nuevo desde cero con Fastify, Prisma, TypeScript, DDD, Clean Architecture y RBAC granular.

## Capas

- `domain`: reglas puras del negocio.
- `application`: casos de uso y puertos.
- `infrastructure`: Prisma, hashing, tokens, persistencia.
- `presentation`: Fastify, rutas, middlewares, schemas HTTP.
- `types`: contratos compartidos y tipos transversales.

## Comandos

```bash
npm run dev
npm run build
npm run typecheck
npm run prisma:generate
npm run db:migrate
npm run db:seed
npm run seed
```

## Base de datos local

```bash
docker compose up -d
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

Postgres queda expuesto en `localhost:7567` para evitar chocar con otros proyectos locales.

El seed solo prepara permisos, roles del sistema y un usuario administrador inicial. No crea productos, ventas, reportes ni datos de prueba.

Credenciales iniciales:

- Correo: `admin@oroaroma.local`
- Contraseña: `ChangeMe123!`
- Nombre: `admin`

La venta usa `DEFAULT_SELLER_NAME="admin"` como colaborador interno por defecto cuando el frontend no envia `employeeId`.

## RBAC

Los permisos se modelan como `resource + action + scope`, por ejemplo:

- `sales:create:own`
- `sales:read:store`
- `reports:cash:global`
- `users:update:global`

El usuario recibe roles por alcance (`global`, `store`, `own`) mediante `UserRoleAssignment`. El motor de autorización evalua permisos y contexto, no roles hardcodeados.
