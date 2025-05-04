'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { reportService } from '@/lib/services/report-service';

interface LowStockItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  reorderLevel: number;
  category: string;
  unit: string;
}

export function LowStockReport() {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const data = await reportService.getLowStockReport();
      setReportData(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching low stock report:', error);
      setLoading(false);
    }
  };

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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Low Stock Report</h2>
          <p className="text-muted-foreground">
            Items that need attention and restocking
          </p>
        </div>
        
        <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>
      
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-full" />
            ) : (
              <div className="text-2xl font-bold">
                {reportData?.data?.criticalItems}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Items with zero quantity
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-full" />
            ) : (
              <div className="text-2xl font-bold">
                {reportData?.data?.lowItems}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Less than 50% of reorder level
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warning Level</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-full" />
            ) : (
              <div className="text-2xl font-bold">
                {reportData?.data?.warningItems}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Between 50% and 100% of reorder level
            </p>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Low Stock Items</CardTitle>
          <CardDescription>
            Items below their reorder level
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="w-full">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="mt-2 h-10 w-full" />
              <Skeleton className="mt-2 h-10 w-full" />
              <Skeleton className="mt-2 h-10 w-full" />
              <Skeleton className="mt-2 h-10 w-full" />
            </div>
          ) : reportData?.data?.items.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">
              No low stock items found
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Reorder Level</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData?.data?.items.map((item: LowStockItem) => {
                    const stockStatus = getStockLevel(item);
                    const progressPercentage = Math.min(
                      Math.round((item.quantity / item.reorderLevel) * 100),
                      100
                    );
                    
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
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
                        <TableCell>{item.quantity} {item.unit}</TableCell>
                        <TableCell>{item.reorderLevel} {item.unit}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge variant={stockStatus.color as any}>
                              {stockStatus.label}
                            </Badge>
                            <Progress value={progressPercentage} className="h-1" />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}