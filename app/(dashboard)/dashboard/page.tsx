import { Metadata } from 'next';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';
import { QuickStats } from '@/components/dashboard/quick-stats';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { LowStockItems } from '@/components/dashboard/low-stock-items';

export const metadata: Metadata = {
  title: 'Dashboard - EquilibriumSys',
  description: 'Overview of your inventory and sales metrics',
};

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader />
      <QuickStats />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DashboardCharts />
        </div>
        <div className="space-y-6">
          <LowStockItems />
          <RecentActivity />
        </div>
      </div>
    </div>
  );
}