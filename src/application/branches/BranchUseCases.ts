import type { BranchStatus, PrismaClient } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationAppError } from '../../shared/errors/AppError.js';
import type { AuthenticatedUser } from '../../types/rbac.js';

export class BranchUseCases {
  constructor(private readonly prisma: PrismaClient) {}

  list(actor: AuthenticatedUser) {
    return this.prisma.branch.findMany({
      where: { tenantId: actor.tenantId },
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
    return this.prisma.branch.create({ data: { tenantId: actor.tenantId, name: input.name.trim(), normalizedName, code, address: input.address?.trim() || null, phone: input.phone?.trim() || null } });
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

  private async find(actor: AuthenticatedUser, id: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id, tenantId: actor.tenantId } });
    if (!branch) throw new NotFoundError('Sucursal no encontrada');
    return branch;
  }
  private async findDetail(actor: AuthenticatedUser, id: string) { await this.find(actor, id); return this.prisma.branch.findUniqueOrThrow({ where: { id }, include: { memberships: { include: { user: { select: { id: true, name: true, email: true } } } } } }); }
  private normalize(value: string) { return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
}
