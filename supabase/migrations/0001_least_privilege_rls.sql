-- =====================================================================
-- Tahap 2: least-privilege RLS
--
-- Tujuan: hanya izinkan operasi yang BENAR-BENAR dipakai kode aplikasi,
-- berdasarkan audit `grep from('<tabel>')` di src/.
--
--   users            -> SELECT, INSERT, UPDATE   (DELETE hanya dipakai test)
--   simaksi          -> SELECT, INSERT, UPDATE   (DELETE tidak dipakai)
--   simaksi_anggota  -> SELECT, INSERT           (UPDATE/DELETE tidak dipakai)
--   tracking_history -> SELECT, INSERT           (UPDATE/DELETE tidak dipakai)
--
-- CATATAN PENTING: ini HARM REDUCTION, bukan perbaikan.
-- Setelah migrasi ini data masih bisa DIBACA penuh oleh siapa saja yang
-- punya anon key (termasuk kolom password & nik), dan status simaksi masih
-- bisa diubah tanpa login admin. Keduanya baru tertutup setelah aplikasi
-- pindah ke Supabase Auth -- lihat Tahap 3.
-- =====================================================================

-- ---------- users ----------------------------------------------------
-- Policy lama `users_policy` berlaku untuk ALL (SELECT+INSERT+UPDATE+DELETE)
-- ke role `public`. Diganti per-command, tanpa DELETE.
DROP POLICY IF EXISTS users_policy ON public.users;

CREATE POLICY users_select ON public.users
  FOR SELECT TO public USING (true);
CREATE POLICY users_insert ON public.users
  FOR INSERT TO public WITH CHECK (true);
CREATE POLICY users_update ON public.users
  FOR UPDATE TO public USING (true) WITH CHECK (true);
-- sengaja tanpa policy DELETE -> DELETE ditolak RLS

-- ---------- simaksi -------------------------------------------------
ALTER TABLE public.simaksi ENABLE ROW LEVEL SECURITY;

CREATE POLICY simaksi_select ON public.simaksi
  FOR SELECT TO public USING (true);
CREATE POLICY simaksi_insert ON public.simaksi
  FOR INSERT TO public WITH CHECK (true);
-- UPDATE masih dibutuhkan approveSimaksi/rejectSimaksi/completeSimaksi
CREATE POLICY simaksi_update ON public.simaksi
  FOR UPDATE TO public USING (true) WITH CHECK (true);

-- ---------- simaksi_anggota -----------------------------------------
ALTER TABLE public.simaksi_anggota ENABLE ROW LEVEL SECURITY;

CREATE POLICY simaksi_anggota_select ON public.simaksi_anggota
  FOR SELECT TO public USING (true);
CREATE POLICY simaksi_anggota_insert ON public.simaksi_anggota
  FOR INSERT TO public WITH CHECK (true);

-- ---------- tracking_history ----------------------------------------
ALTER TABLE public.tracking_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY tracking_history_select ON public.tracking_history
  FOR SELECT TO public USING (true);
CREATE POLICY tracking_history_insert ON public.tracking_history
  FOR INSERT TO public WITH CHECK (true);
-- tanpa UPDATE/DELETE -> riwayat tracking tidak bisa diubah/dihapus klien

-- ---------- cabut grant tingkat tabel (lapis kedua) -----------------
-- RLS sudah menolak, tapi REVOKE membuat maksudnya eksplisit dan menutup
-- celah kalau nanti ada policy permisif yang tak sengaja ditambahkan.
REVOKE DELETE ON public.users            FROM anon, authenticated;
REVOKE DELETE ON public.simaksi          FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.simaksi_anggota  FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.tracking_history FROM anon, authenticated;
