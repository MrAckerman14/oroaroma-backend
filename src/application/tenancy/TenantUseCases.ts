import type { PrismaClient, TenantStatus } from '@prisma/client';
import type { PasswordHasher } from '../../infrastructure/security/PasswordHasher.js';
import { ConflictError, ValidationAppError } from '../../shared/errors/AppError.js';

export interface CreateTenantInput {
  name: string;
  slug: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export class TenantUseCases {
  constructor(private readonly prisma: PrismaClient, private readonly passwordHasher: PasswordHasher) {}

  list() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        createdAt: true,
        moduleSettings: { orderBy: { moduleKey: 'asc' } },
        _count: { select: { users: true } }
      }
    });
  }

  async create(input: CreateTenantInput) {
    const slug = input.slug.trim().toLowerCase();
    const email = input.adminEmail.trim().toLowerCase();
    const existing = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existing) throw new ConflictError('Ya existe una empresa con ese identificador');
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictError('El correo del administrador ya esta registrado');
    }

    const passwordHash = await this.passwordHasher.hash(input.adminPassword);
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { slug, name: input.name.trim() } });
      const modules = await tx.moduleCatalog.findMany();
      await tx.tenantModuleSetting.createMany({
        data: modules.map((module) => ({
          tenantId: tenant.id,
          moduleKey: module.key,
          enabled: module.defaultEnabled
        }))
      });
      await tx.expenseCategory.createMany({
        data: ['Ventas', 'Mensajería', 'Mercancía', 'Publicidad', 'Nómina', 'Local', 'Acarreo'].map((categoryName) => ({
          tenantId: tenant.id,
          name: categoryName,
          normalizedName: categoryName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
          isSystem: true
        }))
      });
      const sourceRoles = await tx.role.findMany({
        where: { tenantId: 'default' },
        include: { permissions: true }
      });
      let adminRoleId: string | null = null;
      for (const sourceRole of sourceRoles) {
        const role = await tx.role.create({
          data: {
            tenantId: tenant.id,
            key: sourceRole.key,
            name: sourceRole.name,
            description: sourceRole.description,
            isSystem: sourceRole.isSystem,
            permissions: {
              create: sourceRole.permissions.map((item) => ({ permissionId: item.permissionId }))
            }
          }
        });
        if (role.key === 'admin') adminRoleId = role.id;
      }
      if (!adminRoleId) throw new Error('No existe el rol administrador base');
      const primaryBranch = await tx.branch.create({ data: { tenantId: tenant.id, name: 'Principal', normalizedName: 'principal', code: 'PRINCIPAL', isPrimary: true } });
      const admin = await tx.user.create({
        data: { tenantId: tenant.id, name: input.adminName.trim(), email, passwordHash, status: 'ACTIVE' }
      });
      await tx.userRoleAssignment.create({
        data: { tenantId: tenant.id, userId: admin.id, roleId: adminRoleId, scope: 'GLOBAL' }
      });
      await tx.branchMembership.create({ data: { tenantId: tenant.id, branchId: primaryBranch.id, userId: admin.id, isPrimary: true } });
      return { id: tenant.id, slug: tenant.slug, name: tenant.name, status: tenant.status, adminEmail: admin.email };
    });
  }

  updateStatus(id: string, status: TenantStatus) {
    if (id === 'default' && status !== 'ACTIVE') {
      throw new ValidationAppError('La empresa principal no se puede suspender ni archivar');
    }
    return this.prisma.tenant.update({ where: { id }, data: { status }, select: { id: true, slug: true, name: true, status: true } });
  }

  listModuleCatalog() {
    return this.prisma.moduleCatalog.findMany({ orderBy: { name: 'asc' } });
  }

  async updateModules(id: string, modules: Array<{ key: string; enabled: boolean }>) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id }, select: { id: true } });
    if (!tenant) throw new ValidationAppError('La empresa indicada no existe');

    const knownModules = await this.prisma.moduleCatalog.findMany({
      where: { key: { in: modules.map((module) => module.key) } },
      select: { key: true }
    });
    if (knownModules.length !== modules.length) {
      throw new ValidationAppError('La configuracion contiene modulos desconocidos');
    }

    await this.prisma.$transaction(modules.map((module) => this.prisma.tenantModuleSetting.upsert({
      where: { tenantId_moduleKey: { tenantId: id, moduleKey: module.key } },
      update: { enabled: module.enabled },
      create: { tenantId: id, moduleKey: module.key, enabled: module.enabled }
    })));

    return this.prisma.tenantModuleSetting.findMany({ where: { tenantId: id }, orderBy: { moduleKey: 'asc' } });
  }

  platformSecurityOverview() {
    return this.prisma.platformRole.findMany({
      orderBy: { name: 'asc' },
      select: {
        key: true,
        name: true,
        description: true,
        permissions: {
          select: { permission: { select: { key: true, resource: true, action: true, description: true } } }
        },
        _count: { select: { assignments: true } }
      }
    });
  }
}
