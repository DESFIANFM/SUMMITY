import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteRegistration,
  getAllRegistrations,
  getAllScans,
  getAllSimaksi,
  markScansSynced,
  saveRegistration,
  saveScan,
  saveSimaksi,
  updateRegistrationStatus,
} from './db';
import type { RegistrationRequest, ScanLog, SimaksiRequest } from '../types';

// Integration tests exercising the real IndexedDB code paths against an
// in-memory fake. No Supabase env vars are set, so every sync attempt is a
// no-op and the app stays in "LOCAL mode" — exactly the offline behaviour we
// want to guarantee.

// Give each test a pristine database.
beforeEach(() => {
  // Fresh in-memory IndexedDB per test. Cast because fake-indexeddb's IDBFactory
  // is structurally-but-not-nominally the same as lib.dom's.
  globalThis.indexedDB = new IDBFactory() as unknown as IDBFactory;
});

function buildRegistration(overrides: Partial<RegistrationRequest> = {}): Omit<RegistrationRequest, 'id'> {
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

describe('registrations (offline queue)', () => {
  it('persists a registration and returns an auto-increment id', async () => {
    const id = await saveRegistration(buildRegistration());
    expect(typeof id).toBe('number');

    const all = await getAllRegistrations();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ name: 'Budi Pendaki', mountain: 'Gn. Slamet' });
  });

  it('keeps records unsynced while offline (no Supabase configured)', async () => {
    await saveRegistration(buildRegistration());
    const [saved] = await getAllRegistrations();
    expect(saved.synced).toBe(false);
  });

  it('updates the status of an existing registration', async () => {
    const id = await saveRegistration(buildRegistration());
    await updateRegistrationStatus(id as number, 'APPROVED');

    const [updated] = await getAllRegistrations();
    expect(updated.status).toBe('APPROVED');
    // marked dirty again so it re-syncs when back online
    expect(updated.synced).toBe(false);
  });

  it('deletes a registration', async () => {
    const id = await saveRegistration(buildRegistration());
    await deleteRegistration(id as number);
    expect(await getAllRegistrations()).toHaveLength(0);
  });
});

describe('scan queue', () => {
  const scan: Omit<ScanLog, 'id'> = {
    ticketId: 'TICK-1',
    userId: 'USER-1',
    timestamp: '2026-07-19T08:00:00.000Z',
    type: 'POST_CHECK',
    posId: 3,
    synced: false,
  };

  it('stores a scan and reads it back', async () => {
    await saveScan(scan);
    const all = await getAllScans();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ ticketId: 'TICK-1', posId: 3 });
  });

  it('marks queued scans as synced by id', async () => {
    const id = await saveScan(scan);
    await markScansSynced([id as number]);

    const [updated] = await getAllScans();
    expect(updated.synced).toBe(true);
  });
});

describe('simaksi', () => {
  const simaksi: Omit<SimaksiRequest, 'id'> = {
    ketuaUserId: 'USER-1',
    ketuaName: 'Budi',
    gunungId: 1,
    tanggalNaik: '2026-07-19',
    tanggalTurun: '2026-07-21',
    status: 'pending',
    createdAt: '2026-07-18T00:00:00.000Z',
    members: [{ id: 'USER-2', name: 'Andi' }],
  };

  it('persists a simaksi request locally', async () => {
    const id = await saveSimaksi(simaksi);
    expect(typeof id).toBe('number');

    const all = await getAllSimaksi();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ ketuaUserId: 'USER-1', status: 'pending' });
    expect((all[0] as any).members).toHaveLength(1);
  });
});
