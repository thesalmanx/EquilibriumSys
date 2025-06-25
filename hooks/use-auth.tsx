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
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const storedSession = localStorage.getItem('userSession');
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession);
        setUser(parsed);
      } catch (err) {
        console.error('Failed to parse stored user session');
        setUser(null);
      }
    } else {
      // redirect to login only if not already on login or signup
      if (!['/', '/signup'].includes(pathname)) {
        router.push('/');
      }
    }
    setLoading(false);
  }, [pathname, router]);

  const logout = () => {
    localStorage.removeItem('userSession');
    setUser(null);
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
