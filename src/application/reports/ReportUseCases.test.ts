import { Prisma, type PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../types/rbac.js';
import { ReportUseCases } from './ReportUseCases.js';

const admin: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@zoko-hola.local',
  name: 'Admin',
  status: 'ACTIVE',
  statusLabel: 'Activo',
  roles: [{ roleKey: 'admin', scope: 'global' }],
  permissions: []
};

const adminWithDetails: AuthenticatedUser = {
  ...admin,
  permissions: [
    {
      key: 'reports:cash-detail-sellers:global',
      resource: 'reports',
      action: 'cash-detail-sellers',
      scope: 'global'
    },
    {
      key: 'reports:cash-detail-employees:global',
      resource: 'reports',
      action: 'cash-detail-employees',
      scope: 'global'
    }
  ]
};

const employeeActor: AuthenticatedUser = {
  id: 'employee-1',
  email: 'employee@zoko-hola.local',
  name: 'Empleado',
  status: 'ACTIVE',
  statusLabel: 'Activo',
  roles: [{ roleKey: 'employee', scope: 'own' }],
  permissions: [
    {
      key: 'reports:cash-detail-messengers:own',
      resource: 'reports',
      action: 'cash-detail-messengers',
      scope: 'own'
    }
  ]
};

const supervisorActor: AuthenticatedUser = {
  ...employeeActor,
  roles: [{ roleKey: 'supervisor', scope: 'own' }]
};

