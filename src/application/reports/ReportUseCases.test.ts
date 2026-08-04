import { Prisma, type PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import type { AuthenticatedUser } from '../../types/rbac.js';
import { ReportUseCases } from './ReportUseCases.js';

const admin: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@oroaroma.local',
  name: 'Admin',
  status: 'ACTIVE',
  statusLabel: 'Activo',
  roles: [{ roleKey: 'admin', scope: 'global' }],
  permissions: []
};

const employeeActor: AuthenticatedUser = {
  id: 'employee-1',
  email: 'employee@oroaroma.local',
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
  roles: [{ roleKey: 'supervisor', scope: 'own' }],
  permissions: [
    ...employeeActor.permissions,
    {
      key: 'reports:cash-detail-employees:own',
      resource: 'reports',
      action: 'cash-detail-employees',
      scope: 'own'
    }
  ]
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

    const messenger = { id: 'messenger-1', name: 'Alex', email: 'alex@oroaroma.local' };
    const employee = { id: 'employee-1', name: 'Bradley', email: 'bradley@oroaroma.local' };
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

    const messenger = { id: 'messenger-1', name: 'Alex', email: 'alex@oroaroma.local' };
    const employee = { id: 'employee-1', name: 'Bradley', email: 'bradley@oroaroma.local' };
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

  it('permite al supervisor ver detalle por colaborador', async () => {
    const reports = new ReportUseCases({} as PrismaClient);
    const cashSummary = (reports as unknown as {
      cashSummary: (actor: AuthenticatedUser, sales: unknown[]) => Promise<{
        detailEmployee: unknown[];
        detailSeller: unknown[];
      }>;
    }).cashSummary.bind(reports);

    const messenger = { id: 'messenger-1', name: 'Alex', email: 'alex@oroaroma.local' };
    const employee = { id: 'employee-1', name: 'Bradley', email: 'bradley@oroaroma.local' };

    const summary = await cashSummary(supervisorActor, [
      sale({ status: 'FINALIZED', deliveryPay: '300', messenger, employee })
    ]);

    expect(summary.detailEmployee).toHaveLength(1);
    expect(summary.detailSeller).toHaveLength(0);
  });

  it('mantiene oculto detalle por colaborador para empleado normal', async () => {
    const reports = new ReportUseCases({} as PrismaClient);
    const cashSummary = (reports as unknown as {
      cashSummary: (actor: AuthenticatedUser, sales: unknown[]) => Promise<{
        detailEmployee: unknown[];
      }>;
    }).cashSummary.bind(reports);

    const messenger = { id: 'messenger-1', name: 'Alex', email: 'alex@oroaroma.local' };
    const employee = { id: 'employee-1', name: 'Bradley', email: 'bradley@oroaroma.local' };

    const summary = await cashSummary(employeeActor, [
      sale({ status: 'FINALIZED', deliveryPay: '300', messenger, employee })
    ]);

    expect(summary.detailEmployee).toHaveLength(0);
  });
});

function sale(input: {
  status: 'FINALIZED' | 'CANCELLED' | 'DELIVERY_PENDING';
  deliveryPay: string;
  amount?: string;
  amountCash?: string;
  amountTransfer?: string;
  messenger: { id: string; name: string; email: string };
  employee: { id: string; name: string; email: string };
}) {
  return {
    employeeId: input.employee.id,
    messengerId: input.messenger.id,
    sellerId: null,
    status: input.status,
    amount: new Prisma.Decimal(input.amount ?? '1200'),
    amountCash: new Prisma.Decimal(input.amountCash ?? '1200'),
    amountTransfer: new Prisma.Decimal(input.amountTransfer ?? '0'),
    deliveryPay: new Prisma.Decimal(input.deliveryPay),
    perfumeCount: 1,
    employee: input.employee,
    messenger: input.messenger,
    seller: null,
    details: [{ quantity: 1, unitPrice: new Prisma.Decimal('1200') }]
  };
}
