import type { FastifyInstance } from 'fastify';
import { UserUseCases } from '../../../application/users/UserUseCases.js';
import {
  changePasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  updateMeSchema
} from '../schemas/authSchemas.js';

export async function authRoutes(app: FastifyInstance) {
  const users = new UserUseCases(app.container.prisma, app.container.passwordHasher);

  app.post('/auth/login', async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const session = await app.container.auth.login.execute(input, {
      ...(request.headers['user-agent'] ? { userAgent: request.headers['user-agent'] } : {}),
      ipAddress: request.ip
    });

    return reply.send(session);
  });

  app.post('/auth/register', async (request, reply) => {
    const input = registerSchema.parse(request.body);

    const user = await users.create({
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

  app.post('/auth/refresh', async (request) => {
    const input = refreshTokenSchema.parse(request.body);
    return app.container.auth.login.refresh(input.refreshToken, {
      ...(request.headers['user-agent'] ? { userAgent: request.headers['user-agent'] } : {}),
      ipAddress: request.ip
    });
  });

  app.post('/auth/logout', async (request, reply) => {
    const input = refreshTokenSchema.parse(request.body);
    await app.container.auth.login.logout(input.refreshToken);
    return reply.status(204).send();
  });

  app.get('/auth/me', { preHandler: [app.authenticate] }, async (request) => ({
    user: request.authUser
  }));

  app.put('/auth/me', { preHandler: [app.authenticate] }, async (request) => {
    const input = updateMeSchema.parse(request.body);
    return { data: await users.update(request.authUser!.id, input) };
  });

  app.delete('/auth/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    await users.softDelete(request.authUser!.id);
    return reply.status(204).send();
  });

  app.put('/auth/me/password', { preHandler: [app.authenticate] }, async (request, reply) => {
    const input = changePasswordSchema.parse(request.body);
    await users.changePassword(request.authUser!.id, input.currentPassword, input.newPassword);
    return reply.status(204).send();
  });
}
