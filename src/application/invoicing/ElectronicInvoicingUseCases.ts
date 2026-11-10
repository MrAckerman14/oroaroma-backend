import { Prisma, type FiscalDocument, type PrismaClient, type TenantFiscalProfile } from '@prisma/client';
import {
  assertInvoiceRules,
  buildLines,
  computeTotals,
  creditNoteLines,
  daysBetween,
  dominicanDate,
  fiscalDocumentLabels,
  formatEncf,
  isValidTaxId,
  normalizeTaxId,
  paymentFormsFor,
  resolveInvoiceType,
  type FiscalBuyer,
  type FiscalDocumentType,
  type FiscalDraft,
  type FiscalStatus,
  type ItbisRate
} from '../../domain/invoicing/fiscalDocument.js';
import {
  ProviderRequestError,
  type ElectronicInvoiceProvider,
  type FiscalProviderKind,
  type ProviderContext,
  type ProviderResult
} from '../../infrastructure/invoicing/ElectronicInvoiceProvider.js';
import { openSecret, sealSecret } from '../../infrastructure/invoicing/secretBox.js';
import { ConflictError, NotFoundError, ValidationAppError } from '../../shared/errors/AppError.js';
import { buildCreatedAtFilter, parseDateRange } from '../../shared/utils/dateRange.js';
import type { AuthenticatedUser } from '../../types/rbac.js';

export interface InvoicingDependencies {
  providers: Record<FiscalProviderKind, ElectronicInvoiceProvider>;
  secretKey: Buffer | null;
  /** La cuenta de la plataforma tiene credencial propia del proveedor (variable de entorno). */
  platformCredentials: Record<FiscalProviderKind, boolean>;
  now?: () => Date;
}

export interface FiscalProfileInput {
  enabled?: boolean | undefined;
  provider?: FiscalProviderKind | undefined;
  environment?: 'TEST' | 'PRODUCTION' | undefined;
  rnc?: string | undefined;
  legalName?: string | undefined;
  tradeName?: string | null | undefined;
  address?: string | undefined;
  municipality?: string | null | undefined;
  province?: string | null | undefined;
  email?: string | null | undefined;
  phone?: string | null | undefined;
  economicActivity?: string | null | undefined;
  providerCompanyId?: string | null | undefined;
  /** Texto plano: se cifra antes de guardarse. Cadena vacía o null lo elimina. */
  providerToken?: string | null | undefined;
  pricesIncludeTax?: boolean | undefined;
  itbisRate?: ItbisRate | undefined;
  autoIssueOnFinalize?: boolean | undefined;
}

export interface SequenceInput {
  documentType: FiscalDocumentType;
  startNumber: number;
  endNumber: number;
  expiresAt: string;
}

export interface IssueInvoiceInput {
  documentType?: 'E31' | 'E32' | undefined;
  buyer?: { rnc?: string | undefined; name?: string | undefined; email?: string | undefined } | undefined;
}

export interface CreditNoteInput {
  reason: string;
  amount?: number | undefined;
}

export interface FiscalDocumentListQuery {
  page: number;
  pageSize: number;
  status?: FiscalStatus | undefined;
  documentType?: FiscalDocumentType | undefined;
  saleId?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

const statusLabels: Record<FiscalStatus, string> = {
  PENDING: 'Pendiente de envío',
  IN_PROCESS: 'En revisión de la DGII',
  ACCEPTED: 'Aceptada',
  ACCEPTED_WITH_OBSERVATIONS: 'Aceptada con observaciones',
  REJECTED: 'Rechazada',
  FAILED: 'No se pudo enviar'
};

const VALID_INVOICE_STATUSES: FiscalStatus[] = ['PENDING', 'IN_PROCESS', 'ACCEPTED', 'ACCEPTED_WITH_OBSERVATIONS'];
const ACCEPTED_STATUSES: FiscalStatus[] = ['ACCEPTED', 'ACCEPTED_WITH_OBSERVATIONS'];

export class ElectronicInvoicingUseCases {
  private readonly now: () => Date;

