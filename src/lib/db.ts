  import { openDB, IDBPDatabase } from 'idb';
  import { ScanLog, RegistrationRequest, SimaksiRequest } from '../types';
  import { createClient } from '@supabase/supabase-js';

  console.log('🔵 db.ts loaded');

  const DB_NAME = 'summity-db';
  const STORE_NAME = 'scans';
  const REG_STORE = 'registrations';
  const SIMAKSI_STORE = 'simaksi';

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

  // Generate compliant RFC4122 v4 UUID
  function generateUUID(): string {
    if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
      try {
        const r = (crypto as any).randomUUID();
        if (isValidUUID(r)) return r;
      } catch (e) {}
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Safely resolve any ID to a valid UUID format
  function getValidUUID(id: any): string {
    if (isValidUUID(id)) return id;
    
    const searchId = String(id || '').toUpperCase();
    if (!searchId) return generateUUID();

    const usersListStr = localStorage.getItem('summity_users_list');
    const usersList: any[] = usersListStr ? JSON.parse(usersListStr) : [];
    
    const found = usersList.find(
      u =>
        (u.id && String(u.id).toUpperCase() === searchId) ||
        (u.displayId && u.displayId.toUpperCase() === searchId) ||
        (u.id_pendaki && u.id_pendaki.toUpperCase() === searchId) ||
        (u.idPendaki && u.idPendaki.toUpperCase() === searchId)
    );
    
    if (found && isValidUUID(found.id)) {
      return found.id;
    }
    
    const newUUID = generateUUID();
    if (found) {
      found.id = newUUID;
    } else {
      usersList.push({ id: newUUID, displayId: searchId, id_pendaki: searchId, idPendaki: searchId });
    }
    localStorage.setItem('summity_users_list', JSON.stringify(usersList));
    return newUUID;
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
    return openDB(DB_NAME, 7, {
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

        if (!db.objectStoreNames.contains(SIMAKSI_STORE)) {
          const store = db.createObjectStore(SIMAKSI_STORE, {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('synced', 'synced');
          store.createIndex('ketuaUserId', 'ketuaUserId');
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
      
      let emailVal = (reg as any).email;
      if (!emailVal) {
        try {
          const activeUserStr = localStorage.getItem('summity_user');
          if (activeUserStr) {
            const activeUser = JSON.parse(activeUserStr);
            if (activeUser.id === reg.userId || activeUser.id === reg.id) {
              emailVal = activeUser.email;
            }
          }
          if (!emailVal) {
            const usersListStr = localStorage.getItem('summity_users_list');
            if (usersListStr) {
              const usersList = JSON.parse(usersListStr);
              const found = usersList.find((u: any) => u.id === reg.userId || u.id === reg.id);
              if (found) {
                emailVal = found.email;
              }
            }
          }
        } catch (e) {
          console.warn('Error recovering email for sync:', e);
        }
      }
      
      if (!emailVal) {
        emailVal = `pendaki-${Date.now()}@summity.com`;
      }

      // Convert camelCase to snake_case for Supabase
      const payload = toSnakeCaseObject({
        // Core identifiers
        id: getValidUUID(reg.userId || reg.id),
        idPendaki: reg.idPendaki || reg.displayId,

        // Account/profile fields (if present)
        name: reg.name,
        email: emailVal,
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
      const { data, error } = await supabase
        .from('users')
        .upsert(filteredPayload)
        .select('id, id_pendaki');

      if (!error) {
        console.log('[SYNC] ✅ Registration synced to Supabase successfully!', data);

        // Also save/upsert the ticket information into the Supabase tickets table to persist SIMAKSI
        if (reg.mountain && reg.date) {
          const ticketPayload = toSnakeCaseObject({
            id: getValidUUID(reg.userId || reg.id),
            userId: getValidUUID(reg.userId || reg.id),
            mountainName: reg.mountain,
            date: reg.date,
            endDate: reg.endDate,
            status: reg.status || 'APPROVED',
            qrCode: `SUMMITY-USER-${reg.id}`
          });

          console.log('[SYNC] 🎫 Syncing ticket details to Supabase table:', ticketPayload);
          const { error: ticketError } = await supabase
            .from('tickets')
            .upsert(ticketPayload);

          if (ticketError) {
            console.warn('[SYNC] ⚠️ Supabase ticket upsert error:', ticketError);
          } else {
            console.log('[SYNC] ✅ Ticket synced to Supabase successfully');
          }
        }
        const db = await initDB();
        const tx = db.transaction(REG_STORE, 'readwrite');
        const store = tx.objectStore(REG_STORE);
        const savedReg = await store.get(reg.id);
        
        let retrievedIdPendaki = '';
        if (data && data[0] && data[0].id_pendaki) {
          retrievedIdPendaki = data[0].id_pendaki;
        }

        if (savedReg) {
          savedReg.synced = true;
          if (retrievedIdPendaki) {
            savedReg.id_pendaki = retrievedIdPendaki;
            savedReg.idPendaki = retrievedIdPendaki;
            savedReg.displayId = retrievedIdPendaki;
          }
          await store.put(savedReg);
          console.log('[SYNC] 💾 Marked registration as synced in LocalDB', retrievedIdPendaki ? `with id_pendaki: ${retrievedIdPendaki}` : '');
        }
        await tx.done;

        // Also update local storage if this is the active user
        if (retrievedIdPendaki) {
          try {
            const activeUserStr = localStorage.getItem('summity_user');
            if (activeUserStr) {
              const activeUser = JSON.parse(activeUserStr);
              if (activeUser.id === reg.id) {
                activeUser.id_pendaki = retrievedIdPendaki;
                activeUser.idPendaki = retrievedIdPendaki;
                activeUser.displayId = retrievedIdPendaki;
                localStorage.setItem('summity_user', JSON.stringify(activeUser));
                console.log('[SYNC] 👤 Updated active user in localStorage with synced id_pendaki:', retrievedIdPendaki);
              }
            }
            
            // Also update the list of users
            const usersListStr = localStorage.getItem('summity_users_list');
            if (usersListStr) {
              const usersList = JSON.parse(usersListStr);
              const idx = usersList.findIndex((u: any) => u.id === reg.id);
              if (idx !== -1) {
                usersList[idx].id_pendaki = retrievedIdPendaki;
                usersList[idx].idPendaki = retrievedIdPendaki;
                usersList[idx].displayId = retrievedIdPendaki;
                localStorage.setItem('summity_users_list', JSON.stringify(usersList));
                console.log('[SYNC] 👥 Updated user in summity_users_list with synced id_pendaki:', retrievedIdPendaki);
              }
            }
          } catch (e) {
            console.error('[SYNC] Error updating local storage user definitions:', e);
          }
        }

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
            (u.id_pendaki &&
              u.id_pendaki.toUpperCase() === searchDisplay) ||
            (u.idPendaki &&
              u.idPendaki.toUpperCase() === searchDisplay) ||
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
          const newInternalId = generateUUID();
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

  export async function syncAllUnsyncedData(): Promise<{ registrationsSynced: number, scansSynced: number, simaksiSynced: number }> {
    const supabase = getSupabaseClient();
    let registrationsSynced = 0;
    let scansSynced = 0;
    let simaksiSynced = 0;

    console.log('[SYNC-ALL] 🔄 Starting data sync check...');
    console.log('[SYNC-ALL] Online:', isOnline(), 'HasSupabase:', !!supabase);

    if (!supabase || !isOnline()) {
      console.log('[SYNC-ALL] ⏸️  Sync blocked - will try again when online');
      return { registrationsSynced, scansSynced, simaksiSynced };
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

      // Sync simaksi
      const simaksiList = await db.getAll(SIMAKSI_STORE);
      const unsyncedSimaksi = simaksiList.filter((s: any) => !s.synced);
      console.log('[SYNC-ALL] 🏔️  Unsynced simaksi:', unsyncedSimaksi.length);
      for (const s of unsyncedSimaksi) {
        const success = await trySyncSimaksi(s);
        if (success) {
          simaksiSynced++;
          console.log('[SYNC-ALL] ✅ Simaksi', s.id, 'synced');
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

      console.log('[SYNC-ALL] ✅ Sync complete! Registrations:', registrationsSynced, 'Simaksi:', simaksiSynced, 'Scans:', scansSynced);
    } catch (err) {
      console.error('[SYNC-ALL] ❌ Sync failed:', err);
    }

    return { registrationsSynced, scansSynced, simaksiSynced };
  }

  // --------------------------------------------------------------------
  // SIMAKSI SYNC LOGIC
  // --------------------------------------------------------------------

  export async function trySyncSimaksi(data: any): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase || !isOnline()) return false;

    try {
      // Pastikan ketuaUserId adalah UUID yang benar-benar ada di tabel users
      let ketuaUUID: string = data.ketuaUserId;
      if (!isValidUUID(ketuaUUID)) {
        const { data: ketuaRow } = await supabase
          .from('users')
          .select('id')
          .eq('id_pendaki', ketuaUUID)
          .maybeSingle();
        if (!ketuaRow) {
          console.warn('[SIMAKSI] Ketua user_id tidak ditemukan di tabel users:', ketuaUUID);
          return false;
        }
        ketuaUUID = ketuaRow.id;
      }

      // 1. Insert header simaksi
      const { data: simaksiRow, error: simaksiErr } = await supabase
        .from('simaksi')
        .insert({
          ketua_user_id: ketuaUUID,
          gunung_id: data.gunungId || 1,
          tanggal_naik: data.tanggalNaik,
          tanggal_turun: data.tanggalTurun,
          total_anggota: 1 + (data.members?.length || 0),
          status: 'pending',
        })
        .select('id')
        .single();

      if (simaksiErr || !simaksiRow) {
        console.warn('[SIMAKSI] Gagal insert header simaksi:', simaksiErr);
        return false;
      }

      const simaksiId = simaksiRow.id;
      console.log('[SIMAKSI] Header tersimpan dengan id:', simaksiId);

      // 2. Insert anggota — cari UUID asli dari tabel users berdasarkan id_pendaki
      if (data.members?.length > 0) {
        const memberRows: { simaksi_id: number; user_id: string }[] = [];

        for (const m of data.members as { id: string; name: string }[]) {
          let resolvedUUID: string | null = null;

          if (isValidUUID(m.id)) {
            // Sudah UUID — verifikasi ada di tabel users
            const { data: exists } = await supabase
              .from('users')
              .select('id')
              .eq('id', m.id)
              .maybeSingle();
            if (exists) resolvedUUID = m.id;
          } else {
            // Display ID (id_pendaki) — lookup ke Supabase
            const { data: userRow } = await supabase
              .from('users')
              .select('id')
              .eq('id_pendaki', m.id)
              .maybeSingle();
            if (userRow) resolvedUUID = userRow.id;
          }

          if (resolvedUUID) {
            memberRows.push({ simaksi_id: simaksiId, user_id: resolvedUUID });
          } else {
            console.warn(`[SIMAKSI] Anggota "${m.id}" tidak ditemukan di tabel users — dilewati`);
          }
        }

        if (memberRows.length > 0) {
          const { error: memberErr } = await supabase
            .from('simaksi_anggota')
            .insert(memberRows);
          if (memberErr) console.warn('[SIMAKSI] Gagal insert anggota:', memberErr);
        }
      }

      // 4. Tandai sebagai synced di IndexedDB
      const db = await initDB();
      const tx = db.transaction(SIMAKSI_STORE, 'readwrite');
      const store = tx.objectStore(SIMAKSI_STORE);
      const saved = await store.get(data.id);
      if (saved) {
        saved.synced = true;
        saved.simaksiId = simaksiId;
        await store.put(saved);
      }
      await tx.done;

      console.log('[SIMAKSI] Sync berhasil untuk simaksi_id:', simaksiId);
      return true;
    } catch (err) {
      console.warn('[SIMAKSI] Sync gagal:', err);
      return false;
    }
  }

  export async function getUserActiveSimaksi(userId: string): Promise<{
    simaksiId: number;
    status: 'draft' | 'pending' | 'approved';
    ketuaName: string;
    ketuaUserId: string;
    tanggalNaik: string;
    tanggalTurun: string;
    isKetua: boolean;
  } | null> {
    const ACTIVE_STATUSES = ['draft', 'pending', 'approved'];
    const supabase = getSupabaseClient();

    if (supabase && isOnline()) {
      // Cek sebagai ketua
      const { data: asKetua } = await supabase
        .from('simaksi')
        .select('id, status, ketua_user_id, tanggal_naik, tanggal_turun')
        .eq('ketua_user_id', userId)
        .in('status', ACTIVE_STATUSES)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (asKetua) {
        const { data: ketuaUser } = await supabase.from('users').select('name').eq('id', asKetua.ketua_user_id).maybeSingle();
        return {
          simaksiId: asKetua.id,
          status: asKetua.status,
          ketuaName: ketuaUser?.name || 'Ketua',
          ketuaUserId: asKetua.ketua_user_id,
          tanggalNaik: asKetua.tanggal_naik,
          tanggalTurun: asKetua.tanggal_turun,
          isKetua: true,
        };
      }

      // Cek sebagai anggota
      const { data: asAnggota } = await supabase
        .from('simaksi_anggota')
        .select('simaksi_id, simaksi!inner(id, status, ketua_user_id, tanggal_naik, tanggal_turun)')
        .eq('user_id', userId)
        .in('simaksi.status', ACTIVE_STATUSES)
        .limit(1)
        .maybeSingle();

      if (asAnggota && asAnggota.simaksi) {
        const s = asAnggota.simaksi as any;
        const { data: ketuaUser } = await supabase.from('users').select('name').eq('id', s.ketua_user_id).maybeSingle();
        return {
          simaksiId: s.id,
          status: s.status,
          ketuaName: ketuaUser?.name || 'Ketua',
          ketuaUserId: s.ketua_user_id,
          tanggalNaik: s.tanggal_naik,
          tanggalTurun: s.tanggal_turun,
          isKetua: false,
        };
      }

      return null;
    }

    // Offline: cek IndexedDB
    const db = await initDB();
    const all = await db.getAll(SIMAKSI_STORE) as any[];
    const found = all.find(s =>
      ACTIVE_STATUSES.includes(s.status) &&
      (s.ketuaUserId === userId || (s.members || []).some((m: any) => m.id === userId))
    );
    if (!found) return null;
    return {
      simaksiId: found.simaksiId || found.id,
      status: found.status,
      ketuaName: found.ketuaName || 'Ketua',
      ketuaUserId: found.ketuaUserId,
      tanggalNaik: found.tanggalNaik,
      tanggalTurun: found.tanggalTurun,
      isKetua: found.ketuaUserId === userId,
    };
  }

  export async function getActiveSimaksiCount(): Promise<number> {
    const supabase = getSupabaseClient();

    if (supabase && isOnline()) {
      const { data, error } = await supabase
        .from('simaksi')
        .select('total_anggota')
        .eq('status', 'approved');
      if (!error && data) {
        return data.reduce((sum: number, row: any) => sum + (row.total_anggota || 0), 0);
      }
    }

    const db = await initDB();
    const all = await db.getAll(SIMAKSI_STORE) as any[];
    return all
      .filter(s => s.status === 'approved')
      .reduce((sum, s) => sum + (s.totalAnggota || 1 + (s.members?.length || 0)), 0);
  }

  export async function getPendingSimaksi(): Promise<any[]> {
    const supabase = getSupabaseClient();

    if (supabase && isOnline()) {
      const { data: list, error } = await supabase
        .from('simaksi')
        .select('id, ketua_user_id, tanggal_naik, tanggal_turun, total_anggota, status, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[SIMAKSI-ADMIN] Gagal fetch pending:', JSON.stringify(error));
        // Fallthrough ke offline
      } else if (list && list.length > 0) {
        const userIds = [...new Set(list.map((s: any) => s.ketua_user_id))];
        const { data: usersData } = await supabase
          .from('users')
          .select('id, name, id_pendaki')
          .in('id', userIds);

        const usersMap: Record<string, any> = {};
        (usersData || []).forEach((u: any) => { usersMap[u.id] = u; });

        return list.map((s: any) => ({
          simaksiId: s.id,
          ketuaName: usersMap[s.ketua_user_id]?.name || 'Unknown',
          idPendaki: usersMap[s.ketua_user_id]?.id_pendaki || '',
          tanggalNaik: s.tanggal_naik,
          tanggalTurun: s.tanggal_turun,
          totalAnggota: s.total_anggota,
          status: s.status,
          createdAt: s.created_at,
          source: 'supabase' as const,
        }));
      } else {
        return [];
      }
    }

    // Offline: dari IndexedDB
    const db = await initDB();
    const all = await db.getAll(SIMAKSI_STORE);
    return (all as any[])
      .filter(s => s.status === 'pending')
      .map(s => ({
        simaksiId: s.simaksiId || s.id,
        localId: s.id,
        ketuaName: s.ketuaName || 'Unknown',
        tanggalNaik: s.tanggalNaik,
        tanggalTurun: s.tanggalTurun,
        totalAnggota: 1 + (s.members?.length || 0),
        status: s.status,
        createdAt: s.createdAt,
        source: 'local' as const,
      }));
  }

  export async function getUserSimaksi(userId: string): Promise<any[]> {
    const supabase = getSupabaseClient();

    if (supabase && isOnline()) {
      // Kumpulkan simaksi_id user (sebagai ketua)
      const { data: asKetua } = await supabase
        .from('simaksi')
        .select('id, kode_simaksi, status, ketua_user_id, tanggal_naik, tanggal_turun, total_anggota, created_at')
        .eq('ketua_user_id', userId)
        .neq('status', 'draft')
        .order('created_at', { ascending: false });

      // Kumpulkan simaksi_id user (sebagai anggota)
      const { data: anggotaRows } = await supabase
        .from('simaksi_anggota')
        .select('simaksi_id')
        .eq('user_id', userId);

      const anggotaIds = (anggotaRows || []).map((r: any) => r.simaksi_id);
      let asAnggota: any[] = [];
      if (anggotaIds.length > 0) {
        const { data } = await supabase
          .from('simaksi')
          .select('id, kode_simaksi, status, ketua_user_id, tanggal_naik, tanggal_turun, total_anggota, created_at')
          .in('id', anggotaIds)
          .neq('status', 'draft')
          .order('created_at', { ascending: false });
        asAnggota = data || [];
      }

      // Gabungkan, hilangkan duplikat
      const allIds = new Set<number>();
      const combined: any[] = [];
      for (const s of [...(asKetua || []), ...asAnggota]) {
        if (!allIds.has(s.id)) { allIds.add(s.id); combined.push(s); }
      }

      if (combined.length === 0) return [];

      // Fetch nama ketua
      const ketuaIds = [...new Set(combined.map((s: any) => s.ketua_user_id))];
      const { data: ketuaUsers } = await supabase.from('users').select('id, name').in('id', ketuaIds);
      const ketuaMap: Record<string, string> = {};
      (ketuaUsers || []).forEach((u: any) => { ketuaMap[u.id] = u.name; });

      // Fetch anggota per simaksi
      const simaksiIds = combined.map((s: any) => s.id);
      const { data: anggotaDetail } = await supabase
        .from('simaksi_anggota')
        .select('simaksi_id, user_id, users(name, id_pendaki)')
        .in('simaksi_id', simaksiIds);
      const membersMap: Record<number, { id: string; name: string }[]> = {};
      (anggotaDetail || []).forEach((a: any) => {
        if (!membersMap[a.simaksi_id]) membersMap[a.simaksi_id] = [];
        membersMap[a.simaksi_id].push({ id: a.users?.id_pendaki || a.user_id, name: a.users?.name || 'Anggota' });
      });

      return combined
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .map((s: any) => ({
          simaksiId: s.id,
          kodeSimaksi: s.kode_simaksi || null,
          status: s.status,
          ketuaName: ketuaMap[s.ketua_user_id] || 'Ketua',
          ketuaUserId: s.ketua_user_id,
          tanggalNaik: s.tanggal_naik,
          tanggalTurun: s.tanggal_turun,
          totalAnggota: s.total_anggota,
          isKetua: s.ketua_user_id === userId,
          members: membersMap[s.id] || [],
          createdAt: s.created_at,
          qrCode: `SUMMITY-SIMAKSI-${s.id}`,
        }));
    }

    // Offline: IndexedDB
    const db = await initDB();
    const all = await db.getAll(SIMAKSI_STORE) as any[];
    return all
      .filter(s => s.status !== 'draft' &&
        (s.ketuaUserId === userId || (s.members || []).some((m: any) => m.id === userId)))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(s => ({
        simaksiId: s.simaksiId || s.id,
        kodeSimaksi: s.kodeSimaksi || null,
        status: s.status,
        ketuaName: s.ketuaName || 'Ketua',
        ketuaUserId: s.ketuaUserId,
        tanggalNaik: s.tanggalNaik,
        tanggalTurun: s.tanggalTurun,
        totalAnggota: s.totalAnggota || 1 + (s.members?.length || 0),
        isKetua: s.ketuaUserId === userId,
        members: s.members || [],
        createdAt: s.createdAt,
        qrCode: `SUMMITY-SIMAKSI-${s.simaksiId || s.id}`,
      }));
  }

  export async function approveSimaksi(simaksiId: number, localId?: number): Promise<boolean> {
    const supabase = getSupabaseClient();
    let ok = false;

    const now = new Date();
    const kodeSimaksi = `SMK-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(simaksiId).padStart(4, '0')}`;

    if (supabase && isOnline()) {
      const { error } = await supabase
        .from('simaksi')
        .update({ status: 'approved', kode_simaksi: kodeSimaksi, approved_at: now.toISOString() })
        .eq('id', simaksiId);
      if (error) console.warn('[SIMAKSI-ADMIN] Gagal approve:', JSON.stringify(error));
      else ok = true;
    }

    const targetLocalId = localId ?? simaksiId;
    try {
      const db = await initDB();
      const tx = db.transaction(SIMAKSI_STORE, 'readwrite');
      const store = tx.objectStore(SIMAKSI_STORE);
      const item = await store.get(targetLocalId);
      if (item) {
        item.status = 'approved';
        item.kodeSimaksi = kodeSimaksi;
        item.synced = ok;
        await store.put(item);
      }
      await tx.done;
    } catch (_) {}

    return ok;
  }

  export async function rejectSimaksi(simaksiId: number, localId?: number): Promise<boolean> {
    const supabase = getSupabaseClient();
    let ok = false;

    if (supabase && isOnline()) {
      const { error } = await supabase
        .from('simaksi')
        .update({ status: 'rejected' })
        .eq('id', simaksiId);
      if (error) console.warn('[SIMAKSI-ADMIN] Gagal reject:', JSON.stringify(error));
      else ok = true;
    }

    const targetLocalId = localId ?? simaksiId;
    try {
      const db = await initDB();
      const tx = db.transaction(SIMAKSI_STORE, 'readwrite');
      const store = tx.objectStore(SIMAKSI_STORE);
      const item = await store.get(targetLocalId);
      if (item) {
        item.status = 'rejected';
        item.synced = ok;
        await store.put(item);
      }
      await tx.done;
    } catch (_) {}

    return ok;
  }

  export async function completeSimaksi(simaksiId: number): Promise<{ ok: boolean; kodeSimaksi: string | null }> {
    const supabase = getSupabaseClient();
    let ok = false;
    let kodeSimaksi: string | null = null;

    if (supabase && isOnline()) {
      const { data, error } = await supabase
        .from('simaksi')
        .update({ status: 'complete' })
        .eq('id', simaksiId)
        .select('kode_simaksi')
        .maybeSingle();
      if (error) console.warn('[SIMAKSI] Gagal complete:', JSON.stringify(error));
      else { ok = true; kodeSimaksi = data?.kode_simaksi ?? null; }
    }

    try {
      const db = await initDB();
      const tx = db.transaction(SIMAKSI_STORE, 'readwrite');
      const store = tx.objectStore(SIMAKSI_STORE);
      const all = await store.getAll();
      const item = all.find((s: any) => s.simaksiId === simaksiId || s.id === simaksiId);
      if (item) {
        item.status = 'complete';
        item.synced = ok;
        await store.put(item);
        if (!kodeSimaksi) kodeSimaksi = item.kodeSimaksi ?? null;
      }
      await tx.done;
    } catch (_) {}

    return { ok, kodeSimaksi };
  }

  export async function saveSimaksi(data: Omit<SimaksiRequest, 'id'>): Promise<number> {
    const db = await initDB();
    const localId = await db.add(SIMAKSI_STORE, { ...data, synced: false });
    console.log('[SIMAKSI] Tersimpan lokal dengan id:', localId);

    const dataWithId = { ...data, id: localId, synced: false };
    const syncResult = await trySyncSimaksi(dataWithId);
    console.log('[SIMAKSI] Hasil sync:', syncResult ? '✅ Berhasil' : '⏸️ Offline/Gagal');
    return localId as number;
  }

  export async function getAllSimaksi() {
    const db = await initDB();
    return db.getAll(SIMAKSI_STORE);
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
