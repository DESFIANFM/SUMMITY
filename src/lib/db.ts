import { openDB, IDBPDatabase } from 'idb';
import { ScanLog, RegistrationRequest } from '../types';
import { createClient } from '@supabase/supabase-js';

console.log('🔵 db.ts loaded');

const DB_NAME = 'summity-db';
const STORE_NAME = 'scans';
const REG_STORE = 'registrations';

// Lazy-initialize the Supabase client safely so it does not crash on missing credentials
let supabaseClient: any = null;

export function getSupabaseClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.log('[DB] ❌ Supabase credentials missing - using LOCAL mode only');
    return null;
  }

  if (!supabaseClient) {
    console.log('[DB] 🔌 Initializing Supabase client with URL:', url);
    supabaseClient = createClient(url, key);
  }
  console.log('[DB] ✅ Supabase client ready');
  return supabaseClient;
}

export async function initDB() {
  return openDB(DB_NAME, 6, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('synced', 'synced');
      } else if (transaction) {
        const store = transaction.objectStore(STORE_NAME);
        if (!store.indexNames.contains('synced')) {
          store.createIndex('synced', 'synced');
        }
      }
      
      if (!db.objectStoreNames.contains(REG_STORE)) {
        const store = db.createObjectStore(REG_STORE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('synced', 'synced');
      } else if (transaction) {
        const store = transaction.objectStore(REG_STORE);
        if (!store.indexNames.contains('synced')) {
          store.createIndex('synced', 'synced');
        }
      }
    },
  });
}

// Check online status
export function isOnline() {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

// --------------------------------------------------------------------
// SYNC LOGIC FOR REGISTRATIONS
// --------------------------------------------------------------------

export async function trySyncRegistration(reg: any): Promise<boolean> {
  const supabase = getSupabaseClient();
  console.log('[SYNC] 🔄 Attempting to sync registration ID:', reg.id, 'Online:', isOnline(), 'HasSupabase:', !!supabase);
  
  if (!supabase || !isOnline()) {
    console.log('[SYNC] ⏸️  Sync blocked - Supabase:', !!supabase, 'Online:', isOnline());
    return false;
  }

  try {
    console.log('[SYNC] 📤 Sending registration to Supabase...');
    const { error } = await supabase
      .from('registrations')
      .upsert({
        id: reg.id,
        userId: reg.userId,
        name: reg.name,
        nik: reg.nik,
        phone: reg.phone,
        emergencyPhone: reg.emergencyPhone,
        birthDate: reg.birthDate,
        address: reg.address,
        gender: reg.gender,
        mountain: reg.mountain,
        date: reg.date,
        endDate: reg.endDate,
        status: reg.status,
        createdAt: reg.createdAt,
        isLeader: reg.isLeader || false,
        members: reg.members || [],
        checkedGears: reg.checkedGears || [],
      });

    if (!error) {
      console.log('[SYNC] ✅ Registration synced to Supabase successfully!');
      const db = await initDB();
      const tx = db.transaction(REG_STORE, 'readwrite');
      const store = tx.objectStore(REG_STORE);
      const savedReg = await store.get(reg.id);
      if (savedReg) {
        savedReg.synced = true;
        await store.put(savedReg);
        console.log('[SYNC] 💾 Marked registration as synced in LocalDB');
      }
      await tx.done;
      return true;
    } else {
      console.warn('[SYNC] ❌ Supabase registration error:', error, '- will retry offline');
      return false;
    }
  } catch (err) {
    console.warn('[SYNC] ⚠️  Failed to sync registration:', err);
    return false;
  }
}

export async function saveRegistration(reg: Omit<RegistrationRequest, 'id'>) {
  console.log('🟢 saveRegistration function CALLED with:', reg.name);
  const db = await initDB();
  console.log('[SAVE] 💾 Saving registration to LocalDB:', reg.name, reg.mountain);
  
  // Keep synced as false initially
  const localId = await db.add(REG_STORE, { ...reg, synced: false });
  console.log('[SAVE] ✅ Registration saved locally with ID:', localId);
  
  // Try immediate sync to Supabase
  console.log('[SAVE] 🔄 Attempting immediate Supabase sync...');
  const regWithId = { ...reg, id: localId, synced: false };
  const syncResult = await trySyncRegistration(regWithId);
  console.log('[SAVE] Sync attempt result:', syncResult ? '✅ Success' : '⏸️  Offline/Failed');
  return localId;
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
    reg.synced = false; // trigger sync again on reconnection
    await store.put(reg);
  }
  await tx.done;

  if (reg) {
    await trySyncRegistration(reg);
  }
}

export async function deleteRegistration(id: number) {
  const db = await initDB();
  await db.delete(REG_STORE, id);

  const supabase = getSupabaseClient();
  if (supabase && isOnline()) {
    try {
      await supabase.from('registrations').delete().eq('id', id);
    } catch (err) {
      console.warn('Failed to delete registration from Supabase:', err);
    }
  }
}

// --------------------------------------------------------------------
// SYNC LOGIC FOR SCANS
// --------------------------------------------------------------------

