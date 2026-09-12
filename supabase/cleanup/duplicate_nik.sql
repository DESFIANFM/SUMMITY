-- =====================================================================
-- Perbaikan duplikat NIK — WAJIB dijalankan sebelum 0002_auth_foundation.sql
--
-- TIDAK ADA BARIS YANG DIHAPUS. Kedelapan baris tetap utuh karena
-- datanya masih akan dipakai; yang diubah hanya kolom `nik` pada 7 baris
-- agar masing-masing unik.
--
-- Temuan (21 baris di public.users):
--   NIK 3300000000000001 dipakai 8 baris, semuanya bernama
--   "Budi Pendaki" dengan username NULL, dibuat 2026-07-19.
--   Referensi: simaksi 0 | simaksi_anggota 0 | tracking_history 0 | tickets 8
--
--   14 NIK unik terpakai di tabel; 3300000000000002..0008 semuanya bebas
--   (sudah diperiksa), jadi aman dipakai sebagai pengganti.
-- =====================================================================

-- ---------- LANGKAH 0: lihat dulu, jangan ubah apa pun --------------
SELECT id, name, username, nik, role, created_at
FROM public.users
WHERE nik = '3300000000000001'
ORDER BY created_at;
-- Harus: 8 baris, semua username NULL.


-- ---------- LANGKAH 1: beri NIK unik ke 7 baris termuda -------------
-- Baris tertua mempertahankan 3300000000000001; tujuh sisanya dapat
-- ...0002 sampai ...0008 menurut urutan created_at.
BEGIN;

  -- Pengaman: batalkan kalau kondisinya tidak seperti yang diverifikasi.
  DO $$
  DECLARE n int; named int; clash int;
  BEGIN
    SELECT count(*) INTO n FROM public.users WHERE nik = '3300000000000001';
    IF n <> 8 THEN
      RAISE EXCEPTION 'Dibatalkan: ditemukan % baris ber-NIK itu, bukan 8.', n;
    END IF;

    SELECT count(*) INTO named FROM public.users
     WHERE nik = '3300000000000001' AND username IS NOT NULL;
    IF named > 0 THEN
      RAISE EXCEPTION 'Dibatalkan: % baris punya username — periksa manual dulu.', named;
    END IF;

    SELECT count(*) INTO clash FROM public.users
     WHERE nik IN ('3300000000000002','3300000000000003','3300000000000004',
                   '3300000000000005','3300000000000006','3300000000000007',
                   '3300000000000008');
    IF clash > 0 THEN
      RAISE EXCEPTION 'Dibatalkan: % NIK pengganti sudah terpakai.', clash;
    END IF;
  END $$;

  WITH bernomor AS (
    SELECT id,
           row_number() OVER (ORDER BY created_at, id) AS rn
    FROM public.users
    WHERE nik = '3300000000000001'
  )
  UPDATE public.users u
     SET nik = '33000000000000' || lpad(b.rn::text, 2, '0')
    FROM bernomor b
   WHERE u.id = b.id
     AND b.rn > 1;   -- rn = 1 (tertua) tetap memakai ...0001

COMMIT;


-- ---------- LANGKAH 2: verifikasi ------------------------------------
-- (a) Tidak ada lagi NIK duplikat — harus 0 baris:
SELECT nik, count(*) FROM public.users
WHERE nik IS NOT NULL GROUP BY nik HAVING count(*) > 1;

-- (b) Kedelapan baris masih ada dengan NIK berurutan:
SELECT name, nik, created_at
FROM public.users
WHERE nik LIKE '33000000000000%'
ORDER BY nik;
-- Harus 8 baris: ...0001 sampai ...0008.

-- (c) Jumlah total tidak berubah — harus tetap 21:
SELECT count(*) AS total_users FROM public.users;


-- Setelah (a) kosong dan (c) = 21, jalankan ulang
-- supabase/migrations/0002_auth_foundation.sql seluruhnya (aman diulang).
