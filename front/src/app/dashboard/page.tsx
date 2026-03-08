'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { listProducts, Product } from '@/lib/api/products';
import { useProductsContext } from '@/lib/context/ProductsContext';

const CATEGORY_NAMES: Record<number, string> = { 1: 'Computadoras', 2: 'Moda' };
const LIMIT = 6;

export default function DashboardPage() {
  const { refreshKey } = useProductsContext();

  const [products, setProducts] = useState<Product[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const sentinelRef = useRef<HTMLDivElement>(null);
  const currentPageRef = useRef(0);
  const isFetchingRef = useRef(false);
  const hasMoreRef = useRef(true);
  // fetchId: invalida respuestas de fetches anteriores cuando se reinicia
  const fetchIdRef = useRef(0);

  const fetchNextPage = useCallback(async () => {
    if (isFetchingRef.current || !hasMoreRef.current) return;

    isFetchingRef.current = true;
    const nextPage = currentPageRef.current + 1;
    const myFetchId = ++fetchIdRef.current; // ID único para esta llamada

    if (nextPage === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const data = await listProducts(nextPage, LIMIT, true);

      // Si se reinició (nuevo refreshKey) mientras estábamos esperando, descartar
      if (myFetchId !== fetchIdRef.current) return;

      // Filtro defensivo: garantiza que NUNCA aparezca un producto inactivo
      // en el Dashboard independientemente del rol (Admin, Merchant o Customer)
      const activeItems = data.items.filter((p) => p.isActive);
      setProducts((prev) => (nextPage === 1 ? activeItems : [...prev, ...activeItems]));
      currentPageRef.current = data.page;
      const more = data.page < data.totalPages;
      hasMoreRef.current = more;
      setHasMore(more);
    } catch (e: unknown) {
      if (myFetchId !== fetchIdRef.current) return;
      setError(e instanceof Error ? e.message : 'Error al cargar productos');
    } finally {
      if (myFetchId === fetchIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
        isFetchingRef.current = false;
      }
    }
  }, []);

  /*
   * Efecto principal: se dispara en el mount inicial Y cada vez que Inventario
   * llama triggerRefresh() (ej.: activar, desactivar, crear, eliminar).
   * Reinicia todo el estado paginado y arranca desde página 1.
   */
  useEffect(() => {
    currentPageRef.current = 0;
    hasMoreRef.current = true;
    isFetchingRef.current = false;
    fetchIdRef.current++; // Invalida fetches en vuelo
    setProducts([]);
    setHasMore(true);
    setError('');
    fetchNextPage();
  }, [refreshKey, fetchNextPage]);

  // Post-carga: si el sentinel sigue visible tras cargar una página, continuar cargando
  useEffect(() => {
    if (loading || loadingMore || !hasMore) return;
    const id = requestAnimationFrame(() => {
      if (!sentinelRef.current || !hasMoreRef.current || isFetchingRef.current) return;
      const { top } = sentinelRef.current.getBoundingClientRect();
      if (top < window.innerHeight + 300) fetchNextPage();
    });
    return () => cancelAnimationFrame(id);
  }, [loading, loadingMore, hasMore, fetchNextPage]);

  // IntersectionObserver: dispara al hacer scroll hasta el sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) fetchNextPage(); },
      { rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage]);

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

      {/* Sentinel siempre en el DOM */}
      <div ref={sentinelRef} className="flex justify-center py-6 min-h-[1px]">
        {loadingMore && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="w-4 h-4 border-2 border-[#c1292e] border-t-transparent rounded-full animate-spin" />
            Cargando más...
          </div>
        )}
        {!loading && !loadingMore && !hasMore && products.length > 0 && (
          <p className="text-xs text-gray-400">— Todos los productos cargados —</p>
        )}
      </div>
    </div>
  );
}

/* ─── ProductCard con React.memo: sólo re-renderiza si el producto cambia ─── */
const ProductCard = React.memo(function ProductCard({ product }: { product: Product }) {
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
});
