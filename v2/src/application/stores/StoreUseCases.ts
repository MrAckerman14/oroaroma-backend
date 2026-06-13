import type { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationAppError } from '../../shared/errors/AppError.js';
import type { StorageService, StoredFile, UploadFileInput } from '../files/StorageService.js';

export interface StoreInput {
  name?: string | undefined;
  description?: string | null | undefined;
  purchasePrice?: string | undefined;
  salePrice?: string | undefined;
  stock?: number | undefined;
  imagePath?: string | undefined;
}

export interface PaginationInput {
  page: number;
  pageSize: number;
}

export class StoreUseCases {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage?: StorageService
  ) {}

  async list(pagination: PaginationInput, includeDeleted = false) {
    const where = includeDeleted ? {} : { deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.store.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize
      }),
      this.prisma.store.count({ where })
    ]);

    return this.paginated(items, total, pagination);
  }

  async create(input: {
    name: string;
    description?: string | undefined;
    purchasePrice: string;
    salePrice: string;
    stock: number;
    imagePath?: string | undefined;
  }) {
    return this.prisma.store.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        purchasePrice: input.purchasePrice,
        salePrice: input.salePrice,
        stock: input.stock,
        imagePath: input.imagePath ?? null
      }
    });
  }

  async createWithImage(input: {
    name: string;
    description?: string | undefined;
    purchasePrice: string;
    salePrice: string;
    stock: number;
  }, file?: UploadFileInput) {
    let savedFile: StoredFile | undefined;

    try {
      if (file) {
        if (!this.storage) {
          throw new ValidationAppError('El almacenamiento de imagenes no esta configurado');
        }
        savedFile = await this.storage.saveProductImage(file);
      }

      return await this.create({
        ...input,
        ...(savedFile ? { imagePath: savedFile.publicPath } : {})
      });
    } catch (error) {
      if (savedFile && this.storage) {
        await this.storage.deleteByPublicPath(savedFile.publicPath).catch(() => undefined);
      }

      throw error;
    }
  }

  async findById(id: string) {
    return this.findActive(id);
  }

  async update(id: string, input: StoreInput) {
    await this.findActive(id);

    return this.prisma.store.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.purchasePrice ? { purchasePrice: input.purchasePrice } : {}),
        ...(input.salePrice ? { salePrice: input.salePrice } : {}),
        ...(input.stock !== undefined ? { stock: input.stock } : {}),
        ...(input.imagePath !== undefined ? { imagePath: input.imagePath } : {})
      }
    });
  }

  async softDelete(id: string) {
    await this.findActive(id);
    await this.prisma.store.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }

  async restore(id: string) {
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) throw new NotFoundError('Producto no encontrado');

    return this.prisma.store.update({
      where: { id },
      data: { deletedAt: null }
    });
  }

  async replaceImage(id: string, file: UploadFileInput) {
    if (!this.storage) {
      throw new ValidationAppError('El almacenamiento de imagenes no esta configurado');
    }

    const store = await this.findActive(id);
    const savedFile = await this.storage.saveProductImage(file);

    const updatedStore = await this.prisma.store.update({
      where: { id },
      data: { imagePath: savedFile.publicPath }
    });

    if (store.imagePath) {
      await this.storage.deleteByPublicPath(store.imagePath);
    }

    return {
      store: updatedStore,
      file: savedFile
    };
  }

  private async findActive(id: string) {
    const store = await this.prisma.store.findFirst({ where: { id, deletedAt: null } });
    if (!store) throw new NotFoundError('Producto no encontrado');
    return store;
  }

  private paginated<T>(items: T[], total: number, pagination: PaginationInput) {
    return {
      items,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
        totalPages: Math.ceil(total / pagination.pageSize)
      }
    };
  }
}
