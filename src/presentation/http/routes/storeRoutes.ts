import type { FastifyInstance, FastifyRequest } from 'fastify';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { ForbiddenError, ValidationAppError } from '../../../shared/errors/AppError.js';
import { StoreUseCases } from '../../../application/stores/StoreUseCases.js';
import type { UploadFileInput } from '../../../application/files/StorageService.js';
import { normalizedUploadPublicBasePath } from '../../../config/env.js';
import { resolveUploadRoot } from '../../../infrastructure/storage/storageFactory.js';
import { buildZipArchive, type ZipFileInput } from '../../../shared/utils/zip.js';
import { canonicalRoleKey, hasRoleKey } from '../../../shared/utils/roleKeys.js';
import { idParamsSchema } from '../schemas/commonSchemas.js';
import { createStoreSchema, storeListQuerySchema, updateStoreSchema } from '../schemas/storeSchemas.js';

export async function storeRoutes(app: FastifyInstance) {
  const stores = new StoreUseCases(app.container.prisma, app.container.storage);

  app.get(
    '/stores',
    { preHandler: [app.authenticate, canReadStores] },
    async (request) => {
      const query = storeListQuerySchema.parse(request.query);
      return {
        data: await stores.list(query, {
          includeSensitivePrices: canReadSensitiveStorePrices(request.authUser!),
          from: query.from,
          to: query.to,
          minStock: query.minStock,
          maxStock: query.maxStock,
          search: query.search
        })
      };
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
    '/stores/images/download',
    { preHandler: [app.authenticate, canReadStores] },
    async (_request, reply) => {
      const images = await stores.listImages();
      const files: ZipFileInput[] = [];

      for (const image of images) {
        if (!image.imagePath) continue;
        const absolutePath = publicUploadPathToAbsolutePath(image.imagePath);
        const { data, metadata } = await readLocalUploadFile(absolutePath);

        files.push({
          name: uniqueZipName(files.map((file) => file.name), image.name, image.imagePath),
          data,
          modifiedAt: metadata.mtime
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
    { preHandler: [app.authenticate, canReadStores] },
    async (request, reply) => {
      const params = idParamsSchema.parse(request.params);
      const image = await stores.imageDownload(params.id);
      const absolutePath = publicUploadPathToAbsolutePath(image.imagePath);
      const { data, metadata } = await readLocalUploadFile(absolutePath);
      const filename = downloadFilename(image.name, image.imagePath);

      return reply
        .header('Content-Type', contentTypeFromPath(image.imagePath))
        .header('Content-Length', metadata.size)
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(data);
    }
  );

  app.get(
    '/stores/:id',
    { preHandler: [app.authenticate, canReadStores] },
    async (request) => {
      const params = idParamsSchema.parse(request.params);
      return {
        data: await stores.findById(params.id, canReadSensitiveStorePrices(request.authUser!))
      };
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

function publicUploadPathToAbsolutePath(publicPath: string) {
  if (!publicPath.startsWith(`${normalizedUploadPublicBasePath}/`)) {
    throw new ValidationAppError('La ruta de la imagen no pertenece al almacenamiento local');
  }

  const relativePath = publicPath.slice(`${normalizedUploadPublicBasePath}/`.length);
  const uploadRoot = path.resolve(resolveUploadRoot());
  const absolutePath = path.resolve(uploadRoot, relativePath);

  if (!absolutePath.startsWith(`${uploadRoot}${path.sep}`) && absolutePath !== uploadRoot) {
    throw new ValidationAppError('La ruta de la imagen no es valida');
  }

  return absolutePath;
}

async function readLocalUploadFile(absolutePath: string) {
  try {
    const [data, metadata] = await Promise.all([
      readFile(absolutePath),
      stat(absolutePath)
    ]);
    return { data, metadata };
  } catch {
    throw new ValidationAppError('La imagen no esta disponible en el almacenamiento');
  }
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

function contentTypeFromPath(imagePath: string) {
  const extension = path.extname(imagePath).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.avif') return 'image/avif';
  return 'application/octet-stream';
}

async function canReadStores(request: FastifyRequest) {
  const actor = request.authUser;
  const readableRoles = new Set([
    'admin',
    'administrator',
    'administrador',
    'employee',
    'empleado',
    'collaborator',
    'colaborador',
    'supervisor',
    'vendedor'
  ]);
  const roleKeys = actor?.roles.map((role) => canonicalRoleKey(role.roleKey)) ?? [];
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
      return readableRoles.has(canonicalRoleKey(assignment.role.key))
        || readableRoles.has(assignment.role.name.toLowerCase());
    });
  }

  if (!canReadByPermission && !canReadByRole) {
    throw new ForbiddenError('Permiso requerido para leer productos');
  }
}

function canReadSensitiveStorePrices(actor: NonNullable<FastifyRequest['authUser']>) {
  return actor.roles.some((role) => hasRoleKey(role.roleKey, ['admin']));
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
