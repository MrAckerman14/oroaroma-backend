# Plan de implementacion SaaS

Este plan ordena el trabajo para no romper el sistema actual mientras se convierte en SaaS.

## Fase 0. Estabilizar el producto actual

### Objetivo

Antes de venderlo como SaaS, la app actual debe ser estable, auditable y facil de desplegar.

### Trabajo

- Corregir sesiones y refresh token.
- Verificar CORS por ambiente.
- Eliminar fugas de datos por consola/API.
- Asegurar que los roles devuelvan nombres consistentes.
- Crear pruebas de permisos por rol.
- Validar reportes principales.
- Validar carga de almacen.
- Validar creacion/edicion de ventas.
- Documentar variables de entorno.

### Definition of Done

- `npm test` pasa.
- Hay tests de permisos para admin, supervisor, vendedor, colaborador y mensajero.
- Ningun endpoint sensible expone precio de compra a roles no autorizados.
- Produccion y staging tienen variables separadas.

## Fase 1. Storage externo

### Objetivo

Sacar imagenes del disco local y prepararlas para multi tenant.

### Trabajo

- Implementar driver R2/S3.
- Guardar archivos con prefijo por tenant.
- Migrar imagenes existentes.
- Crear URLs firmadas o publicas controladas.
- Agregar backup/sync de imagenes.

### Orden recomendado

1. Crear interfaz de storage.
2. Implementar R2.
3. Mantener local solo para desarrollo.
4. Crear script de migracion.
5. Probar descargas individuales y masivas.

## Fase 2. Tenant base

### Objetivo

Introducir `tenantId` sin cambiar toda la UI de golpe.

### Trabajo

- Crear tabla `Tenant`.
- Crear tenant `default` para datos actuales.
- Agregar `tenantId` a tablas principales.
- Backfill de datos existentes.
- Agregar indices compuestos por tenant.
- Crear helper/backend context de tenant.

### Tablas prioritarias

```text
User
Role
UserRoleAssignment
Store
Sale
SaleDetail
CashClosure
InventoryReport
AuditLog
Product/Store si aplica segun modelo actual
```

### Riesgo principal

Fuga de datos por consultas sin `tenantId`.

### Mitigacion

- Pruebas de aislamiento.
- Revision de todos los endpoints.
- Middleware que inyecte contexto de tenant.
- Evitar endpoints globales para usuarios normales.

## Fase 3. Configuracion y marca por tenant

### Objetivo

No tener que crear ramas o builds separados por cliente.

### Trabajo

- Crear `TenantSettings`.
- Configurar nombre, logo, colores y moneda.
- Endpoint publico por dominio/subdominio.
- Frontend carga tema por tenant.
- Eliminar nombres hardcodeados del frontend.

### Resultado esperado

Un mismo frontend puede servir:

```text
oroaroma.tusistema.com
zoko-hola.tusistema.com
cliente-x.tusistema.com
```

Y cada uno ve su marca.

## Fase 4. Roles jerarquicos y asignaciones

### Objetivo

Separar permisos de jerarquia operativa.

### Trabajo

- Normalizar roles.
- Crear asignaciones supervisor -> usuarios.
- Crear asignaciones gerente -> sucursales.
- Crear asignaciones usuario -> sucursal/almacen.
- Permitir permisos por modulo.

### Regla tecnica

No resolver permisos solo en frontend. El backend debe negar datos y acciones.

## Fase 5. Multi sucursal y multi almacen

### Objetivo

Soportar empresas con varias ubicaciones.

### Trabajo

- Crear sucursales.
- Crear almacenes.
- Asignar usuarios.
- Crear movimientos de inventario.
- Trasladar stock entre almacenes.
- Reportes por sucursal/almacen.

### Orden

1. Sucursales.
2. Almacenes.
3. Movimientos.
4. Transferencias.
5. Reportes.

## Fase 6. Planes y billing SaaS

### Objetivo

