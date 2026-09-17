import type { FastifyRequest } from 'fastify';
import { describe, expect, it } from 'vitest';
import { resolveTenantIdFromRequest } from './tenantResolver.js';

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
