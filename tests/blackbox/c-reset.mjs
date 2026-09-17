import { createClient } from '@supabase/supabase-js';
import { browser, halaman, catat, tungguTeks, loginPendaki, BASE } from './lib.mjs';
import { PASSWORD } from './akun.mjs';
import { readFileSync } from 'fs';
const sudah = JSON.parse(readFileSync(new URL('./hasil.json', import.meta.url), 'utf8'));
const lewati = (id) => { if (sudah[id]) { console.log(`  = ${id} sudah tercatat, tidak diulang`); return true; } return false; };

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const EMAIL = 'najwa@summity.id';
const BARU = 'Summity456';

async function panelLupa(p) {
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: /MASUK PENDAKI/i }).click();
  await p.getByRole('button', { name: /Lupa Password\?/i }).click();
}

const b = await browser();
console.log('C. Lupa & Reset Password');

if (!lewati('C1')) { const p = await halaman(b); await panelLupa(p);
  await p.getByPlaceholder('email@contoh.com').fill(EMAIL);
  await p.getByRole('button', { name: /Kirim Tautan/ }).click();
  const m = await tungguTeks(p, ['Email Terkirim', 'gagal dikirim', 'Terlalu banyak']);
  catat('C1', m === 'Email Terkirim', m === 'Email Terkirim'
    ? 'Muncul “Email Terkirim”; server menerima dan mengirim permintaan. Kotak masuk alamat uji tidak dapat diperiksa'
    : `Muncul “${m}”`);
  await p.context().close(); }

if (!lewati('C2')) { const p = await halaman(b); await panelLupa(p);
  await p.getByPlaceholder('email@contoh.com').fill('pendaki.gmail.com');
  await p.getByRole('button', { name: /Kirim Tautan/ }).click();
  await p.waitForTimeout(1500);
  const m = await tungguTeks(p, ['Format email tidak valid.', 'Email Terkirim'], 2500);
  const nativ = await p.getByPlaceholder('email@contoh.com').evaluate(e => e.validity.valid ? '' : e.validationMessage);
  catat('C2', m === 'Format email tidak valid.' || !!nativ,
    m === 'Format email tidak valid.' ? `Muncul pesan “${m}”`
    : nativ ? `Form tidak terkirim; browser menolak format email (“${nativ}”)` : `Muncul “${m}”`);
  await p.context().close(); }

if (!lewati('C3')) { const p = await halaman(b); await panelLupa(p);
  await p.getByPlaceholder('email@contoh.com').fill('belum.terdaftar.uji@summity.id');
  await p.getByRole('button', { name: /Kirim Tautan/ }).click();
  const m = await tungguTeks(p, ['Email Terkirim', 'gagal dikirim', 'Terlalu banyak']);
  catat('C3', m === 'Email Terkirim', m === 'Email Terkirim' ? 'Tetap muncul “Email Terkirim” (tidak membocorkan bahwa email belum terdaftar)' : `Muncul “${m}”`);
  await p.context().close(); }

// ---- alur halaman reset, memakai tautan pemulihan dari admin API (tanpa email) ----
const { data: link, error: le } = await admin.auth.admin.generateLink({
  type: 'recovery', email: EMAIL, options: { redirectTo: `${BASE}/reset-password` },
});
if (le) { console.log('  gagal membuat tautan:', le.message); process.exit(1); }

const p = await halaman(b);
await p.goto(link.properties.action_link, { waitUntil: 'networkidle' });
{ const tampil = await p.getByPlaceholder('Password baru', { exact: true }).isVisible({ timeout: 15000 }).catch(() => false);
  catat('C4', tampil, tampil ? `Tampil halaman form password baru (${new URL(p.url()).pathname})` : `Form tidak tampil; halaman ${p.url()}`); }

async function simpan(pw, ulang) {
  await p.getByPlaceholder('Password baru', { exact: true }).fill(pw);
  await p.getByPlaceholder('Ulangi password baru').fill(ulang);
  await p.getByRole('button', { name: /Simpan Password Baru/ }).click();
}
{ await simpan('12345', '12345');
  const m = await tungguTeks(p, ['Password minimal 6 karakter.'], 4000);
  catat('C5', !!m, m ? `Muncul pesan “${m}”` : 'Tidak muncul pesan'); }
{ await simpan('Summity456', 'Summity789');
  const m = await tungguTeks(p, ['Konfirmasi password tidak cocok.'], 4000);
  catat('C6', !!m, m ? `Muncul pesan “${m}”` : 'Tidak muncul pesan'); }
{ await simpan(BARU, BARU);
  const m = await tungguTeks(p, ['Password Diperbarui'], 10000);
  await p.waitForTimeout(3500);
  const tujuan = new URL(p.url()).pathname;
  catat('C7', !!m, m ? `Muncul “Password Diperbarui”, lalu dialihkan ke ${tujuan}` : 'Tidak muncul konfirmasi'); }
await p.context().close();

{ const q = await halaman(b); await loginPendaki(q, 'najwa', BARU);
  const m = await tungguTeks(q, ['Registrasi SIMAKSI', 'Username atau password salah.']);
  catat('C8', m === 'Registrasi SIMAKSI', m === 'Registrasi SIMAKSI' ? 'Berhasil masuk dengan password baru' : `Muncul “${m}”`);
  await q.context().close(); }

{ const q = await halaman(b); await loginPendaki(q, 'najwa', PASSWORD);
  const m = await tungguTeks(q, ['Username atau password salah.', 'Registrasi SIMAKSI']);
  catat('C9', m === 'Username atau password salah.', m === 'Username atau password salah.' ? `Ditolak: “${m}”` : 'Password lama masih bisa dipakai');
  await q.context().close(); }

await b.close();

// Kembalikan password najwa ke password seragam akun uji.
const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
const n = users.find(u => u.email === EMAIL);
await admin.auth.admin.updateUserById(n.id, { password: PASSWORD });
console.log(`  (password najwa dikembalikan ke password seragam akun uji)`);
