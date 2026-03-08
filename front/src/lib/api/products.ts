import { apiRequest } from './client';

export interface Product {
  id: number;
  title: string;
  code: string;
  description: string;
  about: string[];
  isActive: boolean;
  categoryId: number;
  merchantId: number;
  variationType: string;
  details: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductPayload {
  categoryId: number;
}

export interface ProductDetailsPayload {
  title: string;
  code: string;
  variationType: string;
  details: {
    category: string;
    capacity: number;
    capacityUnit: 'GB' | 'TB';
    capacityType: 'SSD' | 'HD';
    brand: string;
    series: string;
  };
  about: string[];
  description: string;
}

export interface ActivateProductResult {
  id: number;
  isActive: boolean;
}

export async function createProduct(payload: CreateProductPayload): Promise<Product> {
  const res = await apiRequest<Product>('/product/create', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function addProductDetails(
  productId: number,
  payload: ProductDetailsPayload,
): Promise<{ id: number }> {
  const res = await apiRequest<{ id: number }>(`/product/${productId}/details`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function activateProduct(productId: number): Promise<ActivateProductResult> {
  const res = await apiRequest<ActivateProductResult>(
    `/product/${productId}/activate`,
    { method: 'POST' },
  );
  return res.data;
}

export async function getProduct(productId: number): Promise<Product> {
  const res = await apiRequest<Product>(`/product/${productId}`);
  return res.data;
}
