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
      select: { id: true, slug: true, name: true, status: true, createdAt: true, _count: { select: { users: true } } }
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
      const admin = await tx.user.create({
        data: { tenantId: tenant.id, name: input.adminName.trim(), email, passwordHash, status: 'ACTIVE' }
      });
      await tx.userRoleAssignment.create({
        data: { tenantId: tenant.id, userId: admin.id, roleId: adminRoleId, scope: 'GLOBAL' }
      });
      return { id: tenant.id, slug: tenant.slug, name: tenant.name, status: tenant.status, adminEmail: admin.email };
    });
  }

  updateStatus(id: string, status: TenantStatus) {
    if (id === 'default' && status !== 'ACTIVE') {
      throw new ValidationAppError('La empresa principal no se puede suspender ni archivar');
    }
    return this.prisma.tenant.update({ where: { id }, data: { status }, select: { id: true, slug: true, name: true, status: true } });
  }
}
