import type { FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { resolveActiveTenant, resolveTenantIdFromRequest } from './tenantResolver.js';

function request(headers: Record<string, string | string[] | undefined>) {
  return { headers } as FastifyRequest;
}

describe('resolveTenantIdFromRequest', () => {
  it('usa el tenant default cuando no llega header', () => {
    expect(resolveTenantIdFromRequest(request({}))).toBe('default');
  });

  it('acepta tenant explicito por header', () => {
    expect(resolveTenantIdFromRequest(request({ 'x-tenant-id': 'tenant-demo' }))).toBe('tenant-demo');
  });

  it('rechaza tenants multiples', () => {
    expect(() => resolveTenantIdFromRequest(request({ 'x-tenant-id': ['a', 'b'] }))).toThrow(
      'Solo debes enviar un tenant por solicitud'
    );
  });

  it('rechaza caracteres no permitidos', () => {
    expect(() => resolveTenantIdFromRequest(request({ 'x-tenant-id': '../otro' }))).toThrow('Tenant invalido');
  });
});

describe('resolveActiveTenant', () => {
  it('resuelve un tenant activo por slug normalizado', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: 'tenant-id',
      slug: 'empresa-demo',
      name: 'Empresa Demo',
      status: 'ACTIVE'
    });
    const prisma = { tenant: { findFirst } } as unknown as PrismaClient;

    await expect(resolveActiveTenant(prisma, request({}), ' Empresa-Demo ')).resolves.toMatchObject({
      id: 'tenant-id',
      slug: 'empresa-demo'
    });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'ACTIVE' })
    }));
  });

  it('no permite iniciar sesion en un tenant inexistente o suspendido', async () => {
    const prisma = {
      tenant: { findFirst: vi.fn().mockResolvedValue(null) }
    } as unknown as PrismaClient;

    await expect(resolveActiveTenant(prisma, request({}), 'suspendido')).rejects.toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED'
    });
  });
});
