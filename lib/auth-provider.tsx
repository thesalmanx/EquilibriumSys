'use client';

import { ReactNode } from 'react';
import { AuthContext, useMockAuth } from '@/hooks/use-auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useMockAuth();

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}