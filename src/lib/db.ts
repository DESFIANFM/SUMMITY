  import { openDB, IDBPDatabase } from 'idb';
  import { ScanLog, RegistrationRequest } from '../types';
  import { createClient } from '@supabase/supabase-js';

  console.log('🔵 db.ts loaded');

  const DB_NAME = 'summity-db';
  const STORE_NAME = 'scans';
  const REG_STORE = 'registrations';

  // Utility: convert camelCase keys to snake_case for Supabase/Postgres
  function toSnakeCaseKey(key: string): string {
    return key.replace(/([A-Z])/g, '_$1').toLowerCase();
  }

  function toSnakeCaseObject(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[toSnakeCaseKey(key)] = obj[key];
      }
    }
    return result;
  }

  // Simple UUID v4 validation
  function isValidUUID(value: any): boolean {
    if (typeof value !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }

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
      // Convert camelCase to snake_case for Supabase
      const payload = toSnakeCaseObject({
        // Core identifiers
        id: reg.id,
        // NOTE: displayId is kept locally in localStorage only; not synced to Supabase

        // Account/profile fields (if present)
        name: reg.name,
        email: (reg as any).email,
        username: (reg as any).username,
        password: (reg as any).password,
        phone: reg.phone,
        emergencyPhone: reg.emergencyPhone,
        citizenship: (reg as any).citizenship,
        identityType: (reg as any).identityType,
        nik: reg.nik,
        gender: reg.gender,
        weight: (reg as any).weight,
        height: (reg as any).height,
        address: reg.address,
        province: (reg as any).province,
        city: (reg as any).city,
        district: (reg as any).district,
        subdistrict: (reg as any).subdistrict,
        role: (reg as any).role || 'USER',

        // Registration-specific fields (kept aside for now)
        mountain: reg.mountain,
        date: reg.date,
        endDate: reg.endDate,
        status: reg.status,
        createdAt: reg.createdAt,
        isLeader: reg.isLeader || false,
      });
      
      // Whitelist only columns that exist in the registrations table
      // Map registration/account fields to the users table allowed columns
      const ALLOWED_COLUMNS = new Set([
        'id',
        'name',
        'email',
        'username',
        'password',
        'phone',
        'emergency_phone',
        'citizenship',
        'identity_type',
        'nik',
        'gender',
        'weight',
        'height',
        'address',
        'province',
        'city',
        'district',
        'subdistrict',
        'role',
      ]);
      
      const filteredPayload: Record<string, any> = {};
      // When converting registration/account payloads, also try to copy
      // top-level account fields if present. This allows the Register UI to
      // save into `users` directly.
      for (const key of Object.keys(payload)) {
        if (ALLOWED_COLUMNS.has(key)) {
          filteredPayload[key] = payload[key];
        } else {
          // skip fields that are not part of `users` yet
        }
      }
      
      console.log('[SYNC] 📋 Converted payload (snake_case, filtered):', JSON.stringify(filteredPayload, null, 2));

      // NOTE: switched to upserting into `users` table instead of `registrations`.
      // The app currently prefers to persist account data in `users` and avoid
      // using the `registrations` table until later.
      const { error } = await supabase
        .from('users')
        .upsert(filteredPayload);

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
      // Try to sync the underlying user record (registration->user mode)
      try {
        await trySyncRegistration(reg);
      } catch (e) {
        console.warn('[UPDATE] Failed to sync user after status change', e);
      }
    }
  }

  export async function deleteRegistration(id: number) {
    const db = await initDB();
    await db.delete(REG_STORE, id);

    const supabase = getSupabaseClient();
    if (supabase && isOnline()) {
      try {
    // Prefer deleting user record when removing a registration locally
    await supabase.from('users').delete().eq('id', id);
      } catch (err) {
        console.warn('Failed to delete registration from Supabase:', err);
      }
    }
  }

  // --------------------------------------------------------------------
  // TICKET CREATION
  // --------------------------------------------------------------------

  export async function createTicket(ticketData: {
    id: string;
    mountainName: string;
    date: string;
    endDate?: string;
    status?: 'PENDING' | 'APPROVED' | 'REJECTED';
    qrCode?: string;
  }): Promise<boolean> {
    const supabase = getSupabaseClient();
    console.log('[TICKET] 🎫 Attempting to create ticket:', ticketData.id);
    
    if (!supabase || !isOnline()) {
      console.log('[TICKET] ⏸️  Ticket creation blocked - Supabase:', !!supabase, 'Online:', isOnline());
      return false;
    }

    try {
      const payload = toSnakeCaseObject({
        id: ticketData.id,
        mountainName: ticketData.mountainName,
        date: ticketData.date,
        endDate: ticketData.endDate,
        status: ticketData.status || 'PENDING',
        qrCode: ticketData.qrCode,
      });

      console.log('[TICKET] 📋 Creating ticket with payload:', JSON.stringify(payload, null, 2));

      const { error } = await supabase
        .from('tickets')
        .insert(payload);

      if (!error) {
        console.log('[TICKET] ✅ Ticket created successfully:', ticketData.id);
        return true;
      } else {
        console.warn('[TICKET] ❌ Supabase ticket error:', error);
        return false;
      }
    } catch (err) {
      console.warn('[TICKET] ⚠️  Failed to create ticket:', err);
      return false;
    }
  }

  // Check if user has an active ticket (APPROVED or PENDING)
  export async function hasActiveTicket(userId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      // Fallback to local check
      const regs = await getAllRegistrations();
      return regs.some(
        r => r.userId === userId && (r.status === 'APPROVED' || r.status === 'PENDING')
      );
    }

    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('id, status')
        .eq('user_id', userId)
        .in('status', ['APPROVED', 'PENDING'])
        .limit(1);

      if (!error && data && data.length > 0) {
        console.log('[TICKET] ✅ Active ticket found for user:', userId);
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[TICKET] ⚠️  Failed to check active ticket:', err);
      return false;
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
      
      // Resolve ticketId: convert display format (SUMMITY-USER-2) to UUID
      let resolvedTicketId = scan.ticketId;
      console.log('[DEBUG] === TICKET ID RESOLUTION ===');
      console.log('[DEBUG] scan.ticketId (raw):', scan.ticketId);
      
      // If ticketId is not already a UUID, look it up in usersList
      if (!isValidUUID(resolvedTicketId)) {
        const searchDisplay = String(scan.ticketId || '').toUpperCase();
        console.log('[DEBUG] searchDisplay (after toUpperCase):', searchDisplay);
        
        const usersListStr = localStorage.getItem('summity_users_list');
        const usersList: any[] = usersListStr ? JSON.parse(usersListStr) : [];
        console.log('[DEBUG] usersList from localStorage:', JSON.stringify(usersList, null, 2));
        
        let found = usersList.find(
          u =>
            (u.displayId &&
              u.displayId.toUpperCase() === searchDisplay) ||
            (u.id &&
              String(u.id).toUpperCase() === searchDisplay)
        );
        
        console.log('[DEBUG] found user:', found);
        
        if (found) {
          console.log('[DEBUG] ✅ Resolved ticketId to UUID:', found.id);
          resolvedTicketId = found.id;
        } else {
          console.warn('[DEBUG] ⚠️ User not found in list, generating new UUID for display:', searchDisplay);
          // Generate new UUID and store mapping
          const newInternalId = (typeof crypto !== 'undefined' && (crypto as any).randomUUID)
            ? (crypto as any).randomUUID()
            : `generated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const newEntry = { id: newInternalId, displayId: searchDisplay };
          usersList.push(newEntry);
          localStorage.setItem('summity_users_list', JSON.stringify(usersList));
          console.log('[DEBUG] Created new user mapping:', newEntry);
          resolvedTicketId = newInternalId;
        }
      }
      console.log('[DEBUG] === END TICKET ID RESOLUTION ===');
      
      // ENSURE TICKET EXISTS: Before inserting scan, make sure ticket exists in tickets table
      try {
        console.log('[DEBUG] === ENSURE TICKET EXISTS ===');
        console.log('[DEBUG] Checking if ticket exists in Supabase...');
        const { data: existingTicket } = await supabase
          .from('tickets')
          .select('id')
          .eq('id', resolvedTicketId)
          .maybeSingle();
        
        if (!existingTicket) {
          console.log('[DEBUG] Ticket not found - creating minimal ticket record...');
          
          // Create minimal ticket with required fields
          const ticketPayload = toSnakeCaseObject({
            id: resolvedTicketId,
            mountainName: 'Unknown', // Fallback name
            date: new Date().toISOString().split('T')[0], // Today's date
            status: 'PENDING',
          });
          
          console.log('[DEBUG] Creating ticket with payload:', JSON.stringify(ticketPayload, null, 2));
          
          const { error: ticketError } = await supabase
            .from('tickets')
            .insert(ticketPayload);
          
          if (ticketError) {
            console.warn('[DEBUG] ❌ Failed to create ticket:', ticketError);
            console.warn('[DEBUG] Scan sync will be skipped to avoid FK violation');
            return false;
          } else {
            console.log('[DEBUG] ✅ Ticket created successfully');
          }
        } else {
          console.log('[DEBUG] ✅ Ticket already exists');
        }
        console.log('[DEBUG] === END ENSURE TICKET EXISTS ===');
      } catch (e) {
        console.warn('[DEBUG] Error ensuring ticket exists:', e);
        return false;
      }
      
      // Convert camelCase to snake_case for Supabase
      const payload = toSnakeCaseObject({
        id: scan.id,
        ticketId: resolvedTicketId, // Use resolved UUID
        timestamp: scan.timestamp,
        type: scan.type,
        posId: scan.posId,
      });
      
      console.log('[SYNC] 📋 Converted payload (snake_case):', JSON.stringify(payload, null, 2));

      const { error } = await supabase
        .from('scan_logs')
        .upsert(payload);

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
