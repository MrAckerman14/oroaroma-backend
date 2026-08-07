import type { FastifyInstance, FastifyRequest } from 'fastify';

const adminRoleKeys = new Set(['admin']);
const globallySensitiveKeys = new Set([
  'passwordHash',
  'purchasePrice',
  'purchasePriceFormatted',
  'purchaseUnitPrice',
  'purchaseUnitPriceFormatted',
  'purchase_price',
  'purchase_price_formatted',
  'purchase_unit_price',
  'purchase_unit_price_formatted'
]);

export function registerResponsePrivacyHook(app: FastifyInstance) {
  app.addHook('onSend', async (request, reply, payload) => {
    const contentType = reply.getHeader('content-type');
    if (!String(contentType ?? '').includes('application/json')) return payload;
    if (typeof payload !== 'string' && !Buffer.isBuffer(payload)) return payload;

    const text = Buffer.isBuffer(payload) ? payload.toString('utf8') : payload;
    if (!text) return payload;

    try {
      const parsed = JSON.parse(text) as unknown;
      const sanitized = sanitizeResponse(parsed, request);
      return JSON.stringify(sanitized);
    } catch {
      return payload;
    }
  });
}

export function sanitizeResponse(value: unknown, request: FastifyRequest): unknown {
  const actor = request.authUser;
  const isAdmin = actor?.roles.some((role) => adminRoleKeys.has(role.roleKey)) ?? false;

  if (isAdmin || !actor) return value;

  return sanitizeNonAdminValue(value, {
    keepOwnAuthEmail: request.url.startsWith('/auth/')
  });
}

function sanitizeNonAdminValue(value: unknown, options: { keepOwnAuthEmail: boolean }): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeNonAdminValue(item, options));
  }

  if (!isPlainObject(value)) return value;

  const next: Record<string, unknown> = {};

  for (const [key, entryValue] of Object.entries(value)) {
    if (globallySensitiveKeys.has(key)) continue;
    if (key === 'email' && !options.keepOwnAuthEmail) continue;

    next[key] = sanitizeNonAdminValue(entryValue, options);
  }

  return next;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value)
    && typeof value === 'object'
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
