import { openDB, IDBPDatabase } from 'idb';
import { ScanLog, RegistrationRequest } from '../types';

const DB_NAME = 'summity-db';
const STORE_NAME = 'scans';
const REG_STORE = 'registrations';

export async function initDB() {
  return openDB(DB_NAME, 5, {
    upgrade(db, oldVersion) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('synced', 'synced');
      }
      if (!db.objectStoreNames.contains(REG_STORE)) {
        db.createObjectStore(REG_STORE, {
          keyPath: 'id',
          autoIncrement: true,
        });
      }
    },
  });
}

export async function saveScan(scan: Omit<ScanLog, 'id'>) {
  const db = await initDB();
  return db.add(STORE_NAME, scan);
}

export async function saveRegistration(reg: Omit<RegistrationRequest, 'id'>) {
  const db = await initDB();
  return db.add(REG_STORE, reg);
}

export async function getAllRegistrations() {
  const db = await initDB();
  return db.getAll(REG_STORE);
}

export async function updateRegistrationStatus(id: number, status: 'APPROVED' | 'REJECTED') {
  const db = await initDB();
  const tx = db.transaction(REG_STORE, 'readwrite');
  const store = tx.objectStore(REG_STORE);
  const reg = await store.get(id);
  if (reg) {
    reg.status = status;
    await store.put(reg);
  }
  await tx.done;
}

export async function deleteRegistration(id: number) {
  const db = await initDB();
  return db.delete(REG_STORE, id);
}

export async function getUnsyncedScans() {
  const db = await initDB();
  return db.getAllFromIndex(STORE_NAME, 'synced', 0); // 0 for false
}

export async function getAllScans() {
  const db = await initDB();
  return db.getAll(STORE_NAME);
}

export async function markScansSynced(ids: number[]) {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  
  for (const id of ids) {
    const scan = await store.get(id);
    if (scan) {
      scan.synced = true;
      await store.put(scan);
    }
  }
  await tx.done;
}
