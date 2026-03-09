'use client';

import { createContext, useContext, useState, useCallback } from 'react';

interface ProductsContextValue {
  refreshKey: number;
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
