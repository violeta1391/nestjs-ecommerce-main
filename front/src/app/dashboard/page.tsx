'use client';

import { useEffect, useState } from 'react';
import { listProducts, Product } from '@/lib/api/products';

const CATEGORY_NAMES: Record<number, string> = { 1: 'Computadoras', 2: 'Moda' };

export default function DashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listProducts()
      .then((all) => setProducts(all.filter((p) => p.isActive)))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Productos activos</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Catálogo de productos disponibles en la tienda
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#c1292e] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="text-sm text-[#c1292e] bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {!loading && !error && products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="text-5xl mb-4">📦</span>
          <p className="text-gray-500 font-medium">No hay productos activos</p>
          <p className="text-sm text-gray-400 mt-1">
            Los administradores pueden activar productos desde Inventario
          </p>
        </div>
      )}

      {!loading && products.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
          ✓ Activo
        </span>
        <span className="text-xs text-gray-400 font-mono">#{product.id}</span>
      </div>

      <h3 className="font-semibold text-gray-900 truncate">
        {product.title || <span className="text-gray-400 italic">Sin título</span>}
      </h3>

      {product.code && (
        <p className="text-xs text-gray-500 font-mono mt-0.5">{product.code}</p>
      )}

      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
        <span>{CATEGORY_NAMES[product.categoryId] ?? `Cat. ${product.categoryId}`}</span>
        {product.details && Boolean((product.details as Record<string, unknown>).brand) && (
          <span>{String((product.details as Record<string, unknown>).brand)}</span>
        )}
      </div>

      {product.description && (
        <p className="mt-2 text-xs text-gray-500 line-clamp-2">{product.description}</p>
      )}
    </div>
  );
}
