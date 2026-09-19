import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BranchUseCases } from '../../application/branches/BranchUseCases.js';
import type { AuthenticatedUser } from '../../types/rbac.js';
const describeDb = process.env.RUN_DB_TESTS === 'true' ? describe : describe.skip;
const prisma = new PrismaClient();
const suffix = randomUUID();
const tenantA = `branch-a-${suffix}`;
const tenantB = `branch-b-${suffix}`;
let actor: AuthenticatedUser;
let userA: { id: string };
let userB: { id: string };
describeDb('branch tenant isolation', () => {
  beforeAll(async () => {
    await prisma.tenant.createMany({ data: [{ id: tenantA, slug: tenantA, name: 'A' }, { id: tenantB, slug: tenantB, name: 'B' }] });
    userA = await prisma.user.create({ data: { tenantId: tenantA, name: 'A', email: `${tenantA}@test.local`, passwordHash: 'x' } });
    userB = await prisma.user.create({ data: { tenantId: tenantB, name: 'B', email: `${tenantB}@test.local`, passwordHash: 'x' } });
    actor = { id: userA.id, tenantId: tenantA, email: `${tenantA}@test.local`, name: 'A', status: 'ACTIVE', statusLabel: 'Activo', roles: [], permissions: [] };
  });
  afterAll(async () => {
    await prisma.branchMembership.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prisma.branch.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prisma.inventoryPool.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prisma.user.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    await prisma.$disconnect();
  });
  it('creates and lists branches only for the active tenant', async () => {
    const useCases = new BranchUseCases(prisma);
    await useCases.create(actor, { name: 'Centro', code: 'CENTRO' });
    const poolB = await prisma.inventoryPool.create({ data: { tenantId: tenantB, name: 'Norte', normalizedName: 'norte' } });
    await prisma.branch.create({ data: { tenantId: tenantB, name: 'Norte', normalizedName: 'norte', code: 'NORTE', defaultInventoryPoolId: poolB.id } });
    expect(await useCases.list(actor)).toHaveLength(1);
  });
  it('rejects cross-tenant memberships at application and database levels', async () => {
    const useCases = new BranchUseCases(prisma);
    const branch = (await useCases.list(actor))[0]!;
    await expect(useCases.replaceMembers(actor, branch.id, [userB.id], [])).rejects.toThrow('no pertenecen');
    await expect(prisma.branchMembership.create({ data: { tenantId: tenantA, branchId: branch.id, userId: userB.id } })).rejects.toThrow(/tenant boundary/i);
  });
  it('enables RLS policies for branches and memberships', async () => {
    const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_policies WHERE schemaname='public' AND tablename IN ('Branch','BranchMembership') ORDER BY tablename`;
    expect(rows.map((row) => row.tablename)).toEqual(['Branch', 'BranchMembership']);
  });
});
