export interface CreateSaleItemInput {
  productId: string;
  quantity: number;
}

export interface CreateSaleInput {
  employeeId?: string | undefined;
  messengerId?: string | undefined;
  sellerId?: string | undefined;
  amount: string;
  amountCash: string;
  amountTransfer: string;
  deliveryPay: string;
  phone?: string | undefined;
  description?: string | undefined;
  locationUrl?: string | undefined;
  items: CreateSaleItemInput[];
}