  constructor(private readonly prisma: PrismaClient, private readonly deps: InvoicingDependencies) {
    this.now = deps.now ?? (() => new Date());
  }

  // ---------------------------------------------------------------- Perfil fiscal

  async getProfile(actor: AuthenticatedUser) {
    const profile = await this.prisma.tenantFiscalProfile.findUnique({ where: { tenantId: actor.tenantId } });
    return profile ? this.presentProfile(profile) : null;
  }

  async saveProfile(actor: AuthenticatedUser, input: FiscalProfileInput) {
    const current = await this.prisma.tenantFiscalProfile.findUnique({ where: { tenantId: actor.tenantId } });
    const rnc = input.rnc !== undefined ? normalizeTaxId(input.rnc) : current?.rnc ?? null;
    const legalName = input.legalName?.trim() ?? current?.legalName;
    const address = input.address?.trim() ?? current?.address;
    const provider = input.provider ?? current?.provider ?? 'SIMULATED';
    const environment = input.environment ?? current?.environment ?? 'TEST';

    const errors: string[] = [];
    if (!rnc || !isValidTaxId(rnc)) errors.push('El RNC de la empresa debe tener 9 u 11 dígitos');
    if (!legalName) errors.push('Indica la razón social registrada en la DGII');
    if (!address) errors.push('Indica la dirección del establecimiento');
    if (provider === 'SIMULATED' && environment === 'PRODUCTION') {
      errors.push('El modo de prueba no puede emitir comprobantes reales; elige un proveedor');
    }

    let providerTokenEncrypted = current?.providerTokenEncrypted ?? null;
    if (input.providerToken !== undefined) {
      const token = input.providerToken?.trim();
      if (!token) {
        providerTokenEncrypted = null;
      } else if (!this.deps.secretKey) {
        errors.push('El servidor no tiene configurada la clave para guardar credenciales (FISCAL_SECRET_KEY)');
      } else {
        providerTokenEncrypted = sealSecret(token, this.deps.secretKey);
      }
    }

    const enabled = input.enabled ?? current?.enabled ?? false;
    if (enabled && provider !== 'SIMULATED' && !providerTokenEncrypted && !this.deps.platformCredentials[provider]) {
      errors.push('Falta la credencial del proveedor de facturación');
    }
    if (errors.length) throw new ValidationAppError(errors[0]!, { errors });

    const data = {
      enabled,
      provider,
      environment,
      rnc: rnc!,
      legalName: legalName!,
      address: address!,
      tradeName: optional(input.tradeName, current?.tradeName),
      municipality: optional(input.municipality, current?.municipality),
      province: optional(input.province, current?.province),
      email: optional(input.email, current?.email),
      phone: optional(input.phone, current?.phone),
      economicActivity: optional(input.economicActivity, current?.economicActivity),
      providerCompanyId: optional(input.providerCompanyId, current?.providerCompanyId),
      providerTokenEncrypted,
      pricesIncludeTax: input.pricesIncludeTax ?? current?.pricesIncludeTax ?? true,
      itbisRate: input.itbisRate ?? current?.itbisRate ?? 18,
      autoIssueOnFinalize: input.autoIssueOnFinalize ?? current?.autoIssueOnFinalize ?? false
    };

    const profile = await this.prisma.tenantFiscalProfile.upsert({
      where: { tenantId: actor.tenantId },
      update: data,
      create: { tenantId: actor.tenantId, ...data }
    });
    return this.presentProfile(profile);
  }

  // ---------------------------------------------------------------- Secuencias e-NCF

