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

## Paginacion

Las rutas listadas usan paginacion por query string:

```txt
?page=1&pageSize=100
```

Por defecto la API devuelve 100 registros por pagina. Si el frontend necesita cargar mas registros para un rango grande, puede enviar un `pageSize` mayor. El backend no impone un limite maximo configurable sobre `pageSize`.

Variables recomendadas:

```env
DEFAULT_PAGE_SIZE=100
```

Ejemplo para cargar hasta 1000 ventas en una pagina:

```txt
/sales?from=2026-05-01&to=2026-08-01&page=1&pageSize=1000
```

## RBAC

Los permisos se modelan como `resource + action + scope`, por ejemplo:

- `sales:create:own`
- `sales:read:store`
- `reports:cash:global`
- `users:update:global`

El usuario recibe roles por alcance (`global`, `store`, `own`) mediante `UserRoleAssignment`. El motor de autorización evalua permisos y contexto, no roles hardcodeados.

## Imagenes en produccion

El backend guarda las imagenes de productos mediante el puerto `StorageService`.
Por defecto usa almacenamiento local (`STORAGE_DRIVER=local`) y sirve los archivos desde `/uploads`.

En Render debes crear un Persistent Disk para que las imagenes no se pierdan en cada redeploy:

- Mount path recomendado: `/var/data/uploads`
- Variable de entorno: `UPLOAD_ROOT=/var/data/uploads`
- Variable de entorno: `UPLOAD_PUBLIC_BASE_PATH=/uploads`
- Variable de entorno: `STORAGE_DRIVER=local`

Con esa configuracion, las rutas guardadas en base de datos siguen siendo como:

```txt
/uploads/products/archivo.webp
```

y los archivos reales quedan en el disco persistente.

Para una migracion futura a S3, Cloudflare R2 o almacenamiento compatible, ya existen estas variables reservadas:

```env
STORAGE_DRIVER=r2
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_REGION=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_ACCESS_KEY_ID=
OBJECT_STORAGE_SECRET_ACCESS_KEY=
OBJECT_STORAGE_PUBLIC_BASE_URL=
```

Todavia falta implementar el proveedor de objetos. Hasta entonces, en produccion usa `STORAGE_DRIVER=local`.
