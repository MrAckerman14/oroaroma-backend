import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { TenantUseCases } from '../../application/tenancy/TenantUseCases.js';
import { PrismaUserRepository } from '../repositories/PrismaUserRepository.js';
import { PasswordHasher } from '../security/PasswordHasher.js';

const describeDb = process.env.RUN_DB_TESTS === 'true' ? describe : describe.skip;
const prisma = new PrismaClient();
const suffix = Date.now();
const slug = `tenant-provisioning-${suffix}`;
const email = `admin-${suffix}@example.test`;

describeDb('tenant provisioning', () => {
  afterAll(async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (tenant) {
      await prisma.userRoleAssignment.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.user.deleteMany({ where: { tenantId: tenant.id } });
      const roles = await prisma.role.findMany({ where: { tenantId: tenant.id }, select: { id: true } });
      await prisma.rolePermission.deleteMany({ where: { roleId: { in: roles.map((role) => role.id) } } });
      await prisma.role.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
    await prisma.$disconnect();
  });

  it('crea una empresa completa y permite resolverla solo por el correo del administrador', async () => {
    const useCases = new TenantUseCases(prisma, new PasswordHasher());
    const created = await useCases.create({
      name: 'Empresa de prueba',
      slug,
      adminName: 'Administrador de prueba',
      adminEmail: email,
      adminPassword: 'TenantTest123!'
    });

    const baseRoles = await prisma.role.count({ where: { tenantId: 'default' } });
    const tenantRoles = await prisma.role.count({ where: { tenantId: created.id } });
    const account = await new PrismaUserRepository(prisma).findRawUserByEmailAcrossTenants(email);

    expect(tenantRoles).toBe(baseRoles);
    expect(account?.tenantId).toBe(created.id);
    expect(account?.tenant.status).toBe('ACTIVE');
    expect(await prisma.userRoleAssignment.count({ where: { tenantId: created.id } })).toBe(1);
  });
});
