import { Metadata } from 'next';
import { CustomersHeader } from '@/components/customers/customers-header';
import { CustomersList } from '@/components/customers/customers-list';
export const metadata: Metadata = {
  title: 'Customers - EquilibriumSys',
  description: 'Manage your customer database',
};

export default function CustomersPage() {
  return (
    <div className="flex flex-col gap-6">
      <CustomersHeader />
      <CustomersList />
    </div>
  );
}