# Plan SaaS

Este documento ordena la evolucion del sistema actual hacia un SaaS vendible a muchas empresas. La meta no es solo duplicar frontend, backend y DB por cliente, sino construir una plataforma donde cada cliente tenga su informacion, usuarios, sucursales, pagos, inventario, reportes y configuracion aislados.

## Objetivo

Convertir el sistema actual de ventas, almacen, mensajeria y caja en una plataforma SaaS multiempresa para negocios que venden productos fisicos, empezando por perfumeria pero sin quedar amarrado solo a ese rubro.

El SaaS debe permitir:

- Registrar empresas clientes.
- Crear planes de suscripcion.
- Cobrar suscripciones y controlar acceso por plan.
- Manejar varias sucursales y almacenes por empresa.
- Separar datos por cliente sin fugas.
- Personalizar marca, colores, logo y dominio.
- Tener usuarios con roles jerarquicos.
- Exportar informacion contable y operativa.
- Respaldar DB e imagenes de forma automatica.
- Tener observabilidad para saber que paso cuando algo falla.

## Principio principal

Toda informacion de negocio debe pertenecer a un `tenant`.

Un tenant representa una empresa cliente. Por ejemplo:

```text
Tenant: Oro Aroma
Tenant: Zoko-Hola
Tenant: Cliente futuro X
```

Cuando el sistema sea SaaS, ninguna consulta importante debe traer datos sin filtrar por `tenantId`, excepto las pantallas internas de administracion de la plataforma.

## Estado actual vs objetivo

Estado actual:

- Una app pensada para una empresa.
- Roles mezclados con nombres de negocio.
- Configuracion y marca parcialmente hardcodeada.
- Archivos locales o por instancia.
- Backups no tratados como producto.
- Reportes y permisos han crecido por necesidades puntuales.

Estado objetivo:

- Una plataforma con tenants.
- Configuracion por tenant.
- Roles normalizados.
- Storage externo por tenant.
- Backups automaticos.
- Planes de pago.
- Auditoria y trazabilidad.
- Modulos activables por plan.

## Documentos

- [Catalogo de modulos](./product-and-modules.md)
- [Plan de implementacion](./implementation-roadmap.md)
- [Base backend tenant/RLS/providers](./backend-foundation.md)
