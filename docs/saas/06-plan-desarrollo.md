# Plan de desarrollo e implementacion

## Objetivo

Ordenar la migracion a SaaS sin romper el sistema actual. Este plan prioriza seguridad de datos, estabilidad y capacidad de vender pronto.

## Fase 0: estabilizacion del sistema actual

Duracion estimada: 1 a 2 semanas.

Objetivo:

- Dejar la aplicacion actual estable antes de meter multi-tenant.

Tareas:

- Congelar nombres de roles internos y labels visibles.
- Asegurar que no se filtra `purchasePrice` a no-admin.
- Asegurar que no se filtran usuarios de otros alcances.
- Confirmar paginacion consistente en todas las tablas.
- Revisar CORS y variables por ambiente.
- Verificar refresh token y expiracion.
- Documentar deploy backend/frontend.
- Crear staging si no existe.

Pruebas:

- Login por rol.
- Ventas por rol.
- Almacen por rol.
- Cierres de caja.
- Reportes.
- Descarga de imagenes.
- Sanitizacion de respuestas.

Criterio de salida:

- Se puede presentar y operar sin cambios manuales urgentes.

## Fase 1: preparar base para tenant sin activar SaaS

Duracion estimada: 1 a 2 semanas.

Objetivo:

- Agregar estructura de tenant sin cambiar todavia la experiencia.

Tareas backend:

- Crear tabla `Tenant`.
- Crear tabla `TenantSettings`.
- Crear tenant default para la instalacion actual.
- Agregar `tenantId` nullable a tablas principales.
- Backfill de datos existentes.
- Agregar indices iniciales.
- Actualizar seed para crear tenant default.

Tareas frontend:

- Ningun cambio visible obligatorio.
- Leer nombre/logo/theme desde endpoint de settings en una fase posterior.

Pruebas:

- Migracion en copia de DB.
- Todos los endpoints siguen funcionando con tenant default.
- No hay perdida de datos.

Criterio de salida:

- La DB tiene tenant default y el codigo puede convivir con datos viejos.

## Fase 2: aislamiento obligatorio por tenant

Duracion estimada: 2 a 4 semanas.

Objetivo:

- Hacer que todo dato de negocio dependa del tenant.

Tareas:

- Incluir `tenantId` en JWT y `AuthenticatedUser`.
- Crear `TenantContext`.
- Refactorizar use cases de:
  - ventas
  - usuarios
  - almacen
  - reportes de ventas
  - reportes de inventario
  - cierres de caja
- Hacer `tenantId` obligatorio en tablas.
- Agregar pruebas de dos tenants.
- Agregar auditoria con `tenantId`.

Pruebas obligatorias:

- Admin tenant A no ve ventas tenant B.
- Vendedor tenant A no ve productos tenant B.
- Mensajero tenant A no aparece en reportes tenant B.
- Descargas de imagenes respetan tenant.
- Reportes respetan tenant.

Criterio de salida:

- Ninguna consulta de negocio funciona sin tenant.

## Fase 3: onboarding de empresas

Duracion estimada: 1 a 2 semanas.

Objetivo:

- Crear nuevos clientes sin copiar repos ni levantar servicios separados.

Tareas:

- Endpoint interno `POST /platform/tenants`.
- Crear admin inicial del tenant.
- Crear settings iniciales.
- Crear roles y permisos base.
- Configurar logo, nombre y colores por tenant.
- Resolver tenant por subdominio o dominio.

Frontend:

- Cargar settings antes o durante boot.
- Mostrar nombre/logo/color del tenant.
- Evitar hardcodear marca en build.

Criterio de salida:

- Se puede crear un cliente nuevo desde panel interno o script.

## Fase 4: sucursales

Duracion estimada: 2 a 3 semanas.

Objetivo:

- Permitir multiples sucursales por empresa.

Tareas:

- Crear `Branch`.
- Crear sucursal default por tenant.
- Agregar `branchId` a ventas, productos/reportes/cierres.
- Selector de sucursal en frontend.
- Permisos por sucursal.
- Reportes por sucursal.

Decision importante:

- Si se mantendra `Store` como producto con stock directo, la primera version puede usar `Store.branchId`.
- Si se quiere escalar bien, crear `Product` + `ProductBranchStock`.

