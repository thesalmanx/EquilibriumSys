'use client';

import { Check, Clock, Package, Truck, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Order } from '@/lib/types';

interface OrderStatusTimelineProps {
  order: Order;
}

export function OrderStatusTimeline({ order }: OrderStatusTimelineProps) {
  const getStatusDate = (status: string) => {
    const statusEntry = order.statusHistory?.find((entry) => entry.status === status);
    return statusEntry ? new Date(statusEntry.createdAt) : null;
  };

  const isCompleted = (status: string) => {
    const statuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
    const currentIndex = statuses.indexOf(order.status);
    const statusIndex = statuses.indexOf(status);
    
    return statusIndex <= currentIndex;
  };

  const isCancelled = order.status === 'CANCELLED';

  return (
    <div className="space-y-8">
      <div className="relative">
        <div className="absolute left-5 top-0 h-full w-px bg-border" />
        
        <div className="mb-8">
          <div className="flex gap-4">
            <div
              className={cn(
                "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border",
                isCompleted('PENDING') || isCancelled
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground"
              )}
            >
              <Clock className="h-5 w-5" />
            </div>
            <div className="flex-1 pt-1">
              <div
                className={cn(
                  "font-medium",
                  isCompleted('PENDING') || isCancelled
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                Order Placed
              </div>
              {getStatusDate('PENDING') && (
                <div className="text-sm text-muted-foreground">
                  {getStatusDate('PENDING')?.toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {!isCancelled && (
          <>
            <div className="mb-8">
              <div className="flex gap-4">
                <div
                  className={cn(
                    "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border",
                    isCompleted('PROCESSING')
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground"
                  )}
                >
                  <Package className="h-5 w-5" />
                </div>
                <div className="flex-1 pt-1">
                  <div
                    className={cn(
                      "font-medium",
                      isCompleted('PROCESSING')
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    Processing
                  </div>
                  {getStatusDate('PROCESSING') && (
                    <div className="text-sm text-muted-foreground">
                      {getStatusDate('PROCESSING')?.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mb-8">
              <div className="flex gap-4">
                <div
                  className={cn(
                    "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border",
                    isCompleted('SHIPPED')
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground"
                  )}
                >
                  <Truck className="h-5 w-5" />
                </div>
                <div className="flex-1 pt-1">
                  <div
                    className={cn(
                      "font-medium",
                      isCompleted('SHIPPED')
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    Shipped
                  </div>
                  {getStatusDate('SHIPPED') && (
                    <div className="text-sm text-muted-foreground">
                      {getStatusDate('SHIPPED')?.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mb-8">
              <div className="flex gap-4">
                <div
                  className={cn(
                    "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border",
                    isCompleted('DELIVERED')
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground"
                  )}
                >
                  <Check className="h-5 w-5" />
                </div>
                <div className="flex-1 pt-1">
                  <div
                    className={cn(
                      "font-medium",
                      isCompleted('DELIVERED')
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    Delivered
                  </div>
                  {getStatusDate('DELIVERED') && (
                    <div className="text-sm text-muted-foreground">
                      {getStatusDate('DELIVERED')?.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
        
        {isCancelled && (
          <div className="mb-8">
            <div className="flex gap-4">
              <div
                className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-destructive bg-destructive text-destructive-foreground"
              >
                <XCircle className="h-5 w-5" />
              </div>
              <div className="flex-1 pt-1">
                <div className="font-medium">Cancelled</div>
                {getStatusDate('CANCELLED') && (
                  <div className="text-sm text-muted-foreground">
                    {getStatusDate('CANCELLED')?.toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}