'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

interface OrderFilters {
  search: string | null;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  customerId: string | null;
}

interface OrderFiltersContextType {
  filters: OrderFilters;
  setFilters: (filters: OrderFilters) => void;
}

const OrderFiltersContext = createContext<OrderFiltersContextType>({
  filters: {
    search: null,
    status: null,
    startDate: null,
    endDate: null,
    customerId: null,
  },
  setFilters: () => {},
});

export const useOrderFilters = () => useContext(OrderFiltersContext);

export function OrderFiltersProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [filters, setFiltersState] = useState<OrderFilters>({
    search: searchParams.get('search'),
    status: searchParams.get('status'),
    startDate: searchParams.get('startDate'),
    endDate: searchParams.get('endDate'),
    customerId: searchParams.get('customerId'),
  });

  useEffect(() => {
    // Update filters from URL when it changes
    setFiltersState({
      search: searchParams.get('search'),
      status: searchParams.get('status'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      customerId: searchParams.get('customerId'),
    });
  }, [searchParams]);

  const setFilters = (newFilters: OrderFilters) => {
    setFiltersState(newFilters);
    
    // Update URL with new filters
    const params = new URLSearchParams();
    
    if (newFilters.search) params.set('search', newFilters.search);
    if (newFilters.status) params.set('status', newFilters.status);
    if (newFilters.startDate) params.set('startDate', newFilters.startDate);
    if (newFilters.endDate) params.set('endDate', newFilters.endDate);
    if (newFilters.customerId) params.set('customerId', newFilters.customerId);
    
    const queryString = params.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
    
    router.push(newUrl);
  };

  return (
    <OrderFiltersContext.Provider value={{ filters, setFilters }}>
      {children}
    </OrderFiltersContext.Provider>
  );
}