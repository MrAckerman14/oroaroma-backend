# Catalogo de modulos SaaS

Este documento convierte las notas sueltas en modulos claros de producto. Cada modulo tiene proposito, alcance inicial y dependencias.

## 1. Multi tenant

### Proposito

Permitir que muchas empresas usen el mismo sistema sin ver datos entre ellas.

### Alcance inicial

- Crear tabla `Tenant`.
- Agregar `tenantId` a usuarios, roles, tiendas, ventas, productos, reportes, cierres, almacenes, proveedores y configuraciones.
- Crear middleware/contexto backend que determine el tenant del request.
- Aplicar filtros obligatorios por `tenantId`.
- Crear pruebas que fallen si un usuario de un tenant puede ver datos de otro.

### Decisiones clave

Opcion recomendada para empezar:

```text
Una DB compartida + tenantId en todas las tablas
```

Ventajas:

- Menor costo.
- Mas simple de operar.
- Permite planes pequenos.

Riesgos:

- Si una consulta olvida `tenantId`, puede haber fuga de datos.
- Requiere disciplina fuerte en backend y tests.

Para clientes grandes se puede evolucionar a:

```text
DB dedicada por tenant enterprise
```

## 2. Configuracion de tenant y marca

### Proposito

Evitar cambiar codigo para cada cliente.

### Alcance inicial

- Nombre comercial.
- Logo.
- Colores del tema.
- Moneda.
- Pais.
- Zona horaria.
- Dominio o subdominio.
- Texto legal visible.
- Configuracion de modulos activos.

### Ejemplo

```text
tenant.slug = "zoko-hola"
tenant.brandName = "Zoko-Hola"
tenant.primaryColor = "#..."
tenant.logoUrl = "..."
```

El frontend debe cargar esta configuracion desde el backend antes de pintar la app o durante bootstrap.

## 3. Planes y suscripciones

### Proposito

Vender el sistema con limites y funciones segun el plan.

### Alcance inicial

- Definir planes.
- Asignar plan a tenant.
- Fecha de inicio, renovacion, estado y vencimiento.
- Limites por plan:
  - usuarios
  - sucursales
  - almacenes
  - productos
  - ventas mensuales
  - almacenamiento de imagenes
  - exportaciones
  - reportes avanzados

### Estados de suscripcion

```text
trial
active
past_due
suspended
canceled
```

### Regla de negocio

Si un tenant no paga, el sistema no debe borrar datos. Debe bloquear acciones sensibles y permitir ver/descargar informacion por un tiempo definido.

## 4. Metodos de pago y cuentas bancarias

### Proposito

Permitir que cada empresa configure como cobra y como se reconcilia el dinero.

### Alcance inicial

- Metodos de pago internos:
  - efectivo
  - transferencia
  - tarjeta
  - credito
  - pago mixto
- Cuentas bancarias del tenant.
- Asociacion de pagos a bancos.
- Conciliacion basica.
- Reporte por metodo de pago.

### SaaS billing

Para cobrar la suscripcion del SaaS hay que separar:

```text
Pagos del negocio del cliente
Pagos del cliente hacia nuestra plataforma SaaS
```

Son dos dominios distintos.

## 5. Multi sucursal

### Proposito

Permitir que una empresa tenga varias tiendas o puntos de operacion.

### Alcance inicial

- Tabla `Branch` o `Sucursal`.
- Usuarios asignados a una o varias sucursales.
- Ventas por sucursal.
- Cierres de caja por sucursal.
- Reportes filtrados por sucursal.
- Configuracion de horarios y responsables.

### Reglas

- Admin del tenant ve todas sus sucursales.
- Gerente general ve todas las sucursales asignadas.
- Supervisor ve las sucursales/equipos asignados.
- Vendedor/colaborador ve solo lo suyo segun rol.

## 6. Multi almacen

### Proposito

Manejar inventario en varios almacenes o puntos de stock.

### Alcance inicial

- Tabla `Warehouse`.
- Stock por producto y almacen.
- Movimientos de inventario:
  - entrada
  - salida
  - ajuste
  - traslado
  - devolucion
- Transferencias entre almacenes.
- Kardex o historial de movimientos.

