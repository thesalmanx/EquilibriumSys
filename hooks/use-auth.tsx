'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { Session } from 'next-auth';
import { usePathname, useRouter } from 'next/navigation';

interface AuthContextType {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

// This is a mock of session handling until we have the real backend
export function useMockAuth() {
  const [user, setUser] = useState<AuthContextType['user']>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Simulate fetching session
    const checkSession = () => {
      // Check if we have stored mock session data
      const storedSession = localStorage.getItem('mockSession');
      
      if (storedSession) {
        try {
          const session = JSON.parse(storedSession);
          setUser(session.user);
        } catch (error) {
          console.error('Error parsing stored session:', error);
          setUser(null);
        }
      } else {
        // If on the login page, use demo account
        if (pathname === '/') {
          const mockUser = {
            id: '1',
            name: 'Admin User',
            email: 'admin@example.com',
            role: 'ADMIN',
          };
          
          // Store mock session for future use
          localStorage.setItem('mockSession', JSON.stringify({ user: mockUser }));
          setUser(mockUser);
          
          // Redirect to dashboard
          router.push('/dashboard');
        } else {
          setUser(null);
        }
      }
      
      setLoading(false);
    };
    
    checkSession();
  }, [pathname, router]);

  return { user, loading };
}