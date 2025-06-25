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

    try {
      if (storedSession) {
        const parsed = JSON.parse(storedSession);
        setUser(parsed);
      } else if (!['/', '/signup'].includes(pathname)) {
        // Delay the redirect until loading is false
        setUser(null);
      }
    } catch (err) {
      console.error('Error parsing userSession:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [pathname]);

  // Redirect only AFTER loading is false AND user is not logged in
  useEffect(() => {
    if (!loading && !user && !['/', '/signup'].includes(pathname)) {
      router.push('/');
    }
  }, [loading, user, pathname, router]);

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