  async listSequences(actor: AuthenticatedUser) {
    const sequences = await this.prisma.fiscalSequence.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: [{ documentType: 'asc' }, { startNumber: 'asc' }]
    });
    const today = this.now();
    return sequences.map((sequence) => ({
      ...sequence,
      typeLabel: fiscalDocumentLabels[sequence.documentType],
      nextEncf: sequence.nextNumber <= sequence.endNumber ? formatEncf(sequence.documentType, sequence.nextNumber) : null,
      remaining: Math.max(0, sequence.endNumber - sequence.nextNumber + 1),
      expired: sequence.expiresAt.getTime() < today.getTime()
    }));
  }

  async addSequence(actor: AuthenticatedUser, input: SequenceInput) {
    if (input.endNumber < input.startNumber) throw new ValidationAppError('El número final debe ser mayor o igual al inicial');
    const expiresAt = endOfDominicanDay(input.expiresAt);
    if (expiresAt.getTime() < this.now().getTime()) throw new ValidationAppError('La fecha de vencimiento ya pasó');

    const overlapping = await this.prisma.fiscalSequence.findFirst({
      where: {
        tenantId: actor.tenantId,
        documentType: input.documentType,
        startNumber: { lte: input.endNumber },
        endNumber: { gte: input.startNumber }
      }
    });
    if (overlapping) throw new ConflictError('Ese rango se cruza con otro ya registrado para el mismo tipo de comprobante');

    const used = await this.prisma.fiscalDocument.findFirst({
      where: {
        tenantId: actor.tenantId,
        documentType: input.documentType,
        encf: { gte: formatEncf(input.documentType, input.startNumber), lte: formatEncf(input.documentType, input.endNumber) }
      },
      select: { encf: true }
    });
    if (used) throw new ConflictError(`El número ${used.encf} ya fue usado`);

    return this.prisma.fiscalSequence.create({
      data: {
        tenantId: actor.tenantId,
        documentType: input.documentType,
        startNumber: input.startNumber,
        endNumber: input.endNumber,
        nextNumber: input.startNumber,
        expiresAt
      }
    });
  }

  async setSequenceActive(actor: AuthenticatedUser, id: string, active: boolean) {
    const sequence = await this.prisma.fiscalSequence.findFirst({ where: { id, tenantId: actor.tenantId } });
    if (!sequence) throw new NotFoundError('Secuencia no encontrada');
    return this.prisma.fiscalSequence.update({ where: { id }, data: { active } });
  }

  // ---------------------------------------------------------------- Emisión

  async issueForSale(actor: AuthenticatedUser, branchId: string, saleId: string, input: IssueInvoiceInput = {}) {
    const profile = await this.requireEnabledProfile(actor.tenantId);
    const buyer = this.normalizeBuyer(input.buyer);

    const document = await this.prisma.$transaction(async (tx) => {
      await lock(tx, `fiscal-sale:${saleId}`);
      const sale = await tx.sale.findFirst({
        where: { id: saleId, tenantId: actor.tenantId, branchId, deletedAt: null },
        include: {
          branch: { select: { name: true } },
          details: { include: { store: { select: { name: true } } }, orderBy: { createdAt: 'asc' } }
        }
      });
      if (!sale) throw new NotFoundError('Venta no encontrada');
      if (sale.status !== 'FINALIZED') throw new ValidationAppError('Solo se pueden facturar ventas finalizadas');

      const existing = await tx.fiscalDocument.findFirst({
        where: { tenantId: actor.tenantId, saleId, documentType: { in: ['E31', 'E32'] }, status: { in: VALID_INVOICE_STATUSES } },
        select: { encf: true }
      });
      if (existing) throw new ConflictError(`Esta venta ya tiene la factura ${existing.encf}`);

      const rate = profile.itbisRate as ItbisRate;
      const documentType = resolveInvoiceType(buyer, input.documentType);
      const amount = Number(sale.amount);
      const lines = buildLines(
        sale.details.map((detail) => ({ name: detail.store.name, quantity: detail.quantity, unitPrice: Number(detail.unitPrice) })),
        amount,
        rate
      );
      const totals = computeTotals(lines, rate, profile.pricesIncludeTax);
      const errors = assertInvoiceRules(documentType, buyer, totals);
      if (errors.length) throw new ValidationAppError(errors[0]!, { errors });

      const sequence = await takeSequenceNumber(tx, actor.tenantId, documentType, this.now());
      const draft: FiscalDraft = {
        documentType,
        encf: formatEncf(documentType, sequence.number),
        sequenceExpiresAt: dominicanDate(sequence.expiresAt),
        stampDate: dominicanDate(this.now()),
        internalNumber: sale.id.slice(0, 8).toUpperCase(),
        issuer: this.issuerFrom(profile, sale.branch?.name),
        buyer,
        taxIncluded: profile.pricesIncludeTax,
        paymentForms: paymentFormsFor(Number(sale.amountCash), Number(sale.amountTransfer), totals.totalAmount),
        lines,
        totals
      };
      return this.createPending(tx, actor, profile, draft, { saleId, branchId: sale.branchId });
    });

    return this.send(document, profile);
  }

  /** Factura automática al finalizar una venta, si la empresa lo activó. Nunca bloquea la venta. */
  async autoIssueAfterFinalize(actor: AuthenticatedUser, branchId: string, saleId: string) {
    if (!(actor.enabledModules ?? []).includes('e-invoicing')) return null;
    const profile = await this.prisma.tenantFiscalProfile.findUnique({ where: { tenantId: actor.tenantId } });
    if (!profile?.enabled || !profile.autoIssueOnFinalize) return null;
    try {
      return await this.issueForSale(actor, branchId, saleId);
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'No se pudo emitir la factura' };
    }
  }

  async issueCreditNote(actor: AuthenticatedUser, branchId: string, documentId: string, input: CreditNoteInput) {
    const profile = await this.requireEnabledProfile(actor.tenantId);
    const reason = input.reason.trim();
    if (!reason) throw new ValidationAppError('Indica el motivo de la nota de crédito');

    const document = await this.prisma.$transaction(async (tx) => {
      await lock(tx, `fiscal-credit:${documentId}`);
      const original = await tx.fiscalDocument.findFirst({
        where: { id: documentId, tenantId: actor.tenantId, branchId }
      });
      if (!original) throw new NotFoundError('Comprobante no encontrado');
      if (original.documentType !== 'E31' && original.documentType !== 'E32') {
        throw new ValidationAppError('Solo se pueden emitir notas de crédito sobre facturas');
      }
      if (!ACCEPTED_STATUSES.includes(original.status)) {
        throw new ValidationAppError('La factura debe estar aceptada por la DGII antes de emitir una nota de crédito');
      }
      if (original.environment !== profile.environment) {
        throw new ValidationAppError('La factura se emitió en otro ambiente (prueba/producción)');
      }

      const previous = await tx.fiscalDocument.aggregate({
        where: { tenantId: actor.tenantId, referencedDocumentId: original.id, status: { in: VALID_INVOICE_STATUSES } },
        _sum: { totalAmount: true }
      });
      const originalTotal = Number(original.totalAmount);
      const available = Math.round((originalTotal - Number(previous._sum.totalAmount ?? 0)) * 100) / 100;
      if (available <= 0) throw new ConflictError('Esta factura ya fue anulada por completo');
      const requested = input.amount ?? available;
      if (requested > available) throw new ValidationAppError(`El monto disponible para acreditar es ${available.toFixed(2)}`);

      const originalDraft = original.payload as unknown as FiscalDraft;
      const rate = originalDraft.totals.itbisRate;
      const { lines, modificationCode } = requested === originalTotal
        ? creditNoteLines(originalDraft.lines, originalTotal, undefined, rate)
        : creditNoteLines(originalDraft.lines, originalTotal, requested, rate);
      const totals = computeTotals(lines, rate, originalDraft.taxIncluded);

      const sequence = await takeSequenceNumber(tx, actor.tenantId, 'E34', this.now());
      const draft: FiscalDraft = {
        documentType: 'E34',
        encf: formatEncf('E34', sequence.number),
        sequenceExpiresAt: dominicanDate(sequence.expiresAt),
        stampDate: dominicanDate(this.now()),
        internalNumber: original.encf.slice(-8),
        issuer: originalDraft.issuer,
        buyer: originalDraft.buyer,
        taxIncluded: originalDraft.taxIncluded,
        paymentForms: [],
        lines,
        totals,
        reference: {
          encf: original.encf,
          stampDate: dominicanDate(original.stampDate),
          modificationCode,
          reason,
          creditNoteIndicator: daysBetween(original.stampDate, this.now()) > 30 ? 1 : 0
        }
      };
      return this.createPending(tx, actor, profile, draft, {
        saleId: original.saleId,
        branchId: original.branchId,
        referencedDocumentId: original.id,
        modificationCode,
        reason
      });
    });

    return this.send(document, profile);
  }

  /** Reintenta un envío que no llegó al proveedor, o consulta el estado de uno en revisión. */
  async retry(actor: AuthenticatedUser, branchId: string, id: string) {
    const document = await this.findDocument(actor, branchId, id);
    const profile = await this.requireEnabledProfile(actor.tenantId);
    if (document.provider !== profile.provider || document.environment !== profile.environment) {
      throw new ValidationAppError('El comprobante se emitió con otra configuración del proveedor');
    }
    if (document.status === 'IN_PROCESS' && document.providerDocumentId) return this.refresh(actor, branchId, id);
    if (document.status !== 'PENDING' && document.status !== 'FAILED') {
      throw new ValidationAppError('Este comprobante ya fue procesado por la DGII');
    }
    return this.send(document, profile);
  }

  async refresh(actor: AuthenticatedUser, branchId: string, id: string) {
    const document = await this.findDocument(actor, branchId, id);
    if (!document.providerDocumentId) throw new ValidationAppError('El comprobante aún no fue recibido por el proveedor');
    const profile = await this.requireEnabledProfile(actor.tenantId);
    const provider = this.deps.providers[document.provider];
    try {
      const result = await provider.status(document.documentType, document.providerDocumentId, this.context(profile, document.environment));
      return this.presentDocument(await this.applyResult(document.id, result, false));
    } catch (error) {
      throw new ValidationAppError(error instanceof Error ? error.message : 'No se pudo consultar el estado');
    }
  }

  // ---------------------------------------------------------------- Consultas

  async list(actor: AuthenticatedUser, branchId: string, query: FiscalDocumentListQuery) {
    const createdAt = buildCreatedAtFilter(parseDateRange(query));
    const where: Prisma.FiscalDocumentWhereInput = {
      tenantId: actor.tenantId,
      branchId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.documentType ? { documentType: query.documentType } : {}),
      ...(query.saleId ? { saleId: query.saleId } : {}),
      ...(createdAt ? { createdAt } : {})
    };
    const [items, total] = await Promise.all([
      this.prisma.fiscalDocument.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      }),
      this.prisma.fiscalDocument.count({ where })
    ]);
    return {
      items: items.map((item) => this.presentDocument(item)),
      pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) }
    };
  }

  async detail(actor: AuthenticatedUser, branchId: string, id: string) {
    const document = await this.findDocument(actor, branchId, id);
    const creditNotes = await this.prisma.fiscalDocument.findMany({
      where: { tenantId: actor.tenantId, referencedDocumentId: document.id },
      orderBy: { createdAt: 'asc' }
    });
    const draft = document.payload as unknown as FiscalDraft;
    return {
      ...this.presentDocument(document),
      issuer: draft.issuer,
      lines: draft.lines,
      paymentForms: draft.paymentForms,
      reference: draft.reference ?? null,
      creditNotes: creditNotes.map((note) => this.presentDocument(note))
    };
  }

  // ---------------------------------------------------------------- Internos

  private async createPending(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedUser,
    profile: TenantFiscalProfile,
    draft: FiscalDraft,
    links: { saleId: string | null; branchId: string | null; referencedDocumentId?: string; modificationCode?: number; reason?: string }
  ) {
    return tx.fiscalDocument.create({
      data: {
        tenantId: actor.tenantId,
        branchId: links.branchId,
        saleId: links.saleId,
        referencedDocumentId: links.referencedDocumentId ?? null,
        documentType: draft.documentType,
        encf: draft.encf,
        status: 'PENDING',
        provider: profile.provider,
        environment: profile.environment,
        stampDate: new Date(`${draft.stampDate}T12:00:00.000Z`),
        buyerRnc: draft.buyer?.rnc ?? null,
        buyerName: draft.buyer?.name ?? null,
        buyerEmail: draft.buyer?.email ?? null,
        taxedAmount: new Prisma.Decimal(draft.totals.taxedAmount),
        exemptAmount: new Prisma.Decimal(draft.totals.exemptAmount),
        itbisAmount: new Prisma.Decimal(draft.totals.itbisAmount),
        totalAmount: new Prisma.Decimal(draft.totals.totalAmount),
        modificationCode: links.modificationCode ?? null,
        reason: links.reason ?? null,
        payload: draft as unknown as Prisma.InputJsonValue,
        issuedById: actor.id
      }
    });
  }

  private async send(document: FiscalDocument, profile: TenantFiscalProfile) {
    const provider = this.deps.providers[document.provider];
    const draft = document.payload as unknown as FiscalDraft;
    try {
      const result = await provider.issue(draft, this.context(profile, document.environment));
      return this.presentDocument(await this.applyResult(document.id, result, true));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo enviar el comprobante';
      // Sin respuesta del proveedor el número queda reservado y se reintenta con el mismo e-NCF.
      const retryable = !(error instanceof ProviderRequestError) || error.retryable;
      const updated = await this.prisma.fiscalDocument.update({
        where: { id: document.id },
        data: {
          status: retryable ? 'PENDING' : 'FAILED',
          errorMessage: message.slice(0, 1000),
          attempts: { increment: 1 },
          ...(error instanceof ProviderRequestError && error.raw ? { providerResponse: error.raw } : {})
        }
      });
      return this.presentDocument(updated);
    }
  }

  private applyResult(id: string, result: ProviderResult, countAttempt: boolean) {
    return this.prisma.fiscalDocument.update({
      where: { id },
      data: {
        status: result.status,
        ...(result.providerDocumentId ? { providerDocumentId: result.providerDocumentId } : {}),
        ...(result.securityCode ? { securityCode: result.securityCode } : {}),
        ...(result.signatureDate ? { signatureDate: result.signatureDate } : {}),
        ...(result.stampUrl ? { stampUrl: result.stampUrl } : {}),
        ...(result.pdfUrl ? { pdfUrl: result.pdfUrl } : {}),
        ...(result.xmlUrl ? { xmlUrl: result.xmlUrl } : {}),
        errorMessage: result.status === 'REJECTED' || result.status === 'FAILED' ? (result.message ?? 'Rechazado por la DGII') : null,
        providerResponse: (result.raw ?? null) as Prisma.InputJsonValue,
        ...(countAttempt ? { attempts: { increment: 1 } } : {})
      }
    });
  }

  private context(profile: TenantFiscalProfile, environment: 'TEST' | 'PRODUCTION'): ProviderContext {
    let token: string | null = null;
    if (profile.providerTokenEncrypted) {
      if (!this.deps.secretKey) throw new ValidationAppError('El servidor no puede leer la credencial del proveedor (FISCAL_SECRET_KEY)');
      token = openSecret(profile.providerTokenEncrypted, this.deps.secretKey);
    }
    return { environment, token, companyId: profile.providerCompanyId };
  }

  private async requireEnabledProfile(tenantId: string) {
    const profile = await this.prisma.tenantFiscalProfile.findUnique({ where: { tenantId } });
    if (!profile?.enabled) throw new ValidationAppError('La facturación electrónica no está activada para esta empresa');
    return profile;
  }

  private async findDocument(actor: AuthenticatedUser, branchId: string, id: string) {
    const document = await this.prisma.fiscalDocument.findFirst({ where: { id, tenantId: actor.tenantId, branchId } });
    if (!document) throw new NotFoundError('Comprobante no encontrado');
    return document;
  }

  private normalizeBuyer(input: IssueInvoiceInput['buyer']): FiscalBuyer | null {
    if (!input) return null;
    const buyer = {
      rnc: normalizeTaxId(input.rnc),
      name: input.name?.trim() || null,
      email: input.email?.trim() || null
    };
    return buyer.rnc || buyer.name || buyer.email ? buyer : null;
  }

  private issuerFrom(profile: TenantFiscalProfile, branchName?: string | null) {
    return {
      rnc: profile.rnc,
      legalName: profile.legalName,
      tradeName: profile.tradeName,
      address: profile.address,
      municipality: profile.municipality,
      province: profile.province,
      email: profile.email,
      phone: profile.phone,
      economicActivity: profile.economicActivity,
      branchName: branchName ?? null
    };
  }

  private presentProfile(profile: TenantFiscalProfile) {
    const { providerTokenEncrypted, ...rest } = profile;
    return {
      ...rest,
      hasProviderToken: Boolean(providerTokenEncrypted),
      usesPlatformCredentials: !providerTokenEncrypted && this.deps.platformCredentials[profile.provider]
    };
  }

  private presentDocument(document: FiscalDocument) {
    return {
      id: document.id,
      documentType: document.documentType,
      typeLabel: fiscalDocumentLabels[document.documentType],
      encf: document.encf,
      status: document.status,
      statusLabel: statusLabels[document.status],
      provider: document.provider,
      environment: document.environment,
      saleId: document.saleId,
      branchId: document.branchId,
      referencedDocumentId: document.referencedDocumentId,
      buyerRnc: document.buyerRnc,
      buyerName: document.buyerName,
      buyerEmail: document.buyerEmail,
      taxedAmount: Number(document.taxedAmount),
      exemptAmount: Number(document.exemptAmount),
      itbisAmount: Number(document.itbisAmount),
      totalAmount: Number(document.totalAmount),
      securityCode: document.securityCode,
      stampDate: document.stampDate,
      signatureDate: document.signatureDate,
      stampUrl: document.stampUrl,
      pdfUrl: document.pdfUrl,
      xmlUrl: document.xmlUrl,
      modificationCode: document.modificationCode,
      reason: document.reason,
      errorMessage: document.errorMessage,
      attempts: document.attempts,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt
    };
  }
}

