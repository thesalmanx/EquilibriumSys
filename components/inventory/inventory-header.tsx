'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useInventoryFilters } from '@/hooks/use-inventory-filters';

export function InventoryHeader() {
  const router = useRouter();
  const { filters, setFilters } = useInventoryFilters();
  const [searchInput, setSearchInput] = useState(filters.search || '');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({ ...filters, search: searchInput });
  };

  const handleCategoryFilter = (category: string | null) => {
    setFilters({ ...filters, category });
  };

  const handleLowStockFilter = () => {
    setFilters({ ...filters, lowStock: !filters.lowStock });
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
        <p className="text-muted-foreground">
          Manage your inventory items and stock levels
        </p>
      </div>
      
      <div className="flex flex-col gap-2 sm:flex-row">
        <form onSubmit={handleSearchSubmit} className="w-full sm:w-auto">
          <div className="relative">
            <Input
              placeholder="Search inventory..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full"
            />
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0"
            >
              <span className="sr-only">Search</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </Button>
          </div>
        </form>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full gap-2 sm:w-auto">
              <Filter className="h-4 w-4" />
              <span>Filter</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Filter By</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => handleLowStockFilter()}>
                <span className={filters.lowStock ? 'text-primary' : ''}>
                  Low Stock Items
                </span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Categories</DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => handleCategoryFilter(null)}>
                <span className={!filters.category ? 'text-primary' : ''}>
                  All Categories
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCategoryFilter('electronics')}>
                <span className={filters.category === 'electronics' ? 'text-primary' : ''}>
                  Electronics
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCategoryFilter('clothing')}>
                <span className={filters.category === 'clothing' ? 'text-primary' : ''}>
                  Clothing
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCategoryFilter('food')}>
                <span className={filters.category === 'food' ? 'text-primary' : ''}>
                  Food & Beverages
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCategoryFilter('office')}>
                <span className={filters.category === 'office' ? 'text-primary' : ''}>
                  Office Supplies
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCategoryFilter('furniture')}>
                <span className={filters.category === 'furniture' ? 'text-primary' : ''}>
                  Furniture
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCategoryFilter('other')}>
                <span className={filters.category === 'other' ? 'text-primary' : ''}>
                  Other
                </span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <Button 
          onClick={() => router.push('/inventory/new')}
          className="w-full gap-2 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Add Item</span>
        </Button>
      </div>
    </div>
  );
}