import { Metadata } from 'next';
import { ReportsHeader } from '@/components/reports/reports-header';
import { ReportsTabs } from '@/components/reports/reports-tabs';

export const metadata: Metadata = {
  title: 'Reports - EquilibriumSys',
  description: 'View sales and inventory reports',
};

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <ReportsHeader />
      <ReportsTabs />
    </div>
  );
}