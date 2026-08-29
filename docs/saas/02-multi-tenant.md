# Arquitectura multi-tenant

## Decision recomendada

Usar una sola base PostgreSQL compartida con `tenantId` en las tablas de negocio.

Esta opcion es la mas razonable para el estado actual porque:

- Prisma la soporta bien.
- Render/PostgreSQL simplifica operacion inicial.
- Permite onboarding de clientes sin crear infraestructura por cliente.
- Facilita reportes internos de plataforma.
- Es mas barata que una DB por cliente.

Una DB por tenant da mas aislamiento, pero complica migraciones, backups, deploys, soporte y costos. Se puede reservar para clientes enterprise en el futuro.

## Modelos nuevos

Agregar `Tenant`:

```prisma
model Tenant {
  id        String   @id @default(uuid())
  slug      String   @unique
  name      String
  status    TenantStatus @default(TRIAL)
  timezone  String   @default("America/Santo_Domingo")
  currency  String   @default("DOP")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
}

enum TenantStatus {
  TRIAL
  ACTIVE
  PAST_DUE
  SUSPENDED
  CANCELLED
}
```

Agregar `TenantSettings`:

```prisma
model TenantSettings {
  tenantId          String @id
  displayName       String
  logoPath          String?
  primaryColor      String?
  businessDayStart  Int    @default(7)
  defaultSellerName String @default("admin")
}
```

Agregar `tenantId` a:

- `User`
- `Role` si se permitiran roles personalizados por cliente.
- `UserRoleAssignment`
- `Store`
- `Sale`
- `SaleDetail` indirectamente por `Sale`, y opcional directo si ayuda a indices.
- `CashClosure`
- `CashClosureDetail` indirectamente.
- `InventoryReport`
- `InventoryReportDetail` indirectamente.
- `AuditLog`
- Futuras tablas de pagos, sucursales, suscripciones y webhooks.

## Identificacion del tenant

El tenant debe resolverse de forma consistente:

1. Por dominio o subdominio: `cliente.app.com`.
2. Por dominio custom: `sistema.cliente.com`.
3. Por usuario autenticado: el token contiene `tenantId`.
4. En modo soporte interno: header o parametro solo permitido a super-admin.

El frontend no debe enviar `tenantId` libremente para operaciones normales. El backend debe resolverlo desde el usuario o dominio. Si el frontend manda `tenantId`, debe ignorarse salvo rutas internas de plataforma.

## Auth y tokens

El JWT debe incluir:

```json
{
  "sub": "user-id",
  "tenantId": "tenant-id",
  "roles": ["admin"],
  "sessionId": "refresh-session-id"
}
```

Reglas:

- Un usuario normal pertenece a un tenant.
- Si se permite el mismo email en varias empresas, el login debe pedir empresa o resolver por subdominio.
- `email` ya no debe ser unico global si una misma persona puede pertenecer a varios tenants.
- Alternativa: mantener `email` unico global y crear tabla `TenantMembership`. Esta opcion es mas flexible, pero requiere mas cambios.

Recomendacion: usar `TenantMembership` si se quiere SaaS serio.

```prisma
model TenantMembership {
  id        String @id @default(uuid())
  tenantId  String
  userId    String
  status    UserStatus @default(ACTIVE)
  createdAt DateTime @default(now())

  @@unique([tenantId, userId])
}
```

## Cambios en RBAC

El sistema ya tiene `Role`, `Permission`, `RolePermission` y `UserRoleAssignment`. Hay que añadir pertenencia a tenant.

Roles base globales de plataforma:

- `platform_owner`
- `platform_support`

Roles base de tenant:

- `tenant_admin`
- `supervisor`
- `employee`
- `collaborator`
- `messenger`

Los nombres visibles pueden ser:

- Admin
- Supervisor
- Vendedor
- Colaborador
- Mensajero

Los keys internos deben ser estables. No conviene renombrarlos en cada cliente; conviene mapear label visible por tenant si hace falta.

## Patron de consultas

Toda consulta de negocio debe incluir `tenantId`.

Ejemplo:

```ts
await prisma.sale.findMany({
  where: {
    tenantId: actor.tenantId,
    deletedAt: null
  }
});
```

No basta con filtrar en algunos endpoints. Se necesita un patron obligatorio:

- Crear helper `tenantWhere(actor, extraWhere)`.
- Crear repositorios o use cases que reciban `TenantContext`.
- Prohibir acceso directo a Prisma en rutas HTTP.
- Agregar pruebas que creen dos tenants y verifiquen que no se cruzan.

## Prisma middleware o extension

Se puede usar Prisma Client Extension para inyectar `tenantId`, pero no debe ser la unica barrera. Es mejor combinar:

- Contexto explicito en use cases.
- Helpers compartidos.
- Tests de aislamiento.
- Extension defensiva para detectar queries sin tenant en desarrollo/test.

Ejemplo conceptual:

```ts
type TenantContext = {
  tenantId: string;
  actorId: string;
  isPlatformAdmin: boolean;
};
```

Cada use case recibe `context` y no solo `actor`.

## Migracion desde single-tenant

Fase 1: crear tenant por defecto.

- Crear tabla `Tenant`.
- Crear un tenant `default` o `oro-aroma`.
- Agregar `tenantId` nullable a tablas principales.
- Backfill de todas las filas existentes con ese tenant.

Fase 2: hacer `tenantId` obligatorio.

- Crear indices.
- Cambiar columnas a `NOT NULL`.
- Agregar constraints.
- Actualizar codigo para escribir `tenantId`.

Fase 3: aislar endpoints.

- Auth emite `tenantId`.
- Rutas usan `TenantContext`.
- Reportes, store, sales y users filtran por tenant.
- Tests por modulo.

Fase 4: onboarding.

- Endpoint interno para crear tenant.
- Seed por tenant: roles, admin inicial y settings.
- Configuracion de storage prefix y dominio.

## Indices recomendados

Ventas:

```prisma
@@index([tenantId, createdAt])
@@index([tenantId, status])
@@index([tenantId, employeeId, createdAt])
@@index([tenantId, sellerId, createdAt])
@@index([tenantId, messengerId, createdAt])
```

Productos:

```prisma
@@index([tenantId, deletedAt])
@@index([tenantId, name])
@@index([tenantId, stock])
```

Reportes:

```prisma
@@index([tenantId, createdAt])
@@index([tenantId, fromDate, toDate])
```

Usuarios:

```prisma
@@index([tenantId, status])
@@unique([tenantId, email])
```

Si se usa `TenantMembership`, el `email` puede quedar unico global en `User` o moverse a identidad global.

## Archivos e imagenes

Cada archivo debe guardarse con prefijo de tenant:

```txt
tenants/{tenantId}/products/{uuid}.webp
tenants/{tenantId}/logos/{uuid}.png
```

Nunca usar rutas compartidas como:

```txt
uploads/products/image.png
```

sin tenant. Eso complica borrados, backups, exportaciones y auditoria.

## Pruebas obligatorias

Crear tests de aislamiento:

- Tenant A crea producto, Tenant B no lo ve.
- Tenant A crea venta, Tenant B no la ve.
- Admin de Tenant A no puede editar usuarios de Tenant B.
- Mensajero de Tenant A no aparece en reportes de Tenant B.
- Imagen de producto de Tenant A no puede descargarse desde Tenant B.
- Super admin plataforma puede listar tenants, pero no modificar ventas sin modo soporte explicito.

Estas pruebas deben fallar si alguna consulta queda sin `tenantId`.