describe('ReportUseCases', () => {
  it('suma el dinero ganado por mensajero con ventas finalizadas y canceladas', async () => {
    const reports = new ReportUseCases({} as PrismaClient);
    const cashSummary = (reports as unknown as {
      cashSummary: (actor: AuthenticatedUser, sales: unknown[]) => Promise<{
        detailMessenger: Array<{
          finalizedDeliveries: number;
          completedDeliveryPay: Prisma.Decimal;
          earnedMoney: Prisma.Decimal;
          messengerEarnings: Prisma.Decimal;
          totalEarned: Prisma.Decimal;
          pendingDeliveryPay: Prisma.Decimal;
        }>;
      }>;
    }).cashSummary.bind(reports);

    const messenger = { id: 'messenger-1', name: 'Alex', email: 'alex@zoko-hola.local' };
    const employee = { id: 'employee-1', name: 'Bradley', email: 'bradley@zoko-hola.local' };
    const sales = [
      sale({ status: 'FINALIZED', deliveryPay: '300', messenger, employee }),
      sale({ status: 'CANCELLED', deliveryPay: '200', messenger, employee }),
      sale({ status: 'DELIVERY_PENDING', deliveryPay: '100', messenger, employee })
    ];

    const summary = await cashSummary(admin, sales);
    const [row] = summary.detailMessenger;

    expect(row?.finalizedDeliveries).toBe(2);
    expect(row?.completedDeliveryPay.toString()).toBe('500');
    expect(row?.earnedMoney.toString()).toBe('500');
    expect(row?.messengerEarnings.toString()).toBe('500');
    expect(row?.totalEarned.toString()).toBe('500');
    expect(row?.pendingDeliveryPay.toString()).toBe('100');
  });

  it('calcula el efectivo pendiente solo con ventas pendientes', async () => {
    const reports = new ReportUseCases({} as PrismaClient);
    const cashSummary = (reports as unknown as {
      cashSummary: (actor: AuthenticatedUser, sales: unknown[]) => Promise<{
        pendingCash: Prisma.Decimal;
        pendingCashTotal: Prisma.Decimal;
        totalPendingCash: Prisma.Decimal;
        pendingCashAmount: Prisma.Decimal;
      }>;
    }).cashSummary.bind(reports);

    const messenger = { id: 'messenger-1', name: 'Alex', email: 'alex@zoko-hola.local' };
    const employee = { id: 'employee-1', name: 'Bradley', email: 'bradley@zoko-hola.local' };
    const sales = [
      sale({ status: 'FINALIZED', amountCash: '800', deliveryPay: '300', messenger, employee }),
      sale({ status: 'DELIVERY_PENDING', amount: '1200', amountCash: '250', deliveryPay: '100', messenger, employee }),
      sale({ status: 'DELIVERY_PENDING', amount: '1200', amountCash: '0', amountTransfer: '1200', deliveryPay: '100', messenger, employee })
    ];

    const summary = await cashSummary(admin, sales);

    expect(summary.pendingCash.toString()).toBe('250');
    expect(summary.pendingCashTotal.toString()).toBe('250');
    expect(summary.totalPendingCash.toString()).toBe('250');
    expect(summary.pendingCashAmount.toString()).toBe('250');
  });

  it('permite al supervisor ver solo detalle por mensajero en el cuadre', async () => {
    const reports = new ReportUseCases({} as PrismaClient);
    const cashSummary = (reports as unknown as {
      cashSummary: (actor: AuthenticatedUser, sales: unknown[]) => Promise<{
        detailMessenger: unknown[];
        detailEmployee: unknown[];
        detailSeller: unknown[];
      }>;
    }).cashSummary.bind(reports);

    const messenger = { id: 'messenger-1', name: 'Alex', email: 'alex@zoko-hola.local' };
    const employee = { id: 'employee-1', name: 'Bradley', email: 'bradley@zoko-hola.local' };
    const seller = { id: 'seller-1', name: 'Payano', email: 'payano@zoko-hola.local' };

    const summary = await cashSummary(supervisorActor, [
      sale({ status: 'FINALIZED', deliveryPay: '300', messenger, employee, seller })
    ]);

    expect(summary.detailMessenger).toHaveLength(1);
    expect(summary.detailEmployee).toHaveLength(0);
    expect(summary.detailSeller).toHaveLength(0);
  });

  it('mantiene el preview de cuadre de caja limitado para supervisor', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const reports = new ReportUseCases({
      sale: { findMany }
    } as unknown as PrismaClient);

    await reports.cashReconciliation(supervisorActor, {
      from: '2026-06-01',
      to: '2026-06-02'
    });

    const call = findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(call.where.status).toEqual({ in: ['FINALIZED', 'CANCELLED', 'DELIVERY_PENDING'] });
    expect(call.where.deletedAt).toBeNull();
    expect(call.where.OR).toEqual([
      { employeeId: supervisorActor.id },
      { sellerId: supervisorActor.id },
      { messengerId: supervisorActor.id }
    ]);
  });

  it('mantiene el preview de cuadre de caja limitado para empleado normal', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const reports = new ReportUseCases({
      sale: { findMany }
    } as unknown as PrismaClient);

    await reports.cashReconciliation(employeeActor, {
      from: '2026-06-01',
      to: '2026-06-02'
    });

    const call = findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(call.where.OR).toEqual([
      { employeeId: employeeActor.id },
      { sellerId: employeeActor.id },
      { messengerId: employeeActor.id }
    ]);
  });

  it('mantiene oculto detalle por colaborador para empleado normal', async () => {
    const reports = new ReportUseCases({} as PrismaClient);
    const cashSummary = (reports as unknown as {
      cashSummary: (actor: AuthenticatedUser, sales: unknown[]) => Promise<{
        detailEmployee: unknown[];
      }>;
    }).cashSummary.bind(reports);

    const messenger = { id: 'messenger-1', name: 'Alex', email: 'alex@zoko-hola.local' };
    const employee = { id: 'employee-1', name: 'Bradley', email: 'bradley@zoko-hola.local' };

    const summary = await cashSummary(employeeActor, [
      sale({ status: 'FINALIZED', deliveryPay: '300', messenger, employee })
    ]);

    expect(summary.detailEmployee).toHaveLength(0);
  });

  it('calcula ventas internas con el total vendido e ingreso por perfume con precio de venta', async () => {
    const reports = new ReportUseCases({} as PrismaClient);
    const cashSummary = (reports as unknown as {
      cashSummary: (actor: AuthenticatedUser, sales: unknown[]) => Promise<{
        detailEmployee: Array<{
          internalSale: Prisma.Decimal;
          internalSales: Prisma.Decimal;
          total: Prisma.Decimal;
          totalSold: Prisma.Decimal;
          quantity: number;
          shippingCost: Prisma.Decimal;
          net: Prisma.Decimal;
        }>;
      }>;
    }).cashSummary.bind(reports);

    const messenger = { id: 'messenger-1', name: 'Alex', email: 'alex@zoko-hola.local' };
    const employee = { id: 'employee-1', name: 'Bradley', email: 'bradley@zoko-hola.local' };
    const seller = { id: 'seller-1', name: 'Payano', email: 'payano@zoko-hola.local' };

    const summary = await cashSummary(adminWithDetails, [
      sale({
        status: 'FINALIZED',
        amount: '1555',
        amountCash: '1555',
        deliveryPay: '200',
        perfumeCount: 1,
        unitPrice: '175',
        quantity: 1,
        messenger,
        employee
      }),
      sale({
        status: 'FINALIZED',
        amount: '2400',
        amountCash: '0',
        amountTransfer: '2400',
        deliveryPay: '300',
        perfumeCount: 2,
        unitPrice: '495',
        quantity: 2,
        messenger,
        employee,
        seller
      })
    ]);

    const [row] = summary.detailEmployee;

    expect(row?.internalSale.toString()).toBe('1555');
    expect(row?.internalSales.toString()).toBe('1555');
    expect(row?.total.toString()).toBe('2545');
    expect(row?.totalSold.toString()).toBe('2545');
    expect(row?.quantity).toBe(3);
    expect(row?.shippingCost.toString()).toBe('500');
    expect(row?.net.toString()).toBe('1055');
  });

  it('en detalle por colaborador suma envio cancelado sin sumar venta ni perfume cancelado', async () => {
    const reports = new ReportUseCases({} as PrismaClient);
    const cashSummary = (reports as unknown as {
      cashSummary: (actor: AuthenticatedUser, sales: unknown[]) => Promise<{
        detailSeller: Array<{
          totalSold: Prisma.Decimal;
          shippingCost: Prisma.Decimal;
          perfumeCost: Prisma.Decimal;
          amountToPay: Prisma.Decimal;
          quantity: number;
          finalizedDeliveries: number;
        }>;
      }>;
    }).cashSummary.bind(reports);

    const messenger = { id: 'messenger-1', name: 'Alex', email: 'alex@zoko-hola.local' };
    const employee = { id: 'employee-1', name: 'Bradley', email: 'bradley@zoko-hola.local' };
    const seller = { id: 'seller-1', name: 'Payano', email: 'payano@zoko-hola.local' };

    const summary = await cashSummary(adminWithDetails, [
      sale({
        status: 'FINALIZED',
        amount: '4800',
        deliveryPay: '700',
        perfumeCount: 4,
        unitPrice: '650',
        quantity: 4,
        messenger,
        employee,
        seller
      }),
      sale({
        status: 'CANCELLED',
        amount: '1200',
        deliveryPay: '300',
        perfumeCount: 1,
        unitPrice: '650',
        quantity: 1,
        messenger,
        employee,
        seller
      })
    ]);

    const [row] = summary.detailSeller;

    expect(row?.totalSold.toString()).toBe('4800');
    expect(row?.shippingCost.toString()).toBe('1000');
    expect(row?.perfumeCost.toString()).toBe('2600');
    expect(row?.amountToPay.toString()).toBe('1200');
    expect(row?.quantity).toBe(4);
    expect(row?.finalizedDeliveries).toBe(1);
  });

  it('solo lista mensajeros que interactuaron con ventas del resumen cargado', async () => {
    const reports = new ReportUseCases({} as PrismaClient);
    const cashSummary = (reports as unknown as {
      cashSummary: (actor: AuthenticatedUser, sales: unknown[]) => Promise<{
        detailMessenger: Array<{ messenger: { name: string }; finalizedDeliveries: number }>;
      }>;
    }).cashSummary.bind(reports);

    const employee = { id: 'employee-1', name: 'Bradley', email: 'bradley@zoko-hola.local' };

    const summary = await cashSummary(admin, [
      sale({
        status: 'FINALIZED',
        deliveryPay: '300',
        messenger: { id: 'messenger-1', name: 'Alex', email: 'alex@zoko-hola.local' },
        employee
      }),
      sale({
        status: 'DELIVERY_PENDING',
        deliveryPay: '100',
        messenger: { id: 'messenger-2', name: 'Deiri', email: 'deiri@zoko-hola.local' },
        employee
      })
    ]);

    expect(summary.detailMessenger.map((row) => row.messenger.name)).toEqual(['Alex', 'Deiri']);
    expect(summary.detailMessenger.map((row) => row.finalizedDeliveries)).toEqual([1, 0]);
  });
});

function sale(input: {
  status: 'FINALIZED' | 'CANCELLED' | 'DELIVERY_PENDING';
  deliveryPay: string;
  amount?: string;
  amountCash?: string;
  amountTransfer?: string;
  perfumeCount?: number;
  unitPrice?: string;
  quantity?: number;
  messenger: { id: string; name: string; email: string };
  employee: { id: string; name: string; email: string };
  seller?: { id: string; name: string; email: string } | null;
}) {
  return {
    employeeId: input.employee.id,
    messengerId: input.messenger.id,
    sellerId: input.seller?.id ?? null,
    status: input.status,
    amount: new Prisma.Decimal(input.amount ?? '1200'),
    amountCash: new Prisma.Decimal(input.amountCash ?? '1200'),
    amountTransfer: new Prisma.Decimal(input.amountTransfer ?? '0'),
    deliveryPay: new Prisma.Decimal(input.deliveryPay),
    perfumeCount: input.perfumeCount ?? input.quantity ?? 1,
    employee: input.employee,
    messenger: input.messenger,
    seller: input.seller ?? null,
    details: [{
      quantity: input.quantity ?? 1,
      unitPrice: new Prisma.Decimal(input.unitPrice ?? '1200')
    }]
  };
}
