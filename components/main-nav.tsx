'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Box, Menu, Bell, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserNav } from '@/components/user-nav';
import { NotificationsMenu } from '@/components/notifications-menu';
import { useSidebar } from '@/hooks/use-sidebar';

export function MainNav() {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();
  const [isMounted, setIsMounted] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    setIsMounted(true);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Don't render anything on the server or during initial hydration
  if (!isMounted) {
    return null;
  }

  if (pathname === '/') {
    return null;
  }

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b bg-background transition-shadow duration-200 ${
        isScrolled ? 'shadow-sm' : ''
      }`}
    >
      <div className="flex h-16 items-center px-4">
        <div className="flex items-center md:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="mr-2"
            onClick={toggleSidebar}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </div>
        
        <div className="flex items-center">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-lg font-bold"
          >
            <Box className="h-6 w-6" />
            <span className="hidden md:inline-block">EquilibriumSys</span>
          </Link>
        </div>
        
        <div className="ml-auto flex items-center gap-2">
          <div className="relative hidden w-72 lg:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="w-full rounded-full pl-10"
            />
          </div>
          
          <NotificationsMenu>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
              <span className="sr-only">Notifications</span>
            </Button>
          </NotificationsMenu>
          
          <ThemeToggle />
          <UserNav />
        </div>
      </div>
    </header>
  );
}