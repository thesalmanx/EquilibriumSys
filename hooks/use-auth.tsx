'use client';

import {
  useState,
  useEffect,
  createContext,
  useContext,
  ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

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

// Provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const checkSession = () => {
      const storedSession = localStorage.getItem('mockSession');

      if (storedSession) {
        try {
          const session = JSON.parse(storedSession);
          setUser(session.user);
        } catch (error) {
          console.error('Failed to parse mock session:', error);
          localStorage.removeItem('mockSession');
          setUser(null);
        }
      } else {
        // If visiting the root (login page), initialize mock user
        if (pathname === '/') {
          const mockUser = {
            id: '1',
            name: 'Salman Sheikh', // 🔁 Change name here if needed
            email: 'salman@example.com',
            role: 'ADMIN',
          };

          localStorage.setItem(
            'mockSession',
            JSON.stringify({ user: mockUser })
          );
          setUser(mockUser);
          router.push('/dashboard');
        } else {
          setUser(null);
        }
      }

      setLoading(false);
    };

    checkSession();
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
