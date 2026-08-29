# Sucursales y operacion multi-local

## Objetivo

Permitir que una empresa tenga varias sucursales sin mezclar inventario, ventas, cierres ni permisos.

Una sucursal no es un tenant. El tenant es la empresa. La sucursal es una unidad operativa dentro de esa empresa.

## Modelo recomendado

```prisma
model Branch {
  id        String @id @default(uuid())
  tenantId  String
  name      String
  code      String?
  address   String?
  phone     String?
  status    BranchStatus @default(ACTIVE)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  @@unique([tenantId, name])
  @@index([tenantId, status])
}

enum BranchStatus {
  ACTIVE
  INACTIVE
}
```

Agregar `branchId` a:

- `UserRoleAssignment` o `TenantMembership`, para permisos por sucursal.
- `Store`, si cada sucursal tiene inventario propio.
- `Sale`.
- `CashClosure`.
- `InventoryReport`.
- `AuditLog`.

## Inventario por sucursal

Hay dos formas de modelarlo.

Opcion A: producto por sucursal.

`Store` tiene `branchId` y cada sucursal tiene su propio producto/stock.

Ventaja: simple para el sistema actual.

Desventaja: si el mismo perfume existe en 5 sucursales, se duplica metadata.

Opcion B: catalogo global + stock por sucursal.

```prisma
model Product {
  id          String @id @default(uuid())
  tenantId    String
  name        String
  description String?
  imagePath   String?
  createdAt   DateTime @default(now())
}

model ProductBranchStock {
  id            String @id @default(uuid())
  tenantId      String
  productId     String
  branchId      String
  purchasePrice Decimal @db.Decimal(12, 2)
  salePrice     Decimal @db.Decimal(12, 2)
  stock         Int

  @@unique([tenantId, productId, branchId])
}
```

Recomendacion: para SaaS serio usar opcion B, pero migrar por fases. El sistema actual llama `Store` al producto; se puede renombrar conceptualmente despues.

## Ventas por sucursal

Cada venta debe tener:

- `tenantId`
- `branchId`
- `employeeId`
- `sellerId`
- `messengerId`
- estado
- montos
- detalles

El cierre de caja debe cerrar ventas de una sucursal o de todas segun permiso.

Reglas:

- Admin tenant puede ver todas las sucursales.
- Supervisor puede ver las sucursales asignadas.
- Vendedor/empleado ve sus ventas y/o sucursal asignada segun regla de negocio.
- Colaborador ve solo lo suyo si aplica.
- Mensajero ve solo entregas asignadas o completadas por el.

## Transferencias entre sucursales

No implementarlo en la primera fase si no es necesario. Pero el modelo debe permitirlo.

Futuro:

```prisma
model StockTransfer {
  id           String @id @default(uuid())
  tenantId     String
  fromBranchId String
  toBranchId   String
  status       StockTransferStatus
  createdById  String
  createdAt    DateTime @default(now())
}

model StockTransferItem {
  id         String @id @default(uuid())
  transferId String
  productId  String
  quantity   Int
}
```

Estados:

- `DRAFT`
- `SENT`
- `RECEIVED`
- `CANCELLED`

## Reportes multi-sucursal

Reportes deben aceptar filtros:

- tenant
- sucursal
- rango de fechas
- usuario
- mensajero
- colaborador
- estado de venta

Admin debe poder ver:

- total empresa
- desglose por sucursal
- desglose por vendedor
- desglose por mensajero

Supervisor debe poder ver:

- solo sucursales asignadas
- sus propias ventas
- mensajeros vinculados a esas ventas si la regla lo permite

## UI esperada

Agregar selector de sucursal:

- En header o menu.
- Persistido por usuario.
- Opcion "Todas" solo para roles con permiso global de tenant.

En formularios:

- Al crear venta, `branchId` se toma de la sucursal activa.
- Al crear producto, se asigna stock de la sucursal activa.
- En reportes, el filtro de sucursal debe ser visible.

## Migracion recomendada

Fase 1:

- Crear tabla `Branch`.
- Crear sucursal default por tenant.
- Agregar `branchId` nullable a ventas, productos y reportes.
- Backfill con sucursal default.

Fase 2:

- Hacer `branchId` obligatorio.
- Agregar filtros en API.
- Agregar selector en frontend.

Fase 3:

- Permisos por sucursal.
- Reportes comparativos.
- Transferencias de stock si el negocio lo necesita.
