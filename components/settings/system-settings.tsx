'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useTheme } from 'next-themes';

export function SystemSettings() {
  const { setTheme, theme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState({
    locale: 'en-US',
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    defaultTheme: theme || 'system',
    enableDarkMode: true,
    enableNotifications: true,
    autoBackup: true,
    backupFrequency: 'daily',
    securityLevel: 'standard',
  });

  const handleSwitchChange = (key: string, value: boolean) => {
    setSettings({
      ...settings,
      [key]: value,
    });
  };

  const handleSelectChange = (key: string, value: string) => {
    if (key === 'defaultTheme') {
      setTheme(value);
    }
    
    setSettings({
      ...settings,
      [key]: value,
    });
  };

  const handleSave = () => {
    setIsLoading(true);
    
    // Simulate API request
    setTimeout(() => {
      toast({
        title: 'Settings saved',
        description: 'Your system settings have been updated.',
      });
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Localization Settings</CardTitle>
          <CardDescription>
            Configure regional and display preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="locale">Language & Locale</Label>
              <Select
                value={settings.locale}
                onValueChange={(value) => handleSelectChange('locale', value)}
              >
                <SelectTrigger id="locale">
                  <SelectValue placeholder="Select locale" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en-US">English (US)</SelectItem>
                  <SelectItem value="en-GB">English (UK)</SelectItem>
                  <SelectItem value="es-ES">Spanish</SelectItem>
                  <SelectItem value="fr-FR">French</SelectItem>
                  <SelectItem value="de-DE">German</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={settings.currency}
                onValueChange={(value) => handleSelectChange('currency', value)}
              >
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">US Dollar ($)</SelectItem>
                  <SelectItem value="EUR">Euro (€)</SelectItem>
                  <SelectItem value="GBP">British Pound (£)</SelectItem>
                  <SelectItem value="JPY">Japanese Yen (¥)</SelectItem>
                  <SelectItem value="CAD">Canadian Dollar (C$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dateFormat">Date Format</Label>
              <Select
                value={settings.dateFormat}
                onValueChange={(value) => handleSelectChange('dateFormat', value)}
              >
                <SelectTrigger id="dateFormat">
                  <SelectValue placeholder="Select date format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="timeFormat">Time Format</Label>
              <Select
                value={settings.timeFormat}
                onValueChange={(value) => handleSelectChange('timeFormat', value)}
              >
                <SelectTrigger id="timeFormat">
                  <SelectValue placeholder="Select time format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                  <SelectItem value="24h">24-hour</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Customize the look and feel of the application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="defaultTheme">Default Theme</Label>
            <Select
              value={settings.defaultTheme}
              onValueChange={(value) => handleSelectChange('defaultTheme', value)}
            >
              <SelectTrigger id="defaultTheme">
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="enableDarkMode">Enable Dark Mode Toggle</Label>
            <Switch
              id="enableDarkMode"
              checked={settings.enableDarkMode}
              onCheckedChange={(value) =>
                handleSwitchChange('enableDarkMode', value)
              }
            />
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>System Maintenance</CardTitle>
          <CardDescription>
            Configure backup and maintenance settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="autoBackup">Automatic Backup</Label>
            <Switch
              id="autoBackup"
              checked={settings.autoBackup}
              onCheckedChange={(value) =>
                handleSwitchChange('autoBackup', value)
              }
            />
          </div>
          
          {settings.autoBackup && (
            <div className="space-y-2">
              <Label htmlFor="backupFrequency">Backup Frequency</Label>
              <Select
                value={settings.backupFrequency}
                onValueChange={(value) => handleSelectChange('backupFrequency', value)}
              >
                <SelectTrigger id="backupFrequency">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          <Separator />
          
          <div className="space-y-2">
            <Label>Database Management</Label>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm">
                Backup Now
              </Button>
              <Button variant="outline" size="sm">
                Restore Backup
              </Button>
              <Button variant="outline" size="sm" className="text-destructive">
                Reset Data
              </Button>
            </div>
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
              'Save All Settings'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}