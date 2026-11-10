import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ElectronicInvoicingUseCases } from '../../application/invoicing/ElectronicInvoicingUseCases.js';
import type { AuthenticatedUser } from '../../types/rbac.js';
import { AlanubeProvider } from '../invoicing/AlanubeProvider.js';
import { SimulatedProvider } from '../invoicing/SimulatedProvider.js';

const describeDb = process.env.RUN_DB_TESTS === 'true' ? describe : describe.skip;
const prisma = new PrismaClient();
const suffix = randomUUID();
const tenantA = `invoice-a-${suffix}`;
const tenantB = `invoice-b-${suffix}`;
let actorA: AuthenticatedUser;
let branchA: { id: string };
let productA: { id: string };
let poolA: { id: string };

const invoicing = new ElectronicInvoicingUseCases(prisma, {
  providers: { SIMULATED: new SimulatedProvider(), ALANUBE: new AlanubeProvider(undefined) },
  secretKey: Buffer.alloc(32, 7),
  platformCredentials: { SIMULATED: true, ALANUBE: false }
});

async function finalizedSale(amount: number, quantity = 2, unitPrice = 590) {
  return prisma.sale.create({
    data: {
      tenantId: tenantA,
      branchId: branchA.id,
      employeeId: actorA.id,
      amount,
      amountCash: amount,
      paymentMethod: 'CASH',
      perfumeCount: quantity,
      status: 'FINALIZED',
      finalizedAt: new Date(),
      details: { create: [{ tenantId: tenantA, storeId: productA.id, inventoryPoolId: poolA.id, quantity, unitPrice, purchaseUnitPrice: 300 }] }
    }
  });
}

