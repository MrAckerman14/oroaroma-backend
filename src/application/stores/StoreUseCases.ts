import type { Prisma, PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationAppError } from '../../shared/errors/AppError.js';
import { buildCreatedAtFilter, parseDateRange } from '../../shared/utils/dateRange.js';
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

export interface StoreListOptions {
  includeDeleted?: boolean | undefined;
  includeSensitivePrices?: boolean | undefined;
  from?: string | undefined;
  to?: string | undefined;
  minStock?: number | undefined;
  maxStock?: number | undefined;
}

export class StoreUseCases {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage?: StorageService
  ) {}

  async list(pagination: PaginationInput, options: StoreListOptions = {}) {
    const stockFilter = this.stockFilter(options);
    const where: Prisma.StoreWhereInput = {
      ...(options.includeDeleted ? {} : { deletedAt: null }),
      ...(stockFilter ? { stock: stockFilter } : {})
    };

    const stores = await this.prisma.store.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    const soldQuantities = await this.soldQuantitiesForStores(
      stores.map((store) => store.id),
      options
    );

    const enriched = stores
      .map((store) => ({
        ...store,
        quantitySold: soldQuantities.get(store.id) ?? 0,
        soldQuantity: soldQuantities.get(store.id) ?? 0,
        totalSold: soldQuantities.get(store.id) ?? 0,
        soldCount: soldQuantities.get(store.id) ?? 0
      }))
      .sort((a, b) => {
        if (b.quantitySold !== a.quantitySold) return b.quantitySold - a.quantitySold;
        return a.name.localeCompare(b.name);
      });

    const start = (pagination.page - 1) * pagination.pageSize;
    const items = enriched.slice(start, start + pagination.pageSize);

    return this.paginated(
      items.map((item) => this.presentStore(item, options.includeSensitivePrices === true)),
      enriched.length,
      pagination
    );
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

  async findById(id: string, includeSensitivePrices = false) {
    const store = await this.findActive(id);
    return this.presentStore(store, includeSensitivePrices);
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

  async imageDownload(id: string) {
    const store = await this.findActive(id);
    if (!store.imagePath) {
      throw new NotFoundError('Este producto no tiene imagen');
    }

    return {
      id: store.id,
      name: store.name,
      imagePath: store.imagePath
    };
  }

  async listImages() {
    return this.prisma.store.findMany({
      where: {
        deletedAt: null,
        imagePath: { not: null }
      },
      select: {
        id: true,
        name: true,
        imagePath: true
      },
      orderBy: { name: 'asc' }
    });
  }

  private async findActive(id: string) {
    const store = await this.prisma.store.findFirst({ where: { id, deletedAt: null } });
    if (!store) throw new NotFoundError('Producto no encontrado');
    return store;
  }

  private presentStore<T extends {
    id: string;
    name: string;
    description: string | null;
    stock: number;
    imagePath: string | null;
    quantitySold?: number;
    soldQuantity?: number;
    totalSold?: number;
    soldCount?: number;
    purchasePrice?: Prisma.Decimal;
    salePrice?: Prisma.Decimal;
    createdAt?: Date;
    updatedAt?: Date;
    deletedAt?: Date | null;
  }>(store: T, includeSensitivePrices: boolean) {
    if (includeSensitivePrices) {
      return store;
    }

    return {
      id: store.id,
      name: store.name,
      description: store.description,
      stock: store.stock,
      imagePath: store.imagePath,
      quantitySold: store.quantitySold ?? 0,
      soldQuantity: store.soldQuantity ?? store.quantitySold ?? 0,
      totalSold: store.totalSold ?? store.quantitySold ?? 0,
      soldCount: store.soldCount ?? store.quantitySold ?? 0
    };
  }

  private stockFilter(options: StoreListOptions) {
    if (options.minStock === undefined && options.maxStock === undefined) return undefined;

    return {
      ...(options.minStock !== undefined ? { gte: options.minStock } : {}),
      ...(options.maxStock !== undefined ? { lte: options.maxStock } : {})
    } satisfies Prisma.IntFilter;
  }

  private async soldQuantitiesForStores(storeIds: string[], options: StoreListOptions) {
    const quantities = new Map<string, number>();
    if (!storeIds.length) return quantities;

    const range = this.soldRange(options);
    const createdAt = buildCreatedAtFilter(range);
    const finalizedAtWhere = createdAt ? { finalizedAt: createdAt } : {};
    const grouped = await this.prisma.saleDetail.groupBy({
      by: ['storeId'],
      where: {
        storeId: { in: storeIds },
        sale: {
          status: 'FINALIZED',
          deletedAt: null,
          OR: [
            finalizedAtWhere,
            {
              finalizedAt: null,
              ...(createdAt ? { createdAt } : {})
            }
          ]
        }
      },
      _sum: {
        quantity: true
      }
    });

    for (const row of grouped) {
      quantities.set(row.storeId, row._sum?.quantity ?? 0);
    }

    return quantities;
  }

  private soldRange(options: StoreListOptions) {
    const range = parseDateRange({ from: options.from, to: options.to });
    if (range.from || range.to) return range;

    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 7);
    return { from, to };
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
