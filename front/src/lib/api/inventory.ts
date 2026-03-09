import { apiRequest } from './client';

export interface InventoryRecord {
  id: number;
  productVariationId: number;
  countryCode: string;
  quantity: number;
  variation: {
    sizeCode: string;
    colorName: string;
  };
}

export async function getProductInventory(
  productId: number,
): Promise<InventoryRecord[]> {
  const res = await apiRequest<InventoryRecord[]>(
    `/inventory/product/${productId}`,
  );
  return res.data;
}
