'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { useProductsContext } from '@/lib/context/ProductsContext';
import {
  listProducts,
  createProduct,
  addProductDetails,
  activateProduct,
  deactivateProduct,
  deleteProduct,
  getProduct,
  Product,
} from '@/lib/api/products';
import { getProductInventory } from '@/lib/api/inventory';

const CATEGORY_NAMES: Record<number, string> = { 1: 'Computadoras', 2: 'Moda' };
const PAGE_SIZE = 10;

type WizardStep = 1 | 2 | 3 | 4;

/* ═══════════════════════════════════════════════════════════════
   INVENTORY PAGE
════════════════════════════════════════════════════════════════ */
export default function InventoryPage() {
  const { isAdmin, isMerchant } = useAuth();
  const { triggerRefresh } = useProductsContext();

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState('');
  const [showWizard, setShowWizard] = useState(false);

  // Stock map: productId → total quantity (null = cargando)
  const [stockMap, setStockMap] = useState<Map<number, number | null>>(new Map());

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Per-row loading states
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Refs para callbacks estables (evitan stale closures sin re-crear handlers)
  const currentPageRef = useRef(1);
  const totalRef = useRef(0);
  const totalPagesRef = useRef(1);
  // Ref sincronizado en cada render: permite leer products.length en callbacks sin agregarlo como dep
  const productsLengthRef = useRef(0);
  productsLengthRef.current = products.length;

  /* ── fetchProducts ──────────────────────────────────────────── */
  const fetchProducts = useCallback(async (page: number) => {
    setLoadingList(true);
    setListError('');
    try {
      const data = await listProducts(page, PAGE_SIZE);
      setProducts(data.items);
      setCurrentPage(data.page);
      setTotalPages(data.totalPages);
      setTotal(data.total);
      // Actualizar refs para que los callbacks siempre lean el valor actual
      currentPageRef.current = data.page;
      totalRef.current = data.total;
      totalPagesRef.current = data.totalPages;

      // Marcar todos como "cargando stock" y luego resolverlos en paralelo.
      // El fetch de stock es no-bloqueante: la tabla se muestra inmediatamente
      // y la columna Stock se actualiza cuando llegan las respuestas del evento.
      const ids = data.items.map((p) => p.id);
      setStockMap(new Map(ids.map((id) => [id, null])));
      Promise.all(
        ids.map((id) =>
          getProductInventory(id)
            .then((records) => ({ id, qty: records.reduce((s, r) => s + r.quantity, 0) }))
            .catch(() => ({ id, qty: 0 })),
        ),
      ).then((results) => {
        setStockMap(new Map(results.map((r) => [r.id, r.qty])));
      });
    } catch (e: unknown) {
      setListError(e instanceof Error ? e.message : 'Error al cargar productos');
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts(1);
  }, [fetchProducts]);

  /* ── handleActivate ─────────────────────────────────────────── */
  const handleActivate = useCallback(
    async (product: Product) => {
      setTogglingId(product.id);
      try {
        const result = await activateProduct(product.id);
        // Actualiza solo el producto afectado en el estado local, sin re-fetch de toda la tabla
        setProducts((prev) =>
          prev.map((p) => (p.id === result.id ? { ...p, isActive: result.isActive } : p)),
        );
        // Actualiza el stock de este producto: la activación crea el registro de inventario
        getProductInventory(product.id)
          .then((records) => {
            const qty = records.reduce((s, r) => s + r.quantity, 0);
            setStockMap((prev) => new Map(prev).set(product.id, qty));
          })
          .catch(() => {});
        triggerRefresh();
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : 'Error al activar');
      } finally {
        setTogglingId(null);
      }
    },
    [triggerRefresh],
  );

  /* ── handleDeactivate ───────────────────────────────────────── */
  const handleDeactivate = useCallback(
    async (product: Product) => {
      setTogglingId(product.id);
      try {
        const result = await deactivateProduct(product.id);
        // Actualiza solo el producto afectado en el estado local, sin re-fetch de toda la tabla
        setProducts((prev) =>
          prev.map((p) => (p.id === result.id ? { ...p, isActive: result.isActive } : p)),
        );
        triggerRefresh();
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : 'Error al desactivar');
      } finally {
        setTogglingId(null);
      }
    },
    [triggerRefresh],
  );

  /* ── handleDelete ───────────────────────────────────────────── */
  const handleDelete = useCallback(
    async (product: Product) => {
      const label = product.title ? `"${product.title}"` : `#${product.id}`;
      if (!confirm(`¿Eliminar el producto ${label}?\n\nEsta acción no se puede deshacer.`)) return;

      setDeletingId(product.id);
      try {
        await deleteProduct(product.id);

        const newTotal = totalRef.current - 1;
        const newTotalPages = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));

        if (productsLengthRef.current === 1 && currentPageRef.current > 1) {
          // Caso edge: era el único ítem de una página > 1 → fetch de la página anterior
          await fetchProducts(currentPageRef.current - 1);
        } else {
          // Caso normal: quedan ítems en la página → actualización local sin re-fetch
          setProducts((prev) => prev.filter((p) => p.id !== product.id));
          setStockMap((prev) => { const next = new Map(prev); next.delete(product.id); return next; });
          setTotal(newTotal);
          setTotalPages(newTotalPages);
          totalRef.current = newTotal;
          totalPagesRef.current = newTotalPages;
        }

        triggerRefresh();
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : 'Error al eliminar');
      } finally {
        setDeletingId(null);
      }
    },
    [fetchProducts, triggerRefresh],
  );

  /* ── handleWizardComplete ───────────────────────────────────── */
  const handleWizardComplete = useCallback(async () => {
    setShowWizard(false);
    await fetchProducts(1);
    triggerRefresh();
  }, [fetchProducts, triggerRefresh]);

  /* ── Paginación: array de páginas con elipsis (memoizado) ───── */
  const paginationItems = useMemo<(number | 'ellipsis')[]>(() => {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
      .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
      .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
        if (i > 0 && (arr[i - 1] as number) < p - 1) acc.push('ellipsis');
        acc.push(p);
        return acc;
      }, []);
  }, [totalPages, currentPage]);

  if (!isAdmin && !isMerchant) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <span className="text-5xl mb-4">🔒</span>
        <p className="text-gray-700 font-semibold">Acceso restringido</p>
        <p className="text-sm text-gray-400 mt-1">
          Solo administradores y merchants pueden acceder al inventario
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inventario</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gestioná todos tus productos: activá, desactivá, creá o eliminá
          </p>
        </div>
        {!showWizard && (
          <button
            onClick={() => setShowWizard(true)}
            className="bg-[#c1292e] hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
          >
            + Nuevo Producto
          </button>
        )}
      </div>

      {/* Wizard */}
      {showWizard && (
        <ProductWizard
          onComplete={handleWizardComplete}
          onCancel={() => setShowWizard(false)}
        />
      )}

      {/* Product table — full width */}
      <div className="space-y-3">
        {loadingList && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#c1292e] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {listError && (
          <div className="text-sm text-[#c1292e] bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {listError}
          </div>
        )}

        {!loadingList && products.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center py-16 text-center">
            <span className="text-4xl mb-3">📦</span>
            <p className="text-gray-500">No hay productos todavía</p>
            <p className="text-sm text-gray-400 mt-1">Creá uno con &quot;+ Nuevo Producto&quot;</p>
          </div>
        )}

        {!loadingList && products.length > 0 && (
          <>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ID</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Producto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Categoría</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Stock</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map((p) => (
                    <ProductRow
                      key={p.id}
                      product={p}
                      stock={stockMap.has(p.id) ? stockMap.get(p.id)! : null}
                      onActivate={handleActivate}
                      onDeactivate={handleDeactivate}
                      onDelete={handleDelete}
                      isToggling={togglingId === p.id}
                      isDeleting={deletingId === p.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-1">
              <p className="text-xs text-gray-500">
                {total} {total === 1 ? 'producto' : 'productos'} · Página {currentPage} de {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => fetchProducts(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Anterior
                </button>

                {paginationItems.map((item, i) =>
                  item === 'ellipsis' ? (
                    <span key={`e-${i}`} className="px-2 text-xs text-gray-400">…</span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => fetchProducts(item)}
                      className={`w-8 h-8 text-xs rounded-lg font-medium transition-colors ${
                        currentPage === item
                          ? 'bg-[#c1292e] text-white'
                          : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {item}
                    </button>
                  ),
                )}

                <button
                  onClick={() => fetchProducts(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PRODUCT ROW — React.memo: solo re-renderiza si sus props cambian
════════════════════════════════════════════════════════════════ */
interface ProductRowProps {
  product: Product;
  /** null = cargando, number = total de unidades en inventario */
  stock: number | null;
  onActivate: (p: Product) => void;
  onDeactivate: (p: Product) => void;
  onDelete: (p: Product) => void;
  isToggling: boolean;
  isDeleting: boolean;
}

const ProductRow = React.memo(function ProductRow({
  product: p,
  stock,
  onActivate,
  onDeactivate,
  onDelete,
  isToggling,
  isDeleting,
}: ProductRowProps) {
  const isBusy = isToggling || isDeleting;

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 font-mono text-gray-400 text-xs">{p.id}</td>

      <td className="px-4 py-3">
        <p className="font-medium text-gray-900">
          {p.title || <span className="text-gray-400 italic text-xs">Sin título</span>}
        </p>
        {p.code && <p className="text-xs text-gray-400 font-mono">{p.code}</p>}
      </td>

      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
        {CATEGORY_NAMES[p.categoryId] ?? `Cat. ${p.categoryId}`}
      </td>

      <td className="px-4 py-3">
        {p.isActive ? (
          <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            Activo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-xs font-medium">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
            Inactivo
          </span>
        )}
      </td>

      {/* Stock: se carga asincrónicamente luego de que el evento product.activated
          dispara el listener que crea el registro de inventario inicial. */}
      <td className="px-4 py-3 hidden md:table-cell">
        {stock === null ? (
          <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />
        ) : stock === 0 && !p.isActive ? (
          <span className="text-xs text-gray-300 font-mono">—</span>
        ) : (
          <span className={`text-xs font-mono font-medium ${stock === 0 ? 'text-amber-600' : 'text-gray-700'}`}>
            {stock} ud{stock !== 1 ? 's.' : '.'}
          </span>
        )}
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          {/* Activate / Deactivate */}
          {isBusy ? (
            <span className="inline-block w-4 h-4 border-2 border-[#c1292e] border-t-transparent rounded-full animate-spin" />
          ) : p.isActive ? (
            <button
              onClick={() => onDeactivate(p)}
              className="text-xs border border-gray-300 hover:border-gray-400 text-gray-600 hover:text-gray-800 px-2.5 py-1 rounded-lg transition-colors"
            >
              Desactivar
            </button>
          ) : (
            <button
              onClick={() => onActivate(p)}
              disabled={!p.title || !p.code}
              title={!p.title || !p.code ? 'Agregá detalles antes de activar' : ''}
              className="text-xs bg-[#c1292e] hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-2.5 py-1 rounded-lg transition-colors"
            >
              Activar
            </button>
          )}

          {/* Delete button */}
          <button
            onClick={() => onDelete(p)}
            disabled={isBusy}
            title="Eliminar producto"
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Eliminar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
});

/* ═══════════════════════════════════════════════════════════════
   PRODUCT WIZARD
════════════════════════════════════════════════════════════════ */
function ProductWizard({
  onComplete,
  onCancel,
}: {
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<WizardStep>(1);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [categoryId, setCategoryId] = useState('1');
  const [title, setTitle] = useState('Laptop Demo');
  const [code, setCode] = useState(`LAPTOP-${Date.now().toString().slice(-4)}`);
  const [brand, setBrand] = useState('Dell');
  const [series, setSeries] = useState('XPS');
  const [capacity, setCapacity] = useState('512');
  const [capacityUnit, setCapacityUnit] = useState<'GB' | 'TB'>('GB');
  const [capacityType, setCapacityType] = useState<'SSD' | 'HD'>('SSD');
  const [description, setDescription] = useState('Laptop de alta performance.');
  const [about, setAbout] = useState('Alta performance\nPantalla Full HD\nBatería larga duración');

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const created = await createProduct({ categoryId: parseInt(categoryId) });
      setProduct(created);
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setError('');
    setLoading(true);
    try {
      await addProductDetails(product.id, {
        title, code, variationType: 'NONE',
        details: { category: 'Computers', capacity: parseInt(capacity), capacityUnit, capacityType, brand, series },
        about: about.split('\n').filter((l) => l.trim()),
        description,
      });
      setProduct(await getProduct(product.id));
      setStep(3);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar detalles');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!product) return;
    setError('');
    setLoading(true);
    try {
      await activateProduct(product.id);
      setStep(4);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al activar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border-2 border-[#c1292e]/20 rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold text-gray-900">Nuevo Producto</h2>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-6">
        {[1, 2, 3, 4].map((n, i) => (
          <div key={n} className="flex items-center flex-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              n < step ? 'bg-green-500 text-white' : n === step ? 'bg-[#c1292e] text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {n < step ? '✓' : n}
            </div>
            {i < 3 && <div className={`h-0.5 flex-1 mx-1 ${n < step ? 'bg-green-400' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 text-sm text-[#c1292e] bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>
      )}

      {step === 1 && (
        <form onSubmit={handleCreateProduct} className="space-y-4">
          <p className="text-sm text-gray-500">Seleccioná una categoría para el nuevo producto.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c1292e]">
              <option value="1">Computadoras (ID: 1)</option>
              <option value="2">Moda (ID: 2)</option>
            </select>
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-[#c1292e] hover:bg-red-700 disabled:opacity-60 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors">
            {loading ? 'Creando...' : 'Crear →'}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleAddDetails} className="space-y-3">
          <p className="text-sm text-gray-500">Producto <span className="font-mono font-bold">#{product?.id}</span> creado. Agregá los detalles.</p>
          <div className="grid grid-cols-2 gap-3">
            {([['Título', title, setTitle], ['Código', code, setCode], ['Marca', brand, setBrand], ['Serie', series, setSeries]] as [string, string, React.Dispatch<React.SetStateAction<string>>][]).map(([label, value, set]) => (
              <div key={label}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input value={value} onChange={(e) => set(e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c1292e]" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Capacidad</label>
              <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c1292e]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Unidad / Tipo</label>
              <div className="flex gap-2">
                <select value={capacityUnit} onChange={(e) => setCapacityUnit(e.target.value as 'GB' | 'TB')}
                  className="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c1292e]">
                  <option>GB</option><option>TB</option>
                </select>
                <select value={capacityType} onChange={(e) => setCapacityType(e.target.value as 'SSD' | 'HD')}
                  className="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c1292e]">
                  <option>SSD</option><option>HD</option>
                </select>
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c1292e] resize-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Características (una por línea)</label>
              <textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={2} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c1292e] resize-none" />
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-[#c1292e] hover:bg-red-700 disabled:opacity-60 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors">
            {loading ? 'Guardando...' : 'Guardar Detalles →'}
          </button>
        </form>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            El producto está listo para ser activado.
          </p>
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">ID:</span><span className="font-mono">{product?.id}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Título:</span><span>{product?.title}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Código:</span><span className="font-mono">{product?.code}</span></div>
          </div>
          <button onClick={handleActivate} disabled={loading}
            className="w-full bg-[#c1292e] hover:bg-red-700 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
            {loading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Activando...</> : 'Activar producto'}
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-semibold text-green-800">¡Producto activado!</p>
              <p className="text-sm text-green-600">El producto ya está disponible en el catálogo</p>
            </div>
          </div>
          <button onClick={onComplete}
            className="w-full bg-[#c1292e] hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors">
            Ver en inventario →
          </button>
        </div>
      )}
    </div>
  );
}
