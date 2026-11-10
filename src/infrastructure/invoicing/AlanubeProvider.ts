import type { FiscalDocumentType, FiscalDraft, FiscalStatus } from '../../domain/invoicing/fiscalDocument.js';
import {
  ProviderRequestError,
  type ElectronicInvoiceProvider,
  type ProviderContext,
  type ProviderResult
} from './ElectronicInvoiceProvider.js';

// Alanube: proveedor de servicios de facturación electrónica autorizado por la DGII.
// Referencia: https://developer.alanube.co (API FE DOM v1).
const BASE_URLS = {
  TEST: 'https://sandbox.alanube.co/dom/v1',
  PRODUCTION: 'https://api.alanube.co/dom/v1'
} as const;

const ENDPOINTS: Record<FiscalDocumentType, string> = {
  E31: 'fiscal-invoices',
  E32: 'invoices',
  E33: 'debit-notes',
  E34: 'credit-notes'
};

type FetchLike = (input: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

interface AlanubeDocument {
  id?: string;
  status?: string;
  legalStatus?: string;
  securityCode?: string;
  signatureDate?: string;
  documentStampUrl?: string;
  pdf?: string;
  xml?: string;
  sequenceConsumed?: boolean;
  response?: Array<{ message?: string; code?: string }>;
  governmentResponse?: { value?: Array<{ valor?: string; codigo?: number }> };
  errors?: Array<{ message?: string; field?: string }>;
  message?: string;
}

export class AlanubeProvider implements ElectronicInvoiceProvider {
  readonly kind = 'ALANUBE' as const;

  constructor(
    private readonly defaultToken: string | undefined,
    private readonly timeoutMs = 30_000,
    private readonly fetcher: FetchLike = globalThis.fetch
  ) {}

  async issue(draft: FiscalDraft, context: ProviderContext): Promise<ProviderResult> {
    const body = toAlanubePayload(draft, context.companyId);
    const response = await this.request('POST', `${BASE_URLS[context.environment]}/${ENDPOINTS[draft.documentType]}`, context, body);
    return mapDocument(response);
  }

  async status(documentType: FiscalDocumentType, providerDocumentId: string, context: ProviderContext): Promise<ProviderResult> {
    const company = context.companyId ? `/idCompany/${encodeURIComponent(context.companyId)}` : '';
    const url = `${BASE_URLS[context.environment]}/${ENDPOINTS[documentType]}/${encodeURIComponent(providerDocumentId)}${company}`;
    return mapDocument(await this.request('GET', url, context));
  }

  private async request(method: 'GET' | 'POST', url: string, context: ProviderContext, body?: unknown): Promise<AlanubeDocument> {
    const token = context.token || this.defaultToken;
    if (!token) throw new ProviderRequestError('Falta la credencial del proveedor de facturación', false);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal
      });
      const text = await response.text();
      const parsed = safeJson(text) as AlanubeDocument;
      if (!response.ok) {
        const retryable = response.status >= 500 || response.status === 429;
        throw new ProviderRequestError(errorMessage(parsed, response.status), retryable, parsed);
      }
      return parsed;
    } catch (error) {
      if (error instanceof ProviderRequestError) throw error;
      const aborted = error instanceof Error && error.name === 'AbortError';
      throw new ProviderRequestError(
        aborted ? 'El proveedor de facturación tardó demasiado en responder' : 'No se pudo conectar con el proveedor de facturación',
        true
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

export function toAlanubePayload(draft: FiscalDraft, companyId?: string | null) {
  const isCreditNote = draft.documentType === 'E34';
  const { totals } = draft;
  const rateKey = totals.itbisRate === 18 ? 1 : totals.itbisRate === 16 ? 2 : 3;

  return compact({
    ...(companyId ? { company: { id: companyId } } : {}),
    idDoc: {
      encf: draft.encf,
      ...(draft.documentType === 'E32' ? {} : { sequenceDueDate: draft.sequenceExpiresAt }),
      ...(isCreditNote ? { creditNoteIndicator: draft.reference?.creditNoteIndicator ?? 0 } : {}),
      taxAmountIndicator: draft.taxIncluded ? 1 : 0,
      incomeType: 1,
      paymentType: 1,
      ...(isCreditNote ? {} : {
        paymentFormsTable: draft.paymentForms.map((form) => ({ paymentMethod: form.method, paymentAmount: form.amount }))
      })
    },
    sender: {
      rnc: draft.issuer.rnc,
      companyName: draft.issuer.legalName,
      tradename: draft.issuer.tradeName,
      branchOffice: draft.issuer.branchName?.slice(0, 20),
      address: draft.issuer.address.slice(0, 100),
      municipality: draft.issuer.municipality,
      province: draft.issuer.province,
      mail: draft.issuer.email,
      economicActivity: draft.issuer.economicActivity,
      internalInvoiceNumber: draft.internalNumber.slice(0, 20),
      stampDate: draft.stampDate
    },
    buyer: draft.buyer && (draft.buyer.rnc || draft.buyer.name || draft.buyer.email)
      ? { rnc: draft.buyer.rnc, companyName: draft.buyer.name, mail: draft.buyer.email }
      : undefined,
    totals: {
      totalTaxedAmount: totals.itbisRate === 0 ? undefined : totals.taxedAmount,
      [`i${rateKey}AmountTaxed`]: totals.taxedAmount,
      [`itbisS${rateKey}`]: totals.itbisRate,
      itbisTotal: totals.itbisAmount,
      [`itbis${rateKey}Total`]: totals.itbisAmount,
      totalAmount: totals.totalAmount
    },
    itemDetails: draft.lines.map((line) => ({
      lineNumber: line.lineNumber,
      billingIndicator: line.billingIndicator,
      itemName: line.name,
      goodServiceIndicator: line.kind,
      quantityItem: line.quantity,
      unitPriceItem: line.unitPrice,
      ...(line.discount > 0 ? { discountAmount: line.discount } : {}),
      itemAmount: line.amount
    })),
    informationReference: draft.reference
      ? {
        ncfModified: draft.reference.encf,
        ncfModifiedDate: draft.reference.stampDate,
        modificationCode: draft.reference.modificationCode,
        reasonForModification: draft.reference.reason.slice(0, 90)
      }
      : undefined
  });
}

export function mapAlanubeStatus(document: AlanubeDocument): FiscalStatus {
  switch (document.legalStatus) {
    case 'ACCEPTED': return 'ACCEPTED';
    case 'ACCEPTED_WITH_OBSERVATIONS': return 'ACCEPTED_WITH_OBSERVATIONS';
    case 'REJECTED': return 'REJECTED';
    default: break;
  }
  if (document.status === 'FAILED') return 'FAILED';
  return 'IN_PROCESS';
}

function mapDocument(document: AlanubeDocument): ProviderResult {
  const status = mapAlanubeStatus(document);
  const government = document.governmentResponse?.value?.map((item) => item.valor).filter(Boolean).join(' · ');
  const notice = document.response?.map((item) => item.message).filter(Boolean).join(' · ');
  return {
    status,
    providerDocumentId: document.id ?? null,
    securityCode: document.securityCode ?? null,
    signatureDate: document.signatureDate ? new Date(document.signatureDate) : null,
    stampUrl: document.documentStampUrl ?? null,
    pdfUrl: document.pdf ?? null,
    xmlUrl: document.xml ?? null,
    sequenceConsumed: document.sequenceConsumed ?? (status !== 'FAILED'),
    message: (status === 'REJECTED' || status === 'FAILED' ? government || notice : notice) || null,
    raw: document
  };
}

function errorMessage(body: AlanubeDocument, status: number) {
  const details = body.errors?.map((item) => item.field ? `${item.field}: ${item.message}` : item.message).filter(Boolean).join(' · ');
  return details || body.message || `El proveedor de facturación respondió con error ${status}`;
}

function safeJson(text: string) {
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text.slice(0, 300) };
  }
}

function compact<T>(value: T): T {
  if (Array.isArray(value)) return value.map(compact) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined && item !== null && item !== '')
        .map(([key, item]) => [key, compact(item)])
    ) as T;
  }
  return value;
}
