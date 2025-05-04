import { Metadata } from 'next';
import { OrdersHeader } from '@/components/orders/orders-header';
import { OrdersList } from '@/components/orders/orders-list';

export const metadata: Metadata = {
  title: 'Orders - EquilibriumSys',
  description: 'Manage your orders and track sales',
};

export default function OrdersPage() {
  return (
    <div className="flex flex-col gap-6">
      <OrdersHeader />
      <OrdersList />
    </div>
  );
}