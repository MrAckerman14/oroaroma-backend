# Backend SaaS foundation

Este documento describe el primer corte tecnico para mover el backend de una sola empresa a SaaS sin desplegar cambios radicales a produccion.

## Alcance de este corte

- Introducir `Tenant` y `tenantId` en las tablas de negocio actuales.
- Mantener compatibilidad con el sistema actual usando el tenant `default`.
- Preparar RLS en PostgreSQL con `public.current_tenant_id()`.
- Agregar invariantes SQL para impedir relaciones entre tenants distintos.
- Hacer que login, access token y refresh session conserven el tenant activo.
- Dockerizar API + Postgres para local/testing/VPS.
- Implementar provider de storage compatible con S3 y Cloudflare R2.
- Mantener `local` como storage valido para desarrollo y despliegues actuales.

## Lo que no queda listo todavia

- No se debe desplegar a produccion con multi-tenant real todavia.
- RLS esta habilitado, pero no se usa `FORCE ROW LEVEL SECURITY` hasta que el usuario de DB de la API sea no-owner y todas las rutas queden tenant-aware.
- La seleccion de tenant por subdominio/dominio queda para el siguiente corte.
- Email repetido por tenant queda para una migracion posterior; por compatibilidad se mantiene el `UNIQUE(email)` global.
- Roles custom por tenant quedan para fase posterior; ahora los roles siguen siendo globalmente unicos por `key`.

## Invariantes SQL agregados

Las tablas tenant-owned tienen `tenantId` y FK hacia `Tenant`.

Los triggers SQL garantizan:

- `UserRoleAssignment` hereda tenant del usuario y valida que rol/store sean del mismo tenant.
- `RefreshSession` hereda tenant del usuario.
- `Sale` hereda tenant del empleado y valida vendedor/mensajero del mismo tenant.
- `SaleDetail` hereda tenant de la venta y valida producto del mismo tenant.
- `CashClosure` hereda tenant del creador.
- `CashClosureDetail` valida cierre y venta del mismo tenant.
- `InventoryReport` hereda tenant del creador.
- `InventoryReportDetail` valida reporte y producto del mismo tenant.
- `AuditLog` hereda tenant del actor cuando existe.

## RLS

Cada tabla tenant-owned tiene una policy con esta forma:

```sql
USING ("tenantId" = public.current_tenant_id())
WITH CHECK ("tenantId" = public.current_tenant_id())
```

`Tenant` usa:

```sql
USING ("id" = public.current_tenant_id())
WITH CHECK ("id" = public.current_tenant_id())
```

Para probar RLS en serio se debe crear un usuario de DB no-owner para la API de testing. El usuario owner de tablas puede saltarse RLS en PostgreSQL si no se usa `FORCE ROW LEVEL SECURITY`.

## Storage providers

Drivers soportados:

- `local`: guarda en `UPLOAD_ROOT` y sirve por `UPLOAD_PUBLIC_BASE_PATH`.
- `s3`: usa endpoint S3 compatible.
- `r2`: usa endpoint Cloudflare R2 compatible con S3 y region `auto` si no se define region.

Variables para R2/S3:

```env
STORAGE_DRIVER=r2
OBJECT_STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
OBJECT_STORAGE_REGION=auto
OBJECT_STORAGE_BUCKET=<bucket>
OBJECT_STORAGE_ACCESS_KEY_ID=<access-key>
OBJECT_STORAGE_SECRET_ACCESS_KEY=<secret-key>
OBJECT_STORAGE_PUBLIC_BASE_URL=https://imagenes.example.com
```

Si `OBJECT_STORAGE_PUBLIC_BASE_URL` no se define, el sistema conserva un path interno tipo `/uploads/products/<id>.webp`. Para produccion SaaS conviene usar un dominio publico controlado o URLs firmadas en una fase posterior.

## Comandos local/testing

Instalar dependencias:

```bash
npm ci
```

Generar Prisma:

```bash
npx prisma generate
```

Levantar stack de testing:

```bash
docker compose up -d --build
```

Aplicar migraciones dentro del contenedor API:

```bash
docker compose exec api npx prisma migrate deploy
```

Seed:

```bash
docker compose exec api npm run db:seed
```

Validaciones:

```bash
npm run typecheck
npm test
npm run lint
git diff --check
```

Pruebas con PostgreSQL real:

```bash
npm run test:db
```

## Orden siguiente

1. Crear usuario de DB `oroaroma_app_test` no-owner con permisos minimos.
2. Cambiar testing para que la API use ese usuario y validar RLS sin bypass.
3. Introducir tenant resolution por subdominio/header controlado.
4. Pasar rutas de stores, sales, reports e inventory a filtros tenant-aware explícitos.
5. Quitar `UNIQUE(email)` global y reemplazarlo por `UNIQUE(tenantId, email)` cuando el login ya reciba tenant siempre.
6. Agregar `TenantSettings` para marca, moneda, pais, zona horaria y providers.
7. Agregar providers de facturacion electronica por pais detras de una interfaz.
8. Crear backups diarios de Postgres y R2 antes de pruebas con clientes.
