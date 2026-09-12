-- =====================================================================
-- Tahap 3a: fondasi Supabase Auth
--
-- Jalankan SETELAH kode frontend terpasang, TAPI SEBELUM
-- 0003_lock_down_rls.sql. Migrasi ini belum mengubah policy apa pun,
-- jadi aman: aplikasi lama tetap jalan sementara yang baru diuji.
-- =====================================================================

-- ---------- 1. Keunikan ditegakkan di database ----------------------
-- Sebelumnya duplikat dicek di frontend dengan membaca localStorage /
-- seluruh tabel users. Pengecekan di klien tidak bisa dipercaya.
-- CATATAN: kalau perintah ini gagal, berarti sudah ada data duplikat.
-- Cari dulu dengan:
--   SELECT username, count(*) FROM public.users GROUP BY 1 HAVING count(*) > 1;
--   SELECT nik, count(*)      FROM public.users WHERE nik IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_key
  ON public.users (lower(username)) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_nik_key
  ON public.users (nik) WHERE nik IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key
  ON public.users (lower(email)) WHERE email IS NOT NULL;

-- ---------- 2. RPC: username -> email -------------------------------
-- Supabase Auth hanya mengenal email, sedangkan UI Summity memakai
-- username. Fungsi ini SECURITY DEFINER sehingga bisa membaca tabel
-- users meski RLS nanti menutupnya untuk anon, TAPI hanya mengembalikan
-- satu kolom email — bukan seluruh baris.
--
-- Trade-off yang perlu disadari: fungsi ini memungkinkan orang menebak
-- apakah sebuah username terdaftar (user enumeration). Itu jauh lebih
-- ringan daripada keadaan sekarang (seluruh tabel bisa dibaca), dan bisa
-- diperketat nanti dengan rate limit di Edge Function bila perlu.
CREATE OR REPLACE FUNCTION public.get_login_email(p_username text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT email
  FROM public.users
  WHERE lower(username) = lower(p_username)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_login_email(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_login_email(text) TO anon, authenticated;

-- ---------- 3. id_pendaki dibuat otomatis di database ---------------
-- Sebelumnya nomor urut dihitung di frontend dari daftar user di
-- localStorage — rapuh, bisa bentrok, dan butuh akses baca ke user lain.
CREATE OR REPLACE FUNCTION public.assign_id_pendaki()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prefix text := to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYYMMDD');
  v_next   int;
BEGIN
  IF NEW.id_pendaki IS NOT NULL AND NEW.id_pendaki <> '' THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(max(substring(id_pendaki from 9)::int), 0) + 1
    INTO v_next
    FROM public.users
   WHERE id_pendaki LIKE v_prefix || '%'
     AND id_pendaki ~ ('^' || v_prefix || '[0-9]{4}$');

  NEW.id_pendaki := v_prefix || lpad(v_next::text, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_id_pendaki ON public.users;
CREATE TRIGGER trg_assign_id_pendaki
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_id_pendaki();

-- ---------- 4. Helper: apakah pemanggil seorang admin? --------------
-- Dipakai policy di 0003. SECURITY DEFINER supaya policy pada `users`
-- tidak rekursif memanggil dirinya sendiri.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'ADMIN'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
