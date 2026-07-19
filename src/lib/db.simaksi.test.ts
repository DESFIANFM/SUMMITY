import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SimaksiRequest } from '../types';

// ---------------------------------------------------------------------------
// Tests for the SIMAKSI online paths in db.ts. Because each function issues a
// DIFFERENT set of queries (single / maybeSingle / list, across several
// tables), we use a "router" Supabase mock: every query records the table it
// hit plus the chain of operations, and a per-test `resolver({ table, ops })`
// decides what `{ data, error }` to return. No real Supabase involved.
// ---------------------------------------------------------------------------

const { supabaseMock } = vi.hoisted(() => {
  type Op = [string, any[]];
  const state = {
    resolver: (_ctx: { table: string; ops: Op[] }): any => ({ data: null, error: null }),
  };

  const makeBuilder = (table: string) => {
    const ops: Op[] = [];
    const builder: any = {};
    const record = (name: string) => (...args: any[]) => {
      ops.push([name, args]);
      return builder;
    };
    for (const m of ['insert', 'upsert', 'update', 'delete', 'select', 'eq', 'neq', 'in', 'is', 'order', 'limit', 'gte', 'lte']) {
      builder[m] = record(m);
    }
    // Terminal resolvers — Supabase resolves to { data, error } in every case.
    const settle = (name: string) => (...args: any[]) => {
      ops.push([name, args]);
      return Promise.resolve(state.resolver({ table, ops }));
    };
    builder.single = settle('single');
    builder.maybeSingle = settle('maybeSingle');
    builder.then = (onF: any, onR?: any) =>
      Promise.resolve(state.resolver({ table, ops })).then(onF, onR);
    return builder;
  };

  const client = { from: vi.fn((t: string) => makeBuilder(t)) };
  return { supabaseMock: { state, client } };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => supabaseMock.client,
}));

import {
  approveSimaksi,
  completeSimaksi,
  getActiveSimaksiCount,
  getAllSimaksi,
  getPendingSimaksi,
  getUserActiveSimaksi,
  rejectSimaksi,
  saveSimaksi,
  trySyncSimaksi,
} from './db';

// --- helpers ---------------------------------------------------------------
type Op = [string, any[]];
const hasOp = (ops: Op[], name: string) => ops.some(([m]) => m === name);

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
}

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

function buildSimaksi(overrides: Partial<SimaksiRequest> = {}): Omit<SimaksiRequest, 'id'> {
  return {
    ketuaUserId: 'USER-1',
    ketuaName: 'Budi',
    gunungId: 1,
    tanggalNaik: '2026-07-19',
    tanggalTurun: '2026-07-21',
    status: 'pending',
    createdAt: '2026-07-18T00:00:00.000Z',
    members: [{ id: 'USER-2', name: 'Andi' }],
    ...overrides,
  };
}

