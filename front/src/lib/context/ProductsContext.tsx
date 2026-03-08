'use client';

import { createContext, useContext, useState, useCallback } from 'react';

interface ProductsContextValue {
  /** Incrementa cada vez que hay una mutación de productos (crear/activar/desactivar/eliminar).
   *  Los consumidores lo observan con useEffect([refreshKey]) para re-fetch. */
  refreshKey: number;
  /** Llamar tras cualquier mutación exitosa para notificar a Dashboard e Inventario. */
  triggerRefresh: () => void;
}

const ProductsContext = createContext<ProductsContextValue>({
  refreshKey: 0,
  triggerRefresh: () => {},
});

export function ProductsProvider({ children }: { children: React.ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <ProductsContext.Provider value={{ refreshKey, triggerRefresh }}>
      {children}
    </ProductsContext.Provider>
  );
}

export const useProductsContext = () => useContext(ProductsContext);