export async function trySyncScan(scan: any): Promise<boolean> {
  const supabase = getSupabaseClient();
  console.log('[SYNC] 🔄 Attempting to sync scan ID:', scan.id, 'TicketID:', scan.ticketId, 'Online:', isOnline());
  
  if (!supabase || !isOnline()) {
    console.log('[SYNC] ⏸️  Scan sync blocked - Supabase:', !!supabase, 'Online:', isOnline());
    return false;
  }

  try {
    console.log('[SYNC] 📤 Sending scan to Supabase...');
    const { error } = await supabase
      .from('scans')
      .upsert({
        id: scan.id,
        ticketId: scan.ticketId,
        timestamp: scan.timestamp,
        type: scan.type,
        posId: scan.posId
      });

    if (!error) {
      console.log('[SYNC] ✅ Scan synced to Supabase successfully!');
      const db = await initDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const savedScan = await store.get(scan.id);
      if (savedScan) {
        savedScan.synced = true;
        await store.put(savedScan);
        console.log('[SYNC] 💾 Marked scan as synced in LocalDB');
      }
      await tx.done;
      return true;
    } else {
      console.warn('[SYNC] ❌ Supabase scan error:', error, '- will retry offline');
      return false;
    }
  } catch (err) {
    console.warn('[SYNC] ⚠️  Failed to sync scan:', err);
    return false;
  }
}

export async function saveScan(scan: Omit<ScanLog, 'id'>) {
  const db = await initDB();
  console.log('[SAVE] 💾 Saving scan to LocalDB:', scan.ticketId, 'Type:', scan.type, 'PosID:', scan.posId);
  
  const localId = await db.add(STORE_NAME, { ...scan, synced: false });
  console.log('[SAVE] ✅ Scan saved locally with ID:', localId);
  
  console.log('[SAVE] 🔄 Attempting immediate Supabase sync...');
  const scanWithId = { ...scan, id: localId, synced: false };
  const syncResult = await trySyncScan(scanWithId);
  console.log('[SAVE] Scan sync attempt result:', syncResult ? '✅ Success' : '⏸️  Offline/Failed');
  return localId;
}

export async function getUnsyncedScans() {
  const db = await initDB();
  return db.getAllFromIndex(STORE_NAME, 'synced', 0); // 0 representing false
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

// --------------------------------------------------------------------
// DATABASE SYNCHRONIZATION FUNCTION
// --------------------------------------------------------------------

export async function syncAllUnsyncedData(): Promise<{ registrationsSynced: number, scansSynced: number }> {
  const supabase = getSupabaseClient();
  let registrationsSynced = 0;
  let scansSynced = 0;

  console.log('[SYNC-ALL] 🔄 Starting data sync check...');
  console.log('[SYNC-ALL] Online:', isOnline(), 'HasSupabase:', !!supabase);
  
  if (!supabase || !isOnline()) {
    console.log('[SYNC-ALL] ⏸️  Sync blocked - will try again when online');
    return { registrationsSynced, scansSynced };
  }

  try {
    const db = await initDB();
    
    // Sync registrations
    const regs = await db.getAll(REG_STORE);
    console.log('[SYNC-ALL] 📋 Found', regs.length, 'registrations total');
    const unsyncedRegs = regs.filter(r => !r.synced);
    console.log('[SYNC-ALL] 📋 Unsynced registrations:', unsyncedRegs.length);
    
    for (const reg of unsyncedRegs) {
      const success = await trySyncRegistration(reg);
      if (success) {
        registrationsSynced++;
        console.log('[SYNC-ALL] ✅ Registration', reg.id, 'synced');
      }
    }

    // Sync scans
    const scans = await db.getAll(STORE_NAME);
    console.log('[SYNC-ALL] 📊 Found', scans.length, 'scans total');
    const unsyncedScans = scans.filter(s => !s.synced);
    console.log('[SYNC-ALL] 📊 Unsynced scans:', unsyncedScans.length);
    
    for (const scan of unsyncedScans) {
      const success = await trySyncScan(scan);
      if (success) {
        scansSynced++;
        console.log('[SYNC-ALL] ✅ Scan', scan.id, 'synced');
      }
    }
    
    console.log('[SYNC-ALL] ✅ Sync complete! Registrations:', registrationsSynced, 'Scans:', scansSynced);
  } catch (err) {
    console.error('[SYNC-ALL] ❌ Sync failed:', err);
  }

  return { registrationsSynced, scansSynced };
}

// Autostart sync listeners on runtime environments
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Koneksi internet terdeteksi. Berjalan penyelarasan otomatis...');
    syncAllUnsyncedData()
      .then((res) => {
        if (res.registrationsSynced > 0 || res.scansSynced > 0) {
          console.log(`[Penyelarasan] Sukses sinkronisasi: ${res.registrationsSynced} registrasi & ${res.scansSynced} log scan.`);
        }
      })
      .catch(console.error);
  });

  // Periodic fallback sync checks every 10 seconds
  setInterval(() => {
    if (isOnline()) {
      syncAllUnsyncedData().catch(console.error);
    }
  }, 10000);
}
