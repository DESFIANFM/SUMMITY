import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../types';

// ---------------------------------------------------------------------------
// AuthContext sekarang berbasis sesi Supabase Auth, bukan lagi localStorage.
// Dua mode yang diuji:
//
//   1. LOCAL mode  — tanpa kredensial Supabase. getSupabaseClient() bernilai
//                    null, jadi tidak ada sesi yang bisa dipulihkan.
//   2. Mode sesi   — client Supabase dipalsukan supaya jalur getSession /
//                    onAuthStateChange bisa diuji tanpa jaringan.
// ---------------------------------------------------------------------------

const { mocks } = vi.hoisted(() => ({
  mocks: {
    client: null as any,
    profile: null as User | null,
  },
}));

vi.mock('../lib/db', () => ({
  getSupabaseClient: () => mocks.client,
  isOnline: () => true,
}));

vi.mock('../lib/auth', () => ({
  fetchProfile: vi.fn(async () => mocks.profile),
  signIn: vi.fn(async () => ({ user: mocks.profile, error: null })),
  signOut: vi.fn(async () => {}),
}));

import { AuthProvider, useAuth } from './AuthContext';

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;
const renderAuth = () => renderHook(() => useAuth(), { wrapper });

const PROFILE: User = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Budi',
  email: 'budi@example.com',
  role: 'USER',
};

/** Client Supabase palsu yang mengembalikan sesi tertentu. */
function fakeClient(session: any) {
  return {
    auth: {
      getSession: vi.fn(async () => ({ data: { session } })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: vi.fn(async () => {}),
    },
  };
}

beforeEach(() => {
  mocks.client = null;
  mocks.profile = null;
});

describe('useAuth guard', () => {
  it('throws when used outside of an AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(/must be used within an AuthProvider/);
  });
});

describe('AuthProvider — LOCAL mode (tanpa kredensial Supabase)', () => {
  it('starts with no user and finishes loading', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
  });
});

describe('AuthProvider — mode sesi', () => {
  it('memulihkan profil ketika sesi tersimpan ada', async () => {
    mocks.client = fakeClient({ user: { id: PROFILE.id } });
    mocks.profile = PROFILE;

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toMatchObject({ name: 'Budi', role: 'USER' });
  });

  it('tetap null bila tidak ada sesi', async () => {
    mocks.client = fakeClient(null);

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('memakai cache profil saat offline (fetchProfile gagal)', async () => {
    localStorage.setItem('summity_profile_cache', JSON.stringify(PROFILE));
    mocks.client = fakeClient({ user: { id: PROFILE.id } });
    mocks.profile = null; // simulasi gagal fetch karena offline

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toMatchObject({ name: 'Budi' });
  });

  it('membersihkan cache profil ketika tidak ada sesi', async () => {
    localStorage.setItem('summity_profile_cache', JSON.stringify(PROFILE));
    mocks.client = fakeClient(null);

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(localStorage.getItem('summity_profile_cache')).toBeNull();
  });
});

describe('AuthProvider — aksi', () => {
  it('setSessionUser memasang user dan menyimpan cache profil', async () => {
    mocks.client = fakeClient(null);
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setSessionUser(PROFILE));

    expect(result.current.user).toMatchObject({ name: 'Budi' });
    const cached = JSON.parse(localStorage.getItem('summity_profile_cache') ?? 'null');
    expect(cached.name).toBe('Budi');
  });

  it('updateUser menggabungkan perubahan ke cache', async () => {
    mocks.client = fakeClient(null);
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setSessionUser(PROFILE));
    act(() => result.current.updateUser({ phone: '0812' }));

    expect(result.current.user).toMatchObject({ name: 'Budi', phone: '0812' });
    const cached = JSON.parse(localStorage.getItem('summity_profile_cache') ?? 'null');
    expect(cached.phone).toBe('0812');
  });

  it('updateUser tidak melakukan apa-apa bila belum ada user', async () => {
    mocks.client = fakeClient(null);
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.updateUser({ phone: '0812' }));
    expect(result.current.user).toBeNull();
  });

  it('logout mengosongkan user dan cache', async () => {
    mocks.client = fakeClient(null);
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setSessionUser(PROFILE));
    expect(result.current.user).not.toBeNull();

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('summity_profile_cache')).toBeNull();
  });

  it('signIn memasang user hasil autentikasi', async () => {
    mocks.client = fakeClient(null);
    mocks.profile = PROFILE;

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.signIn('budi', 'rahasia123');
    });

    expect(result.current.user).toMatchObject({ name: 'Budi' });
  });
});
