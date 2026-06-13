import type { Prisma } from '@prisma/client';
import { labelFromMap, paymentMethodLabels, saleStatusLabels } from '../../shared/utils/spanishLabels.js';

type SaleDetailWithStore = {
  quantity: number;
  unitPrice: Prisma.Decimal;
  store: {
    id: string;
    name: string;
    description: string | null;
    salePrice: Prisma.Decimal;
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
      ...detail,
      productId: detail.store.id,
      productName: detail.store.name,
      productDescription: detail.store.description,
      salePrice: detail.store.salePrice,
      quantitySold: detail.quantity,
      subtotal: detail.unitPrice.mul(detail.quantity)
    }))
  };
}
