# Plan SaaS para el sistema

Esta carpeta contiene la guia para evolucionar el sistema actual de una instalacion por cliente hacia un SaaS multi-tenant, con suscripciones, pagos, sucursales, almacenamiento escalable y una ruta de implementacion ordenada.

El sistema actual ya tiene una base buena para crecer:

- Backend Fastify + Prisma + PostgreSQL.
- RBAC con usuarios, roles, permisos y asignaciones.
- Ventas, mensajeros, colaboradores/vendedores, almacen, reportes de ventas e inventario.
- Refresh sessions y auditoria basica.
- Abstraccion inicial de storage con `STORAGE_DRIVER`, `UPLOAD_ROOT` y variables reservadas para S3/R2.

La parte que falta para SaaS no es solo "agregar tenantId". Tambien hay que aislar datos, dominios, branding, pagos, limites del plan, observabilidad, soporte y migraciones sin romper a los clientes actuales.

## Documentos

1. [Vision SaaS](./01-vision-saas.md)
2. [Arquitectura multi-tenant](./02-multi-tenant.md)
3. [Suscripciones y pagos para RD](./03-suscripciones-y-pagos-rd.md)
4. [Sucursales y operacion multi-local](./04-sucursales.md)
5. [Servicios externos e infraestructura escalable](./05-servicios-terceros-e-infraestructura.md)
6. [Plan de desarrollo e implementacion](./06-plan-desarrollo.md)

## Decision recomendada

Para el primer SaaS real, la recomendacion es:

- Usar una sola aplicacion backend y frontend compartida.
- Usar PostgreSQL compartido con `tenantId` obligatorio en tablas de negocio.
- Mantener `tenantId` tambien en usuarios y roles, excepto una capa interna de soporte/super-admin.
- Usar Cloudflare R2 o S3 compatible para imagenes.
- Arrancar pagos con un proveedor local de RD para tarjetas y transferencias manuales verificables.
- Modelar suscripciones internamente aunque el primer cobro sea manual.
- Desplegar por ambientes: `dev`, `staging`, `production`.

La opcion de una instancia completa por cliente sirve para vender rapido al inicio, pero no escala operativamente. El objetivo debe ser migrar a multi-tenant con aislamiento correcto.

## Reglas de arquitectura para no repetir problemas

- Todo endpoint que lea datos de negocio debe recibir o resolver un `tenantId`.
- Ninguna consulta Prisma de datos de negocio debe ejecutarse sin filtro de tenant.
- Las respuestas no deben depender de "ocultar en el frontend"; el backend debe sanitizar y autorizar.
- Las imagenes no deben vivir en filesystem efimero de Render.
- Las suscripciones no deben depender solo de que el usuario pague; deben activar/desactivar capacidades.
- Los roles visibles deben ser nombres de negocio; los keys internos pueden migrarse con calma, pero no deben filtrarse a usuarios finales si confunden.
- Cada cambio grande debe tener pruebas de acceso por rol y por tenant.

## Referencias consultadas

- Cloudflare R2 docs: https://developers.cloudflare.com/r2/
- Cloudflare R2 S3 API: https://developers.cloudflare.com/r2/api/s3/api/
- Render Persistent Disks: https://render.com/docs/disks
- International Trade Administration, Republica Dominicana ecommerce: https://www.trade.gov/country-commercial-guides/dominican-republic-ecommerce
- Azul Dominicana: https://www.azul.com.do/
- CardNET: https://cardnet.com.do/
- Stripe global availability: https://stripe.com/global
- PayPal supported features: https://developer.paypal.com/payouts/supported-features
