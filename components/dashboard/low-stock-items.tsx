'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { reportService } from '@/lib/services/report-service';

interface LowStockItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  reorderLevel: number;
}

export function LowStockItems() {
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLowStockItems = async () => {
      try {
        const report = await reportService.getLowStockReport();
        setItems(report.data.items.slice(0, 5));
        setLoading(false);
      } catch (error) {
        console.error('Error fetching low stock items:', error);
        setLoading(false);
      }
    };

    fetchLowStockItems();
  }, []);

  const getStockLevel = (item: LowStockItem) => {
    const ratio = item.quantity / item.reorderLevel;
    
    if (item.quantity === 0) {
      return { level: 'critical', label: 'Out of Stock', color: 'destructive' };
    } else if (ratio <= 0.5) {
      return { level: 'low', label: 'Low Stock', color: 'warning' };
    } else {
      return { level: 'warning', label: 'Reorder Soon', color: 'secondary' };
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Low Stock Items
        </CardTitle>
        <CardDescription>
          Items that need to be restocked
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loading ? (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </>
          ) : items.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground">
              No low stock items
            </div>
          ) : (
            <>
              {items.map((item) => {
                const stockStatus = getStockLevel(item);
                const progressPercentage = Math.min(
                  Math.round((item.quantity / item.reorderLevel) * 100),
                  100
                );
                
                return (
                  <div key={item.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/inventory/${item.id}`}
                        className="font-medium hover:underline"
                      >
                        {item.name}
                      </Link>
                      <Badge variant={stockStatus.color as any}>
                        {stockStatus.label}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>SKU: {item.sku}</span>
                      <span>
                        {item.quantity} / {item.reorderLevel}
                      </span>
                    </div>
                    <Progress value={progressPercentage} className="h-1" />
                  </div>
                );
              })}
            </>
          )}
        </div>
      </CardContent>
      {!loading && items.length > 0 && (
        <CardFooter>
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href="/inventory?lowStock=true">View All Low Stock Items</Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}