/** Seed a simaksi into IndexedDB while offline (so it stays unsynced). */
async function seedLocalSimaksi(overrides: Partial<SimaksiRequest> = {}): Promise<number> {
  setOnline(false);
  const id = await saveSimaksi(buildSimaksi(overrides));
  setOnline(true);
  return id;
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory() as unknown as IDBFactory;
  vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
  setOnline(true);
  state().resolver = () => ({ data: null, error: null });
  supabaseMock.client.from.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function state() {
  return supabaseMock.state;
}

// ---------------------------------------------------------------------------
describe('trySyncSimaksi', () => {
  it('does not sync when offline', async () => {
    setOnline(false);
    expect(await trySyncSimaksi({ id: 1, ...buildSimaksi() })).toBe(false);
    expect(supabaseMock.client.from).not.toHaveBeenCalled();
  });

  it('returns false when the ketua cannot be resolved in the users table', async () => {
    state().resolver = ({ table }) => {
      if (table === 'users') return { data: null, error: null }; // ketua lookup -> not found
      return { data: null, error: null };
    };
    // ketuaUserId is NOT a UUID -> triggers the users lookup, which returns null.
    expect(await trySyncSimaksi({ id: 1, ...buildSimaksi({ ketuaUserId: 'USER-1' }) })).toBe(false);
  });

  it('inserts the header + members and marks the local record synced', async () => {
    const localId = await seedLocalSimaksi({ ketuaUserId: UUID_A });

    state().resolver = ({ table, ops }) => {
      if (table === 'users') return { data: { id: UUID_B }, error: null }; // member lookup
      if (table === 'simaksi' && hasOp(ops, 'single')) return { data: { id: 501 }, error: null }; // header insert
      if (table === 'simaksi_anggota') return { data: null, error: null };
      return { data: null, error: null };
    };

    const saved = (await getAllSimaksi()).find((s: any) => s.id === localId);
    const ok = await trySyncSimaksi(saved);
    expect(ok).toBe(true);
    expect(supabaseMock.client.from).toHaveBeenCalledWith('simaksi');
    expect(supabaseMock.client.from).toHaveBeenCalledWith('simaksi_anggota');

    const after = (await getAllSimaksi()).find((s: any) => s.id === localId) as any;
    expect(after.synced).toBe(true);
    expect(after.simaksiId).toBe(501);
  });

  it('returns false when the header insert fails', async () => {
    const localId = await seedLocalSimaksi({ ketuaUserId: UUID_A });
    state().resolver = ({ table, ops }) => {
      if (table === 'simaksi' && hasOp(ops, 'single')) return { data: null, error: { message: 'boom' } };
      return { data: null, error: null };
    };
    const saved = (await getAllSimaksi()).find((s: any) => s.id === localId);
    expect(await trySyncSimaksi(saved)).toBe(false);
    const after = (await getAllSimaksi()).find((s: any) => s.id === localId) as any;
    expect(after.synced).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('getActiveSimaksiCount', () => {
  it('sums total_anggota of approved rows from Supabase when online', async () => {
    state().resolver = ({ table }) => {
      if (table === 'simaksi') return { data: [{ total_anggota: 3 }, { total_anggota: 2 }], error: null };
      return { data: null, error: null };
    };
    expect(await getActiveSimaksiCount()).toBe(5);
  });

  it('falls back to counting approved simaksi in IndexedDB when offline', async () => {
    setOnline(false);
    // Two approved parties, each with a 2-person group (ketua + 1 member).
    await saveSimaksi(buildSimaksi({ status: 'approved' }));
    await saveSimaksi(buildSimaksi({ status: 'approved' }));
    await saveSimaksi(buildSimaksi({ status: 'pending' })); // ignored
    expect(await getActiveSimaksiCount()).toBe(4);
  });
});

// ---------------------------------------------------------------------------
describe('getPendingSimaksi', () => {
  it('maps pending rows and resolves ketua names from Supabase when online', async () => {
    state().resolver = ({ table }) => {
      if (table === 'simaksi') {
        return {
          data: [{
            id: 7,
            ketua_user_id: UUID_A,
            tanggal_naik: '2026-07-19',
            tanggal_turun: '2026-07-21',
            total_anggota: 2,
            status: 'pending',
            created_at: '2026-07-18T00:00:00.000Z',
          }],
          error: null,
        };
      }
      if (table === 'users') return { data: [{ id: UUID_A, name: 'Budi', id_pendaki: 'PDK-1' }], error: null };
      return { data: null, error: null };
    };

    const list = await getPendingSimaksi();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      simaksiId: 7,
      ketuaName: 'Budi',
      idPendaki: 'PDK-1',
      status: 'pending',
      source: 'supabase',
    });
  });

  it('reads pending simaksi from IndexedDB when offline', async () => {
    setOnline(false);
    await saveSimaksi(buildSimaksi({ status: 'pending', ketuaName: 'Offline Ketua' }));
    await saveSimaksi(buildSimaksi({ status: 'approved' })); // ignored

    const list = await getPendingSimaksi();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ ketuaName: 'Offline Ketua', status: 'pending', source: 'local' });
  });
});

// ---------------------------------------------------------------------------
describe('getUserActiveSimaksi', () => {
  it('finds the active party where the user is the ketua (offline)', async () => {
    setOnline(false);
    await saveSimaksi(buildSimaksi({ ketuaUserId: 'USER-1', status: 'approved' }));

    const res = await getUserActiveSimaksi('USER-1');
    expect(res).toMatchObject({ status: 'approved', isKetua: true, ketuaUserId: 'USER-1' });
  });

  it('finds the active party where the user is a member (offline)', async () => {
    setOnline(false);
    await saveSimaksi(buildSimaksi({
      ketuaUserId: 'USER-9',
      status: 'pending',
      members: [{ id: 'USER-1', name: 'Andi' }],
    }));

    const res = await getUserActiveSimaksi('USER-1');
    expect(res).toMatchObject({ isKetua: false, ketuaUserId: 'USER-9' });
  });

  it('returns null when the user has no active party (offline)', async () => {
    setOnline(false);
    expect(await getUserActiveSimaksi('USER-1')).toBeNull();
  });

  it('resolves the ketua party from Supabase when online', async () => {
    state().resolver = ({ table }) => {
      if (table === 'simaksi') {
        return {
          data: {
            id: 42,
            status: 'approved',
            ketua_user_id: UUID_A,
            tanggal_naik: '2026-07-19',
            tanggal_turun: '2026-07-21',
          },
          error: null,
        };
      }
      if (table === 'users') return { data: { name: 'Budi' }, error: null };
      return { data: null, error: null };
    };

    const res = await getUserActiveSimaksi(UUID_A);
    expect(res).toMatchObject({ simaksiId: 42, ketuaName: 'Budi', isKetua: true });
  });
});

// ---------------------------------------------------------------------------
describe('approveSimaksi', () => {
  it('updates status, issues tickets online and marks the local record synced', async () => {
    const localId = await seedLocalSimaksi({ status: 'pending' });

    state().resolver = ({ table, ops }) => {
      if (table === 'simaksi') {
        if (hasOp(ops, 'update')) return { data: null, error: null }; // status update
        if (hasOp(ops, 'single')) {
          return {
            data: { ketua_user_id: UUID_A, gunung_id: 1, tanggal_naik: '2026-07-19', tanggal_turun: '2026-07-21' },
            error: null,
          };
        }
      }
      if (table === 'simaksi_anggota') return { data: [{ user_id: UUID_B }], error: null };
      if (table === 'gunung') return { data: { nama: 'Gn. Slamet' }, error: null };
      if (table === 'tickets') return { data: null, error: null };
      return { data: null, error: null };
    };

    expect(await approveSimaksi(localId, localId)).toBe(true);
    expect(supabaseMock.client.from).toHaveBeenCalledWith('tickets');

    const after = (await getAllSimaksi()).find((s: any) => s.id === localId) as any;
    expect(after.status).toBe('approved');
    expect(after.synced).toBe(true);
    expect(after.kodeSimaksi).toMatch(/^SMK-\d{6}-\d{4}$/);
  });

  it('updates the local record but returns false when offline', async () => {
    const localId = await seedLocalSimaksi({ status: 'pending' });
    setOnline(false);

    expect(await approveSimaksi(localId, localId)).toBe(false);
    const after = (await getAllSimaksi()).find((s: any) => s.id === localId) as any;
    expect(after.status).toBe('approved');
    expect(after.synced).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('rejectSimaksi', () => {
  it('rejects online and persists the verifier note locally', async () => {
    const localId = await seedLocalSimaksi({ status: 'pending' });
    state().resolver = () => ({ data: null, error: null });

    expect(await rejectSimaksi(localId, localId, 'Dokumen kurang')).toBe(true);
    const after = (await getAllSimaksi()).find((s: any) => s.id === localId) as any;
    expect(after.status).toBe('rejected');
    expect(after.catatanVerifikator).toBe('Dokumen kurang');
    expect(after.synced).toBe(true);
  });

  it('returns false but still rejects locally when offline', async () => {
    const localId = await seedLocalSimaksi({ status: 'pending' });
    setOnline(false);

    expect(await rejectSimaksi(localId, localId)).toBe(false);
    const after = (await getAllSimaksi()).find((s: any) => s.id === localId) as any;
    expect(after.status).toBe('rejected');
    expect(after.synced).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('completeSimaksi', () => {
  it('completes online and returns the kode_simaksi', async () => {
    const localId = await seedLocalSimaksi({ status: 'approved' });

    state().resolver = ({ table, ops }) => {
      if (table === 'simaksi') {
        if (hasOp(ops, 'update')) return { data: { kode_simaksi: 'SMK-202607-0001' }, error: null };
        if (hasOp(ops, 'single')) return { data: { ketua_user_id: UUID_A }, error: null };
      }
      if (table === 'simaksi_anggota') return { data: [], error: null };
      if (table === 'tickets') return { data: null, error: null }; // no active ticket -> no tracking insert
      return { data: null, error: null };
    };

    const res = await completeSimaksi(localId);
    expect(res).toEqual({ ok: true, kodeSimaksi: 'SMK-202607-0001' });

    const after = (await getAllSimaksi()).find((s: any) => s.id === localId) as any;
    expect(after.status).toBe('complete');
    expect(after.synced).toBe(true);
  });

  it('returns ok:false and marks the local record complete-but-unsynced when offline', async () => {
    const localId = await seedLocalSimaksi({ status: 'approved' });
    setOnline(false);

    const res = await completeSimaksi(localId);
    expect(res.ok).toBe(false);
    const after = (await getAllSimaksi()).find((s: any) => s.id === localId) as any;
    expect(after.status).toBe('complete');
    expect(after.synced).toBe(false);
  });
});
