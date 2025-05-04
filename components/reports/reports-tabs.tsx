'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SalesReport } from '@/components/reports/sales-report';
import { InventoryReport } from '@/components/reports/inventory-report';
import { LowStockReport } from '@/components/reports/low-stock-report';
import { TopProductsReport } from '@/components/reports/top-products-report';

export function ReportsTabs() {
  const [activeTab, setActiveTab] = useState('sales');

  return (
    <Tabs defaultValue="sales" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="sales">Sales</TabsTrigger>
        <TabsTrigger value="inventory">Inventory</TabsTrigger>
        <TabsTrigger value="low-stock">Low Stock</TabsTrigger>
        <TabsTrigger value="top-products">Top Products</TabsTrigger>
      </TabsList>
      
      <TabsContent value="sales" className="space-y-4">
        <SalesReport />
      </TabsContent>
      
      <TabsContent value="inventory" className="space-y-4">
        <InventoryReport />
      </TabsContent>
      
      <TabsContent value="low-stock" className="space-y-4">
        <LowStockReport />
      </TabsContent>
      
      <TabsContent value="top-products" className="space-y-4">
        <TopProductsReport />
      </TabsContent>
    </Tabs>
  );
}