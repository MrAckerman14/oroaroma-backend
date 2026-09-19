import type { Prisma } from '@prisma/client';
import { ValidationAppError } from '../../shared/errors/AppError.js';

export class InventoryStockService {
  async resolvePoolId(tx: Prisma.TransactionClient, tenantId: string, branchId: string, productId: string) {
    const override = await tx.branchInventoryProductOverride.findFirst({
      where: { tenantId, branchId, productId },
      select: { poolId: true }
    });
    if (override) return override.poolId;

    const branch = await tx.branch.findFirst({
      where: { id: branchId, tenantId, status: 'ACTIVE' },
      select: { defaultInventoryPoolId: true }
    });
    if (!branch) throw new ValidationAppError('La sucursal seleccionada no está disponible');
    if (!branch.defaultInventoryPoolId) throw new ValidationAppError('La sucursal no tiene inventario configurado');
    return branch.defaultInventoryPoolId;
  }

  async decrement(
    tx: Prisma.TransactionClient,
    input: { tenantId: string; branchId: string; productId: string; quantity: number; productName: string }
  ) {
    const poolId = await this.resolvePoolId(tx, input.tenantId, input.branchId, input.productId);
    const updated = await tx.inventoryPoolStock.updateMany({
      where: { tenantId: input.tenantId, poolId, productId: input.productId, stock: { gte: input.quantity } },
      data: { stock: { decrement: input.quantity } }
    });
    if (updated.count !== 1) throw new ValidationAppError(`Stock insuficiente para ${input.productName}`);
    return poolId;
  }

  async decrementFromPool(
    tx: Prisma.TransactionClient,
    input: { tenantId: string; poolId: string; productId: string; quantity: number; productName: string }
  ) {
    const updated = await tx.inventoryPoolStock.updateMany({
      where: { tenantId: input.tenantId, poolId: input.poolId, productId: input.productId, stock: { gte: input.quantity } },
      data: { stock: { decrement: input.quantity } }
    });
    if (updated.count !== 1) throw new ValidationAppError(`Stock insuficiente para ${input.productName}`);
  }

  async increment(
    tx: Prisma.TransactionClient,
    input: { tenantId: string; poolId: string; productId: string; quantity: number }
  ) {
    await tx.inventoryPoolStock.upsert({
      where: { poolId_productId: { poolId: input.poolId, productId: input.productId } },
      update: { stock: { increment: input.quantity } },
      create: { tenantId: input.tenantId, poolId: input.poolId, productId: input.productId, stock: input.quantity }
    });
  }
}
