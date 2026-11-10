import type { FiscalDocumentType, FiscalDraft, FiscalStatus } from '../../domain/invoicing/fiscalDocument.js';

export type FiscalProviderKind = 'SIMULATED' | 'ALANUBE';
export type FiscalEnvironmentKind = 'TEST' | 'PRODUCTION';

export interface ProviderContext {
  environment: FiscalEnvironmentKind;
  /** Credencial de la empresa; si falta se usa la de la cuenta de la plataforma. */
  token?: string | null;
  /** Empresa dentro de la cuenta del proveedor (una cuenta puede emitir por varias empresas). */
  companyId?: string | null;
}

export interface ProviderResult {
  status: FiscalStatus;
  providerDocumentId?: string | null;
  securityCode?: string | null;
  signatureDate?: Date | null;
  stampUrl?: string | null;
  pdfUrl?: string | null;
  xmlUrl?: string | null;
  /** La DGII ya registró el número aunque el documento falle: no se puede volver a usar. */
  sequenceConsumed?: boolean;
  message?: string | null;
  raw: unknown;
}

export interface ElectronicInvoiceProvider {
  readonly kind: FiscalProviderKind;
  issue(draft: FiscalDraft, context: ProviderContext): Promise<ProviderResult>;
  status(documentType: FiscalDocumentType, providerDocumentId: string, context: ProviderContext): Promise<ProviderResult>;
}

export class ProviderRequestError extends Error {
  constructor(message: string, readonly retryable: boolean, readonly raw?: unknown) {
    super(message);
    this.name = 'ProviderRequestError';
  }
}
