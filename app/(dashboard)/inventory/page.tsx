import { Metadata } from 'next';
import { InventoryHeader } from '@/components/inventory/inventory-header';
import { InventoryList } from '@/components/inventory/inventory-list';

export const metadata: Metadata = {
  title: 'Inventory - EquilibriumSys',
  description: 'Manage your inventory items',
};

export default function InventoryPage() {
  return (
    <div className="flex flex-col gap-6">
      <InventoryHeader />
      <InventoryList />
    </div>
  );
}