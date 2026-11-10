import { describe, expect, it, vi } from 'vitest';
import { buildLines, computeTotals, type FiscalDraft } from '../../domain/invoicing/fiscalDocument.js';
import { AlanubeProvider, mapAlanubeStatus, toAlanubePayload } from './AlanubeProvider.js';
import { ProviderRequestError } from './ElectronicInvoiceProvider.js';
import { openSecret, parseSecretKey, sealSecret } from './secretBox.js';

const lines = buildLines([{ name: 'Perfume', quantity: 1, unitPrice: 1180 }], 1180, 18);
const draft: FiscalDraft = {
  documentType: 'E31',
  encf: 'E310000000001',
  sequenceExpiresAt: '2027-12-31',
  stampDate: '2026-11-10',
  internalNumber: 'ABCD1234',
  issuer: { rnc: '131123456', legalName: 'Oro Aroma SRL', address: 'Calle 1, Santo Domingo', branchName: 'Principal' },
  buyer: { rnc: '101010101', name: 'Cliente SRL', email: null },
  taxIncluded: true,
  paymentForms: [{ method: 1, amount: 1180 }],
  lines,
  totals: computeTotals(lines, 18, true)
};

describe('Alanube payload', () => {
  it('traduce el borrador a los campos de la API', () => {
    const payload = toAlanubePayload(draft, 'company-1') as unknown as Record<string, Record<string, unknown>>;
    expect(payload.company).toEqual({ id: 'company-1' });
    expect(payload.idDoc).toMatchObject({ encf: 'E310000000001', sequenceDueDate: '2027-12-31', taxAmountIndicator: 1, incomeType: 1, paymentType: 1 });
    expect(payload.sender).toMatchObject({ rnc: '131123456', companyName: 'Oro Aroma SRL', stampDate: '2026-11-10' });
    expect(payload.buyer).toEqual({ rnc: '101010101', companyName: 'Cliente SRL' });
    expect(payload.totals).toEqual({ totalTaxedAmount: 1000, i1AmountTaxed: 1000, itbisS1: 18, itbisTotal: 180, itbis1Total: 180, totalAmount: 1180 });
    expect(payload.itemDetails).toEqual([{
      lineNumber: 1, billingIndicator: 1, itemName: 'Perfume', goodServiceIndicator: 1, quantityItem: 1, unitPriceItem: 1180, itemAmount: 1180
    }]);
  });

  it('omite fecha de vencimiento en consumo y agrega referencia en notas de crédito', () => {
    const consumer = toAlanubePayload({ ...draft, documentType: 'E32', encf: 'E320000000001' }) as unknown as Record<string, Record<string, unknown>>;
    expect(consumer.idDoc).not.toHaveProperty('sequenceDueDate');

    const credit = toAlanubePayload({
      ...draft,
      documentType: 'E34',
      encf: 'E340000000001',
      paymentForms: [],
      reference: { encf: 'E310000000001', stampDate: '2026-11-10', modificationCode: 1, reason: 'Devolución', creditNoteIndicator: 0 }
    }) as unknown as Record<string, Record<string, unknown>>;
    expect(credit.idDoc).toMatchObject({ creditNoteIndicator: 0 });
    expect(credit.idDoc).not.toHaveProperty('paymentFormsTable');
    expect(credit.informationReference).toEqual({
      ncfModified: 'E310000000001', ncfModifiedDate: '2026-11-10', modificationCode: 1, reasonForModification: 'Devolución'
    });
  });

  it('interpreta el estado legal de la DGII', () => {
    expect(mapAlanubeStatus({ status: 'FINISHED', legalStatus: 'ACCEPTED' })).toBe('ACCEPTED');
    expect(mapAlanubeStatus({ status: 'FINISHED', legalStatus: 'REJECTED' })).toBe('REJECTED');
    expect(mapAlanubeStatus({ status: 'WAITING_RESPONSE' })).toBe('IN_PROCESS');
    expect(mapAlanubeStatus({ status: 'FAILED' })).toBe('FAILED');
  });
});

describe('Alanube cliente HTTP', () => {
  it('envía al sandbox con el token de la empresa', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: () => Promise.resolve(JSON.stringify({ id: 'doc-1', status: 'FINISHED', legalStatus: 'ACCEPTED', securityCode: 'ABC123', pdf: 'https://pdf' }))
    });
    const provider = new AlanubeProvider('platform-token', 1000, fetcher);
    const result = await provider.issue(draft, { environment: 'TEST', token: 'tenant-token' });

    expect(fetcher).toHaveBeenCalledWith('https://sandbox.alanube.co/dom/v1/fiscal-invoices', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer tenant-token' }) as unknown
    }));
    expect(result).toMatchObject({ status: 'ACCEPTED', providerDocumentId: 'doc-1', securityCode: 'ABC123', pdfUrl: 'https://pdf' });
  });

  it('marca como reintentable un error del servidor y no un error de datos', async () => {
    const failing = (status: number) => new AlanubeProvider('t', 1000, vi.fn().mockResolvedValue({
      ok: false, status, text: () => Promise.resolve(JSON.stringify({ errors: [{ field: 'sender.rnc', message: 'inválido' }] }))
    }));
    await expect(failing(503).issue(draft, { environment: 'PRODUCTION' })).rejects.toMatchObject({ retryable: true });
    const error = await failing(400).issue(draft, { environment: 'PRODUCTION' }).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ProviderRequestError);
    expect(error).toMatchObject({ retryable: false, message: 'sender.rnc: inválido' });
  });

  it('consulta el estado con la empresa en la ruta', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('{"id":"doc-1","legalStatus":"ACCEPTED"}') });
    await new AlanubeProvider('t', 1000, fetcher).status('E32', 'doc-1', { environment: 'PRODUCTION', companyId: 'c-1' });
    expect(fetcher.mock.calls[0]![0]).toBe('https://api.alanube.co/dom/v1/invoices/doc-1/idCompany/c-1');
  });
});

describe('credenciales cifradas', () => {
  it('cifra y descifra con la clave del servidor', () => {
    const key = parseSecretKey('a'.repeat(64))!;
    const sealed = sealSecret('token-secreto', key);
    expect(sealed).not.toContain('token-secreto');
    expect(openSecret(sealed, key)).toBe('token-secreto');
    expect(() => openSecret(sealed, parseSecretKey('b'.repeat(64))!)).toThrow();
  });
});
