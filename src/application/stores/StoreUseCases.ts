import type { Prisma, PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationAppError } from '../../shared/errors/AppError.js';
import { buildCreatedAtFilter, parseDateRange } from '../../shared/utils/dateRange.js';
import type { StorageService, StoredFile, UploadFileInput } from '../files/StorageService.js';
import { InventoryStockService } from '../inventory/InventoryStockService.js';

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
  search?: string | undefined;
}

export class StoreUseCases {
  private readonly inventory = new InventoryStockService();
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage?: StorageService
  ) {}

  async list(
    tenantId: string,
    branchIdOrPagination: string | PaginationInput,
    paginationOrOptions: PaginationInput | StoreListOptions = {},
    explicitOptions: StoreListOptions = {}
  ) {
    const branchId = typeof branchIdOrPagination === 'string' ? branchIdOrPagination : undefined;
    const pagination = (typeof branchIdOrPagination === 'string' ? paginationOrOptions : branchIdOrPagination) as PaginationInput;
    const options = (typeof branchIdOrPagination === 'string' ? explicitOptions : paginationOrOptions) as StoreListOptions;
    const stockFilter = this.stockFilter(options);
    const searchFilter = this.searchFilter(options.search);
    const branchVisibility = branchId
      ? await this.branchProductVisibility(tenantId, branchId)
      : undefined;
    const where: Prisma.StoreWhereInput = {
      tenantId,
      ...(options.includeDeleted ? {} : { deletedAt: null }),
      ...(!branchId && stockFilter ? { stock: stockFilter } : {}),
      ...(searchFilter ? searchFilter : {}),
      ...(branchVisibility ? {
        branchExclusions: { none: { tenantId, branchId: branchVisibility.branchId } },
        OR: [
          { inventoryStocks: { some: { poolId: branchVisibility.poolId } } },
          { inventoryOverrides: { some: { branchId: branchVisibility.branchId } } }
        ]
      } : {})
    };

    if (!this.hasExplicitSoldRange(options) && !(branchId && stockFilter)) {
      const [stores, total] = await Promise.all([
        this.prisma.store.findMany({
          where,
          orderBy: { name: 'asc' },
          skip: (pagination.page - 1) * pagination.pageSize,
          take: pagination.pageSize
        }),
        this.prisma.store.count({ where })
      ]);

      const soldQuantities = await this.soldQuantitiesForStores(
        stores.map((store) => store.id),
        options,
        branchId
      );
      const stocks = branchId ? await this.stockByProduct(tenantId, branchId, stores.map((store) => store.id)) : new Map(stores.map((store) => [store.id, store.stock]));

      const items = stores.map((store) => ({
        ...store,
        stock: stocks.get(store.id) ?? 0,
        quantitySold: soldQuantities.get(store.id) ?? 0,
        soldQuantity: soldQuantities.get(store.id) ?? 0,
        totalSold: soldQuantities.get(store.id) ?? 0,
        soldCount: soldQuantities.get(store.id) ?? 0
      }));

      return this.paginated(
        items.map((item) => this.presentStore(item, options.includeSensitivePrices === true)),
        total,
        pagination
      );
    }

    const stores = await this.prisma.store.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    const soldQuantities = await this.soldQuantitiesForStores(
      stores.map((store) => store.id),
      options,
      branchId
    );
    const stocks = branchId ? await this.stockByProduct(tenantId, branchId, stores.map((store) => store.id)) : new Map(stores.map((store) => [store.id, store.stock]));

    const enriched = stores
      .map((store) => ({
        ...store,
        stock: stocks.get(store.id) ?? 0,
        quantitySold: soldQuantities.get(store.id) ?? 0,
        soldQuantity: soldQuantities.get(store.id) ?? 0,
        totalSold: soldQuantities.get(store.id) ?? 0,
        soldCount: soldQuantities.get(store.id) ?? 0
      }))
      .filter((store) => options.minStock === undefined || store.stock >= options.minStock)
      .filter((store) => options.maxStock === undefined || store.stock <= options.maxStock)
      .sort((a, b) => {
        if (this.hasExplicitSoldRange(options) && b.quantitySold !== a.quantitySold) {
          return b.quantitySold - a.quantitySold;
        }

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

  async create(tenantId: string, branchId: string, input: {
    name: string;
    description?: string | undefined;
    purchasePrice: string;
    salePrice: string;
    stock: number;
    imagePath?: string | undefined;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.store.create({ data: {
        tenantId,
        name: input.name,
        description: input.description ?? null,
        purchasePrice: input.purchasePrice,
        salePrice: input.salePrice,
        stock: 0,
        imagePath: input.imagePath ?? null
      }});
      const poolId = await this.inventory.resolvePoolId(tx, tenantId, branchId, product.id);
      await tx.inventoryPoolStock.create({ data: { tenantId, poolId, productId: product.id, stock: input.stock } });
      return { ...product, stock: input.stock };
    });
  }

  async createWithImage(tenantId: string, branchId: string, input: {
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

      return await this.create(tenantId, branchId, {
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

  async findById(id: string, tenantId: string, branchId: string, includeSensitivePrices = false) {
    const store = await this.findActive(id, tenantId);
    await this.assertVisibleInBranch(id, tenantId, branchId);
    const stocks = await this.stockByProduct(tenantId, branchId, [id]);
    return this.presentStore({ ...store, stock: stocks.get(id) ?? 0 }, includeSensitivePrices);
  }

  async update(id: string, tenantId: string, branchId: string, input: StoreInput) {
    await this.findActive(id, tenantId);
    await this.assertVisibleInBranch(id, tenantId, branchId);
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.store.update({ where: { id }, data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.purchasePrice ? { purchasePrice: input.purchasePrice } : {}),
        ...(input.salePrice ? { salePrice: input.salePrice } : {}),
        ...(input.imagePath !== undefined ? { imagePath: input.imagePath } : {})
      }});
      const poolId = await this.inventory.resolvePoolId(tx, tenantId, branchId, id);
      if (input.stock !== undefined) {
        await tx.inventoryPoolStock.upsert({
          where: { poolId_productId: { poolId, productId: id } },
          update: { stock: input.stock }, create: { tenantId, poolId, productId: id, stock: input.stock }
        });
      }
      const balance = await tx.inventoryPoolStock.findUnique({ where: { poolId_productId: { poolId, productId: id } } });
      return { ...product, stock: balance?.stock ?? 0 };
    });
  }

  async softDelete(id: string, tenantId: string, branchId: string) {
    await this.findActive(id, tenantId);
    await this.assertVisibleInBranch(id, tenantId, branchId);
    await this.prisma.branchProductExclusion.upsert({
      where: { branchId_productId: { branchId, productId: id } },
      update: {},
      create: { tenantId, branchId, productId: id }
    });
  }

  async restore(id: string, tenantId: string, branchId: string) {
    const store = await this.prisma.store.findFirst({ where: { id, tenantId } });
    if (!store) throw new NotFoundError('Producto no encontrado');
    await this.prisma.branchProductExclusion.deleteMany({ where: { tenantId, branchId, productId: id } });
    return store;
  }

  async replaceImage(id: string, tenantId: string, branchId: string, file: UploadFileInput) {
    if (!this.storage) {
      throw new ValidationAppError('El almacenamiento de imagenes no esta configurado');
    }

    const store = await this.findActive(id, tenantId);
    await this.assertVisibleInBranch(id, tenantId, branchId);
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

  async imageDownload(id: string, tenantId: string, branchId: string) {
    const store = await this.findActive(id, tenantId);
    await this.assertVisibleInBranch(id, tenantId, branchId);
    if (!store.imagePath) {
      throw new NotFoundError('Este producto no tiene imagen');
    }

    return {
      id: store.id,
      name: store.name,
      imagePath: store.imagePath
    };
  }

  async listImages(tenantId: string, branchId: string, options: StoreListOptions = {}) {
    const result = await this.list(tenantId, branchId, { page: 1, pageSize: 5000 }, options);
    return result.items.filter((store) => Boolean(store.imagePath));
  }

  private async findActive(id: string, tenantId: string) {
    const store = await this.prisma.store.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!store) throw new NotFoundError('Producto no encontrado');
    return store;
  }

  private async branchProductVisibility(tenantId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId, status: 'ACTIVE' },
      select: { defaultInventoryPoolId: true }
    });
    if (!branch?.defaultInventoryPoolId) throw new ValidationAppError('La sucursal no tiene inventario configurado');
    return { branchId, poolId: branch.defaultInventoryPoolId };
  }

  private async assertVisibleInBranch(productId: string, tenantId: string, branchId: string) {
    const excluded = await this.prisma.branchProductExclusion.findFirst({
      where: { tenantId, branchId, productId }, select: { id: true }
    });
    if (excluded) throw new NotFoundError('Producto no encontrado en la sucursal activa');
    const visibility = await this.branchProductVisibility(tenantId, branchId);
    const stock = await this.prisma.inventoryPoolStock.findFirst({
      where: {
        tenantId,
        productId,
        OR: [
          { poolId: visibility.poolId },
          { product: { inventoryOverrides: { some: { branchId: visibility.branchId } } } }
        ]
      },
      select: { id: true }
    });
    if (!stock) throw new NotFoundError('Producto no encontrado en la sucursal activa');
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
      salePrice: store.salePrice,
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

  private searchFilter(search?: string) {
    const value = search?.trim();
    if (!value) return undefined;

    return {
      OR: [
        { name: { contains: value, mode: 'insensitive' } },
        { description: { contains: value, mode: 'insensitive' } }
      ]
    } satisfies Prisma.StoreWhereInput;
  }

  private async soldQuantitiesForStores(storeIds: string[], options: StoreListOptions, branchId?: string) {
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
          ...(branchId ? { branchId } : {}),
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

  private async stockByProduct(tenantId: string, branchId: string, productIds: string[]) {
    const result = new Map<string, number>();
    if (!productIds.length) return result;
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId }, select: { defaultInventoryPoolId: true }
    });
    if (!branch) throw new ValidationAppError('La sucursal seleccionada no está disponible');
    const overrides = await this.prisma.branchInventoryProductOverride.findMany({
      where: { tenantId, branchId, productId: { in: productIds } }, select: { productId: true, poolId: true }
    });
    const poolByProduct = new Map(overrides.map((override) => [override.productId, override.poolId]));
    const stocks = await this.prisma.inventoryPoolStock.findMany({
      where: { tenantId, productId: { in: productIds } }, select: { productId: true, poolId: true, stock: true }
    });
    for (const stock of stocks) {
      if (stock.poolId === (poolByProduct.get(stock.productId) ?? branch.defaultInventoryPoolId)) {
        result.set(stock.productId, stock.stock);
      }
    }
    return result;
  }

  private soldRange(options: StoreListOptions) {
    const range = parseDateRange({ from: options.from, to: options.to });
    if (range.from || range.to) return range;

    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 7);
    return { from, to };
  }

  private hasExplicitSoldRange(options: StoreListOptions) {
    return Boolean(options.from || options.to);
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
