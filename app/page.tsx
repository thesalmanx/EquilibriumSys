import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Auth } from '@/components/auth';

export const metadata: Metadata = {
  title: 'EquilibriumSys - Login',
  description: 'Secure login to your inventory management system',
};

export default function Home() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
      <Auth />
    </div>
  );
}