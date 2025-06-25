'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/hooks/use-sidebar';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  BarChart, 
  Settings, 
  Users,
  ChevronRight
} from 'lucide-react';

interface SidebarItemProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  isActive: boolean;
  isCollapsed: boolean;
}

function SidebarItem({ href, icon, title, isActive, isCollapsed }: SidebarItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center py-3 px-3 rounded-md group transition-colors hover:bg-accent hover:text-accent-foreground",
        isActive ? "bg-accent text-accent-foreground" : "transparent"
      )}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span
          className={cn(
            "text-sm transition-opacity duration-200",
            isCollapsed ? "opacity-0 w-0 hidden" : "opacity-100"
          )}
        >
          {title}
        </span>
      </div>
      {isActive && !isCollapsed && (
        <ChevronRight className="ml-auto h-4 w-4" />
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { isOpen } = useSidebar();

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
    // {
    //   href: "/settings",
    //   icon: <Settings className="h-5 w-5" />,
    //   title: "Settings",
    // },
  ];

  return (
    <aside
      className={cn(
        "fixed left-0 top-16 z-30 h-[calc(100vh-4rem)] border-r bg-background transition-all duration-300",
        isOpen ? "w-64" : "w-16"
      )}
    >
      <div className="flex h-full flex-col gap-2 p-3">
        <nav className="flex-1 space-y-1">
          {routes.map((route) => (
            <SidebarItem
              key={route.href}
              href={route.href}
              icon={route.icon}
              title={route.title}
              isActive={pathname.startsWith(route.href)}
              isCollapsed={!isOpen}
            />
          ))}
        </nav>
      </div>
    </aside>
  );
}