async function lock(tx: Prisma.TransactionClient, key: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0)) IS NULL AS locked`;
}

/** Toma el siguiente número de la secuencia vigente de forma atómica (fila bloqueada). */
async function takeSequenceNumber(tx: Prisma.TransactionClient, tenantId: string, documentType: FiscalDocumentType, now: Date) {
  const rows = await tx.$queryRaw<Array<{ number: number; expiresAt: Date }>>`
    UPDATE "FiscalSequence" SET "nextNumber" = "nextNumber" + 1, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = (
      SELECT "id" FROM "FiscalSequence"
      WHERE "tenantId" = ${tenantId}
        AND "documentType" = ${documentType}::"FiscalDocumentType"
        AND "active" = true
        AND "nextNumber" <= "endNumber"
        AND "expiresAt" >= ${now}
      ORDER BY "expiresAt" ASC, "startNumber" ASC
      LIMIT 1
      FOR UPDATE
    )
    RETURNING "nextNumber" - 1 AS "number", "expiresAt"
  `;
  const row = rows[0];
  if (!row) {
    throw new ValidationAppError(`No hay números disponibles para ${fiscalDocumentLabels[documentType].toLowerCase()}. Registra una secuencia autorizada por la DGII`);
  }
  return { number: Number(row.number), expiresAt: row.expiresAt };
}

function endOfDominicanDay(date: string) {
  // 23:59:59 en República Dominicana (UTC-4)
  const parsed = new Date(`${date.slice(0, 10)}T23:59:59.999-04:00`);
  if (Number.isNaN(parsed.getTime())) throw new ValidationAppError('Fecha de vencimiento inválida');
  return parsed;
}

function optional<T>(next: T | null | undefined, current: T | null | undefined) {
  if (next === undefined) return current ?? null;
  if (typeof next === 'string') return next.trim() || null;
  return next;
}
