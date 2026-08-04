import { Prisma, type PrismaClient, type PermissionScope, type UserStatus } from '@prisma/client';
import { employeeBonusConfig } from '../../config/env.js';
import { ConflictError, NotFoundError, ValidationAppError } from '../../shared/errors/AppError.js';
import { buildCreatedAtFilter, dateRangeOrCurrentDay } from '../../shared/utils/dateRange.js';
import {
  labelFromMap,
  permissionActionLabels,
  permissionResourceLabels,
  permissionScopeLabels,
  roleLabels,
  userStatusLabels
} from '../../shared/utils/spanishLabels.js';
import type { PasswordHasher } from '../../infrastructure/security/PasswordHasher.js';
import type { AuthenticatedUser } from '../../types/rbac.js';

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  phone?: string | undefined;
  profileImagePath?: string | undefined;
  status: UserStatus;
  roleKey?: string | undefined;
  scope: PermissionScope;
  storeId?: string | undefined;
}

export interface UpdateUserInput {
  name?: string | undefined;
  email?: string | undefined;
  password?: string | undefined;
  phone?: string | null | undefined;
  profileImagePath?: string | null | undefined;
  status?: UserStatus | undefined;
  roleKey?: string | undefined;
  scope?: PermissionScope | undefined;
  storeId?: string | undefined;
}

export interface AssignRoleInput {
  roleKey: string;
  scope: PermissionScope;
  storeId?: string | undefined;
  expiresAt?: string | undefined;
}

export interface PaginationInput {
  page: number;
  pageSize: number;
}

export interface DashboardInput extends PaginationInput {
  from?: string | undefined;
  to?: string | undefined;
}

