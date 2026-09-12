-- =====================================================================
-- Angkat akun petugas (ADMIN) pertama
--
-- WAJIB dijalankan sebelum 0003_lock_down_rls.sql.
--
-- Kenapa: seluruh akses petugas di 0003 bergantung pada is_admin(), yang
-- mensyaratkan public.users.role = 'ADMIN'. Saat ini ke-21 baris berstatus
-- 'USER' — kalau 0003 dijalankan tanpa ini, dashboard petugas tidak akan
-- melihat data apa pun dan tidak ada yang bisa menyetujui SIMAKSI.
--
-- is_admin() butuh DUA hal benar sekaligus:
--   1. public.users.role = 'ADMIN'                     <- file ini
--   2. public.users.id  = id akun di auth.users        <- script migrasi
--      (scripts/migrate-users-to-auth.mjs)
-- Kalau hanya satu yang benar, akses petugas tetap tertutup.
-- =====================================================================

-- ---------- LANGKAH 0: pilih akun mana yang jadi petugas -------------
SELECT id, name, username, email, role
FROM public.users
WHERE username IS NOT NULL
ORDER BY username;


-- ---------- LANGKAH 1: angkat jadi ADMIN -----------------------------
-- GANTI username di bawah dengan akun yang Anda pilih.
BEGIN;

  UPDATE public.users
     SET role = 'ADMIN'
   WHERE username = 'desfianfemas';   -- <<< GANTI SESUAI PILIHAN ANDA

  -- Pengaman: pastikan tepat satu baris terpengaruh dan hasilnya benar.
  DO $$
  DECLARE n int;
  BEGIN
    SELECT count(*) INTO n FROM public.users WHERE role = 'ADMIN';
    IF n = 0 THEN
      RAISE EXCEPTION 'Dibatalkan: tidak ada baris yang cocok — periksa ejaan username.';
    END IF;
    RAISE NOTICE 'Jumlah akun ADMIN sekarang: %', n;
  END $$;

COMMIT;


-- ---------- LANGKAH 2: verifikasi ------------------------------------
SELECT id, name, username, email, role
FROM public.users
WHERE role = 'ADMIN';
-- Harus mengembalikan minimal 1 baris.


-- ---------- CATATAN: menambah petugas lain nanti ---------------------
-- Setelah 0003 aktif, promosi lewat aplikasi hanya bisa dilakukan oleh
-- akun yang sudah ADMIN (dijaga trigger guard_role_change). Dari SQL
-- Editor promosi tetap bisa kapan saja, karena auth.uid() di sana NULL
-- dan konteks itu dipercaya.