Cobrar por el sistema y controlar acceso por plan.

### Trabajo

- Tabla `Plan`.
- Tabla `Subscription`.
- Limites por plan.
- Trial.
- Estado de pago.
- Pantalla de facturacion del tenant.
- Webhooks de pasarela.

### Reglas

- Nunca borrar datos por falta de pago.
- Suspender acciones nuevas si esta vencido.
- Permitir exportacion limitada por politica.

## Fase 7. Reportes, exportaciones y contabilidad

### Objetivo

Convertir la app en una herramienta de decision y contabilidad.

### Trabajo

- CSV y Excel.
- Preview antes de exportar.
- Reportes por usuario.
- Reportes de ganancias.
- Plan contable.
- Gastos.
- Control de inventario.
- Historial de costos.

### Seguridad

Cada exportacion debe usar el mismo filtro de permisos que el endpoint normal.

## Fase 8. Facturacion electronica

### Objetivo

Soportar facturacion fiscal segun pais.

### Trabajo

- Datos fiscales por tenant.
- Integracion con proveedor.
- Numeracion y documentos.
- Firma digital si aplica.
- Notas de credito.
- Anulaciones.

### Recomendacion

Primero integrar proveedor; no construir motor fiscal propio hasta tener volumen y obligacion clara.

## Fase 9. Soporte, observabilidad y operaciones

### Objetivo

Operar el SaaS sin apagar fuegos manualmente.

### Trabajo

- Tickets de soporte.
- Logs con requestId.
- Errores con contexto.
- Alertas.
- Backups automaticos.
- Restauracion probada.
- Dashboard interno de tenants.

## Fase 10. Crecimiento

### Objetivo

Escalar ventas y producto.

### Trabajo

- Sistema de referidos.
- Metricas SaaS.
- CLV/churn/MRR/ARR.
- Onboarding self-service.
- Dominios personalizados.
- Plan enterprise.

## Orden recomendado resumido

```text
0. Estabilidad actual
1. Storage externo
2. Tenant base
3. Marca por tenant
4. Roles y jerarquia
5. Sucursales y almacenes
6. Planes y suscripciones
7. Reportes/exportaciones/contabilidad
8. Facturacion electronica
9. Soporte/observabilidad/backups
10. Referidos y crecimiento
```

## Decisiones que hay que tomar antes de construir

### Dominio SaaS

Opciones:

```text
cliente.tusistema.com
tusistema.com/cliente
dominio propio del cliente
```

Recomendado:

```text
cliente.tusistema.com
```

Y dominio propio solo para planes altos.

### DB por cliente o tenantId

Recomendado para empezar:

```text
DB compartida con tenantId
```

Recomendado para clientes grandes:

```text
DB dedicada enterprise
```

### Precios de compra

Debe existir una politica clara:

```text
Solo owner/admin/contabilidad autorizada ven costo de compra.
```

Ni frontend ni API deben entregarlo a roles no autorizados.

### Backups

Minimo:

```text
daily 30 dias
weekly 12 semanas
monthly 12 meses
```

Con prueba de restauracion.

## Riesgos grandes

- Migrar a tenantId sin tests puede filtrar datos.
- Hardcodear marca por cliente crea caos de ramas.
- No separar precio compra/venta rompe confianza.
- Facturacion electronica mal hecha puede crear problemas legales.
- Backups sin restauracion probada dan falsa seguridad.
- Planes sin limites tecnicos no son planes reales.

## Primer sprint recomendado

Duracion: 1 a 2 semanas.

Objetivo: dejar base para SaaS sin romper produccion.

Tareas:

- Crear documento de roles definitivos.
- Crear diagrama de tablas SaaS.
- Crear tabla `Tenant` y migracion inicial en branch aparte.
- Agregar pruebas de aislamiento por tenant.
- Crear storage interface real.
- Definir proveedor de storage.
- Definir nombres de planes.
- Crear checklist de endpoints que deben filtrar por tenant.

