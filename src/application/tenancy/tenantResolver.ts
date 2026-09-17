import type { FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { env } from '../../config/env.js';
import { UnauthorizedError, ValidationAppError } from '../../shared/errors/AppError.js';

const tenantIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/;

export function resolveTenantIdFromRequest(request: FastifyRequest) {
  const headerName = env.TENANT_HEADER_NAME.toLowerCase();
  const rawValue = request.headers[headerName];

  if (Array.isArray(rawValue)) {
    throw new ValidationAppError('Solo debes enviar un tenant por solicitud');
  }

  const tenantId = String(rawValue ?? env.DEFAULT_TENANT_ID).trim();

  if (!tenantIdPattern.test(tenantId)) {
    throw new ValidationAppError('Tenant invalido');
  }

  return tenantId;
}

export async function resolveActiveTenant(
  prisma: PrismaClient,
  request: FastifyRequest,
  requestedTenant?: string
) {
  const tenantKey = String(requestedTenant || resolveTenantIdFromRequest(request)).trim().toLowerCase();

  if (!tenantIdPattern.test(tenantKey)) {
    throw new ValidationAppError('Empresa invalida');
  }

  const tenant = await prisma.tenant.findFirst({
    where: {
      status: 'ACTIVE',
      OR: [{ id: tenantKey }, { slug: tenantKey }]
    },
    select: { id: true, slug: true, name: true, status: true }
  });

  if (!tenant) {
    throw new UnauthorizedError('Empresa o credenciales invalidas');
  }

  return tenant;
}
