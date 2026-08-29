# Servicios externos e infraestructura escalable

## Objetivo

Definir los servicios que conviene integrar para que el sistema pueda crecer sin depender de una sola maquina, sin perder imagenes en deploys y sin quedarse ciego ante errores.

## Estado actual de infraestructura

El sistema corre bien para una instalacion pequena:

- Backend Node/Fastify.
- PostgreSQL.
- Frontend Quasar SPA.
- Imagenes por storage local.
- Variables reservadas para storage S3/R2.

El problema es que el storage local normal de plataformas tipo Render puede ser efimero si no hay persistent disk. Render documenta que solo lo escrito bajo el mount path de un persistent disk se preserva entre deploys y reinicios. Por eso, para SaaS, las imagenes deben salir del filesystem local.

## Almacenamiento de imagenes

Recomendacion principal: Cloudflare R2.

Motivos:

- Object storage escalable.
- Compatible con API S3.
- Bueno para imagenes y archivos de producto.
- Puede servirse detras de CDN.
- Evita depender del disco del servidor.

Cloudflare documenta que R2 soporta API compatible con S3 y usa endpoint tipo:

```txt
https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

Variables sugeridas:

```env
STORAGE_DRIVER=r2
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_REGION=auto
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_ACCESS_KEY_ID=
OBJECT_STORAGE_SECRET_ACCESS_KEY=
OBJECT_STORAGE_PUBLIC_BASE_URL=
```

Estructura de keys:

```txt
tenants/{tenantId}/products/{productId}/{uuid}.webp
tenants/{tenantId}/logos/{uuid}.png
tenants/{tenantId}/reports/{reportId}.pdf
```

Alternativas:

- AWS S3: maduro, mas caro segun egreso.
- Backblaze B2: S3 compatible, costo bajo.
- DigitalOcean Spaces: simple si se usa DO.
- Render Persistent Disk: aceptable temporalmente para una instancia, no ideal para SaaS multi-tenant.

## CDN e imagenes

Agregar CDN para:

- Imagenes de productos.
- Logos de tenants.
- Assets publicos.

Reglas:

- Imagenes publicas pueden ser servidas por URL firmada larga o public base URL.
- Imagenes privadas o reportes sensibles deben usar signed URLs con expiracion.
- Nunca exponer keys internas de object storage al frontend.

## Base de datos

Inicio:

- PostgreSQL administrado.
- Backups automaticos.
- Indices por tenant, fecha, usuario y estado.

Escala intermedia:

- Pool de conexiones.
- Read replicas para reportes si crece.
- Jobs para reportes pesados.

Escala mayor:

- Particion por fechas en ventas si hay millones de filas.
- Separar reporting/analytics si los cierres se ponen lentos.

## Cache y colas

Agregar Redis cuando aparezcan estas necesidades:

- Rate limiting distribuido.
- Cache de permisos y settings del tenant.
- Jobs de descargas masivas.
- Generacion de reportes.
- Webhooks de pagos con reintentos.

Cola recomendada:

- BullMQ si se usa Redis.
- Alternativa simple: jobs en DB para primera fase.

Jobs candidatos:

- Procesar imagenes.
- Generar ZIP o lotes de descargas.
- Enviar emails.
- Revisar suscripciones vencidas.
- Sincronizar pagos.
- Crear reportes pesados.

## Email

Necesario para:

- Invitaciones de usuarios.
- Recuperar contraseña.
- Avisos de pago.
- Facturas.
- Alertas de suspension.

Opciones:

- Resend.
- SendGrid.
- Mailgun.
- Amazon SES.

Modelo:

```prisma
model EmailEvent {
  id        String @id @default(uuid())
  tenantId  String?
  to        String
  template  String
  status    String
  provider  String?
  createdAt DateTime @default(now())
}
```

## WhatsApp/SMS

Puede ser relevante para comercios en RD:

- Confirmar ventas.
- Enviar enlaces de pago.
- Notificar entregas.

Opciones:

- WhatsApp Business Cloud API.
- Twilio.
- Proveedor local si ofrece mejor costo.

No debe implementarse antes de estabilizar multi-tenant y pagos, salvo que sea requisito comercial fuerte.

## Observabilidad

Minimo necesario:

- Logs JSON con `requestId`, `tenantId`, `actorId`.
- Error tracking.
- Metricas de latencia por endpoint.
- Alertas de errores 5xx.
- Monitoreo de uso por tenant.

Opciones:

- Sentry para frontend/backend.
- Better Stack o Logtail para logs.
- Axiom/Datadog si el presupuesto lo permite.
- UptimeRobot/Better Stack para uptime.

Eventos clave:

- Login fallido.
- Cambios de rol.
- Descarga masiva de imagenes.
- Cambio de precio de producto.
- Creacion/cancelacion/finalizacion de venta.
- Cierre de caja.
- Cambio de plan/suscripcion.

## Seguridad

Servicios/capas recomendadas:

- WAF/CDN con Cloudflare.
- Rate limiting en login.
- 2FA para admins.
- Politica de contraseñas.
- Auditoria no editable.
- Backups probados.
- Separacion de secretos por ambiente.

Reglas de backend:

- Nunca devolver `passwordHash`.
- No devolver `purchasePrice` a no-admin.
- No confiar en datos enviados desde frontend para tenant/role.
- Sanitizar respuestas.
- Validar payloads con Zod.
- CORS por ambiente y dominio exacto.

## Ambientes

Crear ambientes separados:

- Local: desarrollo.
- Staging: pruebas reales antes de produccion.
- Production: clientes.

Cada ambiente debe tener:

- DB propia.
- bucket/prefix propio.
- JWT secret propio.
- pasarela en sandbox/produccion separada.
- dominios separados.

## Recomendacion para Render hoy

Mientras se usa Render:

- Backend web service.
- Frontend static site.
- PostgreSQL administrado.
- Persistent Disk solo como puente si todavia no se implemento R2.
- R2 para imagenes antes de vender muchos clientes.

Para multi-tenant, no crear un servicio por cliente como solucion permanente. Puede servir para pilotos, pero aumenta mantenimiento y riesgo de versiones distintas.
