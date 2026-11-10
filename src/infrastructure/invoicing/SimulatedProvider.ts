import { createHash } from 'node:crypto';
import type { FiscalDocumentType, FiscalDraft } from '../../domain/invoicing/fiscalDocument.js';
import type { ElectronicInvoiceProvider, ProviderContext, ProviderResult } from './ElectronicInvoiceProvider.js';

/**
 * Proveedor de prueba: acepta el comprobante sin enviarlo a la DGII. Sirve para
 * probar el flujo completo (testing, demostraciones) y nunca se usa en producción.
 */
export class SimulatedProvider implements ElectronicInvoiceProvider {
  readonly kind = 'SIMULATED' as const;

  async issue(draft: FiscalDraft, context: ProviderContext): Promise<ProviderResult> {
    assertTest(context);
    const digest = createHash('sha256').update(`${draft.issuer.rnc}:${draft.encf}:${draft.totals.totalAmount}`).digest('hex');
    return {
      status: 'ACCEPTED',
      providerDocumentId: `sim-${digest.slice(0, 24)}`,
      securityCode: digest.slice(0, 6).toUpperCase(),
      signatureDate: new Date(),
      sequenceConsumed: true,
      message: 'Comprobante de prueba: no fue enviado a la DGII',
      raw: { simulated: true }
    };
  }

  async status(_documentType: FiscalDocumentType, providerDocumentId: string, context: ProviderContext): Promise<ProviderResult> {
    assertTest(context);
    return { status: 'ACCEPTED', providerDocumentId, sequenceConsumed: true, raw: { simulated: true } };
  }
}

function assertTest(context: ProviderContext) {
  if (context.environment !== 'TEST') throw new Error('El proveedor de prueba no puede emitir en producción');
}
