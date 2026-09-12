import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { getSupabaseClient } from '../lib/db';
import { fetchProfile, signIn as authSignIn, signOut as authSignOut } from '../lib/auth';
import type { AuthResult } from '../lib/auth';

interface AuthContextType {
  user: User | null;
  /** Login pendaki maupun petugas — peran ditentukan kolom `role` di DB. */
  signIn: (identifier: string, password: string) => Promise<AuthResult>;
  /** Dipakai Register setelah signUp berhasil, agar profil langsung terpasang. */
  setSessionUser: (user: User) => void;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Cache profil supaya sesi yang dipulihkan saat offline tetap punya data diri.
// Hanya data profil — tidak ada password, dan tidak dipakai untuk memutuskan
// apakah seseorang boleh masuk. Yang menentukan itu tetap sesi Supabase.
const PROFILE_CACHE_KEY = 'summity_profile_cache';

function readProfileCache(): User | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (raw && raw !== 'undefined') return JSON.parse(raw);
  } catch (_) {}
  return null;
}

function writeProfileCache(user: User | null) {
  try {
    if (user) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch (_) {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();

    // Tanpa kredensial Supabase tidak ada sesi yang bisa dipulihkan.
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let active = true;

    // Pulihkan sesi yang tersimpan (juga bekerja saat offline — Supabase
    // menyimpan sesi di localStorage dan getSession membacanya lokal).
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;

      if (data.session?.user) {
        const profile = await fetchProfile(data.session.user.id);
        if (!active) return;
        // Kalau offline, fetchProfile gagal — pakai cache profil.
        const resolved = profile ?? readProfileCache();
        setUser(resolved);
        if (profile) writeProfileCache(profile);
      } else {
        setUser(null);
        writeProfileCache(null);
      }
      setIsLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event: string, session: any) => {
      if (!active) return;

      if (!session?.user) {
        setUser(null);
        writeProfileCache(null);
        return;
      }
      const profile = await fetchProfile(session.user.id);
      if (!active) return;
      const resolved = profile ?? readProfileCache();
      setUser(resolved);
      if (profile) writeProfileCache(profile);
    });

    return () => {
      active = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  const signIn = async (identifier: string, password: string): Promise<AuthResult> => {
    const result = await authSignIn(identifier, password);
    if (result.user) {
      setUser(result.user);
      writeProfileCache(result.user);
    }
    return result;
  };

  const setSessionUser = (newUser: User) => {
    setUser(newUser);
    writeProfileCache(newUser);
  };

  const updateUser = (data: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...data };
      writeProfileCache(updated);
      return updated;
    });
  };

  const logout = async () => {
    await authSignOut();
    setUser(null);
    writeProfileCache(null);
  };

  return (
    <AuthContext.Provider value={{ user, signIn, setSessionUser, logout, updateUser, isLoading }}>
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
