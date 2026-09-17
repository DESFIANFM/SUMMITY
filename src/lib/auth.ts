  import { getSupabaseClient, isOnline } from './db';
  import { User, UserRole } from '../types';

  // --------------------------------------------------------------------
  // LAPISAN AUTENTIKASI (Supabase Auth)
  //
  // Menggantikan pola lama yang mencocokkan password langsung ke tabel
  // `users` dari browser. Di sini password tidak pernah dikirim maupun
  // dibaca dari tabel `users` — hanya diserahkan ke Supabase Auth, yang
  // menyimpannya ter-hash (bcrypt) di skema `auth`.
  //
  // Catatan penting soal login pakai username:
  // Supabase Auth hanya mengenal email. Karena UI Summity memakai
  // username, username diterjemahkan dulu ke email lewat RPC
  // `get_login_email` (SECURITY DEFINER) — lihat
  // supabase/migrations/0002_auth_foundation.sql
  // --------------------------------------------------------------------

  // Kolom profil di tabel `users`. Sengaja TIDAK memuat `password`:
  // setelah migrasi, kolom itu tidak lagi dipakai dan akan dihapus.
  const PROFILE_COLUMNS =
    'id, id_pendaki, name, email, username, role, phone, emergency_phone, ' +
    'citizenship, identity_type, nik, gender, weight, height, ' +
    'province, city, district, subdistrict, address';

  export interface AuthResult {
    user: User | null;
    error: string | null;
    /** true bila akun dibuat tapi masih menunggu konfirmasi email */
    needsEmailConfirmation?: boolean;
    /** Kolom pendaftaran yang ternyata sudah dipakai akun lain. */
    takenFields?: Array<'username' | 'email' | 'nik'>;
  }

  /** Ubah baris snake_case dari tabel `users` menjadi objek User camelCase. */
  export function mapProfileRow(row: any, fallbackRole: UserRole = 'USER'): User {
    const displayId = row?.id_pendaki || undefined;
    return {
      id: row?.id,
      displayId,
      idPendaki: displayId,
      id_pendaki: displayId,
      name: row?.name || 'Pendaki',
      email: row?.email || '',
      username: row?.username || undefined,
      role: (row?.role as UserRole) || fallbackRole,
      phone: row?.phone || undefined,
      emergencyPhone: row?.emergency_phone || undefined,
      citizenship: row?.citizenship || undefined,
      identityType: row?.identity_type || undefined,
      nik: row?.nik || undefined,
      gender: row?.gender || undefined,
      weight: row?.weight || undefined,
      height: row?.height || undefined,
      province: row?.province || undefined,
      city: row?.city || undefined,
      district: row?.district || undefined,
      subdistrict: row?.subdistrict || undefined,
      address: row?.address || undefined,
    };
  }

  /**
   * Terjemahkan username menjadi email lewat RPC SECURITY DEFINER.
   * Kalau yang diketik sudah berupa email, dipakai langsung.
   */
  async function resolveLoginEmail(identifier: string): Promise<string | null> {
    const trimmed = identifier.trim();
    if (trimmed.includes('@')) return trimmed;

    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase.rpc('get_login_email', {
      p_username: trimmed.toLowerCase(),
    });

    if (error) {
      console.warn('[AUTH] Gagal resolve username ke email:', error.message);
      return null;
    }
    return (data as string | null) || null;
  }

  /** Ambil profil dari tabel `users` untuk user yang sedang login. */
  export async function fetchProfile(userId: string): Promise<User | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('users')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[AUTH] Gagal fetch profil:', error.message);
      return null;
    }
    return data ? mapProfileRow(data) : null;
  }

  /**
   * Login dengan username (atau email) + password.
   * Dipakai untuk pendaki maupun petugas — peran diambil dari kolom
   * `role` di tabel `users`, bukan ditentukan di frontend.
   */
  export async function signIn(identifier: string, password: string): Promise<AuthResult> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { user: null, error: 'Aplikasi berjalan tanpa koneksi server. Login tidak tersedia.' };
    }
    if (!isOnline()) {
      return {
        user: null,
        error: 'Tidak ada koneksi internet. Login pertama kali harus online; setelah itu sesi Anda tetap aktif meski offline.',
      };
    }

    const email = await resolveLoginEmail(identifier);
    if (!email) {
      return { user: null, error: 'Username atau password salah.' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      // Pesan digeneralisasi supaya tidak membocorkan username mana yang ada.
      return { user: null, error: 'Username atau password salah.' };
    }

    const profile = await fetchProfile(data.user.id);
    if (!profile) {
      return { user: null, error: 'Akun terautentikasi tapi profilnya belum ada. Hubungi petugas.' };
    }
    return { user: profile, error: null };
  }

  /** Daftarkan akun pendaki baru: buat akun Auth, lalu simpan profilnya. */
  export async function signUpClimber(params: {
    email: string;
    password: string;
    username: string;
    profile: Record<string, any>;
  }): Promise<AuthResult> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { user: null, error: 'Aplikasi berjalan tanpa koneksi server. Pendaftaran tidak tersedia.' };
    }

    // Cek ketersediaan SEBELUM membuat akun Auth. Kalau dicek sesudahnya,
    // pendaftaran yang gagal meninggalkan akun Auth tanpa profil.
    const { data: cek, error: cekError } = await supabase.rpc('cek_ketersediaan_registrasi', {
      p_username: params.username.toLowerCase().trim(),
      p_email: params.email.trim(),
      p_nik: String(params.profile?.nik ?? ''),
    });
    if (cekError) {
      // Tidak menggagalkan pendaftaran; unique constraint di database tetap
      // menjadi pengaman terakhir.
      console.warn('[AUTH] Cek ketersediaan gagal:', cekError.message);
    } else if (cek) {
      const takenFields = (['username', 'email', 'nik'] as const).filter(k => (cek as any)[k]);
      if (takenFields.length) {
        return { user: null, error: 'Data pendaftaran sudah dipakai akun lain.', takenFields: [...takenFields] };
      }
    }

    const { data, error } = await supabase.auth.signUp({
      email: params.email.trim(),
      password: params.password,
      options: { data: { username: params.username.toLowerCase().trim() } },
    });

    if (error || !data.user) {
      return { user: null, error: error?.message || 'Gagal membuat akun.' };
    }

    // id profil WAJIB sama dengan id akun Auth — inilah yang membuat
    // policy `auth.uid() = id` bisa bekerja.
    const authUserId = data.user.id;
    const { error: profileError } = await supabase.from('users').insert({
      ...params.profile,
      id: authUserId,
      email: params.email.trim(),
      username: params.username.toLowerCase().trim(),
      role: 'USER',
    });

    if (profileError) {
      console.warn('[AUTH] Profil gagal disimpan:', profileError.message);
      // Pengaman bila dua orang mendaftar dengan data sama hampir bersamaan
      // (lolos cek di atas, lalu bentrok di UNIQUE constraint).
      const msg = profileError.message || '';
      const takenFields = ([
        ['username', 'users_username_key'],
        ['email', 'users_email_key'],
        ['nik', 'users_nik_key'],
      ] as const).filter(([, c]) => msg.includes(c)).map(([f]) => f);
      if (takenFields.length) {
        return { user: null, error: 'Data pendaftaran sudah dipakai akun lain.', takenFields: [...takenFields] };
      }
      return { user: null, error: 'Data diri gagal disimpan. Silakan coba lagi.' };
    }

    // Kalau "Confirm email" aktif di dashboard, signUp tidak mengembalikan sesi.
    if (!data.session) {
      return { user: null, error: null, needsEmailConfirmation: true };
    }

    const profile = await fetchProfile(authUserId);
    return { user: profile, error: null };
  }

  export async function signOut(): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase) await supabase.auth.signOut();
  }

  /** Kirim email reset password. Butuh Redirect URL terdaftar di dashboard. */
  export async function requestPasswordReset(email: string): Promise<{ error: string | null }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { error: 'Fitur ini butuh koneksi server.' };

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (!error) return { error: null };

    // GoTrue membalas 500 dengan body kosong saat SMTP gagal, dan supabase-js
    // menaruhnya apa adanya sehingga pengguna melihat "{}" — tidak berguna.
    // Terjemahkan ke pesan yang bisa ditindaklanjuti.
    const raw = (error.message || '').trim();
    console.warn('[AUTH] resetPasswordForEmail gagal:', error.status, raw);

    if (/rate limit/i.test(raw)) {
      return { error: 'Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi.' };
    }
    if (!raw || raw === '{}' || /unexpected_failure|error sending/i.test(raw)) {
      return { error: 'Email gagal dikirim. Konfigurasi SMTP di server bermasalah — hubungi petugas.' };
    }
    return { error: raw };
  }

  /** Set password baru — dipakai di halaman yang dibuka dari link email reset. */
  export async function updatePassword(newPassword: string): Promise<{ error: string | null }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { error: 'Fitur ini butuh koneksi server.' };

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message || null };
  }
