-- =====================================================================
-- Tahap 3a-lanjutan: RPC pendukung rombongan
--
-- Jalankan SETELAH 0002_auth_foundation.sql dan SEBELUM 0003.
-- Aman dijalankan kapan pun: tidak mengubah policy, hanya menambah fungsi.
--
-- KENAPA PERLU:
-- Policy users_select_self di 0003 hanya mengizinkan seseorang membaca
-- barisnya sendiri. Tapi fitur SIMAKSI rombongan menuntut ketua bisa
-- mencari pendaki lain dari ID Pendaki-nya, dan menampilkan nama anggota
-- rombongannya. Tanpa kedua fungsi ini, fitur rombongan rusak begitu 0003
-- aktif — anggota akan dibuang diam-diam saat sync.
--
-- Keduanya SECURITY DEFINER tapi sengaja dipersempit: hanya mengembalikan
-- id, id_pendaki, dan nama — tidak pernah NIK, telepon, alamat, atau email.
-- =====================================================================

-- ---------- 1. Cari satu pendaki dari ID Pendaki atau UUID ----------
-- Menerima keduanya supaya jalur di trySyncSimaksi (yang kadang sudah
-- punya UUID, kadang baru punya id_pendaki) cukup memakai satu fungsi.
--
-- Mengembalikan json supaya tipe kolom tidak perlu dideklarasikan —
-- tahan terhadap perbedaan uuid vs text pada users.id.
CREATE OR REPLACE FUNCTION public.find_pendaki(p_key text)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT to_json(t) FROM (
    SELECT u.id, u.id_pendaki, u.name
    FROM public.users u
    WHERE u.id_pendaki = p_key
       OR u.id::text   = p_key
    LIMIT 1
  ) t;
$$;

REVOKE ALL ON FUNCTION public.find_pendaki(text) FROM public;
GRANT EXECUTE ON FUNCTION public.find_pendaki(text) TO anon, authenticated;


-- ---------- 2. Daftar anggota sebuah SIMAKSI ------------------------
-- Hanya boleh diakses oleh ketua simaksi itu, anggotanya, atau petugas.
-- Pemanggil lain dapat array kosong, bukan error — supaya tidak bisa
-- dipakai memetakan simaksi milik orang lain.
CREATE OR REPLACE FUNCTION public.get_simaksi_members(p_simaksi_id bigint)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_allowed boolean;
  v_result  json;
BEGIN
  SELECT (
       EXISTS (SELECT 1 FROM public.simaksi s
                WHERE s.id = p_simaksi_id AND s.ketua_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.simaksi_anggota sa
                WHERE sa.simaksi_id = p_simaksi_id AND sa.user_id = auth.uid())
    OR public.is_admin()
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RETURN '[]'::json;
  END IF;

  SELECT coalesce(
           json_agg(json_build_object(
             'id',         u.id,
             'idPendaki',  u.id_pendaki,
             'name',       u.name
           ) ORDER BY u.name),
           '[]'::json)
    INTO v_result
    FROM public.simaksi_anggota sa
    JOIN public.users u ON u.id = sa.user_id
   WHERE sa.simaksi_id = p_simaksi_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_simaksi_members(bigint) FROM public;
GRANT EXECUTE ON FUNCTION public.get_simaksi_members(bigint) TO anon, authenticated;
