-- =====================================================================
-- Cek ketersediaan username, email, dan NIK sebelum pendaftaran
--
-- MASALAH:
-- signUpClimber() membuat akun Auth lebih dulu, baru menyimpan profil.
-- Bila username/NIK/email ternyata sudah terpakai, insert profil gagal
-- karena UNIQUE constraint — tetapi akun Auth-nya telanjur terbuat.
-- Hasilnya pesan generik yang menyesatkan dan akun setengah jadi yang
-- menghabiskan alamat email tersebut.
--
-- Pendaftar belum login, dan RLS melarang tamu membaca tabel `users`,
-- jadi pengecekan harus lewat fungsi SECURITY DEFINER.
--
-- Fungsi ini hanya mengembalikan true/false per kolom — tidak pernah
-- data pendaki. Membocorkan "username sudah dipakai" memang sifat wajar
-- form pendaftaran mana pun.
--
-- Email juga dicek di auth.users: Supabase sengaja tidak memberi error
-- saat signUp dengan email yang sudah terdaftar (anti-enumerasi), jadi
-- tanpa pengecekan ini email duplikat baru ketahuan setelah terlambat.
--
-- Aman diulang.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.cek_ketersediaan_registrasi(
  p_username text,
  p_email    text,
  p_nik      text
)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
STABLE
AS $$
  SELECT json_build_object(
    'username', EXISTS (
      SELECT 1 FROM public.users
      WHERE lower(username) = lower(btrim(p_username))
    ),
    'email', EXISTS (
      SELECT 1 FROM public.users WHERE lower(email) = lower(btrim(p_email))
    ) OR EXISTS (
      SELECT 1 FROM auth.users  WHERE lower(email) = lower(btrim(p_email))
    ),
    'nik', coalesce(btrim(p_nik), '') <> '' AND EXISTS (
      SELECT 1 FROM public.users WHERE nik = btrim(p_nik)
    )
  );
$$;

REVOKE ALL ON FUNCTION public.cek_ketersediaan_registrasi(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.cek_ketersediaan_registrasi(text, text, text) TO anon, authenticated;
