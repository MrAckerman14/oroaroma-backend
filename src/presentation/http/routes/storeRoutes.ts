import type { FastifyInstance, FastifyRequest } from 'fastify';
import path from 'node:path';
import { ForbiddenError, ValidationAppError } from '../../../shared/errors/AppError.js';
import { StoreUseCases } from '../../../application/stores/StoreUseCases.js';
import type { UploadFileInput } from '../../../application/files/StorageService.js';
import { buildZipArchive, type ZipFileInput } from '../../../shared/utils/zip.js';
import { idParamsSchema } from '../schemas/commonSchemas.js';
import { createStoreSchema, storeListQuerySchema, updateStoreSchema } from '../schemas/storeSchemas.js';

export async function storeRoutes(app: FastifyInstance) {
  const stores = new StoreUseCases(app.container.prisma, app.container.storage);

  app.get(
    '/stores',
    { preHandler: [app.authenticate, app.requireTenantModule('inventory'), canReadStores] },
    async (request) => {
      const query = storeListQuerySchema.parse(request.query);
      if (query.includeExcluded === true && !hasStoreCapability(request.authUser!, 'restore')) {
        throw new ForbiddenError('Permiso requerido para consultar productos ocultos');
      }
      return {
        data: await stores.list(request.authUser!.tenantId, request.branchId, query, {
          includeSensitivePrices: hasStoreCapability(request.authUser!, 'update'),
          from: query.from,
          to: query.to,
          minStock: query.minStock,
          maxStock: query.maxStock,
          search: query.search,
          includeExcluded: query.includeExcluded === true
        })
      };
    }
  );

  app.post(
    '/stores',
    { preHandler: [app.authenticate, app.authorize('stores', 'create')] },
    async (request, reply) => {
      const { input, image } = await parseCreateStoreRequest(request);
      const tenantId = request.authUser!.tenantId;
      const store = image
        ? await stores.createWithImage(tenantId, request.branchId, input, image)
        : await stores.create(tenantId, request.branchId, input);
      return reply.status(201).send({ data: store });
    }
  );

  app.get(
    '/stores/images/download',
    { preHandler: [app.authenticate, app.requireTenantModule('inventory'), canReadStores] },
    async (request, reply) => {
      const query = storeListQuerySchema.parse(request.query);
      const images = await stores.listImages(request.authUser!.tenantId, request.branchId, {
        from: query.from,
        to: query.to,
        minStock: query.minStock,
        maxStock: query.maxStock,
        search: query.search
      });
      const files: ZipFileInput[] = [];

      for (const image of images) {
        if (!image.imagePath) continue;
        const file = await app.container.storage.readByPublicPath(image.imagePath);

        files.push({
          name: uniqueZipName(files.map((file) => file.name), image.name, image.imagePath),
          data: file.data,
          modifiedAt: file.modifiedAt
        });
      }

      if (!files.length) {
        throw new ValidationAppError('No hay imagenes de productos para descargar');
      }

      return reply
        .header('Content-Type', 'application/zip')
        .header('Content-Disposition', 'attachment; filename="imagenes-productos.zip"')
        .send(buildZipArchive(files));
    }
  );

  app.get(
    '/stores/:id/image/download',
    { preHandler: [app.authenticate, app.requireTenantModule('inventory'), canReadStores] },
    async (request, reply) => {
      const params = idParamsSchema.parse(request.params);
      const image = await stores.imageDownload(params.id, request.authUser!.tenantId, request.branchId);
      const file = await app.container.storage.readByPublicPath(image.imagePath);
      const filename = downloadFilename(image.name, image.imagePath);

      return reply
        .header('Content-Type', file.mimeType)
        .header('Content-Length', file.size)
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(file.data);
    }
  );

  app.get(
    '/stores/:id',
    { preHandler: [app.authenticate, app.requireTenantModule('inventory'), canReadStores] },
    async (request) => {
      const params = idParamsSchema.parse(request.params);
      return {
        data: await stores.findById(params.id, request.authUser!.tenantId, request.branchId, hasStoreCapability(request.authUser!, 'update'))
      };
    }
  );

  app.put(
    '/stores/:id',
    { preHandler: [app.authenticate, app.authorize('stores', 'update')] },
    async (request) => {
      const params = idParamsSchema.parse(request.params);
      const input = updateStoreSchema.parse(request.body);
      return { data: await stores.update(params.id, request.authUser!.tenantId, request.branchId, input) };
    }
  );

  app.delete(
    '/stores/:id',
    { preHandler: [app.authenticate, app.authorize('stores', 'delete')] },
    async (request, reply) => {
      const params = idParamsSchema.parse(request.params);
      await stores.softDelete(params.id, request.authUser!.tenantId, request.branchId);
      return reply.status(204).send();
    }
  );

  app.post(
    '/stores/:id/restore',
    { preHandler: [app.authenticate, app.authorize('stores', 'restore')] },
    async (request) => {
      const params = idParamsSchema.parse(request.params);
      return { data: await stores.restore(params.id, request.authUser!.tenantId, request.branchId) };
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
      const result = await stores.replaceImage(params.id, request.authUser!.tenantId, request.branchId, {
        buffer,
        originalName: image.filename,
        mimeType: image.mimetype,
        size: buffer.byteLength
      });

      return reply.status(200).send({ data: result });
    }
  );
}

function downloadFilename(name: string, imagePath: string) {
  return `${safeFileName(name)}${path.extname(imagePath) || '.img'}`;
}

function uniqueZipName(existingNames: string[], name: string, imagePath: string) {
  const baseName = safeFileName(name);
  const extension = path.extname(imagePath) || '.img';
  let candidate = `${baseName}${extension}`;
  let index = 2;

  while (existingNames.includes(candidate)) {
    candidate = `${baseName}-${index}${extension}`;
    index += 1;
  }

  return candidate;
}

function safeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'producto';
}

async function canReadStores(request: FastifyRequest) {
  const actor = request.authUser;
  const canReadByPermission = actor?.permissions.some((permission) => {
    return permission.resource === 'stores' && permission.action === 'read';
  }) ?? false;
  if (!canReadByPermission) {
    throw new ForbiddenError('Permiso requerido para leer productos');
  }
}

function hasStoreCapability(actor: NonNullable<FastifyRequest['authUser']>, action: string) {
  return actor.permissions.some((permission) => (
    permission.resource === 'stores'
      && permission.action === action
      && permission.scope === 'global'
  ));
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
