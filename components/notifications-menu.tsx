'use client';

import { useEffect, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface NotificationsMenuProps {
  children: React.ReactNode;
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  reorderLevel: number;
}

export function NotificationsMenu({ children }: NotificationsMenuProps) {
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const fetchLowStock = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/inventory?lowStock=true&limit=10');
      const data = await res.json();
      setLowStockItems(data.items || []);
    } catch (error) {
      console.error('Error fetching low stock items:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchLowStock();
    }
  }, [open]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup className="max-h-[300px] overflow-auto">
          {loading ? (
            <>
              {[1, 2, 3].map((i) => (
                <DropdownMenuItem key={i} className="flex flex-col items-start py-3">
                  <div className="flex w-full gap-3">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          ) : lowStockItems.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No low stock alerts
            </div>
          ) : (
            <>
              {lowStockItems.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  className="flex items-start gap-3 py-3"
                >
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Low Stock: {item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Only {item.quantity} left (Reorder at {item.reorderLevel})
                    </p>
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
