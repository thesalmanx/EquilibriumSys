import { Metadata } from 'next';
import { SettingsTabs } from '@/components/settings/settings-tabs';

export const metadata: Metadata = {
  title: 'Settings - EquilibriumSys',
  description: 'Manage your system settings',
};

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and system preferences.
        </p>
      </div>
      <SettingsTabs />
    </div>
  );
}