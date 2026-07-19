import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import type { User } from '../types';
import ProtectedRoute from './ProtectedRoute';

// Renders ProtectedRoute inside a small router so we can assert on the page the
// user actually lands on. Auth state is seeded via localStorage, which
// AuthProvider reads on mount.
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

function seedUser(user: Partial<User>) {
  localStorage.setItem('summity_user', JSON.stringify(user));
}

describe('ProtectedRoute', () => {
  it('redirects an unauthenticated visitor to /login', async () => {
    renderProtected();
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Secret Content')).not.toBeInTheDocument();
  });

  it('renders the protected content for an authenticated user', async () => {
    seedUser({ id: 'user-1', name: 'Budi', email: 'b@x.com', role: 'USER' });
    renderProtected({ allowedRole: 'USER' });
    expect(await screen.findByText('Secret Content')).toBeInTheDocument();
  });

  it('redirects to home when the role does not match allowedRole', async () => {
    seedUser({ id: 'admin-1', name: 'Petugas', email: 'a@x.com', role: 'ADMIN' });
    renderProtected({ allowedRole: 'USER' });
    expect(await screen.findByText('Home Page')).toBeInTheDocument();
    expect(screen.queryByText('Secret Content')).not.toBeInTheDocument();
  });

  it('allows any authenticated role when no allowedRole is specified', async () => {
    seedUser({ id: 'admin-1', name: 'Petugas', email: 'a@x.com', role: 'ADMIN' });
    renderProtected();
    expect(await screen.findByText('Secret Content')).toBeInTheDocument();
  });
});
