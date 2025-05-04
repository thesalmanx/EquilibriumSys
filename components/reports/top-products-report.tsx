'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, RefreshCw } from 'lucide-react';
import { format, subDays } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { reportService } from '@/lib/services/report-service';

export function TopProductsReport() {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);
  const [dateRange, setDateRange] = useState<{
    startDate: Date;
    endDate: Date;
  }>({
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
  });

  useEffect(() => {
    fetchReport();
  }, [dateRange]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const data = await reportService.getTopProductsReport(
        dateRange.startDate,
        dateRange.endDate
      );
      setReportData(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching top products report:', error);
      setLoading(false);
    }
  };

  const topProducts = reportData?.data || [];
  const chartData = topProducts.slice(0, 5).map((product: any) => ({
    name: product.name,
    quantitySold: product.quantitySold,
    revenue: product.totalRevenue,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Top Products Report</h2>
          <p className="text-muted-foreground">
            Best selling products for the selected period
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal",
                )}
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                {format(dateRange.startDate, 'LLL dd, y')} - {format(dateRange.endDate, 'LLL dd, y')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                defaultMonth={dateRange.startDate}
                selected={{
                  from: dateRange.startDate,
                  to: dateRange.endDate,
                }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({
                      startDate: range.from,
                      endDate: range.to,
                    });
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          
          <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Top 5 Products by Sales Volume</CardTitle>
          <CardDescription>
            Products with the highest sales volume
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-80 w-full">
              <Skeleton className="h-full w-full" />
            </div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    width={100}
                  />
                  <Tooltip 
                    formatter={(value) => [`${value} units`, 'Quantity Sold']}
                  />
                  <Legend />
                  <Bar 
                    dataKey="quantitySold" 
                    name="Quantity Sold" 
                    fill="hsl(var(--chart-2))" 
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Top Products Details</CardTitle>
          <CardDescription>
            Complete list of top-selling products for the period
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
          ) : topProducts.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">
              No sales data found for the selected period
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Quantity Sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((product: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.sku}</TableCell>
                      <TableCell className="capitalize">{product.category || 'N/A'}</TableCell>
                      <TableCell className="text-right">{product.quantitySold}</TableCell>
                      <TableCell className="text-right">${product.totalRevenue.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}