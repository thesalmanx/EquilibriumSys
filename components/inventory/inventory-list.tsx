'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Edit, MoreHorizontal, AlertTriangle, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { inventoryService } from '@/lib/services/inventory-service';
import { useInventoryFilters } from '@/hooks/use-inventory-filters';
import { InventoryItem } from '@/lib/types';

export function InventoryList() {
  const router = useRouter();
  const { filters } = useInventoryFilters();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortColumn, setSortColumn] = useState<string>('updatedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const data = await inventoryService.getList(filters);
      setInventory(data.items);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load inventory data.',
      });
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [filters]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedInventory = [...inventory].sort((a, b) => {
    let valA = a[sortColumn as keyof InventoryItem];
    let valB = b[sortColumn as keyof InventoryItem];
    
    // Handle special case for dates
    if (typeof valA === 'string' && (sortColumn === 'createdAt' || sortColumn === 'updatedAt')) {
      valA = new Date(valA);
      valB = new Date(valB as string);
    }
    
    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleDelete = async (id: string) => {
    try {
      await inventoryService.delete(id);
      toast({
        title: 'Item Deleted',
        description: 'The inventory item was successfully deleted.',
      });
      await fetchInventory();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete the inventory item.',
      });
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">
              <Button
                variant="ghost"
                className="p-0 hover:bg-transparent"
                onClick={() => handleSort('name')}
              >
                <span>Name</span>
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                className="p-0 hover:bg-transparent"
                onClick={() => handleSort('sku')}
              >
                <span>SKU</span>
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                className="p-0 hover:bg-transparent"
                onClick={() => handleSort('category')}
              >
                <span>Category</span>
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                className="p-0 hover:bg-transparent"
                onClick={() => handleSort('quantity')}
              >
                <span>Quantity</span>
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                className="p-0 hover:bg-transparent"
                onClick={() => handleSort('price')}
              >
                <span>Price</span>
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Skeleton className="h-5 w-[200px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-[80px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-[100px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-[60px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-[60px]" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-8 w-8" />
                </TableCell>
              </TableRow>
            ))
          ) : sortedInventory.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                No inventory items found.
              </TableCell>
            </TableRow>
          ) : (
            sortedInventory.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/inventory/${item.id}`}
                    className="hover:underline"
                  >
                    {item.name}
                  </Link>
                  {item.quantity <= item.reorderLevel && (
                    <span className="ml-2 inline-flex items-center">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    </span>
                  )}
                </TableCell>
                <TableCell>{item.sku}</TableCell>
                <TableCell>
                  {item.category ? (
                    <Badge variant="outline" className="capitalize">
                      {item.category}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="w-[100px]">
                    <div className="flex justify-between text-xs">
                      <span>
                        {item.quantity} {item.unit}
                      </span>
                      <span className="text-muted-foreground">
                        /{item.reorderLevel}
                      </span>
                    </div>
                    <Progress
                      value={Math.min(
                        Math.round((item.quantity / item.reorderLevel) * 100),
                        100
                      )}
                      className="h-1"
                    />
                  </div>
                </TableCell>
                <TableCell>${item.price.toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => router.push(`/inventory/${item.id}`)}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this item?')) {
                            handleDelete(item.id);
                          }
                        }}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}