export class UserUseCases {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly passwordHasher: PasswordHasher
  ) {}

  async create(input: CreateUserInput) {
    const passwordHash = await this.passwordHasher.hash(input.password);
    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: {
        roleAssignments: { include: { role: true } }
      }
    });

    if (existingUser && !existingUser.deletedAt) {
      const roleNames = existingUser.roleAssignments.map((assignment) => this.roleDisplayName(assignment.role.key, assignment.role.name));
      throw new ConflictError(`Ya existe un usuario activo con ese correo: ${existingUser.name}`, {
        usuario: {
          id: existingUser.id,
          nombre: existingUser.name,
          correo: existingUser.email,
          roles: roleNames
        }
      });
    }

    if (existingUser?.deletedAt) {
      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: input.name,
          passwordHash,
          phone: input.phone ?? null,
          profileImagePath: input.profileImagePath ?? null,
          status: input.status,
          deletedAt: null
        }
      });

      if (input.roleKey) {
        await this.replaceRole(existingUser.id, {
          roleKey: input.roleKey,
          scope: input.scope,
          ...(input.storeId ? { storeId: input.storeId } : {})
        });
      }

      return this.findById(existingUser.id);
    }

    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        phone: input.phone ?? null,
        profileImagePath: input.profileImagePath ?? null,
        status: input.status
      },
      select: this.publicUserSelect()
    });

    if (input.roleKey) {
      await this.assignRole(user.id, {
        roleKey: input.roleKey,
        scope: input.scope,
        ...(input.storeId ? { storeId: input.storeId } : {})
      });
    }

    return this.findById(user.id);
  }

  async list(pagination: PaginationInput) {
    const where = { deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: this.publicUserSelect(),
        orderBy: { name: 'asc' },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize
      }),
      this.prisma.user.count({ where })
    ]);

    return this.paginated(items.map((item) => this.presentUser(item)), total, pagination);
  }

  async listOptions(input: DashboardInput, actor?: AuthenticatedUser) {
    const range = dateRangeOrCurrentDay(input);
    const createdAt = buildCreatedAtFilter(range);
    const visibleRoleKeys = this.visibleOptionRoleKeys(actor);
    const isAdmin = this.hasAnyRole(actor, ['admin']);
    const where = {
      deletedAt: null,
      status: 'ACTIVE' as const,
      ...(!isAdmin ? {
        roleAssignments: {
          some: {
            role: {
              key: {
                in: visibleRoleKeys
              }
            }
          }
        }
      } : {})
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          roleAssignments: {
            select: {
              role: {
                select: {
                  key: true,
                  name: true
                }
              }
            }
          }
        },
        orderBy: { name: 'asc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize
      }),
      this.prisma.user.count({ where })
    ]);

    const presentedItems = await Promise.all(items.map(async (user) => {
      const roleKeys = user.roleAssignments.map((assignment) => assignment.role.key);
      const roleNames = user.roleAssignments.map((assignment) => this.roleDisplayName(assignment.role.key, assignment.role.name));
      const roleAssignments = user.roleAssignments.map((assignment) => ({
        ...assignment,
        role: this.presentRole(assignment.role)
      }));
      const messengerStats = roleKeys.includes('messenger')
        ? await this.messengerStats(user.id, createdAt, actor)
        : this.emptyMessengerStats();

      return {
        id: user.id,
        name: user.name,
        email: isAdmin ? user.email : null,
        status: user.status,
        roles: roleKeys,
        roleKey: roleKeys[0] ?? null,
        role: roleNames[0] ?? null,
        roleName: roleNames[0] ?? null,
        roleLabel: roleNames[0] ?? null,
        roleDisplayName: roleNames[0] ?? null,
        roleAssignments,
        completedDeliveries: messengerStats.completedDeliveries,
        deliveriesCount: messengerStats.completedDeliveries,
        completedDeliveryPay: messengerStats.completedDeliveryPay,
        earnedMoney: messengerStats.earnedMoney,
        messengerEarnings: messengerStats.messengerEarnings,
        totalEarned: messengerStats.totalEarned,
        deliveryPayment: messengerStats.deliveryPayment,
        pendingDeliveryPay: messengerStats.pendingDeliveryPay,
        pendingMoney: messengerStats.pendingMoney,
        pendingCash: messengerStats.pendingCash
      };
    }));

    return this.paginated(presentedItems, total, input);
  }

  async dashboard(input: DashboardInput) {
    const range = dateRangeOrCurrentDay(input);
    const createdAt = buildCreatedAtFilter(range);
    const rangeDays = this.rangeDays(range);
    const where = { deletedAt: null };
    const users = await this.prisma.user.findMany({
      where,
      include: {
        roleAssignments: { include: { role: true } }
      },
      orderBy: { name: 'asc' },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize
    });
    const total = await this.prisma.user.count({ where });

    const items = await Promise.all(users.map(async (user) => {
      const roleKeys = user.roleAssignments.map((assignment) => assignment.role.key);
      const roleNames = user.roleAssignments.map((assignment) => this.roleDisplayName(assignment.role.key, assignment.role.name));
      const [employeeStats, messengerStats, sellerStats] = await Promise.all([
        this.salesStats({ employeeId: user.id }, createdAt, rangeDays, user.name),
        this.messengerStats(user.id, createdAt),
        this.sellerStats(user.id, createdAt)
      ]);
      const primaryStats = roleKeys.includes('seller') ? sellerStats : employeeStats;
      const deliveriesCount = roleKeys.includes('messenger')
        ? messengerStats.completedDeliveries
        : primaryStats.orders;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        statusLabel: labelFromMap(userStatusLabels, user.status),
        roles: roleKeys,
        role: roleNames[0] ?? null,
        roleName: roleNames[0] ?? null,
        roleLabel: roleNames[0] ?? null,
        roleDisplayName: roleNames[0] ?? null,
        orders: primaryStats.orders,
        finalizedOrders: primaryStats.orders,
        deliveriesCount,
        percentage: employeeStats.average,
        average: employeeStats.average,
        dailyAverage: employeeStats.average,
        bonus: employeeStats.bonus,
        bonusAmount: employeeStats.bonus,
        perfumes: primaryStats.perfumes,
        productCount: primaryStats.perfumes,
        internalSales: employeeStats.internalSales,
        productIncome: primaryStats.productIncome,
        perfumeIncome: primaryStats.productIncome,
        perfumeMoney: primaryStats.perfumeCost,
        perfumeCost: primaryStats.perfumeCost,
        totalSold: primaryStats.total,
        totalSales: primaryStats.total,
        cash: primaryStats.cash,
        transfer: primaryStats.transfer,
        messengerCost: primaryStats.deliveryPay,
        shippingCost: primaryStats.deliveryPay,
        shippingMoney: primaryStats.deliveryPay,
        net: primaryStats.net,
        netCash: primaryStats.net,
        sellerNet: sellerStats.net,
        completedDeliveries: messengerStats.completedDeliveries,
        completedDeliveryPay: messengerStats.completedDeliveryPay,
        earnedMoney: messengerStats.earnedMoney,
        messengerEarnings: messengerStats.messengerEarnings,
        totalEarned: messengerStats.totalEarned,
        deliveryPayment: messengerStats.deliveryPayment,
        pendingDeliveryPay: messengerStats.pendingDeliveryPay,
        pendingMoney: messengerStats.pendingMoney,
        pendingCash: messengerStats.pendingCash,
        employee: employeeStats,
        messenger: messengerStats,
        seller: sellerStats
      };
    }));

    return this.paginated(items, total, input);
  }

  async findById(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: this.publicUserSelect()
    });

    if (!user) throw new NotFoundError('Usuario no encontrado');
    return this.presentUser(user);
  }

  async update(id: string, input: UpdateUserInput) {
    await this.findById(id);
    const passwordHash = input.password ? await this.passwordHasher.hash(input.password) : undefined;

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.email ? { email: input.email } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.profileImagePath !== undefined ? { profileImagePath: input.profileImagePath } : {}),
        ...(passwordHash ? { passwordHash } : {})
      },
      select: this.publicUserSelect()
    });

    if (input.roleKey) {
      await this.replaceRole(id, {
        roleKey: input.roleKey,
        scope: input.scope ?? 'GLOBAL',
        ...(input.storeId ? { storeId: input.storeId } : {})
      });
    }

    return this.presentUser(user);
  }

  async softDelete(id: string) {
    await this.findById(id);
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' }
    });
  }

  async changePassword(id: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundError('Usuario no encontrado');

    const valid = await this.passwordHasher.compare(currentPassword, user.passwordHash);
    if (!valid) throw new ValidationAppError('La contrasena actual no es correcta');

    const passwordHash = await this.passwordHasher.hash(newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { passwordHash }
      });
      await tx.refreshSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    });
  }

  async assignRole(userId: string, input: AssignRoleInput) {
    await this.findById(userId);
    const role = await this.prisma.role.findUnique({ where: { key: input.roleKey } });
    if (!role) throw new ValidationAppError('Rol inexistente');

    if (input.scope === 'STORE' && !input.storeId) {
      throw new ValidationAppError('El producto o tienda es requerido para el alcance seleccionado');
    }

    const assignment = await this.prisma.userRoleAssignment.create({
      data: {
        userId,
        roleId: role.id,
        scope: input.scope,
        storeId: input.storeId ?? null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null
      },
      include: { role: true, store: this.roleAssignmentStoreSelect() }
    });

    return {
      ...assignment,
      role: this.presentRole(assignment.role)
    };
  }

  async replaceRole(userId: string, input: AssignRoleInput) {
    await this.findById(userId);
    const role = await this.prisma.role.findUnique({ where: { key: input.roleKey } });
    if (!role) throw new ValidationAppError('Rol inexistente');

    if (input.scope === 'STORE' && !input.storeId) {
      throw new ValidationAppError('El producto o tienda es requerido para el alcance seleccionado');
    }

    const assignment = await this.prisma.$transaction(async (tx) => {
      await tx.userRoleAssignment.deleteMany({ where: { userId } });

      return tx.userRoleAssignment.create({
        data: {
          userId,
          roleId: role.id,
          scope: input.scope,
          storeId: input.storeId ?? null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null
        },
        include: { role: true, store: this.roleAssignmentStoreSelect() }
      });
    });

    return {
      ...assignment,
      role: this.presentRole(assignment.role)
    };
  }

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } }
      },
      orderBy: { key: 'asc' }
    });

    return roles.map((role) => ({
      ...this.presentRole(role),
      permissions: role.permissions.map((rolePermission) => ({
        ...rolePermission,
        permission: this.presentPermission(rolePermission.permission)
      }))
    }));
  }

  private async salesStats(
    where: { employeeId?: string; sellerId?: string },
    createdAt: ReturnType<typeof buildCreatedAtFilter>,
    rangeDays: number,
    _userName: string
  ) {
    const [sales, shipping] = await Promise.all([
      this.prisma.sale.findMany({
        where: {
          ...where,
          status: 'FINALIZED',
          deletedAt: null,
          ...(createdAt ? { createdAt } : {})
        },
        include: {
          details: { select: { quantity: true, unitPrice: true } }
        }
      }),
      this.prisma.sale.aggregate({
        where: {
          ...where,
          status: { in: ['FINALIZED', 'CANCELLED'] },
          deletedAt: null,
          ...(createdAt ? { createdAt } : {})
        },
        _sum: { deliveryPay: true }
      })
    ]);

    const stats = sales.reduce((totals, sale) => {
      const saleProductTotal = this.saleProductIncome(sale.details);
      totals.orders += 1;
      totals.cash = totals.cash.plus(sale.amountCash);
      totals.transfer = totals.transfer.plus(sale.amountTransfer);
      totals.perfumes += sale.perfumeCount;
      if (!sale.sellerId) {
        totals.internalSales = totals.internalSales.plus(sale.amount);
      } else {
        totals.productIncome = totals.productIncome.plus(saleProductTotal);
      }
      return totals;
    }, {
      orders: 0,
      cash: new Prisma.Decimal(0),
      transfer: new Prisma.Decimal(0),
      perfumes: 0,
      productIncome: new Prisma.Decimal(0),
      internalSales: new Prisma.Decimal(0)
    });
    const deliveryPay = shipping._sum.deliveryPay ?? new Prisma.Decimal(0);
    const totalSold = stats.internalSales.plus(stats.productIncome);
    const average = rangeDays > 0 ? totalSold.div(rangeDays) : new Prisma.Decimal(0);

    return {
      orders: stats.orders,
      total: totalSold,
      cash: stats.cash,
      transfer: stats.transfer,
      deliveryPay,
      perfumes: stats.perfumes,
      productIncome: stats.productIncome,
      perfumeIncome: stats.productIncome,
      perfumeCost: stats.productIncome,
      internalSales: stats.internalSales,
      average,
      bonus: this.employeeBonus(average),
      net: stats.cash.minus(deliveryPay)
    };
  }

  private async sellerStats(sellerId: string, createdAt: ReturnType<typeof buildCreatedAtFilter>) {
    const [sales, shipping] = await Promise.all([
      this.prisma.sale.findMany({
        where: {
          sellerId,
          status: 'FINALIZED',
          deletedAt: null,
          ...(createdAt ? { createdAt } : {})
        },
        include: {
          details: { select: { quantity: true, unitPrice: true } }
        }
      }),
      this.prisma.sale.aggregate({
        where: {
          sellerId,
          status: { in: ['FINALIZED', 'CANCELLED'] },
          deletedAt: null,
          ...(createdAt ? { createdAt } : {})
        },
        _sum: { deliveryPay: true }
      })
    ]);

    const stats = sales.reduce((totals, sale) => {
      totals.orders += 1;
      totals.total = totals.total.plus(sale.amount);
      totals.cash = totals.cash.plus(sale.amountCash);
      totals.transfer = totals.transfer.plus(sale.amountTransfer);
      totals.perfumes += sale.perfumeCount;
      totals.productIncome = totals.productIncome.plus(this.saleProductIncome(sale.details));
      totals.perfumeCost = totals.perfumeCost.plus(this.saleProductIncome(sale.details));
      return totals;
    }, {
      orders: 0,
      total: new Prisma.Decimal(0),
      cash: new Prisma.Decimal(0),
      transfer: new Prisma.Decimal(0),
      perfumes: 0,
      productIncome: new Prisma.Decimal(0),
      perfumeCost: new Prisma.Decimal(0)
    });
    const deliveryPay = shipping._sum.deliveryPay ?? new Prisma.Decimal(0);

    return {
      orders: stats.orders,
      total: stats.total,
      totalSales: stats.total,
      cash: stats.cash,
      transfer: stats.transfer,
      deliveryPay,
      shippingCost: deliveryPay,
      shippingMoney: deliveryPay,
      perfumes: stats.perfumes,
      productIncome: stats.productIncome,
      perfumeIncome: stats.productIncome,
      perfumeCost: stats.perfumeCost,
      perfumeMoney: stats.perfumeCost,
      net: stats.total.minus(deliveryPay).minus(stats.perfumeCost),
      amountToPay: stats.total.minus(deliveryPay).minus(stats.perfumeCost)
    };
  }

  private async messengerStats(
    messengerId: string,
    createdAt: ReturnType<typeof buildCreatedAtFilter>,
    actor?: AuthenticatedUser
  ) {
    const scopedWhere = this.userStatsAccessWhere(actor);
    const [completed, pending] = await Promise.all([
      this.prisma.sale.aggregate({
        where: {
          messengerId,
          status: { in: ['FINALIZED', 'CANCELLED'] },
          deletedAt: null,
          ...scopedWhere,
          ...(createdAt ? { createdAt } : {})
        },
        _count: { id: true },
        _sum: { deliveryPay: true }
      }),
      this.prisma.sale.aggregate({
        where: {
          messengerId,
          status: 'DELIVERY_PENDING',
          deletedAt: null,
          ...scopedWhere,
          ...(createdAt ? { createdAt } : {})
        },
        _sum: { amountCash: true, deliveryPay: true }
      })
    ]);
    const completedDeliveryPay = completed._sum.deliveryPay ?? new Prisma.Decimal(0);
    const pendingDeliveryPay = pending._sum.deliveryPay ?? new Prisma.Decimal(0);
    const pendingMoney = pending._sum.amountCash ?? new Prisma.Decimal(0);

    return {
      deliveries: completed._count.id,
      completedDeliveries: completed._count.id,
      completedDeliveryPay,
      earnedMoney: completedDeliveryPay,
      messengerEarnings: completedDeliveryPay,
      totalEarned: completedDeliveryPay,
      deliveryPayment: pendingDeliveryPay,
      deliveryPay: pendingDeliveryPay,
      shippingPayment: pendingDeliveryPay,
      pendingDeliveryPay,
      pendingMoney,
      pendingCash: pendingMoney
    };
  }

  private emptyMessengerStats() {
    const zero = new Prisma.Decimal(0);

    return {
      deliveries: 0,
      completedDeliveries: 0,
      completedDeliveryPay: zero,
      earnedMoney: zero,
      messengerEarnings: zero,
      totalEarned: zero,
      deliveryPayment: zero,
      deliveryPay: zero,
      shippingPayment: zero,
      pendingDeliveryPay: zero,
      pendingMoney: zero,
      pendingCash: zero
    };
  }

  private userStatsAccessWhere(actor?: AuthenticatedUser): Prisma.SaleWhereInput {
    if (!actor) return {};

    const canReadGlobal = actor.permissions.some((permission) => {
      return permission.key === 'users:read:global' || permission.key === 'reports:cash:global';
    });

    if (canReadGlobal) return {};

    return {
      OR: [
        { employeeId: actor.id },
        { sellerId: actor.id },
        { messengerId: actor.id }
      ]
    };
  }

  private saleProductIncome(details: Array<{ quantity: number; unitPrice: Prisma.Decimal }>) {
    return details.reduce((total, detail) => {
      return total.plus(detail.unitPrice.mul(detail.quantity));
    }, new Prisma.Decimal(0));
  }

  private employeeBonus(average: Prisma.Decimal) {
    let bonus = 0;
    for (const tier of employeeBonusConfig.tiers) {
      const dailyTarget = new Prisma.Decimal(tier.target).div(employeeBonusConfig.baseDays);
      if (average.greaterThanOrEqualTo(dailyTarget)) {
        bonus = tier.bonus;
      }
    }

    return bonus;
  }

  private rangeDays(range: { from?: Date; to?: Date }) {
    if (!range.from || !range.to) return 1;
    const milliseconds = range.to.getTime() - range.from.getTime();
    return Math.max(1, Math.ceil(milliseconds / 86_400_000));
  }

  private publicUserSelect() {
    return {
      id: true,
      name: true,
      email: true,
      status: true,
      phone: true,
      profileImagePath: true,
      createdAt: true,
      updatedAt: true,
      roleAssignments: {
        include: {
          role: true,
          store: this.roleAssignmentStoreSelect()
        }
      }
    } as const;
  }

  private roleAssignmentStoreSelect() {
    return {
      select: {
        id: true,
        name: true,
        description: true,
        stock: true,
        imagePath: true
      }
    } as const;
  }

  private visibleOptionRoleKeys(actor?: AuthenticatedUser) {
    if (this.hasAnyRole(actor, ['admin'])) {
      return ['admin', 'employee', 'supervisor', 'seller', 'messenger'];
    }

    if (this.hasAnyRole(actor, ['employee', 'supervisor'])) {
      return ['seller', 'messenger'];
    }

    if (this.hasAnyRole(actor, ['seller'])) {
      return ['messenger'];
    }

    return [];
  }

  private hasAnyRole(actor: AuthenticatedUser | undefined, roles: string[]) {
    return actor?.roles.some((role) => roles.includes(role.roleKey)) ?? false;
  }

  private presentUser<T extends { status: string }>(user: T) {
    const userWithRoles = user as unknown as {
      roleAssignments?: Array<{ role?: { key: string; name: string } }>;
    };
    const roleAssignments = Array.isArray(userWithRoles.roleAssignments)
      ? userWithRoles.roleAssignments.map((assignment) => ({
        ...assignment,
        role: assignment.role ? this.presentRole(assignment.role) : assignment.role
      }))
      : undefined;
    const roleKeys = roleAssignments?.map((assignment) => assignment.role?.key).filter(Boolean) ?? [];
    const firstRole = roleAssignments?.[0]?.role;

    return {
      ...user,
      ...(roleAssignments ? { roleAssignments } : {}),
      ...(roleAssignments ? {
        roles: roleKeys,
        roleKey: roleKeys[0] ?? null,
        role: firstRole?.name ?? null,
        roleName: firstRole?.name ?? null,
        roleLabel: firstRole?.name ?? null,
        roleDisplayName: firstRole?.name ?? null
      } : {}),
      statusLabel: labelFromMap(userStatusLabels, user.status)
    };
  }

  private presentRole<T extends { key: string; name: string }>(role: T) {
    const name = this.roleDisplayName(role.key, role.name);
    return {
      ...role,
      name,
      label: name,
      displayName: name
    };
  }

  private roleDisplayName(roleKey: string, fallback?: string | null) {
    return roleLabels[roleKey] ?? fallback ?? roleKey;
  }

  private presentPermission<T extends { resource: string; action: string; scope: string }>(permission: T) {
    const scope = permission.scope.toLowerCase();
    return {
      ...permission,
      resourceLabel: labelFromMap(permissionResourceLabels, permission.resource),
      actionLabel: labelFromMap(permissionActionLabels, permission.action),
      scopeLabel: labelFromMap(permissionScopeLabels, scope)
    };
  }

  private paginated<T>(items: T[], total: number, pagination: PaginationInput) {
    return {
      items,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
        totalPages: Math.ceil(total / pagination.pageSize)
      }
    };
  }
}
