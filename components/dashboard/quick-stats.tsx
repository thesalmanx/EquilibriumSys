'use client';

import { useEffect, useState } from 'react';
import {
  Package,
  ShoppingCart,
  DollarSign,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { reportService } from '@/lib/services/report-service';

type Stats = {
  totalItems: number;
  lowStockCount: number;
  totalSales: number;
  orderCount: number;
  loading: boolean;
};

export function QuickStats() {
  const [stats, setStats] = useState<Stats>({
    totalItems: 0,
    lowStockCount: 0,
    totalSales: 0,
    orderCount: 0,
    loading: true,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Get today's date
        const today = new Date();
        
        // Get start date (30 days ago)
        const startDate = new Date();
        startDate.setDate(today.getDate() - 30);
        
        const [inventoryReport, salesReport, lowStockReport] = await Promise.all([
          reportService.getInventoryReport(),
          reportService.getSalesReport(startDate, today),
          reportService.getLowStockReport(),
        ]);

        setStats({
          totalItems: inventoryReport.data.totalItems,
          lowStockCount: lowStockReport.data.total,
          totalSales: salesReport.data.totalSales,
          orderCount: salesReport.data.orderCount,
          loading: false,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Inventory</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {stats.loading ? (
            <Skeleton className="h-7 w-20" />
          ) : (
            <div className="text-2xl font-bold">{stats.totalItems.toLocaleString()}</div>
          )}
          <p className="text-xs text-muted-foreground">Total inventory items</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          {stats.loading ? (
            <Skeleton className="h-7 w-20" />
          ) : (
            <div className="text-2xl font-bold">{stats.lowStockCount.toLocaleString()}</div>
          )}
          <p className="text-xs text-muted-foreground">Items below reorder level</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Last 30 Days Sales</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {stats.loading ? (
            <Skeleton className="h-7 w-20" />
          ) : (
            <div className="text-2xl font-bold">${stats.totalSales.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}</div>
          )}
          <p className="text-xs text-muted-foreground">Total revenue (30 days)</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Orders</CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {stats.loading ? (
            <Skeleton className="h-7 w-20" />
          ) : (
            <div className="text-2xl font-bold">{stats.orderCount.toLocaleString()}</div>
          )}
          <p className="text-xs text-muted-foreground">Orders in last 30 days</p>
        </CardContent>
      </Card>
    </div>
  );
}