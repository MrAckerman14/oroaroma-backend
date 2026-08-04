import type { Prisma } from '@prisma/client';
import { labelFromMap, paymentMethodLabels, saleStatusLabels } from '../../shared/utils/spanishLabels.js';

type SaleDetailWithStore = {
  id: string;
  storeId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  store: {
    id: string;
    name: string;
    description: string | null;
    imagePath: string | null;
  };
};

type SaleWithDetails<TDetail extends SaleDetailWithStore = SaleDetailWithStore> = {
  details: TDetail[];
};

export function presentSale<TSale extends SaleWithDetails>(sale: TSale) {
  return {
    ...sale,
    statusLabel: labelFromMap(saleStatusLabels, 'status' in sale && typeof sale.status === 'string' ? sale.status : null),
    paymentMethodLabel: labelFromMap(
      paymentMethodLabels,
      'paymentMethod' in sale && typeof sale.paymentMethod === 'string' ? sale.paymentMethod : null
    ),
    details: sale.details.map((detail) => ({
      id: detail.id,
      storeId: detail.storeId,
      quantity: detail.quantity,
      unitPrice: detail.unitPrice,
      productId: detail.store.id,
      productName: detail.store.name,
      productDescription: detail.store.description,
      productImagePath: detail.store.imagePath,
      salePrice: detail.unitPrice,
      quantitySold: detail.quantity,
      subtotal: detail.unitPrice.mul(detail.quantity)
    }))
  };
}