describeDb('facturación electrónica por empresa', () => {
  beforeAll(async () => {
    await prisma.tenant.createMany({ data: [
      { id: tenantA, slug: tenantA, name: 'Invoice tenant A' },
      { id: tenantB, slug: tenantB, name: 'Invoice tenant B' }
    ] });
    const user = await prisma.user.create({ data: { tenantId: tenantA, name: 'Admin A', email: `${tenantA}@test.local`, passwordHash: 'not-used' } });
    actorA = {
      id: user.id, tenantId: tenantA, email: user.email, name: user.name, status: 'ACTIVE', statusLabel: 'Activo',
      roles: [], permissions: [], enabledModules: ['e-invoicing']
    };
    poolA = await prisma.inventoryPool.create({ data: { tenantId: tenantA, name: 'A', normalizedName: 'a' } });
    branchA = await prisma.branch.create({ data: { tenantId: tenantA, name: 'Principal', normalizedName: 'principal', code: 'PRINCIPAL', isPrimary: true, defaultInventoryPoolId: poolA.id } });
    await prisma.branchMembership.create({ data: { tenantId: tenantA, branchId: branchA.id, userId: user.id, isPrimary: true } });
    productA = await prisma.store.create({ data: { tenantId: tenantA, name: 'Perfume de prueba', purchasePrice: 300, salePrice: 590, stock: 100 } });
  });

  afterAll(async () => {
    const tenants = { in: [tenantA, tenantB] };
    await prisma.fiscalDocument.deleteMany({ where: { tenantId: tenants, referencedDocumentId: { not: null } } });
    await prisma.fiscalDocument.deleteMany({ where: { tenantId: tenants } });
    await prisma.fiscalSequence.deleteMany({ where: { tenantId: tenants } });
    await prisma.tenantFiscalProfile.deleteMany({ where: { tenantId: tenants } });
    await prisma.saleDetail.deleteMany({ where: { tenantId: tenants } });
    await prisma.sale.deleteMany({ where: { tenantId: tenants } });
    await prisma.store.deleteMany({ where: { tenantId: tenants } });
    await prisma.branchMembership.deleteMany({ where: { tenantId: tenants } });
    await prisma.branch.deleteMany({ where: { tenantId: tenants } });
    await prisma.inventoryPool.deleteMany({ where: { tenantId: tenants } });
    await prisma.user.deleteMany({ where: { tenantId: tenants } });
    await prisma.tenant.deleteMany({ where: { id: tenants } });
    await prisma.$disconnect();
  });

  it('no factura mientras la empresa no active el módulo fiscal', async () => {
    const sale = await finalizedSale(1180);
    await expect(invoicing.issueForSale(actorA, branchA.id, sale.id)).rejects.toThrow('no está activada');
  });

  it('valida los datos fiscales y nunca devuelve la credencial', async () => {
    await expect(invoicing.saveProfile(actorA, { rnc: '12', legalName: 'X', address: 'Y' })).rejects.toThrow('RNC');
    await expect(invoicing.saveProfile(actorA, { rnc: '131123456', legalName: 'Oro Aroma SRL', address: 'Santo Domingo', provider: 'SIMULATED', environment: 'PRODUCTION' }))
      .rejects.toThrow('modo de prueba');
    const profile = await invoicing.saveProfile(actorA, {
      enabled: true, rnc: '1-31-12345-6', legalName: 'Oro Aroma SRL', address: 'Santo Domingo', providerToken: 'secreto'
    });
    expect(profile).toMatchObject({ rnc: '131123456', provider: 'SIMULATED', environment: 'TEST', hasProviderToken: true });
    expect(JSON.stringify(profile)).not.toContain('secreto');
    expect(profile).not.toHaveProperty('providerTokenEncrypted');
  });

  it('pide secuencias autorizadas antes de facturar', async () => {
    const sale = await finalizedSale(1180);
    await expect(invoicing.issueForSale(actorA, branchA.id, sale.id)).rejects.toThrow('Registra una secuencia');
    await invoicing.addSequence(actorA, { documentType: 'E32', startNumber: 1, endNumber: 50, expiresAt: '2099-12-31' });
    await invoicing.addSequence(actorA, { documentType: 'E31', startNumber: 1, endNumber: 50, expiresAt: '2099-12-31' });
    await invoicing.addSequence(actorA, { documentType: 'E34', startNumber: 1, endNumber: 50, expiresAt: '2099-12-31' });
    await expect(invoicing.addSequence(actorA, { documentType: 'E32', startNumber: 40, endNumber: 60, expiresAt: '2099-12-31' }))
      .rejects.toThrow('se cruza');
  });

  it('emite factura de consumo con ITBIS incluido y evita duplicarla', async () => {
    const sale = await finalizedSale(1180);
    const invoice = await invoicing.issueForSale(actorA, branchA.id, sale.id);
    expect(invoice).toMatchObject({ documentType: 'E32', status: 'ACCEPTED', totalAmount: 1180, taxedAmount: 1000, itbisAmount: 180 });
    expect(invoice.encf).toMatch(/^E320000000\d{3}$/);
    await expect(invoicing.issueForSale(actorA, branchA.id, sale.id)).rejects.toThrow('ya tiene la factura');
  });

  it('emite crédito fiscal cuando el cliente da su RNC', async () => {
    const sale = await finalizedSale(2360, 4);
    await expect(invoicing.issueForSale(actorA, branchA.id, sale.id, { documentType: 'E31' })).rejects.toThrow('RNC');
    const invoice = await invoicing.issueForSale(actorA, branchA.id, sale.id, { buyer: { rnc: '101010101', name: 'Cliente SRL' } });
    expect(invoice).toMatchObject({ documentType: 'E31', encf: 'E310000000001', buyerRnc: '101010101' });
  });

  it('asigna números distintos a facturas simultáneas', async () => {
    const sales = await Promise.all([1, 2, 3, 4, 5].map(() => finalizedSale(590, 1)));
    const invoices = await Promise.all(sales.map((sale) => invoicing.issueForSale(actorA, branchA.id, sale.id)));
    expect(new Set(invoices.map((invoice) => invoice.encf)).size).toBe(5);
  });

  it('emite notas de crédito parciales sin pasarse del total facturado', async () => {
    const sale = await finalizedSale(1180);
    const invoice = await invoicing.issueForSale(actorA, branchA.id, sale.id);
    const partial = await invoicing.issueCreditNote(actorA, branchA.id, invoice.id, { reason: 'Devolución de un perfume', amount: 590 });
    expect(partial).toMatchObject({ documentType: 'E34', status: 'ACCEPTED', totalAmount: 590, modificationCode: 3, referencedDocumentId: invoice.id });
    await expect(invoicing.issueCreditNote(actorA, branchA.id, invoice.id, { reason: 'Otra', amount: 600 })).rejects.toThrow('disponible');
    const rest = await invoicing.issueCreditNote(actorA, branchA.id, invoice.id, { reason: 'Devolución del resto' });
    expect(rest.totalAmount).toBe(590);
    await expect(invoicing.issueCreditNote(actorA, branchA.id, invoice.id, { reason: 'Otra vez' })).rejects.toThrow('anulada por completo');
    const detail = await invoicing.detail(actorA, branchA.id, invoice.id);
    expect(detail.creditNotes).toHaveLength(2);
  });

  it('factura sola al finalizar cuando la empresa lo activa', async () => {
    const sale = await finalizedSale(590, 1);
    expect(await invoicing.autoIssueAfterFinalize(actorA, branchA.id, sale.id)).toBeNull();
    await invoicing.saveProfile(actorA, { autoIssueOnFinalize: true });
    const auto = await invoicing.autoIssueAfterFinalize(actorA, branchA.id, sale.id);
    expect(auto).toMatchObject({ documentType: 'E32', status: 'ACCEPTED' });
  });

  it('impide enlazar comprobantes con ventas de otra empresa', async () => {
    const sale = await finalizedSale(590, 1);
    await expect(prisma.fiscalDocument.create({
      data: {
        tenantId: tenantB, saleId: sale.id, documentType: 'E32', encf: 'E329999999999', provider: 'SIMULATED', environment: 'TEST',
        stampDate: new Date(), taxedAmount: 1, itbisAmount: 0, totalAmount: 1, payload: {}, issuedById: actorA.id
      }
    })).rejects.toThrow(/tenant boundary/i);
  });

  it('tiene políticas RLS en las tablas fiscales', async () => {
    const policies = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_policies
      WHERE schemaname = 'public' AND tablename IN ('TenantFiscalProfile', 'FiscalSequence', 'FiscalDocument')
      ORDER BY tablename
    `;
    expect(policies.map((row) => row.tablename)).toEqual(['FiscalDocument', 'FiscalSequence', 'TenantFiscalProfile']);
  });
});
