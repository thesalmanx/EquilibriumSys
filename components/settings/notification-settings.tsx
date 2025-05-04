'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

export function NotificationSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState({
    emailNotifications: true,
    lowStockAlerts: true,
    orderNotifications: true,
    systemUpdates: false,
    reorderLevel: 5,
  });

  const handleSwitchChange = (key: string, value: boolean) => {
    setSettings({
      ...settings,
      [key]: value,
    });
  };

  const handleInputChange = (key: string, value: string) => {
    setSettings({
      ...settings,
      [key]: parseInt(value) || 0,
    });
  };

  const handleSave = () => {
    setIsLoading(true);
    
    // Simulate API request
    setTimeout(() => {
      toast({
        title: 'Settings saved',
        description: 'Your notification settings have been updated.',
      });
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            Choose how you want to be notified about system events.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="email-notifications">Email Notifications</Label>
            <Switch
              id="email-notifications"
              checked={settings.emailNotifications}
              onCheckedChange={(value) =>
                handleSwitchChange('emailNotifications', value)
              }
            />
          </div>
          
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="low-stock-alerts">Low Stock Alerts</Label>
            <Switch
              id="low-stock-alerts"
              checked={settings.lowStockAlerts}
              onCheckedChange={(value) =>
                handleSwitchChange('lowStockAlerts', value)
              }
            />
          </div>
          
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="order-notifications">Order Notifications</Label>
            <Switch
              id="order-notifications"
              checked={settings.orderNotifications}
              onCheckedChange={(value) =>
                handleSwitchChange('orderNotifications', value)
              }
            />
          </div>
          
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="system-updates">System Updates</Label>
            <Switch
              id="system-updates"
              checked={settings.systemUpdates}
              onCheckedChange={(value) =>
                handleSwitchChange('systemUpdates', value)
              }
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="mr-2">Saving</span>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Alert Thresholds</CardTitle>
          <CardDescription>
            Configure when system alerts should be triggered.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reorder-level">Default Reorder Alert Level</Label>
            <div className="flex w-full max-w-sm items-center space-x-2">
              <Input
                id="reorder-level"
                type="number"
                min="1"
                value={settings.reorderLevel}
                onChange={(e) =>
                  handleInputChange('reorderLevel', e.target.value)
                }
              />
              <span>units</span>
            </div>
            <p className="text-sm text-muted-foreground">
              System will alert when inventory quantity falls below this level
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="mr-2">Saving</span>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}