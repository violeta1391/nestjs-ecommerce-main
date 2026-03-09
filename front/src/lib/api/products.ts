import { apiRequest } from './client';

export interface ColorOption {
  name: string;
  hexCode: string;
}

export interface SizeOption {
  code: string;
}

export interface CountryOption {
  code: string;
  name: string;
}

export interface CurrencyOption {
  code: string;
  name: string;
}

export interface VariationDraft {
  colorName: string;
  sizeCode: string;
  countryCode: string;
  quantity: number;
  currencyCode: string;
  price: number;
}

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

export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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

export async function listProducts(page = 1, limit = 10, activeOnly = false): Promise<PaginatedProducts> {
  const url = `/product?page=${page}&limit=${limit}${activeOnly ? '&activeOnly=true' : ''}`;
  const res = await apiRequest<PaginatedProducts>(url);
  return res.data;
}

export async function getProduct(productId: number): Promise<Product> {
  const res = await apiRequest<Product>(`/product/${productId}`);
  return res.data;
}

export async function deactivateProduct(productId: number): Promise<ActivateProductResult> {
  const res = await apiRequest<ActivateProductResult>(
    `/product/${productId}/deactivate`,
    { method: 'POST' },
  );
  return res.data;
}

export async function deleteProduct(productId: number): Promise<void> {
  await apiRequest<{ message: string }>(`/product/${productId}`, {
    method: 'DELETE',
  });
}

export async function listColors(): Promise<ColorOption[]> {
  const res = await apiRequest<ColorOption[]>('/product/colors');
  return res.data;
}

export async function listSizes(): Promise<SizeOption[]> {
  const res = await apiRequest<SizeOption[]>('/product/sizes');
  return res.data;
}

export async function createVariation(
  productId: number,
  payload: { colorName: string; sizeCode: string },
): Promise<{ id: number }> {
  const res = await apiRequest<{ id: number }>(`/product/${productId}/variations`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function listCountries(): Promise<CountryOption[]> {
  const res = await apiRequest<CountryOption[]>('/product/countries');
  return res.data;
}

export async function listCurrencies(): Promise<CurrencyOption[]> {
  const res = await apiRequest<CurrencyOption[]>('/product/currencies');
  return res.data;
}

export async function createVariationInventory(
  productId: number,
  variationId: number,
  payload: { countryCode: string; quantity: number },
): Promise<{ id: number }> {
  const res = await apiRequest<{ id: number }>(
    `/product/${productId}/variations/${variationId}/inventory`,
    { method: 'POST', body: JSON.stringify(payload) },
  );
  return res.data;
}

export async function createVariationPrice(
  productId: number,
  variationId: number,
  payload: { countryCode: string; currencyCode: string; price: number },
): Promise<{ id: number }> {
  const res = await apiRequest<{ id: number }>(
    `/product/${productId}/variations/${variationId}/prices`,
    { method: 'POST', body: JSON.stringify(payload) },
  );
  return res.data;
}
