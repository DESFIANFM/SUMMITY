import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../types';

// ---------------------------------------------------------------------------
// Sejak migrasi ke Supabase Auth, AuthProvider tidak lagi membaca user dari
// localStorage — ia memulihkan sesi lewat supabase.auth.getSession() lalu
// mengambil profilnya. Jadi auth state di test ini di-seed dengan memalsukan
// sesi + profil, bukan dengan menulis ke localStorage.
// ---------------------------------------------------------------------------

const { mocks } = vi.hoisted(() => ({
  mocks: {
    session: null as any,
    profile: null as User | null,
  },
}));

vi.mock('../lib/db', () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: mocks.session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => {},
    },
  }),
  isOnline: () => true,
}));

vi.mock('../lib/auth', () => ({
  fetchProfile: async () => mocks.profile,
  signIn: async () => ({ user: mocks.profile, error: null }),
  signOut: async () => {},
}));

import { AuthProvider } from '../context/AuthContext';
import ProtectedRoute from './ProtectedRoute';

function renderProtected({ allowedRole }: { allowedRole?: User['role'] } = {}) {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/" element={<div>Home Page</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute allowedRole={allowedRole}>
                <div>Secret Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

/** Pasang sesi aktif beserta profilnya, seperti user yang sudah login. */
function seedUser(user: User) {
  mocks.session = { user: { id: user.id } };
  mocks.profile = user;
}

const CLIMBER: User = { id: 'user-1', name: 'Budi', email: 'b@x.com', role: 'USER' };
const OFFICER: User = { id: 'admin-1', name: 'Petugas', email: 'a@x.com', role: 'ADMIN' };

beforeEach(() => {
  mocks.session = null;
  mocks.profile = null;
});

describe('ProtectedRoute', () => {
  it('redirects an unauthenticated visitor to /login', async () => {
    renderProtected();
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Secret Content')).not.toBeInTheDocument();
  });

  it('renders the protected content for an authenticated user', async () => {
    seedUser(CLIMBER);
    renderProtected({ allowedRole: 'USER' });
    expect(await screen.findByText('Secret Content')).toBeInTheDocument();
  });

  it('redirects to home when the role does not match allowedRole', async () => {
    seedUser(OFFICER);
    renderProtected({ allowedRole: 'USER' });
    expect(await screen.findByText('Home Page')).toBeInTheDocument();
    expect(screen.queryByText('Secret Content')).not.toBeInTheDocument();
  });

  it('allows any authenticated role when no allowedRole is specified', async () => {
    seedUser(OFFICER);
    renderProtected();
    expect(await screen.findByText('Secret Content')).toBeInTheDocument();
  });

  it('keeps a session user out when their profile cannot be resolved', async () => {
    // Sesi ada tapi profil tidak ditemukan (mis. baris users terhapus) —
    // ProtectedRoute harus memperlakukannya sebagai belum login.
    mocks.session = { user: { id: 'ghost' } };
    mocks.profile = null;

    renderProtected();
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
  });
});
