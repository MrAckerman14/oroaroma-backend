# Suscripciones y pagos para RD

## Objetivo

Permitir que cada empresa pague una suscripcion del sistema y que el backend active, suspenda o limite funcionalidades segun el estado del plan.

El sistema debe soportar dos realidades:

- Cobro SaaS automatico cuando haya pasarela integrada.
- Cobro manual al inicio, para vender antes de terminar la automatizacion.

## Proveedores relevantes para Republica Dominicana

Segun la guia de ecommerce de la International Trade Administration para Republica Dominicana, las plataformas locales mencionadas para procesamiento de tarjetas incluyen Cardnet, Visanet y Azul. Azul y CardNET tambien publican soluciones de pago locales para comercios.

Opciones a evaluar:

- Azul: fuerte opcion local RD, tarjetas y billeteras segun su oferta comercial.
- CardNET: opcion local RD, boton/enlace de pago y pagos automaticos segun oferta comercial.
- Visanet/Visa: red/procesamiento, puede requerir integracion bancaria o adquirente.
- PayPal: util para pagos internacionales; la documentacion de PayPal indica soporte de enviar, recibir y retirar para Republica Dominicana, pero hay que validar costos, moneda y retiros bancarios reales.
- Stripe: revisar disponibilidad oficial antes de comprometerse. Stripe tiene lista publica de paises soportados; si RD no aparece para cuentas comerciales locales en el momento de implementacion, no se debe vender como opcion principal.

Recomendacion inicial:

1. Empezar con suscripciones manuales registradas en el sistema.
2. Integrar un proveedor local RD primero: Azul o CardNET.
3. Mantener un adaptador de pagos para poder agregar otro proveedor sin rehacer suscripciones.
4. No guardar tarjetas directamente. Usar tokenizacion/checkout hospedado del proveedor.

## Modelo de datos

Plan:

```prisma
model Plan {
  id          String @id @default(uuid())
  key         String @unique
  name        String
  monthlyPrice Decimal @db.Decimal(12, 2)
  currency    String @default("DOP")
  isActive    Boolean @default(true)
  limits      Json
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

Suscripcion:

```prisma
model Subscription {
  id                 String @id @default(uuid())
  tenantId           String
  planId             String
  status             SubscriptionStatus
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  trialEndsAt         DateTime?
  cancelAtPeriodEnd   Boolean @default(false)
  provider            String?
  providerCustomerId  String?
  providerSubId       String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([tenantId])
  @@index([status])
  @@index([currentPeriodEnd])
}

enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  SUSPENDED
  CANCELLED
}
```

Factura/Pago:

```prisma
model Invoice {
  id             String @id @default(uuid())
  tenantId       String
  subscriptionId String
  number         String
  status         InvoiceStatus
  amount         Decimal @db.Decimal(12, 2)
  currency       String @default("DOP")
  dueDate        DateTime
  paidAt         DateTime?
  provider       String?
  providerRef    String?
  createdAt      DateTime @default(now())

  @@index([tenantId, createdAt])
  @@unique([tenantId, number])
}

enum InvoiceStatus {
  DRAFT
  OPEN
  PAID
  VOID
  OVERDUE
}
```

Webhook:

```prisma
model PaymentWebhookEvent {
  id            String @id @default(uuid())
  provider      String
  providerEventId String
  tenantId      String?
  payload       Json
  status        WebhookStatus
  receivedAt    DateTime @default(now())
  processedAt   DateTime?

  @@unique([provider, providerEventId])
}
```

## Abstraccion de pagos

Crear puerto:

```ts
interface PaymentProvider {
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
  parseWebhook(input: WebhookInput): Promise<PaymentEvent>;
  refund?(input: RefundInput): Promise<RefundResult>;
}
```

Implementaciones:

- `ManualPaymentProvider`
- `AzulPaymentProvider`
- `CardNetPaymentProvider`
- Futuro: `PayPalPaymentProvider`

El dominio de suscripciones no debe depender de nombres especificos de un proveedor.

## Flujo inicial manual

Este flujo permite vender rapido:

1. Super admin crea tenant.
2. Selecciona plan.
3. Registra fecha de inicio y vencimiento.
4. Estado `ACTIVE` o `TRIALING`.
5. Al vencer, job diario cambia a `PAST_DUE`.
6. Tras periodo de gracia, cambia a `SUSPENDED`.
7. Tenant suspendido puede iniciar sesion, pero solo ve pantalla de pago/renovacion.

## Flujo automatico

1. Tenant elige plan.
2. Backend crea checkout con proveedor.
3. Cliente paga en proveedor.
4. Proveedor envia webhook.
5. Backend valida firma del webhook.
6. Se crea o marca factura como pagada.
7. Se activa suscripcion.
8. Se registra auditoria.

## Reglas de suspension

No borrar datos al suspender.

Estados:

- `ACTIVE`: acceso normal.
- `PAST_DUE`: aviso visible, acceso permitido.
- `SUSPENDED`: bloqueo de creacion de ventas/productos/reportes; permitir login y pantalla de facturacion.
- `CANCELLED`: acceso solo lectura por un periodo o bloqueo total segun contrato.

## Limites por plan

Los limites deben aplicarse en backend:

- Usuarios activos.
- Sucursales.
- Productos activos.
- Ventas mensuales.
- Imagenes/almacenamiento.
- Reportes guardados.
- Exportaciones masivas.

Ejemplo `limits`:

```json
{
  "users": 5,
  "branches": 1,
  "products": 500,
  "monthlySales": 3000,
  "storageGB": 2,
  "advancedReports": false
}
```

## Seguridad y cumplimiento

- No guardar numeros de tarjeta.
- No manejar CVV.
- Preferir checkout hospedado o tokenizacion del proveedor.
- Validar firma de webhooks.
- Guardar eventos webhook idempotentes.
- Registrar auditoria de cambios de plan, suspensiones y pagos.
- Separar permisos de soporte interno.

## Decision practica

Para el primer lanzamiento SaaS:

- Implementar tablas `Plan`, `Subscription`, `Invoice`.
- Activar pago manual primero.
- Agregar job diario para vencimientos.
- Integrar Azul o CardNET cuando el cliente/proveedor entregue credenciales y documentacion tecnica.
- Mantener PayPal como opcion secundaria si las condiciones de retiro y moneda convienen.