Criterio de salida:

- Un tenant puede tener dos sucursales y sus ventas/inventarios no se mezclan.

## Fase 5: storage externo

Duracion estimada: 1 a 2 semanas.

Objetivo:

- Sacar imagenes del filesystem local.

Tareas:

- Implementar `R2StorageService` usando API S3 compatible.
- Guardar archivos con prefijo `tenants/{tenantId}`.
- Crear migracion de rutas existentes.
- Script para copiar imagenes locales a R2.
- Signed URLs para recursos privados si aplica.
- CDN/public base URL.

Pruebas:

- Subir producto con imagen.
- Editar imagen.
- Descargar una imagen.
- Descargar todas con filtro.
- Verificar que tenant A no descarga imagen tenant B.

Criterio de salida:

- Redeploy no afecta imagenes.

## Fase 6: suscripciones manuales

Duracion estimada: 1 a 2 semanas.

Objetivo:

- Tener planes y vencimientos aunque el cobro sea manual.

Tareas:

- Crear `Plan`, `Subscription`, `Invoice`.
- Panel interno para asignar plan.
- Job diario para vencimientos.
- Estado `PAST_DUE` y `SUSPENDED`.
- Middleware de feature/plan limits.

Pruebas:

- Tenant activo opera.
- Tenant vencido recibe aviso.
- Tenant suspendido no crea ventas/productos.
- Admin puede reactivar tras pago manual.

Criterio de salida:

- El negocio puede cobrar manualmente y controlar acceso.

## Fase 7: pasarela de pagos

Duracion estimada: 2 a 5 semanas, depende del proveedor.

Objetivo:

- Automatizar cobros.

Tareas:

- Elegir proveedor: Azul o CardNET primero.
- Obtener credenciales sandbox y produccion.
- Implementar `PaymentProvider`.
- Checkout o enlace de pago.
- Webhooks firmados.
- Idempotencia.
- Facturas y recibos.
- Reintentos.

Pruebas:

- Pago exitoso activa suscripcion.
- Pago fallido no activa.
- Webhook duplicado no duplica factura.
- Tenant suspendido se reactiva al pagar.

Criterio de salida:

- Un cliente puede pagar sin intervencion manual.

## Fase 8: observabilidad y soporte

Duracion estimada: 1 a 2 semanas.

Objetivo:

- Poder operar varios clientes sin adivinar errores.

Tareas:

- Sentry o similar.
- Logs con `tenantId`.
- Panel de salud por tenant.
- Auditoria visible.
- Export de datos por tenant.
- Backups probados.

Criterio de salida:

- Ante un error, se sabe que tenant, usuario, ruta y request fallaron.

## Orden recomendado de implementacion

1. Estabilizar sistema actual.
2. Tenant default.
3. Filtros obligatorios por tenant.
4. Onboarding de tenant.
5. Settings/branding por tenant.
6. Sucursales.
7. R2/S3.
8. Suscripciones manuales.
9. Pasarela de pago.
10. Observabilidad avanzada.
11. Roles personalizados y modulos premium.

## No hacer todavia

- No crear una DB por cliente como unica estrategia SaaS.
- No meter pagos antes de aislar tenants.
- No permitir que frontend mande `tenantId` libremente.
- No guardar tarjetas.
- No depender de storage local para varios clientes.
- No mezclar roles de plataforma con roles de negocio.

## Entregables tecnicos por version

Version 1 SaaS interna:

- Tenant default.
- Backfill.
- Tests basicos.

Version 2 SaaS segura:

- Tenant obligatorio.
- Auth con tenant.
- Aislamiento probado.

Version 3 SaaS vendible:

- Crear cliente desde panel/script.
- Branding por tenant.
- Plan manual.
- Storage externo.

Version 4 SaaS escalable:

- Sucursales.
- Pasarela de pago.
- Observabilidad.
- Jobs/reportes pesados.

## Checklist antes de vender a mas clientes

- Backups automaticos activos.
- Restore probado.
- Logs con requestId y tenantId.
- R2/S3 funcionando.
- Pruebas multi-tenant pasando.
- Seed crea roles por tenant.
- Super admin separado.
- Planes modelados.
- CORS por dominio.
- Politica de soporte y acceso a datos.
- Documentacion de deploy y rollback.
