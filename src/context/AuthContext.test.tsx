import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

function renderAuth() {
  return renderHook(() => useAuth(), { wrapper });
}

describe('useAuth guard', () => {
  it('throws when used outside of an AuthProvider', () => {
    // renderHook surfaces the thrown error via result.current -> use a plain render.
    expect(() => renderHook(() => useAuth())).toThrow(/must be used within an AuthProvider/);
  });
});

describe('AuthProvider', () => {
  it('starts with no user and finishes loading', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('logs in a USER with sensible defaults and persists to localStorage', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.login('USER'));

    expect(result.current.user).toMatchObject({ role: 'USER', name: 'Pendaki' });
    const persisted = JSON.parse(localStorage.getItem('summity_user') ?? 'null');
    expect(persisted.role).toBe('USER');
  });

  it('treats a legacy USER-XXXX id as a displayId and generates an internal UUID', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.login('USER', { id: 'USER-1234', name: 'Budi' }));

    const user = result.current.user!;
    expect(user.displayId).toBe('USER-1234');
    expect(user.id).not.toBe('USER-1234');
    // internal id should look like a UUID (contains dashes, not the USER- prefix)
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('merges updates via updateUser', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.login('USER', { name: 'Budi' }));
    act(() => result.current.updateUser({ phone: '0812' }));

    expect(result.current.user).toMatchObject({ name: 'Budi', phone: '0812' });
    const persisted = JSON.parse(localStorage.getItem('summity_user') ?? 'null');
    expect(persisted.phone).toBe('0812');
  });

  it('logs out and clears storage', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.login('ADMIN'));
    expect(result.current.user).not.toBeNull();

    act(() => result.current.logout());
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('summity_user')).toBeNull();
  });

  it('rehydrates the user from localStorage on mount', async () => {
    localStorage.setItem(
      'summity_user',
      JSON.stringify({ id: 'user-1', name: 'Saved User', email: 'x@y.com', role: 'USER' }),
    );

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toMatchObject({ name: 'Saved User', role: 'USER' });
  });
});