### Regla importante

El stock no debe ser solo un numero editable. Debe derivarse de movimientos o al menos guardar auditoria de cada cambio.

## 7. Proveedores

### Proposito

Controlar quien suministra productos, costos y cuentas por pagar.

### Alcance inicial

- Proveedores por tenant.
- Contactos.
- Productos asociados.
- Costos historicos.
- Ordenes de compra.
- Deudas pendientes.

### Seguridad

El costo de compra debe estar protegido. Solo roles autorizados deben verlo.

## 8. Roles y jerarquia

### Proposito

Tener permisos claros para empresas con equipos grandes.

### Roles sugeridos

```text
Platform owner
Platform support
Tenant owner
Tenant admin
Gerente general
Supervisor
Vendedor
Colaborador
Mensajero
Almacenista
Contabilidad
Soporte interno
```

### Jerarquia

Debe existir una forma de asignar:

- empleados a supervisores
- supervisores a gerentes
- usuarios a sucursales
- usuarios a almacenes
- usuarios a productos o lineas de producto si aplica

### Regla

El rol dice que puede hacer. La asignacion dice sobre que datos lo puede hacer.

## 9. Ventas, ganancias y bonos

### Proposito

Medir rendimiento real por usuario y pagar incentivos.

### Alcance inicial

- Ganancia por empleado.
- Ganancia por colaborador.
- Ganancia por vendedor.
- Bonos configurables.
- Comisiones por producto.
- Comisiones por venta.
- Reglas por rango de fechas.
- Reporte individual por usuario.

### Cuidado

No mezclar:

```text
precio de compra
precio de venta
comision
ganancia bruta
ganancia neta
dinero pendiente
```

Cada concepto debe tener nombre y formula unica.

## 10. Caja, cierres y dinero pendiente

### Proposito

Saber cuanto dinero debe entregar cada persona y cuanto ya fue cuadrado.

### Alcance inicial

- Cierre de caja por sucursal, usuario y dia.
- Efectivo pendiente.
- Transferencias.
- Pago de mensajeros.
- Dinero pendiente por vendedor/colaborador/mensajero.
- Historial de cierres.
- Correcciones con auditoria.

### Regla

Nunca sobrescribir un cierre sin auditoria. Si se corrige, debe quedar quien, cuando y por que.

## 11. Seguimiento de paquetes

### Proposito

Dar visibilidad del estado de entregas.

### Alcance inicial

- Estado de paquete.
- Mensajero asignado.
- Fecha estimada.
- URL de ubicacion.
- Historial de cambios.
- Notificaciones.

### Futuro

- Integracion con mapas.
- Tracking publico para cliente final.
- Evidencia de entrega.

## 12. Clientes de confianza

### Proposito

Permitir politicas especiales para clientes recurrentes o confiables.

### Alcance inicial

- Marcar cliente como confiable.
- Limite de credito.
- Historial de compras.
- Riesgo o notas internas.
- Condiciones especiales.

### Cuidado

Esto toca credito y deuda. Debe quedar auditado.

## 13. Gastos y control de inventario

### Proposito

Calcular utilidad real, no solo ventas.

### Alcance inicial

- Gastos por sucursal.
- Gastos por categoria.
- Costos operativos.
- Perdidas de inventario.
- Ajustes.
- Reporte de utilidad.

## 14. Plan contable

### Proposito

Preparar el sistema para contabilidad formal.

### Alcance inicial

- Catalogo de cuentas.
- Mapeo de ventas, gastos, inventario, impuestos y comisiones.
- Exportacion contable.
- Reportes por periodo.

### Futuro

- Integracion con software contable.
- Asientos automaticos.

## 15. Facturacion electronica y firma digital

### Proposito

Permitir facturacion formal cuando el negocio lo necesite.

### Alcance inicial

- Configuracion fiscal por tenant.
- Datos legales.
- NCF/e-CF si aplica al pais.
- Firma digital o proveedor certificado.
- Historial de facturas.
- Notas de credito.
- Anulaciones.

### Recomendacion

No construir facturacion electronica desde cero al inicio. Integrar con proveedor especializado y mantener el sistema como generador/consumidor de documentos fiscales.

