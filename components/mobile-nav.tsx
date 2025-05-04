'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  BarChart, 
  Settings, 
  Users
} from 'lucide-react';

export function MobileNav() {
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || pathname === '/') return null;

  const routes = [
    {
      href: "/dashboard",
      icon: <LayoutDashboard className="h-5 w-5" />,
      title: "Dashboard",
    },
    {
      href: "/inventory",
      icon: <Package className="h-5 w-5" />,
      title: "Inventory",
    },
    {
      href: "/orders",
      icon: <ShoppingCart className="h-5 w-5" />,
      title: "Orders",
    },
    {
      href: "/customers",
      icon: <Users className="h-5 w-5" />,
      title: "Customers",
    },
    {
      href: "/reports",
      icon: <BarChart className="h-5 w-5" />,
      title: "Reports",
    },
    {
      href: "/settings",
      icon: <Settings className="h-5 w-5" />,
      title: "Settings",
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 z-40 block w-full border-t bg-background md:hidden">
      <div className="grid grid-cols-6">
        {routes.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className={cn(
              "flex flex-col items-center justify-center py-2 text-xs",
              pathname.startsWith(route.href)
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            {route.icon}
            <span className="mt-1">{route.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}