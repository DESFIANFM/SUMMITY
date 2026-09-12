# Panduan Setup Email (Custom SMTP) — SUMMITY

Panduan menyiapkan pengiriman email untuk **lupa password** dan **konfirmasi
pendaftaran**, memakai Resend sebagai SMTP dan domain `summity.id`.

## Kenapa perlu

SMTP bawaan Supabase dibatasi sangat ketat (sekitar **2 email per jam**) dan
tidak bisa dinaikkan maupun dimatikan dari dashboard — Supabase sengaja
menguncinya agar tidak dipakai produksi. Satu percobaan reset password sudah
cukup untuk memicu `email rate limit exceeded`.

Kuota itu dihitung untuk **semua email auth**, bukan hanya reset password.
Selama `Confirm email` masih aktif, setiap pendaftaran akun baru ikut
menghabiskan jatah yang sama.

---

## Kondisi saat ini (per 13 September 2026)

| Hal | Status |
|---|---|
| Domain produksi | `https://www.summity.id` (juga `summity-ten.vercel.app`) |
| Hosting | Vercel, auto-deploy dari branch `main` |
| DNS `summity.id` | Dikelola **Rumahweb** (`nsid1–4.rumahweb.*`) |
| Record TXT | Belum ada — domain masih bersih |
| Record MX | Belum ada — domain belum dipakai email |
| `www.summity.id` | Sudah mengarah ke Vercel |
| SMTP | Masih bawaan Supabase (terbatas) |
| Rute `/reset-password` | Sudah aktif (HTTP 200), rewrite Vercel sudah terpasang |

Project ref Supabase: `nscdivtzsunfbpihlqio`

---

## Bagian 1 — Daftar Resend

1. Buka <https://resend.com> → **Sign up** (gratis, bisa pakai Google/GitHub,
   tanpa kartu kredit)
2. Verifikasi email pendaftaran

Kuota gratis: 100 email/hari, 3.000/bulan.

## Bagian 2 — Daftarkan domain di Resend

3. Sidebar kiri → **Domains** → **Add Domain**
4. Isi `summity.id`
5. Region: **ap-southeast-1 (Singapore)** — terdekat
6. Klik **Add**

Resend menampilkan 3 record DNS. **Jangan tutup halaman ini.** Bentuknya:

| Type | Name | Value |
|---|---|---|
| `MX` | `send` | `feedback-smtp.ap-southeast-1.amazonses.com` (priority 10) |
| `TXT` | `send` | `v=spf1 include:amazonses.com ~all` |
| `TXT` | `resend._domainkey` | `p=MIGfMA0GCSq...` (string panjang) |

## Bagian 3 — Tambahkan record di Rumahweb

7. Login ke client area **Rumahweb** → domain `summity.id` → **Kelola DNS** /
   **Zone Editor**
   (kalau pakai cPanel: cPanel → **Zone Editor** → **Manage**)
8. Tambahkan ketiga record di atas satu per satu

> ### ⚠️ Kesalahan paling sering terjadi
>
> Di cPanel/Rumahweb, kolom **Name** biasanya **otomatis menambahkan nama
> domain**. Jadi isi `send` saja — **BUKAN** `send.summity.id`.
>
> Kalau ditulis lengkap, hasilnya menjadi `send.summity.id.summity.id` dan
> verifikasi tidak akan pernah berhasil. Berlaku sama untuk
> `resend._domainkey`.

9. Untuk record DKIM yang panjang, salin **seluruh** nilainya — tanpa spasi
   atau baris baru tambahan

## Bagian 4 — Verifikasi

10. Kembali ke Resend → **Domains** → **Verify DNS Records**
11. Tunggu status berubah menjadi **Verified** (5–30 menit, kadang beberapa jam)

Cek mandiri dari terminal apakah record sudah terbaca publik:

```bash
dig +short TXT send.summity.id
dig +short TXT resend._domainkey.summity.id
dig +short MX  send.summity.id
```

Kalau ketiganya sudah keluar tapi Resend masih "Pending", berarti tinggal
menunggu cache DNS — bukan salah konfigurasi.

## Bagian 5 — Buat API key

12. Resend → **API Keys** → **Create API Key**
13. Name `summity-supabase`, Permission **Sending access**, Domain `summity.id`
14. **Salin key-nya sekarang** (diawali `re_`) — Resend hanya menampilkannya
    sekali

