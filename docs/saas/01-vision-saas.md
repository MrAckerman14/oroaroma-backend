# Vision SaaS

## Objetivo

Convertir el sistema actual en una plataforma SaaS donde varias empresas puedan usar la misma base tecnologica sin ver datos entre ellas, con planes de suscripcion, pagos, sucursales, branding por cliente y operacion estable.

El resultado esperado no es solo alojar varias copias. El objetivo es que un nuevo cliente pueda crearse con un flujo controlado:

1. Registrar empresa.
2. Elegir plan.
3. Configurar dominio, logo, moneda, impuestos y sucursales.
4. Crear usuarios internos.
5. Empezar a operar ventas, almacen, mensajeros y reportes.
6. Cobrar o suspender segun estado de suscripcion.

## Estado actual

El sistema actual trabaja como una aplicacion para una sola empresa. Eso se nota en varias areas:

- Los usuarios no tienen `tenantId`.
- Los productos (`Store`) son globales para toda la instalacion.
- Las ventas apuntan a usuarios y productos sin pertenencia a empresa.
- Los reportes no estan separados por empresa.
- El branding vive en el frontend, no como configuracion por cliente.
- Las imagenes usan almacenamiento local por defecto.
- Las credenciales y variables se manejan por instalacion.

Eso funciona para una empresa, pero no para SaaS. En SaaS, cada consulta, reporte, archivo e integracion debe estar dentro del contexto de una empresa.

## Modelo de producto

La plataforma deberia venderse como sistema de gestion para comercios con ventas, inventario, repartidores, colaboradores y reportes. El SaaS puede tener estos modulos:

- Ventas y seguimiento de pedidos.
- Almacen e inventario.
- Mensajeros y pagos de envio.
- Vendedores/colaboradores.
- Cierres de caja.
- Reportes de ventas e inventario.
- Sucursales.
- Usuarios y permisos.
- Branding basico por empresa.
- Suscripcion y facturacion.

## Tipos de cuenta

Se recomienda separar usuarios de negocio y usuarios internos de plataforma.

Usuarios de negocio:

- Admin de empresa: administra su tenant completo.
- Supervisor: opera con permisos avanzados dentro del tenant.
- Vendedor/empleado: registra y consulta su operacion permitida.
- Colaborador: rol comercial externo/interno segun las reglas actuales.
- Mensajero: consulta o participa solo en entregas permitidas.

Usuarios de plataforma:

- Super admin SaaS: soporte tecnico, facturacion, bloqueo de tenants.
- Soporte limitado: puede ver metadata del tenant, pero no precios sensibles ni ventas completas salvo autorizacion.

El super admin no debe ser un usuario normal con rol `admin` dentro de todas las empresas. Debe tener una capa separada para evitar confundir permisos de negocio con permisos de plataforma.

## Planes SaaS sugeridos

Plan Inicial:

- 1 empresa.
- 1 sucursal.
- 3 a 5 usuarios.
- Limite de productos y ventas mensual razonable.
- Reportes basicos.
- Storage limitado.

Plan Negocio:

- Varias sucursales.
- Mas usuarios.
- Reportes avanzados.
- Exportaciones.
- Branding por empresa.
- Soporte prioritario.

Plan Pro:

- Multi-sucursal amplio.
- API/integraciones.
- Auditoria extendida.
- Webhooks.
- Backups dedicados o retencion mayor.
- Roles personalizados.

Estos planes deben modelarse en base de datos aunque al principio el cobro sea manual. Si no se modelan desde temprano, luego sera dificil suspender, limitar o migrar clientes.

## Principios de diseño

El SaaS debe seguir estas reglas:

- Aislamiento primero: ningun dato de una empresa debe filtrarse a otra.
- Backend manda: el frontend nunca debe ser la unica barrera de seguridad.
- Configuracion por tenant: nombre, logo, moneda, zona horaria, impuestos y reglas deben vivir en DB.
- Migraciones reversibles cuando sea posible.
- Auditoria en operaciones sensibles.
- Observabilidad desde el inicio: logs, errores y metricas con `tenantId`.
- Planes y limites aplicados en backend.

## Riesgos principales

Riesgo 1: Fuga de datos entre clientes.

Mitigacion: `tenantId` obligatorio, helpers de Prisma, pruebas automatizadas multi-tenant, revision de endpoints y sanitizacion.

Riesgo 2: Romper la instalacion actual al migrar.

Mitigacion: migracion por fases, `default tenant`, pruebas con copia de produccion, feature flags.

Riesgo 3: Pagos bloqueados por requisitos locales.

Mitigacion: soportar suscripcion manual inicialmente, luego integrar proveedor local RD y mantener adaptador para varios gateways.

Riesgo 4: Imagenes perdidas en deploys.

Mitigacion: mover imagenes a R2/S3 o usar disco persistente mientras se migra.

Riesgo 5: Reportes lentos al crecer.

Mitigacion: indices por `tenantId`, fechas y estados; paginacion real; jobs para reportes pesados; vistas/materializaciones si hace falta.