## 16. Politicas legales

### Proposito

Tener base legal minima para operar como SaaS.

### Documentos necesarios

- Terminos de uso.
- Politica de privacidad.
- Politica de reembolso.
- Politica de soporte.
- Politica de retencion de datos.
- Acuerdo de procesamiento de datos si se vende a empresas mas grandes.

### Regla

Las politicas deben versionarse. El usuario debe aceptar una version especifica.

## 17. Login con Google y cuenta de desarrollador

### Proposito

Mejorar onboarding y seguridad.

### Alcance inicial

- Crear proyecto en Google Cloud.
- Configurar OAuth.
- Login con Google.
- Registro con Google.
- Asociar cuenta Google a usuario existente.
- Restringir dominios si un tenant lo pide.

### Cuidado

Google login no reemplaza RBAC. Solo autentica identidad; los permisos siguen viviendo en el sistema.

## 18. Perfil de usuario

### Proposito

Permitir que cada usuario gestione su informacion y seguridad.

### Alcance inicial

- Nombre.
- Telefono.
- Foto.
- Cambio de clave.
- Sesiones activas.
- Preferencias.
- Tema visual si aplica.

## 19. Soporte

### Proposito

Atender clientes SaaS sin depender de WhatsApp personal.

### Alcance inicial

- Tickets de soporte.
- Prioridad.
- Estado.
- Adjuntos.
- Tenant afectado.
- Usuario que reporta.
- Historial de respuestas.

### Futuro

- SLA por plan.
- Base de conocimiento.
- Chat interno.

## 20. Servicios de terceros

### Categorias

- Storage: Cloudflare R2 o S3.
- Email: Resend, SendGrid, AWS SES o similar.
- SMS/WhatsApp: Twilio, Meta WhatsApp Cloud API o proveedor local.
- Pagos: proveedor compatible con RD y pagos recurrentes.
- Facturacion fiscal: proveedor especializado por pais.
- Observabilidad: Sentry, Logtail, Grafana, OpenTelemetry o similar.
- Analytics producto: PostHog, Plausible o similar.

## 21. Exportaciones CSV, Excel y preview

### Proposito

Que el cliente pueda sacar informacion sin pedir soporte.

### Alcance inicial

- Exportar tablas a CSV.
- Exportar tablas a Excel.
- Preview antes de exportar.
- Exportar con filtros aplicados.
- Exportar solo campos permitidos por rol.

### Seguridad

Una exportacion no puede saltarse las mismas reglas de permisos de la pantalla.

## 22. Trace Query y observabilidad

### Proposito

Evitar errores imposibles de diagnosticar.

### Alcance inicial

- `requestId` por request.
- Log estructurado.
- Duracion de consultas lentas.
- Usuario, tenant y ruta en logs.
- No loggear secretos.
- Tabla o sistema de auditoria para acciones sensibles.

### Futuro

- OpenTelemetry.
- Dashboard de errores.
- Alertas por 500, latencia y fallos de backup.

## 23. Reportes por usuario

### Proposito

Ver el perfil operativo de cada usuario.

### Alcance inicial

- Ventas.
- Entregas.
- Ganancias.
- Bonos.
- Dinero pendiente.
- Errores/cancelaciones.
- Productos vendidos.
- Periodos comparables.

## 24. Sistema de referidos

### Proposito

Ayudar a vender el SaaS.

### Alcance inicial

- Codigo de referido.
- Tenant referido.
- Estado.
- Comision.
- Fecha de conversion.

## 25. Metricas CLA/CLV

La nota dice `CLA`, pero conviene confirmar si se refiere a `CLV`/valor de vida del cliente o a otra metrica.

Si es CLV:

- ingreso promedio por tenant
- churn
- costo de soporte
- margen
- tiempo de vida estimado

## 26. Backups y recuperacion

### Proposito

Proteger datos del cliente y evitar perdida operativa.

### Alcance inicial

- Backup diario de DB.
- Backup/sync de imagenes.
- Retencion diaria/semanal/mensual.
- Prueba de restauracion.
- Alertas de fallo.

### Regla

Un backup no probado no cuenta como backup confiable.

