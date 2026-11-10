# Facturación electrónica (e-CF DGII)

Cada empresa (tenant), incluida la principal, factura con su propio RNC, sus propias
secuencias e-NCF y su propia credencial del proveedor. El sistema no firma ni envía a la
DGII por su cuenta: delega en un proveedor autorizado detrás de `ElectronicInvoiceProvider`.

## Proveedores

| Proveedor | Uso | Ambiente |
|---|---|---|
| `SIMULATED` | Probar el flujo completo sin enviar nada a la DGII | Solo `TEST` |
| `ALANUBE` | Emisión real (proveedor autorizado por la DGII) | `TEST` = sandbox, `PRODUCTION` = real |

Agregar otro proveedor = una clase nueva que implemente `issue` y `status`, y registrarla en
`Container.ts`. El dominio (`src/domain/invoicing`) no cambia.

## Puesta en marcha por empresa

1. La empresa obtiene su certificado digital y se habilita como emisor electrónico ante la DGII
   (el proveedor acompaña el proceso de certificación).
2. Crea su empresa en Alanube y copia el token (o el id de empresa si la plataforma usa una
   sola cuenta Alanube con varias empresas).
3. En el sistema: `PUT /fiscal-profile` con RNC, razón social, dirección, proveedor,
   ambiente y token. El token se guarda cifrado (`FISCAL_SECRET_KEY`) y nunca se devuelve.
4. Registra los rangos autorizados: `POST /fiscal-sequences` (E31, E32, E34) con número
   inicial, final y vencimiento.
5. Activa `enabled`. Opcional: `autoIssueOnFinalize` para facturar al finalizar cada venta.

## Flujo

- `POST /sales/:id/fiscal-invoice` — factura una venta finalizada. Con RNC/cédula del cliente
  emite crédito fiscal (E31); sin él, consumo (E32). Desde RD$250,000 el consumo exige
  identificar al cliente.
- El total de la factura es lo cobrado en la venta: si se cobró menos que los precios se
  reparte como descuento; si se cobró más se agrega la línea "Envío y otros cargos".
- Por defecto los precios incluyen ITBIS 18 % (`pricesIncludeTax`).
- `POST /fiscal-documents/:id/credit-note` — nota de crédito (E34) total o parcial; no permite
  acreditar más de lo facturado.
- `POST /fiscal-documents/:id/retry` — reenvía uno que no llegó al proveedor (mismo e-NCF) o
  consulta el estado de uno en revisión. `POST /fiscal-documents/:id/refresh` solo consulta.
- `GET /fiscal-documents`, `GET /fiscal-documents/:id` — historial y detalle (PDF, código de
  seguridad, enlace de consulta DGII).

## Permisos y módulo

Módulo `e-invoicing` (activo por defecto). Permisos `fiscal-documents:{read,create,void,update}:global`,
asignados al rol Administrador. La facturación automática al finalizar funciona aunque quien
finaliza no tenga permiso de facturar.

## Pendiente fuera del código

- Números que fallaron antes de llegar a la DGII (`FAILED`) deben anularse ante la DGII
  (anulación de secuencias) desde el portal o el proveedor.
- Pantallas del panel (perfil fiscal, secuencias, botón "Facturar" en la venta, historial).
