'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { InventoryItem } from '@/lib/types';
import { inventoryService } from '@/lib/services/inventory-service';

interface ProductSelectProps {
  id: string;
  value: string;
  onSelect: (productId: string) => void;
}

export function ProductSelect({ id, value, onSelect }: ProductSelectProps) {
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const data = await inventoryService.getList({ search });
        setProducts(data.items);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching products:', error);
        setLoading(false);
      }
    };

    fetchProducts();
  }, [search]);

  const handleSelect = (productId: string) => {
    onSelect(productId);
    setOpen(false);
  };

  const selectedProduct = products.find(p => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-labelledby={id}
          className="w-full justify-between"
        >
          {value && selectedProduct
            ? selectedProduct.name
            : "Select product..."}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Search products..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? 'Loading...' : 'No products found.'}
            </CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.id}
                  onSelect={handleSelect}
                  disabled={product.quantity <= 0}
                >
                  <div className="flex flex-col">
                    <span className={product.quantity <= 0 ? 'text-muted-foreground' : ''}>
                      {product.name} {product.quantity <= 0 && '(Out of Stock)'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      SKU: {product.sku} | In Stock: {product.quantity}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}