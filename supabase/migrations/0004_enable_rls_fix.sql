-- =====================================================================
-- PERBAIKAN: aktifkan RLS + tegakkan ulang policy
--
-- MASALAH YANG DIPERBAIKI:
-- 0003 membuat policy tapi tidak pernah menjalankan ENABLE ROW LEVEL
-- SECURITY — perintah itu ada di 0001. Kalau 0001 terlewat, policy di
-- 0003 tercipta TAPI TIDAK PERNAH DIEVALUASI: Postgres mengabaikan
-- seluruh policy pada tabel yang RLS-nya nonaktif.
--
-- Akibatnya (terukur pada database ini):
--   users            21 baris → pendaki lihat  1   ✅ (RLS memang sudah aktif)
--   simaksi          12 baris → pendaki lihat 12   ❌
--   simaksi_anggota   7 baris → pendaki lihat  7   ❌
--   tracking_history 132 baris → pendaki lihat 132 ❌
-- dan pendaki masih bisa mengubah status SIMAKSI-nya sendiri.
--
-- File ini SWASEMBADA dan aman diulang: ia mengaktifkan RLS, membuang
-- policy permisif lama dari 0001, lalu membuat ulang policy 0003.
-- Tidak peduli urutan file sebelumnya dijalankan.
-- =====================================================================

-- ---------- 1. Aktifkan RLS (inti perbaikan) ------------------------
ALTER TABLE public.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simaksi          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simaksi_anggota  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_history ENABLE ROW LEVEL SECURITY;

-- ---------- 2. Buang SEMUA policy lama ------------------------------
-- Policy permisif digabung dengan OR: satu saja yang longgar cukup untuk
-- membatalkan yang ketat. Jadi sisa policy `USING (true)` dari 0001 harus
-- benar-benar hilang, bukan sekadar ditimpa.
DROP POLICY IF EXISTS users_policy              ON public.users;
DROP POLICY IF EXISTS users_select              ON public.users;
DROP POLICY IF EXISTS users_insert              ON public.users;
DROP POLICY IF EXISTS users_update              ON public.users;
DROP POLICY IF EXISTS users_select_self         ON public.users;
DROP POLICY IF EXISTS users_insert_self         ON public.users;
DROP POLICY IF EXISTS users_update_self         ON public.users;

DROP POLICY IF EXISTS simaksi_select            ON public.simaksi;
DROP POLICY IF EXISTS simaksi_insert            ON public.simaksi;
DROP POLICY IF EXISTS simaksi_update            ON public.simaksi;
DROP POLICY IF EXISTS simaksi_select_own        ON public.simaksi;
DROP POLICY IF EXISTS simaksi_insert_own        ON public.simaksi;
DROP POLICY IF EXISTS simaksi_update_admin      ON public.simaksi;

DROP POLICY IF EXISTS simaksi_anggota_select        ON public.simaksi_anggota;
DROP POLICY IF EXISTS simaksi_anggota_insert        ON public.simaksi_anggota;
DROP POLICY IF EXISTS simaksi_anggota_select_own    ON public.simaksi_anggota;
DROP POLICY IF EXISTS simaksi_anggota_insert_ketua  ON public.simaksi_anggota;

DROP POLICY IF EXISTS tracking_history_select       ON public.tracking_history;
DROP POLICY IF EXISTS tracking_history_insert       ON public.tracking_history;
DROP POLICY IF EXISTS tracking_history_select_own   ON public.tracking_history;
DROP POLICY IF EXISTS tracking_history_insert_own   ON public.tracking_history;

-- ---------- 3. Buat ulang policy yang benar -------------------------
-- users
CREATE POLICY users_select_self ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY users_insert_self ON public.users
  FOR INSERT TO anon, authenticated
  WITH CHECK (id = auth.uid() OR auth.uid() IS NULL);

CREATE POLICY users_update_self ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- simaksi
CREATE POLICY simaksi_select_own ON public.simaksi
  FOR SELECT TO authenticated
  USING (
    ketua_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.simaksi_anggota sa
                WHERE sa.simaksi_id = simaksi.id AND sa.user_id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY simaksi_insert_own ON public.simaksi
  FOR INSERT TO authenticated
  WITH CHECK (ketua_user_id = auth.uid() AND status = 'pending');

-- Penutup bypass approval: hanya petugas yang boleh mengubah status.
CREATE POLICY simaksi_update_admin ON public.simaksi
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- simaksi_anggota
CREATE POLICY simaksi_anggota_select_own ON public.simaksi_anggota
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.simaksi s
                WHERE s.id = simaksi_anggota.simaksi_id AND s.ketua_user_id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY simaksi_anggota_insert_ketua ON public.simaksi_anggota
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.simaksi s
             WHERE s.id = simaksi_anggota.simaksi_id AND s.ketua_user_id = auth.uid())
    OR public.is_admin()
  );

-- tracking_history
CREATE POLICY tracking_history_select_own ON public.tracking_history
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY tracking_history_insert_own ON public.tracking_history
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());


-- ---------- 4. Verifikasi -------------------------------------------
-- (a) RLS harus aktif di keempat tabel — rowsecurity semuanya true:
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users','simaksi','simaksi_anggota','tracking_history')
ORDER BY tablename;

-- (b) Daftar policy yang tersisa — tidak boleh ada nama lama
--     (simaksi_update, users_policy, dst.) yang muncul di sini:
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('users','simaksi','simaksi_anggota','tracking_history')
ORDER BY tablename, policyname;
