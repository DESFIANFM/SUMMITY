-- =====================================================================
-- (A) Ceklis perlengkapan wajib  (B) Pencarian pendaki lewat nama
--
-- Sebelum ini, ceklis perlengkapan hanya state di layar: dipakai untuk
-- mengunci tombol submit, lalu hilang. Tidak ada jejak yang bisa dilihat
-- petugas saat memverifikasi.
--
-- Kedua tabel sudah ada sejak awal tapi terkunci total oleh RLS (0001
-- mengaktifkan RLS tanpa policy apa pun), jadi belum bisa dipakai.
--
-- Aman diulang.
-- =====================================================================

-- ---------- 1. mandatory_gear: katalog, boleh dibaca semua yang login --
-- Isinya daftar barang wajib, bukan data pribadi. Pendaki perlu membacanya
-- untuk menampilkan ceklis; petugas untuk memverifikasi.
DROP POLICY IF EXISTS mandatory_gear_select ON public.mandatory_gear;
CREATE POLICY mandatory_gear_select ON public.mandatory_gear
  FOR SELECT TO authenticated
  USING (true);

-- ---------- 2. simaksi_mandatory_gear: riwayat per simaksi ------------
-- Memakai helper SECURITY DEFINER dari 0005 supaya pemeriksaan lintas
-- tabel tidak memicu rekursi antar policy.

DROP POLICY IF EXISTS simaksi_gear_select ON public.simaksi_mandatory_gear;
CREATE POLICY simaksi_gear_select ON public.simaksi_mandatory_gear
  FOR SELECT TO authenticated
  USING (
    public.is_simaksi_ketua(simaksi_id)
    OR public.is_simaksi_member(simaksi_id)
    OR public.is_admin()
  );

-- Hanya ketua rombongan yang mencatat ceklis, saat mengajukan SIMAKSI.
DROP POLICY IF EXISTS simaksi_gear_insert ON public.simaksi_mandatory_gear;
CREATE POLICY simaksi_gear_insert ON public.simaksi_mandatory_gear
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_simaksi_ketua(simaksi_id)
    OR public.is_admin()
  );

-- Kolom diverifikasi/catatan/verified_at disediakan untuk verifikasi
-- fisik oleh petugas. Belum dipakai aplikasi, jadi UPDATE sengaja hanya
-- diberikan ke petugas.
DROP POLICY IF EXISTS simaksi_gear_update_admin ON public.simaksi_mandatory_gear;
CREATE POLICY simaksi_gear_update_admin ON public.simaksi_mandatory_gear
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Satu barang hanya boleh tercatat sekali per simaksi. Sekaligus membuat
-- pencatatan ulang (mis. sync yang terulang) tidak menghasilkan duplikat.
CREATE UNIQUE INDEX IF NOT EXISTS simaksi_mandatory_gear_unik
  ON public.simaksi_mandatory_gear (simaksi_id, mandatory_gear_id);


-- ---------- 3. Verifikasi --------------------------------------------
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('mandatory_gear','simaksi_mandatory_gear')
ORDER BY tablename, policyname;


-- =====================================================================
-- (B) Pencarian pendaki untuk menambah anggota rombongan
--
-- find_pendaki() hanya cocok persis dengan ID Pendaki atau UUID. Ketua
-- rombongan sering tidak hafal ID temannya, jadi perlu pencarian nama.
--
-- Pembatasan yang sengaja dipasang, karena fungsi ini melewati RLS:
--   - minimal 3 karakter, supaya tidak bisa dipakai menarik seluruh daftar
--   - maksimal 8 hasil
--   - hanya mengembalikan id, id_pendaki, dan nama
--     (tidak pernah NIK, telepon, alamat, atau email)
--   - akun petugas tidak ikut muncul
-- =====================================================================
CREATE OR REPLACE FUNCTION public.search_pendaki(p_query text)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT coalesce(json_agg(t), '[]'::json) FROM (
    SELECT u.id, u.id_pendaki, u.name
    FROM public.users u
    WHERE length(btrim(p_query)) >= 3
      AND coalesce(u.role, 'USER') <> 'ADMIN'
      AND (
        u.id_pendaki ILIKE btrim(p_query) || '%'
        OR u.name     ILIKE '%' || btrim(p_query) || '%'
      )
    ORDER BY
      -- cocok persis ID Pendaki didahulukan, lalu urut nama
      (u.id_pendaki = btrim(p_query)) DESC,
      u.name
    LIMIT 8
  ) t;
$$;

REVOKE ALL ON FUNCTION public.search_pendaki(text) FROM public;
GRANT EXECUTE ON FUNCTION public.search_pendaki(text) TO anon, authenticated;
