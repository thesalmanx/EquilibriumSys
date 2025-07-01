'use client';

import { useEffect, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Package, Check, Bell } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { notificationService } from '@/lib/services/notification-service';
import { Notification } from '@/lib/types';

interface NotificationsMenuProps {
  children: React.ReactNode;
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  reorderLevel: number;
}

export function NotificationsMenu({ children }: NotificationsMenuProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await notificationService.getUnread();
      setNotifications(data.notifications);

      const lowStock = await fetch('/api/inventory/low-stock').then((res) => res.json());
      setLowStockItems(lowStock.items || []);
    } catch (error) {
      console.error('Error fetching notifications or low stock:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open]);

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications([]);
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await notificationService.markRead(id);
      setNotifications(notifications.filter((n) => n.id !== id));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'LOW_STOCK':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'ORDER':
        return <Package className="h-4 w-4 text-blue-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const allItems = [
    ...lowStockItems.map((item) => ({
      id: `low-${item.id}`,
      type: 'LOW_STOCK',
      title: `Low Stock: ${item.name}`,
      message: `Only ${item.quantity} left (Reorder at ${item.reorderLevel})`,
      createdAt: new Date().toISOString(),
      temp: true,
    })),
    ...notifications,
  ];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs font-normal text-primary"
              onClick={handleMarkAllRead}
            >
              Mark all as read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup className="max-h-[300px] overflow-auto">
          {loading ? (
            <>
              {[1, 2, 3].map((i) => (
                <DropdownMenuItem key={i} className="flex flex-col items-start py-3">
                  <div className="flex w-full gap-3">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          ) : allItems.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No new notifications
            </div>
          ) : (
            <>
              {allItems.map((notification: any) => (
                <DropdownMenuItem
                  key={notification.id}
                  className="flex items-start gap-3 py-3"
                >
                  {getNotificationIcon(notification.type)}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{notification.title}</p>
                    <p className="text-xs text-muted-foreground">{notification.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!notification.temp && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkRead(notification.id);
                      }}
                    >
                      <Check className="h-3 w-3" />
                      <span className="sr-only">Mark as read</span>
                    </Button>
                  )}
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
