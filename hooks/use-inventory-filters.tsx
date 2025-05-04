'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

interface InventoryFilters {
  search: string | null;
  category: string | null;
  lowStock: boolean;
}

interface InventoryFiltersContextType {
  filters: InventoryFilters;
  setFilters: (filters: InventoryFilters) => void;
}

const InventoryFiltersContext = createContext<InventoryFiltersContextType>({
  filters: {
    search: null,
    category: null,
    lowStock: false,
  },
  setFilters: () => {},
});

export const useInventoryFilters = () => useContext(InventoryFiltersContext);

export function InventoryFiltersProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [filters, setFiltersState] = useState<InventoryFilters>({
    search: searchParams.get('search'),
    category: searchParams.get('category'),
    lowStock: searchParams.get('lowStock') === 'true',
  });

  useEffect(() => {
    // Update filters from URL when it changes
    setFiltersState({
      search: searchParams.get('search'),
      category: searchParams.get('category'),
      lowStock: searchParams.get('lowStock') === 'true',
    });
  }, [searchParams]);

  const setFilters = (newFilters: InventoryFilters) => {
    setFiltersState(newFilters);
    
    // Update URL with new filters
    const params = new URLSearchParams();
    
    if (newFilters.search) params.set('search', newFilters.search);
    if (newFilters.category) params.set('category', newFilters.category);
    if (newFilters.lowStock) params.set('lowStock', 'true');
    
    const queryString = params.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
    
    router.push(newUrl);
  };

  return (
    <InventoryFiltersContext.Provider value={{ filters, setFilters }}>
      {children}
    </InventoryFiltersContext.Provider>
  );
}