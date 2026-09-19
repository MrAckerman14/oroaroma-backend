import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { UserUseCases } from '../../../application/users/UserUseCases.js';
import {
  changePasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  updateMeSchema
} from '../schemas/authSchemas.js';
import { canonicalRoleKey } from '../../../shared/utils/roleKeys.js';
import { roleLabels } from '../../../shared/utils/spanishLabels.js';
import type { AuthenticatedUser } from '../../../types/rbac.js';
import type { AuthSession } from '../../../types/auth.js';
import { UnauthorizedError } from '../../../shared/errors/AppError.js';
import { enterTenantDatabaseContext } from '../../../infrastructure/database/prisma.js';
import { env } from '../../../config/env.js';

const refreshCookieName = 'refresh_token';

export async function authRoutes(app: FastifyInstance) {
  const users = new UserUseCases(app.container.prisma, app.container.passwordHasher);

  app.post('/auth/login', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const tenantId = await app.container.users.resolveTenantIdByEmail(input.email) ?? '__invalid_tenant__';
    enterTenantDatabaseContext(tenantId);
    const session = await app.container.auth.login.execute(input, {
      tenantId,
      ...(request.headers['user-agent'] ? { userAgent: request.headers['user-agent'] } : {}),
      ipAddress: request.ip
    });

    setRefreshCookie(reply, session.refreshToken);
    return reply.send(publicSession(session));
  });

  app.post('/auth/register', { config: { rateLimit: { max: 3, timeWindow: '1 hour' } } }, async (request, reply) => {
    const input = registerSchema.parse(request.body);
    enterTenantDatabaseContext('default');

    const user = await users.create('default', {
      name: input.name,
      email: input.email,
      password: input.password,
      phone: input.phone,
      profileImagePath: input.profileImagePath,
      status: 'INACTIVE',
      scope: 'GLOBAL'
    });

    return reply.status(201).send({
      data: user,
      message: 'Cuenta registrada. Un administrador debe activarla y asignar un rol.'
    });
  });

  app.post('/auth/refresh', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const refreshToken = refreshTokenFrom(request);
    const session = await app.container.auth.login.refresh(refreshToken);
    setRefreshCookie(reply, session.refreshToken);
    return publicSession(session);
  });

  app.post('/auth/logout', async (request, reply) => {
    const refreshToken = refreshTokenFrom(request);
    await app.container.auth.login.logout(refreshToken);
    reply.clearCookie(refreshCookieName, refreshCookieOptions());
    return reply.status(204).send();
  });

  app.get('/auth/me', { preHandler: [app.authenticate] }, async (request) => ({
    user: publicAuthUser(request.authUser!)
  }));

  app.put('/auth/me', { preHandler: [app.authenticate] }, async (request) => {
    const input = updateMeSchema.parse(request.body);
    return { data: await users.update(request.authUser!.id, request.authUser!, input) };
  });

  app.delete('/auth/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    await users.softDelete(request.authUser!.id, request.authUser!);
    return reply.status(204).send();
  });

  app.put('/auth/me/password', { preHandler: [app.authenticate] }, async (request, reply) => {
    const input = changePasswordSchema.parse(request.body);
    await users.changePassword(request.authUser!.id, input.currentPassword, input.newPassword);
    return reply.status(204).send();
  });
}

export function publicSession(session: AuthSession) {
  return {
    accessToken: session.accessToken,
    user: publicAuthUser(session.user)
  };
}

function refreshTokenFrom(request: FastifyRequest) {
  const input = refreshTokenSchema.parse(request.body ?? {});
  const refreshToken = request.cookies[refreshCookieName] ?? input.refreshToken;
  if (!refreshToken) throw new UnauthorizedError('Sesión de actualización no encontrada');
  return refreshToken;
}

function setRefreshCookie(reply: FastifyReply, refreshToken: string) {
  reply.setCookie(refreshCookieName, refreshToken, refreshCookieOptions());
}

export function refreshCookieOptions() {
  return {
    path: '/auth',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' as const : 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60
  };
}

function publicAuthUser(user: AuthenticatedUser) {
  const roleNames = user.roles
    .map((role) => roleLabels[canonicalRoleKey(role.roleKey)])
    .filter(Boolean);
  const primaryRole = roleNames[0] ?? null;

  return {
    id: user.id,
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug,
    tenantName: user.tenantName,
    isPlatformAdmin: (user.platformPermissions?.length ?? 0) > 0,
    platformPermissions: user.platformPermissions ?? [],
    enabledModules: user.enabledModules ?? [],
    email: user.email,
    name: user.name,
    status: user.status,
    statusLabel: user.statusLabel,
    role: primaryRole,
    roleName: primaryRole,
    roleLabel: primaryRole,
    roleDisplayName: primaryRole,
    roles: user.roles,
    permissions: user.permissions,
    branches: user.branches ?? []
  };
}
