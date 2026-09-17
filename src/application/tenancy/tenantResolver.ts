import type { FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { ValidationAppError } from '../../shared/errors/AppError.js';

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
