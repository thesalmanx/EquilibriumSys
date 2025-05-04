'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  TrendingUp,
  TrendingDown,
  PlusCircle,
  MinusCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { InventoryHistoryEntry } from '@/lib/types';
import { inventoryService } from '@/lib/services/inventory-service';

interface InventoryHistoryProps {
  itemId: string;
}

export function InventoryHistory({ itemId }: InventoryHistoryProps) {
  const [history, setHistory] = useState<InventoryHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const data = await inventoryService.getHistory(itemId);
        setHistory(data.history);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching inventory history:', error);
        setLoading(false);
      }
    };

    fetchHistory();
  }, [itemId]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'ADD':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'REMOVE':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'CREATE':
        return <PlusCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <MinusCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory History</CardTitle>
        <CardDescription>
          Track changes to quantity and other attributes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2 pt-1">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))
          ) : history.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground">
              No history found for this item
            </div>
          ) : (
            <div className="relative">
              <div className="absolute bottom-0 left-5 top-2 w-px bg-border" />
              
              {history.map((entry) => (
                <div key={entry.id} className="mb-8 last:mb-0">
                  <div className="flex gap-4">
                    <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border bg-background">
                      {getActionIcon(entry.action)}
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="font-medium">
                        {entry.action === 'ADD' && 'Added to Inventory'}
                        {entry.action === 'REMOVE' && 'Removed from Inventory'}
                        {entry.action === 'CREATE' && 'Item Created'}
                        {entry.action === 'UPDATE' && 'Item Updated'}
                      </div>
                      
                      {(entry.action === 'ADD' || entry.action === 'REMOVE') && (
                        <div className="text-sm text-muted-foreground">
                          {entry.quantity} units {entry.action === 'ADD' ? 'added' : 'removed'}
                        </div>
                      )}
                      
                      {entry.notes && (
                        <div className="mt-1 text-sm">{entry.notes}</div>
                      )}
                      
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <span>By {entry.user?.name || 'Unknown'}</span>
                        <span>•</span>
                        <span>
                          {format(new Date(entry.createdAt), 'MMM d, yyyy h:mm a')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}