import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegistrationRequest } from '../types';

// ---------------------------------------------------------------------------
// These tests exercise the ONLINE sync paths in db.ts (trySyncRegistration,
// syncAllUnsyncedData) WITHOUT a real Supabase backend. We mock
// `@supabase/supabase-js` so `createClient` returns a chainable query builder
// whose resolved value we control per-test via `supabaseMock.state.result`.
// ---------------------------------------------------------------------------

// vi.hoisted so the shared mock state exists before the hoisted vi.mock factory
// runs (factory bodies cannot reference normal module-scope variables).
const { supabaseMock } = vi.hoisted(() => {
  const state = {
    result: { data: [] as any[], error: null as any },
  };

  // A fake PostgREST builder: every method returns the same builder (chainable)
  // and the builder is thenable, so `await builder.upsert(x).select(y)` resolves
  // to whatever `state.result` currently holds.
  const makeBuilder = () => {
    const builder: any = {};
    for (const m of [
      'insert', 'upsert', 'update', 'delete', 'select',
      'eq', 'neq', 'in', 'is', 'order', 'limit', 'single', 'maybeSingle',
    ]) {
      builder[m] = vi.fn(() => builder);
    }
    builder.then = (resolve: (v: any) => any) => resolve(state.result);
    return builder;
  };

  const client = { from: vi.fn(() => makeBuilder()) };
  return { supabaseMock: { state, client } };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => supabaseMock.client,
}));

// Import AFTER the mock is registered.
import {
  getAllRegistrations,
  saveRegistration,
  syncAllUnsyncedData,
  trySyncRegistration,
} from './db';

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
}

function buildRegistration(
  overrides: Partial<RegistrationRequest> = {},
): Omit<RegistrationRequest, 'id'> {
  return {
    userId: 'USER-1',
    name: 'Budi Pendaki',
    nik: '3300000000000001',
    phone: '08120000001',
    emergencyPhone: '08120000002',
    birthDate: '1998-01-01',
    address: 'Purwokerto',
    gender: 'Laki-laki',
    mountain: 'Gn. Slamet',
    date: '2026-07-19',
    endDate: '2026-07-21',
    status: 'PENDING',
    createdAt: '2026-07-18T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  // Pristine in-memory IndexedDB per test.
  globalThis.indexedDB = new IDBFactory() as unknown as IDBFactory;
  // Credentials present -> getSupabaseClient() returns the mocked client.
  vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
  setOnline(true);
  // Default: server accepts the upsert and echoes back a generated id_pendaki.
  supabaseMock.state.result = {
    data: [{ id: '11111111-1111-4111-8111-111111111111', id_pendaki: 'PDK-0001' }],
    error: null,
  };
  supabaseMock.client.from.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('trySyncRegistration', () => {
  it('does not sync when offline', async () => {
    setOnline(false);
    const ok = await trySyncRegistration({ id: 1, ...buildRegistration() });
    expect(ok).toBe(false);
    expect(supabaseMock.client.from).not.toHaveBeenCalled();
  });

  it('does not sync when Supabase is not configured', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const ok = await trySyncRegistration({ id: 1, ...buildRegistration() });
    expect(ok).toBe(false);
    expect(supabaseMock.client.from).not.toHaveBeenCalled();
  });

  it('syncs online, marks the local record synced and stores the returned id_pendaki', async () => {
    // Save while offline so it lands unsynced (saveRegistration also tries to sync).
    setOnline(false);
    await saveRegistration(buildRegistration());
    let [saved] = await getAllRegistrations();
    expect(saved.synced).toBe(false);

    // Back online: sync the queued record.
    setOnline(true);
    const ok = await trySyncRegistration(saved);
    expect(ok).toBe(true);
    expect(supabaseMock.client.from).toHaveBeenCalledWith('users');

    [saved] = await getAllRegistrations();
    expect(saved.synced).toBe(true);
    // id_pendaki echoed back from the (mocked) server is persisted locally.
    expect((saved as any).id_pendaki).toBe('PDK-0001');
  });

  it('returns false and keeps the record unsynced when Supabase returns an error', async () => {
    supabaseMock.state.result = { data: null, error: { message: 'insert failed' } };

    setOnline(false);
    await saveRegistration(buildRegistration());
    setOnline(true);

    const [saved] = await getAllRegistrations();
    const ok = await trySyncRegistration(saved);
    expect(ok).toBe(false);

    const [after] = await getAllRegistrations();
    expect(after.synced).toBe(false);
  });
});

describe('syncAllUnsyncedData', () => {
  it('returns zero counts when offline', async () => {
    setOnline(false);
    const res = await syncAllUnsyncedData();
    expect(res).toEqual({ registrationsSynced: 0, scansSynced: 0, simaksiSynced: 0 });
  });

  it('syncs every queued registration once back online', async () => {
    // Queue two registrations while offline.
    setOnline(false);
    await saveRegistration(buildRegistration({ name: 'Budi' }));
    await saveRegistration(buildRegistration({ name: 'Andi' }));
    expect(await getAllRegistrations()).toHaveLength(2);

    setOnline(true);
    const res = await syncAllUnsyncedData();
    expect(res.registrationsSynced).toBe(2);

    const all = await getAllRegistrations();
    expect(all.every((r) => r.synced)).toBe(true);
  });
});