Key ini langsung ditempel ke Supabase. Jangan masuk ke repo atau file `.env`.

## Bagian 6 — Pasang di Supabase

15. **Authentication → Emails → SMTP Settings** → aktifkan
    **Enable Custom SMTP**
16. Isi:

```
Host          : smtp.resend.com
Port          : 465
Username      : resend
Password      : re_xxxxx            <- API key dari Bagian 5
Sender email  : noreply@summity.id
Sender name   : SUMMITY
```

17. **Save**

## Bagian 7 — Naikkan rate limit

18. **Authentication → Rate Limits** → *Rate limit for sending emails*
19. Kolom ini baru bisa dinaikkan setelah Custom SMTP aktif. Isi **30**
    (satuannya **per jam**, bukan per hari)
20. *Minimum interval between emails*: turunkan dari 60 detik ke **10** supaya
    bisa mencoba berulang saat demo

## Bagian 8 — URL Configuration (wajib)

Tanpa ini, tautan reset ditolak meski emailnya sampai.

21. **Authentication → URL Configuration**

```
Site URL      : https://www.summity.id

Redirect URLs : https://www.summity.id/reset-password
                https://summity-ten.vercel.app/reset-password
                http://localhost:3000/reset-password
```

22. Klik **Save** di masing-masing bagian — keduanya disimpan terpisah

Kenapa tiga entri: kode menentukan tujuan dari alamat tempat aplikasi dibuka
(`src/lib/auth.ts`):

```ts
redirectTo: `${window.location.origin}/reset-password`
```

**Site URL juga memengaruhi email konfirmasi pendaftaran**, bukan cuma reset
password. Kalau masih `http://localhost:3000` (default Supabase), pendaki yang
membuka email konfirmasi dari HP akan diarahkan ke localhost dan gagal.

## Bagian 9 — Tes

23. Buka <https://www.summity.id/login> → **Lupa Password?**
24. Masukkan email akun yang terdaftar
25. Email masuk → klik tautan → harus mendarat di
    `https://www.summity.id/reset-password` dengan form password baru
26. Isi password baru → login ulang dengan password itu

---

## Jalur cepat (kalau waktu mepet)

Kerjakan **Bagian 1, 5, 6, 8** saja. Lewati verifikasi domain, dan pakai:

```
Sender email : onboarding@resend.dev
```

**Batasannya:** tanpa domain terverifikasi, Resend hanya mengirim ke alamat
email yang Anda pakai mendaftar Resend. Cukup untuk demo yang Anda kendalikan
sendiri, **tidak cukup** kalau penguji ikut mencoba mendaftar dengan email
mereka.

---

## Saran untuk sidang

Matikan konfirmasi email supaya pendaftaran tidak menghabiskan kuota:

**Authentication → Providers → Email → matikan "Confirm email"**

Efeknya: pendaftaran tidak mengirim email sama sekali, akun langsung aktif dan
bisa login. Layar "Cek Email Anda" di `src/pages/user/Register.tsx` otomatis
dilewati — kode sudah menangani kedua kondisi. Seluruh kuota email tersisa
khusus untuk reset password.

## Ganti password tanpa email

Untuk keadaan darurat atau saat kuota habis, password bisa diubah langsung:

**Authentication → Users** → cari akun → menu **⋮** → set password

Tidak menyentuh email, tidak kena kuota, berlaku seketika.

---

## Pemecahan masalah

| Gejala | Penyebab yang paling mungkin |
|---|---|
| `email rate limit exceeded` | Masih memakai SMTP bawaan, atau *Minimum interval* 60 detik belum lewat |
| Domain "Pending" terus di Resend | Nama record ditulis lengkap (`send.summity.id`) sehingga jadi ganda — lihat peringatan Bagian 3 |
| Email masuk, tautan error "redirect not allowed" | Redirect URLs di Bagian 8 belum diisi |
| Tautan mengarah ke `localhost` | Site URL masih default — lihat Bagian 8 |
| Halaman `/reset-password` 404 | `vercel.json` belum ter-deploy (sudah diperbaiki di commit `e31a493`) |
| Email tidak sampai sama sekali | Cek tab **Logs** di Resend — di situ terlihat apakah email benar terkirim atau ditolak |
