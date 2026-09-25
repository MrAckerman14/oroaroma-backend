import type { PrismaClient, WarehouseStatus } from '@prisma/client';
import { ConflictError, ForbiddenError, NotFoundError, ValidationAppError } from '../../shared/errors/AppError.js';
import type { AuthenticatedUser } from '../../types/rbac.js';

interface TransferInput {
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  reference?: string | undefined;
  note?: string | undefined;
  items: Array<{ productId: string; quantity: number }>;
}

export class WarehouseUseCases {
  constructor(private readonly prisma: PrismaClient) {}

  list(actor: AuthenticatedUser, branchId: string) {
    this.assertBranchAccess(actor, branchId, 'read');
    return this.prisma.warehouse.findMany({
      where: { tenantId: actor.tenantId, branchId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: {
        _count: { select: { outgoingTransfers: true, incomingTransfers: true } },
        inventoryPool: { select: { stocks: { select: { stock: true } } } }
      }
    }).then((warehouses) => warehouses.map(({ inventoryPool, ...warehouse }) => ({
      ...warehouse,
      productCount: inventoryPool.stocks.length,
      totalUnits: inventoryPool.stocks.reduce((total, item) => total + item.stock, 0)
    })));
  }

  async create(actor: AuthenticatedUser, branchId: string, input: { name: string; code: string }) {
    this.assertGlobal(actor, 'create');
    await this.requireBranch(actor.tenantId, branchId);
    const normalizedName = this.normalize(input.name);
    const code = input.code.trim().toUpperCase();
    const duplicate = await this.prisma.warehouse.findFirst({ where: { branchId, OR: [{ normalizedName }, { code }] }, select: { id: true } });
    if (duplicate) throw new ConflictError('Ya existe un almacén con ese nombre o código en la sucursal');
    return this.prisma.$transaction(async (tx) => {
      const id = crypto.randomUUID();
      const pool = await tx.inventoryPool.create({
        data: { tenantId: actor.tenantId, name: `Almacén ${input.name.trim()}`, normalizedName: `warehouse-${id}` }
      });
      return tx.warehouse.create({
        data: { id, tenantId: actor.tenantId, branchId, inventoryPoolId: pool.id, name: input.name.trim(), normalizedName, code }
      });
    });
  }

  async update(actor: AuthenticatedUser, branchId: string, id: string, input: { name?: string | undefined; code?: string | undefined; status?: WarehouseStatus | undefined }) {
    this.assertGlobal(actor, 'update');
    const warehouse = await this.find(actor.tenantId, id);
    if (warehouse.branchId !== branchId) throw new NotFoundError('Almacén no encontrado');
    if (warehouse.isDefault && input.status === 'INACTIVE') throw new ValidationAppError('El almacén principal no se puede desactivar');
    const normalizedName = input.name ? this.normalize(input.name) : undefined;
    const code = input.code?.trim().toUpperCase();
    if (normalizedName || code) {
      const duplicate = await this.prisma.warehouse.findFirst({
        where: { branchId, id: { not: id }, OR: [...(normalizedName ? [{ normalizedName }] : []), ...(code ? [{ code }] : [])] }, select: { id: true }
      });
      if (duplicate) throw new ConflictError('Ya existe un almacén con ese nombre o código en la sucursal');
    }
    return this.prisma.warehouse.update({
      where: { id },
      data: { ...(input.name && normalizedName ? { name: input.name.trim(), normalizedName } : {}), ...(code ? { code } : {}), ...(input.status ? { status: input.status } : {}) }
    });
  }

  async transfer(actor: AuthenticatedUser, branchId: string, input: TransferInput) {
    this.assertBranchAccess(actor, branchId, 'transfer');
    const hasGlobal = this.hasPermission(actor, 'warehouses:transfer:global');
    return this.prisma.$transaction(async (tx) => {
      const warehouses = await tx.warehouse.findMany({
        where: { tenantId: actor.tenantId, id: { in: [input.sourceWarehouseId, input.destinationWarehouseId] }, status: 'ACTIVE' }
      });
      if (warehouses.length !== 2) throw new ValidationAppError('El almacén origen o destino no está disponible');
      const source = warehouses.find((warehouse) => warehouse.id === input.sourceWarehouseId)!;
      const destination = warehouses.find((warehouse) => warehouse.id === input.destinationWarehouseId)!;
      if (source.branchId !== branchId) throw new ValidationAppError('El almacén origen no pertenece a la sucursal activa');
      if (!hasGlobal && destination.branchId !== branchId) throw new ValidationAppError('No tienes permiso para transferir inventario a otra sucursal');

      const productIds = input.items.map((item) => item.productId);
      const products = await tx.store.findMany({ where: { tenantId: actor.tenantId, id: { in: productIds }, deletedAt: null }, select: { id: true, name: true } });
      if (products.length !== productIds.length) throw new ValidationAppError('Uno de los productos no pertenece a esta empresa o está eliminado');
      const names = new Map(products.map((product) => [product.id, product.name]));

      for (const item of input.items) {
        const result = await tx.inventoryPoolStock.updateMany({
          where: { tenantId: actor.tenantId, poolId: source.inventoryPoolId, productId: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } }
        });
        if (result.count !== 1) throw new ValidationAppError(`Stock insuficiente para ${names.get(item.productId)}`);
        await tx.$executeRaw`
          INSERT INTO public."InventoryPoolStock" ("id", "tenantId", "poolId", "productId", "stock", "createdAt", "updatedAt")
          VALUES (${crypto.randomUUID()}, ${actor.tenantId}, ${destination.inventoryPoolId}, ${item.productId}, ${item.quantity}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT ("poolId", "productId") DO UPDATE SET "stock" = public."InventoryPoolStock"."stock" + EXCLUDED."stock", "updatedAt" = CURRENT_TIMESTAMP
        `;
      }

      return tx.inventoryTransfer.create({
        data: {
          tenantId: actor.tenantId,
          branchId,
          sourceWarehouseId: source.id,
          destinationWarehouseId: destination.id,
          createdById: actor.id,
          reference: input.reference?.trim() || null,
          note: input.note?.trim() || null,
          items: { create: input.items }
        },
        include: { sourceWarehouse: true, destinationWarehouse: true, items: { include: { product: { select: { id: true, name: true } } } } }
      });
    });
  }

