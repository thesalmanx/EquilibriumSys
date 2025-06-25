'use client';

import { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type User = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const loadSession = () => {
      const storedSession = localStorage.getItem('mockSession');
      if (storedSession) {
        try {
          const parsed = JSON.parse(storedSession);
          setUser(parsed.user);
        } catch (e) {
          console.error('Failed to parse mockSession', e);
        }
      } else if (pathname === '/') {
        const mockUser = {
          id: '1',
          name: 'Admin User',
          email: 'admin@example.com',
          role: 'ADMIN',
        };
        localStorage.setItem('mockSession', JSON.stringify({ user: mockUser }));
        setUser(mockUser);
        router.push('/dashboard');
      }
      setLoading(false);
    };

    loadSession();
  }, [pathname, router]);

  const logout = () => {
    localStorage.removeItem('mockSession');
    setUser(null);
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
