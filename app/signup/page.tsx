import { Metadata } from 'next';
import { SignUp } from '@/components/signup';

export const metadata: Metadata = {
  title: 'Sign Up - EquilibriumSys',
  description: 'Create a new account for EquilibriumSys',
};

export default function SignUpPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
      <SignUp />
    </div>
  );
}