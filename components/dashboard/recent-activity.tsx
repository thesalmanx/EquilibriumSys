'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, Package, ShoppingCart } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { orderService } from '@/lib/services/order-service';
import { inventoryService } from '@/lib/services/inventory-service';

type RecentActivity = {
  id: string;
  type: 'order' | 'inventory';
  title: string;
  description: string;
  status?: string;
  date: Date;
};

export function RecentActivity() {
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        // Fetch recent orders and inventory changes
        const [orders, inventory] = await Promise.all([
          orderService.getList({ limit: 5 }),
          inventoryService.getInventoryHistory({ limit: 5 }),
        ]);

        // Process orders
        const orderActivities = orders.orders.map(order => ({
          id: order.id,
          type: 'order' as const,
          title: `Order #${order.orderNumber}`,
          description: `${order.customer.name}`,
          status: order.status,
          date: new Date(order.createdAt),
        }));

        // Process inventory changes
        const inventoryActivities = inventory.history.map(history => ({
          id: history.id,
          type: 'inventory' as const,
          title: `${history.action === 'ADD' ? 'Added' : 'Removed'} Inventory`,
          description: `${history.quantity} units ${history.action === 'ADD' ? 'added to' : 'removed from'} stock`,
          date: new Date(history.createdAt),
        }));

        // Combine and sort
        const combined = [...orderActivities, ...inventoryActivities]
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .slice(0, 5);

        setActivities(combined);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching activity:', error);
        setLoading(false);
      }
    };

    fetchActivity();
  }, []);

  const getStatusBadge = (status: string) => {
    let variant = 'secondary';
    
    switch (status) {
      case 'PENDING':
        variant = 'secondary';
        break;
      case 'PROCESSING':
        variant = 'warning';
        break;
      case 'SHIPPED':
        variant = 'info';
        break;
      case 'DELIVERED':
        variant = 'success';
        break;
      case 'CANCELLED':
        variant = 'destructive';
        break;
    }
    
    return <Badge variant={variant as any}>{status}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          Recent Activity
        </CardTitle>
        <CardDescription>
          Latest actions in your inventory system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loading ? (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </>
          ) : activities.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground">
              No recent activity
            </div>
          ) : (
            <>
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {activity.type === 'order' ? (
                      <ShoppingCart className="h-4 w-4" />
                    ) : (
                      <Package className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <Link
                      href={
                        activity.type === 'order'
                          ? `/orders/${activity.id}`
                          : '#'
                      }
                      className="text-sm font-medium hover:underline"
                    >
                      {activity.title}
                    </Link>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {activity.description}
                      </p>
                      {activity.status && getStatusBadge(activity.status)}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {activity.date.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}