-- =====================================================================
-- Tahap 3b: kunci RLS berbasis identitas
--
-- ⚠️  JANGAN jalankan sebelum SEMUA ini benar:
--     1. 0002_auth_foundation.sql sudah dijalankan
--     2. Kode frontend Supabase Auth sudah ter-deploy
--     3. Semua user lama sudah punya akun di auth.users
--        (scripts/migrate-users-to-auth.mjs)
--     4. Sudah diuji: login pendaki, login petugas, registrasi
--
-- Kalau dijalankan lebih awal, aplikasi berhenti bekerja: auth.uid()
-- bernilai NULL untuk request anon, sehingga semua policy di bawah gagal.
-- =====================================================================

-- ---------- users ---------------------------------------------------
DROP POLICY IF EXISTS users_select ON public.users;
DROP POLICY IF EXISTS users_insert ON public.users;
DROP POLICY IF EXISTS users_update ON public.users;
DROP POLICY IF EXISTS users_policy ON public.users;

-- Pendaki hanya boleh melihat barisnya sendiri; petugas melihat semua.
CREATE POLICY users_select_self ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

-- Insert profil hanya boleh untuk dirinya sendiri, saat mendaftar.
-- `anon` tetap perlu INSERT karena signUp terjadi sebelum sesi aktif
-- ketika konfirmasi email diaktifkan.
CREATE POLICY users_insert_self ON public.users
  FOR INSERT TO anon, authenticated
  WITH CHECK (id = auth.uid() OR auth.uid() IS NULL);

-- Ubah data diri sendiri saja. Role TIDAK bisa dinaikkan sendiri —
-- dijaga trigger di bawah.
CREATE POLICY users_update_self ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- Cegah eskalasi hak: hanya admin yang boleh mengubah kolom `role`.
CREATE OR REPLACE FUNCTION public.guard_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- auth.uid() NULL berarti pemanggilnya bukan sesi user: SQL Editor,
  -- service_role, atau script migrasi. Konteks itu memang dipercaya, dan
  -- pengecualian ini WAJIB ada — tanpanya admin pertama tidak akan pernah
  -- bisa diangkat (is_admin() selalu false saat belum ada admin sama sekali).
  --
  -- Tetap aman: policy users_update_self hanya diberikan ke role
  -- `authenticated`, jadi `anon` tidak punya jalur UPDATE untuk menyentuh
  -- trigger ini.
  IF NEW.role IS DISTINCT FROM OLD.role
     AND auth.uid() IS NOT NULL
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Tidak boleh mengubah role sendiri';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_role_change ON public.users;
CREATE TRIGGER trg_guard_role_change
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_role_change();

-- ---------- simaksi -------------------------------------------------
DROP POLICY IF EXISTS simaksi_select ON public.simaksi;
DROP POLICY IF EXISTS simaksi_insert ON public.simaksi;
DROP POLICY IF EXISTS simaksi_update ON public.simaksi;

-- Lihat simaksi sendiri (sebagai ketua atau anggota), atau semua bila petugas.
CREATE POLICY simaksi_select_own ON public.simaksi
  FOR SELECT TO authenticated
  USING (
    ketua_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.simaksi_anggota sa
      WHERE sa.simaksi_id = simaksi.id AND sa.user_id = auth.uid()
    )
    OR public.is_admin()
  );

-- Ajukan simaksi hanya atas nama sendiri, dan wajib berstatus pending.
CREATE POLICY simaksi_insert_own ON public.simaksi
  FOR INSERT TO authenticated
  WITH CHECK (ketua_user_id = auth.uid() AND status = 'pending');

-- INILAH yang menutup bypass approval: hanya petugas yang boleh mengubah
-- status simaksi. Sebelumnya siapa pun bisa menyetujui simaksinya sendiri.
CREATE POLICY simaksi_update_admin ON public.simaksi
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------- simaksi_anggota -----------------------------------------
DROP POLICY IF EXISTS simaksi_anggota_select ON public.simaksi_anggota;
DROP POLICY IF EXISTS simaksi_anggota_insert ON public.simaksi_anggota;

CREATE POLICY simaksi_anggota_select_own ON public.simaksi_anggota
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.simaksi s
      WHERE s.id = simaksi_anggota.simaksi_id AND s.ketua_user_id = auth.uid()
    )
    OR public.is_admin()
  );

-- Ketua rombongan yang mendaftarkan anggotanya.
CREATE POLICY simaksi_anggota_insert_ketua ON public.simaksi_anggota
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.simaksi s
      WHERE s.id = simaksi_anggota.simaksi_id AND s.ketua_user_id = auth.uid()
    )
    OR public.is_admin()
  );

-- ---------- tracking_history ----------------------------------------
DROP POLICY IF EXISTS tracking_history_select ON public.tracking_history;
DROP POLICY IF EXISTS tracking_history_insert ON public.tracking_history;

CREATE POLICY tracking_history_select_own ON public.tracking_history
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- Scan hanya boleh dicatat atas nama diri sendiri; checkout oleh petugas.
CREATE POLICY tracking_history_insert_own ON public.tracking_history
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- ---------- langkah terakhir ----------------------------------------
-- Kolom password di tabel `users` sudah tidak dipakai setelah migrasi.
-- Pastikan login & registrasi benar-benar jalan, lalu jalankan ini
-- SECARA TERPISAH (tidak bisa dibatalkan):
--
--   ALTER TABLE public.users DROP COLUMN password;
