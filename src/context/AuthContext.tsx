import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  login: (role: UserRole, customData?: Partial<User>) => void;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('summity_user');
      if (savedUser && savedUser !== 'undefined') {
        setUser(JSON.parse(savedUser));
      }
    } catch (error) {
      console.error('Error parsing saved user:', error);
      localStorage.removeItem('summity_user');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (role: UserRole, customData?: Partial<User>) => {
    // Check if we have a "remembered" user for this role if no customData is provided
    let savedIdentity: Partial<User> | null = null;
    if (!customData) {
      try {
        const lastUserStr = localStorage.getItem(`summity_last_${role.toLowerCase()}`);
        if (lastUserStr) {
          savedIdentity = JSON.parse(lastUserStr);
        }
      } catch (e) {
        console.error('Error parsing last identity', e);
      }
    }

    // Normalize id: ensure we have a UUID-like internal id. Preserve legacy displayId if provided.
    const providedId = customData?.id || savedIdentity?.id;
    let normalizedId = providedId;
    let displayId = (customData as any)?.idPendaki || (customData as any)?.id_pendaki || (customData as any)?.displayId || (savedIdentity as any)?.idPendaki || (savedIdentity as any)?.displayId;

    // If provided id looks like legacy USER-XXXX, treat it as displayId and generate internal UUID.
    if (providedId && /^USER-/.test(providedId)) {
      displayId = providedId;
      normalizedId = (typeof crypto !== 'undefined' && (crypto as any).randomUUID)
        ? (crypto as any).randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
    }

    const newUser: User = {
      name: customData?.name || savedIdentity?.name || (role === 'ADMIN' ? 'Petugas Lapangan' : 'Pendaki'),
      email: customData?.email || savedIdentity?.email || (role === 'ADMIN' ? 'admin@summity.com' : 'pendaki@summity.com'),
      role,
      // Spread caller-provided fields first, then let the normalized identity win
      // so a legacy USER-XXXX `id` can't clobber the generated internal UUID.
      ...customData,
      id: normalizedId || (role === 'ADMIN' ? 'admin-1' : 'user-1'),
      displayId,
      idPendaki: displayId,
      id_pendaki: displayId,
    };
    setUser(newUser);
    localStorage.setItem('summity_user', JSON.stringify(newUser));
    // Also save as the last known for this role
    localStorage.setItem(`summity_last_${role.toLowerCase()}`, JSON.stringify(newUser));
  };

  const updateUser = (data: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...data };
      localStorage.setItem('summity_user', JSON.stringify(updated));
      localStorage.setItem(`summity_last_${updated.role.toLowerCase()}`, JSON.stringify(updated));
      return updated;
    });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('summity_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