  listTransfers(actor: AuthenticatedUser, branchId: string) {
    this.assertBranchAccess(actor, branchId, 'read');
    return this.prisma.inventoryTransfer.findMany({
      where: { tenantId: actor.tenantId, OR: [{ sourceWarehouse: { branchId } }, { destinationWarehouse: { branchId } }] },
      orderBy: { createdAt: 'desc' }, take: 100,
      include: {
        sourceWarehouse: { select: { id: true, name: true, code: true, branchId: true } },
        destinationWarehouse: { select: { id: true, name: true, code: true, branchId: true } },
        createdBy: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, name: true } } } }
      }
    });
  }

  private async requireBranch(tenantId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId, status: 'ACTIVE' }, select: { id: true } });
    if (!branch) throw new NotFoundError('Sucursal no encontrada');
  }

  private async find(tenantId: string, id: string) {
    const warehouse = await this.prisma.warehouse.findFirst({ where: { id, tenantId } });
    if (!warehouse) throw new NotFoundError('Almacén no encontrado');
    return warehouse;
  }

  private assertGlobal(actor: AuthenticatedUser, action: 'create' | 'update') {
    if (!this.hasPermission(actor, `warehouses:${action}:global`)) throw new ForbiddenError('No tienes permiso global para gestionar almacenes');
  }

  private assertBranchAccess(actor: AuthenticatedUser, branchId: string, action: 'read' | 'transfer') {
    if (this.hasPermission(actor, `warehouses:${action}:global`)) return;
    const assigned = this.hasPermission(actor, `warehouses:${action}:assigned`) && actor.branches?.some((branch) => branch.id === branchId);
    if (!assigned) throw new ForbiddenError('No tienes acceso a los almacenes de esta sucursal');
  }

  private hasPermission(actor: AuthenticatedUser, key: string) { return actor.permissions.some((permission) => permission.key === key); }
  private normalize(value: string) { return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
}
