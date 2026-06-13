import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ForbiddenError, ValidationAppError } from '../../../shared/errors/AppError.js';
import { StoreUseCases } from '../../../application/stores/StoreUseCases.js';
import type { UploadFileInput } from '../../../application/files/StorageService.js';
import { idParamsSchema, paginationQuerySchema } from '../schemas/commonSchemas.js';
import { createStoreSchema, updateStoreSchema } from '../schemas/storeSchemas.js';

export async function storeRoutes(app: FastifyInstance) {
  const stores = new StoreUseCases(app.container.prisma, app.container.storage);

  app.get(
    '/stores',
    { preHandler: [app.authenticate, canReadStores] },
    async (request) => {
      const query = paginationQuerySchema.parse(request.query);
      return { data: await stores.list(query) };
    }
  );

  app.post(
    '/stores',
    { preHandler: [app.authenticate, app.authorize('stores', 'create')] },
    async (request, reply) => {
      const { input, image } = await parseCreateStoreRequest(request);
      const store = image ? await stores.createWithImage(input, image) : await stores.create(input);
      return reply.status(201).send({ data: store });
    }
  );

  app.get(
    '/stores/:id',
    { preHandler: [app.authenticate, canReadStores] },
    async (request) => {
      const params = idParamsSchema.parse(request.params);
      return { data: await stores.findById(params.id) };
    }
  );

  app.put(
    '/stores/:id',
    { preHandler: [app.authenticate, app.authorize('stores', 'update')] },
    async (request) => {
      const params = idParamsSchema.parse(request.params);
      const input = updateStoreSchema.parse(request.body);
      return { data: await stores.update(params.id, input) };
    }
  );

  app.delete(
    '/stores/:id',
    { preHandler: [app.authenticate, app.authorize('stores', 'delete')] },
    async (request, reply) => {
      const params = idParamsSchema.parse(request.params);
      await stores.softDelete(params.id);
      return reply.status(204).send();
    }
  );

  app.post(
    '/stores/:id/restore',
    { preHandler: [app.authenticate, app.authorize('stores', 'restore')] },
    async (request) => {
      const params = idParamsSchema.parse(request.params);
      return { data: await stores.restore(params.id) };
    }
  );

  app.post(
    '/stores/:id/image',
    { preHandler: [app.authenticate, app.authorize('stores', 'update')] },
    async (request, reply) => {
      const params = idParamsSchema.parse(request.params);
      const image = await request.file();

      if (!image) {
        throw new ValidationAppError('Debes enviar una imagen en el campo image');
      }

      if (image.fieldname !== 'image') {
        throw new ValidationAppError('El campo de archivo debe llamarse image');
      }

      const buffer = await image.toBuffer();
      const result = await stores.replaceImage(params.id, {
        buffer,
        originalName: image.filename,
        mimeType: image.mimetype,
        size: buffer.byteLength
      });

      return reply.status(200).send({ data: result });
    }
  );
}

async function canReadStores(request: FastifyRequest) {
  const actor = request.authUser;
  const readableRoles = new Set(['admin', 'administrator', 'administrador', 'employee', 'empleado', 'colaborador', 'seller', 'vendedor']);
  const roleKeys = actor?.roles.map((role) => role.roleKey.toLowerCase()) ?? [];
  const canReadByPermission = actor?.permissions.some((permission) => {
    return permission.resource === 'stores' && permission.action === 'read';
  }) ?? false;
  let canReadByRole = roleKeys.some((role) => readableRoles.has(role));

  if (!canReadByRole && actor?.id) {
    const activeAssignments = await request.server.container.prisma.userRoleAssignment.findMany({
      where: {
        userId: actor.id,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      },
      select: {
        role: {
          select: {
            key: true,
            name: true
          }
        }
      }
    });

    canReadByRole = activeAssignments.some((assignment) => {
      return readableRoles.has(assignment.role.key.toLowerCase())
        || readableRoles.has(assignment.role.name.toLowerCase());
    });
  }

  if (!canReadByPermission && !canReadByRole) {
    throw new ForbiddenError('Permiso requerido para leer productos');
  }
}

async function parseCreateStoreRequest(request: FastifyRequest) {
  if (!request.isMultipart()) {
    return {
      input: createStoreSchema.parse(request.body),
      image: undefined
    };
  }

  const fields: Record<string, unknown> = {};
  let image: UploadFileInput | undefined;

  for await (const part of request.parts()) {
    if (part.type === 'file') {
      if (part.fieldname !== 'image') {
        throw new ValidationAppError('El campo de archivo debe llamarse image');
      }

      const buffer = await part.toBuffer();
      image = {
        buffer,
        originalName: part.filename,
        mimeType: part.mimetype,
        size: buffer.byteLength
      };
      continue;
    }

    fields[part.fieldname] = part.value;
  }

  return {
    input: createStoreSchema.parse({
      ...fields,
      stock: fields.stock === undefined ? undefined : Number(fields.stock)
    }),
    image
  };
}
