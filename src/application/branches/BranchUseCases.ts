import type { BranchStatus, PrismaClient } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationAppError } from '../../shared/errors/AppError.js';
import type { AuthenticatedUser } from '../../types/rbac.js';

export class BranchUseCases {
  constructor(private readonly prisma: PrismaClient) {}

  list(actor: AuthenticatedUser) {
    const canReadAll = actor.permissions.some((permission) => permission.key === 'branches:read:global');
    return this.prisma.branch.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(canReadAll ? {} : { memberships: { some: { userId: actor.id } } })
      },
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
      include: {
        memberships: {
          include: { user: { select: { id: true, name: true, email: true, status: true, roleAssignments: { include: { role: { select: { key: true, name: true } } } } } } },
          orderBy: [{ isPrimary: 'desc' }, { user: { name: 'asc' } }]
        },
        _count: { select: { memberships: true } }
      }
    });
  }

  async create(actor: AuthenticatedUser, input: { name: string; code: string; address?: string | undefined; phone?: string | undefined }) {
    const normalizedName = this.normalize(input.name);
    const code = input.code.trim().toUpperCase();
    const duplicate = await this.prisma.branch.findFirst({ where: { tenantId: actor.tenantId, OR: [{ normalizedName }, { code }] } });
    if (duplicate) throw new ConflictError('Ya existe una sucursal con ese nombre o código');
    return this.prisma.$transaction(async (tx) => {
      const branchId = crypto.randomUUID();
      const pool = await tx.inventoryPool.create({
        data: { tenantId: actor.tenantId, name: `Inventario ${input.name.trim()}`, normalizedName: `branch-${branchId}` }
      });
      const branch = await tx.branch.create({ data: { id: branchId, tenantId: actor.tenantId, name: input.name.trim(), normalizedName, code, address: input.address?.trim() || null, phone: input.phone?.trim() || null, defaultInventoryPoolId: pool.id } });
      await tx.branchMembership.upsert({
        where: { branchId_userId: { branchId: branch.id, userId: actor.id } },
        update: {},
        create: { tenantId: actor.tenantId, branchId: branch.id, userId: actor.id }
      });
      return branch;
    });
  }

  async update(actor: AuthenticatedUser, id: string, input: { name?: string | undefined; code?: string | undefined; address?: string | null | undefined; phone?: string | null | undefined }) {
    const branch = await this.find(actor, id);
    const normalizedName = input.name ? this.normalize(input.name) : undefined;
    const code = input.code?.trim().toUpperCase();
    if (normalizedName || code) {
      const duplicate = await this.prisma.branch.findFirst({ where: { tenantId: actor.tenantId, id: { not: id }, OR: [...(normalizedName ? [{ normalizedName }] : []), ...(code ? [{ code }] : [])] } });
      if (duplicate) throw new ConflictError('Ya existe una sucursal con ese nombre o código');
    }
    return this.prisma.branch.update({ where: { id: branch.id }, data: { ...(input.name && normalizedName ? { name: input.name.trim(), normalizedName } : {}), ...(code ? { code } : {}), ...(input.address !== undefined ? { address: input.address?.trim() || null } : {}), ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}) } });
  }

  async updateStatus(actor: AuthenticatedUser, id: string, status: BranchStatus) {
    const branch = await this.find(actor, id);
    if (branch.isPrimary && status !== 'ACTIVE') throw new ValidationAppError('La sucursal principal no se puede desactivar');
    return this.prisma.branch.update({ where: { id }, data: { status } });
  }

  async replaceMembers(actor: AuthenticatedUser, id: string, userIds: string[], primaryUserIds: string[]) {
    const branch = await this.find(actor, id);
    const uniqueIds = [...new Set(userIds)];
    if (primaryUserIds.some((userId) => !uniqueIds.includes(userId))) throw new ValidationAppError('El usuario principal debe pertenecer a la sucursal');
    const users = await this.prisma.user.findMany({ where: { tenantId: actor.tenantId, id: { in: uniqueIds }, deletedAt: null }, select: { id: true } });
    if (users.length !== uniqueIds.length) throw new ValidationAppError('Uno o más usuarios no pertenecen a esta empresa');
    await this.prisma.$transaction(async (tx) => {
      await tx.branchMembership.deleteMany({ where: { branchId: branch.id, userId: { notIn: uniqueIds } } });
      for (const userId of uniqueIds) {
        const isPrimary = primaryUserIds.includes(userId);
        if (isPrimary) await tx.branchMembership.updateMany({ where: { tenantId: actor.tenantId, userId, isPrimary: true, branchId: { not: branch.id } }, data: { isPrimary: false } });
        await tx.branchMembership.upsert({ where: { branchId_userId: { branchId: branch.id, userId } }, update: { isPrimary }, create: { tenantId: actor.tenantId, branchId: branch.id, userId, isPrimary } });
      }
    });
    return this.findDetail(actor, id);
  }

  async availableUsers(actor: AuthenticatedUser) {
    return this.prisma.user.findMany({ where: { tenantId: actor.tenantId, deletedAt: null, status: 'ACTIVE' }, orderBy: { name: 'asc' }, select: { id: true, name: true, email: true, roleAssignments: { include: { role: { select: { key: true, name: true } } } }, branchMemberships: { select: { branchId: true, isPrimary: true } } } });
  }

  async inventorySharing(actor: AuthenticatedUser, id: string) {
    const branch = await this.find(actor, id);
    const ownPool = await this.prisma.inventoryPool.findFirst({ where: { tenantId: actor.tenantId, normalizedName: `branch-${id}` } });
    const overrides = await this.prisma.branchInventoryProductOverride.findMany({
      where: { tenantId: actor.tenantId, branchId: id }, select: { productId: true, poolId: true }
    });
    const mode = overrides.length > 0 ? 'SELECTIVE' : branch.defaultInventoryPoolId !== ownPool?.id ? 'FULL' : 'INDEPENDENT';
    return { mode, defaultInventoryPoolId: branch.defaultInventoryPoolId, products: overrides };
  }

  async configureInventorySharing(actor: AuthenticatedUser, id: string, input: { mode: 'INDEPENDENT' | 'FULL' | 'SELECTIVE'; sourceBranchId?: string | undefined; productIds?: string[] | undefined }) {
    const branch = await this.find(actor, id);
    const ownPool = await this.prisma.inventoryPool.findFirst({ where: { tenantId: actor.tenantId, normalizedName: `branch-${id}` } });
    if (!ownPool) throw new ValidationAppError('No se encontró el inventario propio de la sucursal');
    const source = input.sourceBranchId
      ? await this.prisma.branch.findFirst({ where: { id: input.sourceBranchId, tenantId: actor.tenantId, status: 'ACTIVE' } })
      : null;
    if (input.mode !== 'INDEPENDENT' && (!source || source.id === branch.id || !source.defaultInventoryPoolId)) {
      throw new ValidationAppError('Debes seleccionar otra sucursal activa como origen del inventario');
    }
    if (input.mode === 'SELECTIVE' && !input.productIds?.length) throw new ValidationAppError('Selecciona al menos un producto para compartir');
    await this.prisma.$transaction(async (tx) => {
      await tx.branchInventoryProductOverride.deleteMany({ where: { tenantId: actor.tenantId, branchId: id } });
      await tx.branch.update({ where: { id }, data: { defaultInventoryPoolId: input.mode === 'FULL' ? source!.defaultInventoryPoolId : ownPool.id } });
      if (input.mode === 'SELECTIVE') {
        const products = await tx.store.findMany({ where: { tenantId: actor.tenantId, id: { in: input.productIds! }, deletedAt: null }, select: { id: true } });
        if (products.length !== new Set(input.productIds).size) throw new ValidationAppError('Uno de los productos no pertenece a esta empresa');
        await tx.branchInventoryProductOverride.createMany({ data: products.map((product) => ({ tenantId: actor.tenantId, branchId: id, productId: product.id, poolId: source!.defaultInventoryPoolId! })) });
      }
    });
    return this.inventorySharing(actor, id);
  }

  private async find(actor: AuthenticatedUser, id: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id, tenantId: actor.tenantId } });
    if (!branch) throw new NotFoundError('Sucursal no encontrada');
    return branch;
  }
  private async findDetail(actor: AuthenticatedUser, id: string) { await this.find(actor, id); return this.prisma.branch.findUniqueOrThrow({ where: { id }, include: { memberships: { include: { user: { select: { id: true, name: true, email: true } } } } } }); }
  private normalize(value: string) { return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
}
