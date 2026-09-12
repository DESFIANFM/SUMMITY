-- =====================================================================
-- PERBAIKAN: rekursi tak hingga antar policy
--
-- MASALAH:
-- Policy simaksi dan simaksi_anggota saling merujuk lewat subquery:
--   simaksi_select_own         -> EXISTS (SELECT ... FROM simaksi_anggota)
--   simaksi_anggota_select_own -> EXISTS (SELECT ... FROM simaksi)
-- Setiap subquery memicu evaluasi policy tabel seberang, yang memicu
-- balik yang pertama. Postgres mendeteksinya dan menggagalkan query:
--   "infinite recursion detected in policy for relation ..."
--
-- Efeknya kedua tabel tidak terbaca oleh SIAPA PUN — pendaki maupun
-- petugas. Dashboard petugas ikut kosong.
--
-- SOLUSI:
-- Pindahkan pemeriksaan lintas-tabel ke fungsi SECURITY DEFINER. Fungsi
-- seperti itu berjalan sebagai pemiliknya sehingga query di dalamnya
-- tidak dikenai RLS — persis pola yang sudah dipakai is_admin().
--
-- Aman diulang. Jalankan setelah 0004.
-- =====================================================================

-- ---------- 1. Helper pemutus rekursi -------------------------------
-- Apakah pemanggil terdaftar sebagai anggota simaksi ini?
CREATE OR REPLACE FUNCTION public.is_simaksi_member(p_simaksi_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.simaksi_anggota sa
    WHERE sa.simaksi_id = p_simaksi_id AND sa.user_id = auth.uid()
  );
$$;

-- Apakah pemanggil ketua dari simaksi ini?
CREATE OR REPLACE FUNCTION public.is_simaksi_ketua(p_simaksi_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.simaksi s
    WHERE s.id = p_simaksi_id AND s.ketua_user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_simaksi_member(bigint) FROM public;
REVOKE ALL ON FUNCTION public.is_simaksi_ketua(bigint)  FROM public;
GRANT EXECUTE ON FUNCTION public.is_simaksi_member(bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_simaksi_ketua(bigint)  TO anon, authenticated;


-- ---------- 2. Buat ulang policy tanpa subquery lintas-tabel --------
DROP POLICY IF EXISTS simaksi_select_own ON public.simaksi;
CREATE POLICY simaksi_select_own ON public.simaksi
  FOR SELECT TO authenticated
  USING (
    ketua_user_id = auth.uid()
    OR public.is_simaksi_member(id)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS simaksi_anggota_select_own ON public.simaksi_anggota;
CREATE POLICY simaksi_anggota_select_own ON public.simaksi_anggota
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_simaksi_ketua(simaksi_id)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS simaksi_anggota_insert_ketua ON public.simaksi_anggota;
CREATE POLICY simaksi_anggota_insert_ketua ON public.simaksi_anggota
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_simaksi_ketua(simaksi_id)
    OR public.is_admin()
  );


-- ---------- 3. Verifikasi -------------------------------------------
-- Tidak boleh lagi memunculkan error rekursi:
SELECT count(*) AS simaksi_terbaca         FROM public.simaksi;
SELECT count(*) AS simaksi_anggota_terbaca FROM public.simaksi_anggota;

-- Dijalankan dari SQL Editor (auth.uid() NULL, bukan petugas) angka di
-- atas mengembalikan seluruh baris karena SQL Editor melewati RLS.
-- Pengujian sebenarnya tetap harus lewat sesi login aplikasi.
