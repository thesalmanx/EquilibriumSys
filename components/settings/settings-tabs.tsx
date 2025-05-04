'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileSettings } from '@/components/settings/profile-settings';
import { NotificationSettings } from '@/components/settings/notification-settings';
import { CompanySettings } from '@/components/settings/company-settings';
import { UsersSettings } from '@/components/settings/users-settings';
import { SystemSettings } from '@/components/settings/system-settings';

export function SettingsTabs() {
  return (
    <Tabs defaultValue="profile" className="space-y-4">
      <TabsList>
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
        <TabsTrigger value="company">Company</TabsTrigger>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="system">System</TabsTrigger>
      </TabsList>
      
      <TabsContent value="profile">
        <ProfileSettings />
      </TabsContent>
      
      <TabsContent value="notifications">
        <NotificationSettings />
      </TabsContent>
      
      <TabsContent value="company">
        <CompanySettings />
      </TabsContent>
      
      <TabsContent value="users">
        <UsersSettings />
      </TabsContent>
      
      <TabsContent value="system">
        <SystemSettings />
      </TabsContent>
    </Tabs>
  );
}