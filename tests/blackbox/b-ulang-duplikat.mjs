// Uji ulang B13–B15 setelah perbaikan c0283c9 + migrasi 0007.
// Tiap skenario memakai email baru agar hanya SATU kolom yang duplikat,
// dan diverifikasi bahwa tidak ada akun Auth setengah jadi yang tercipta.
import { createClient } from '@supabase/supabase-js';
import { browser, halaman, catat, tungguTeks, BASE } from './lib.mjs';

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const LUBNA_NIK = (await admin.from('users').select('nik').eq('username', 'lubna').single()).data.nik;

const set = async (p, ph, v, i = 0) => { const el = p.getByPlaceholder(ph).nth(i); await el.fill(''); await el.fill(v); };
async function daftar(b, a) {
  const p = await halaman(b);
  await p.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
  await set(p, 'Masukkan username untuk login pendaki', a.username);
  await set(p, 'Contoh: pendaki@email.com', a.email);
  await set(p, 'Maksimal aman, min 6 digit', 'Summity123');
  await set(p, 'Ketik ulang sandi Anda', 'Summity123');
  await set(p, '81234567890', '81234567890', 0);
  await set(p, '81234567890', '81398765432', 1);
  await p.getByRole('button', { name: /Berikutnya: Data Diri/ }).last().click(); await p.waitForTimeout(700);
  await p.getByPlaceholder(/Masukkan nomor KTP Anda/).fill(a.nik);
  await p.getByPlaceholder('Masukkan nama lengkap Anda').fill('Uji Duplikat');
  await p.getByPlaceholder('Contoh: 65').fill('60');
  await p.getByPlaceholder('Contoh: 170').fill('168');
  await p.getByRole('button', { name: /Berikutnya: Alamat Lengkap/ }).click(); await p.waitForTimeout(1000);
  const pola = [/JAWA TENGAH/i, /PURBALINGGA/i, /KARANG ?REJA/i, /./];
  for (let i = 0; i < 4; i++) {
    await p.waitForFunction((x) => { const e = document.querySelectorAll('select')[x]; return e && !e.disabled && e.options.length > 1; }, i, { timeout: 20000 });
    const s = p.locator('select').nth(i);
    const opsi = await s.locator('option').allInnerTexts();
    const k = opsi.findIndex((t, j) => j > 0 && pola[i].test(t));
    await s.selectOption({ index: k > 0 ? k : 1 }); await p.waitForTimeout(400);
  }
  await p.getByPlaceholder(/Jl\. Bambangan Raya/).fill('Jl. Raya Bambangan No. 21');
  await p.getByRole('button', { name: /Daftar & Konfirmasi Akun/ }).click();
  const m = await tungguTeks(p, [a.harap, 'Cek Email Anda', 'gagal disimpan', 'Data diri gagal'], 20000);
  // Pastikan pesan terlihat di tahap yang benar
  const tahap = (await p.getByPlaceholder('Masukkan username untuk login pendaki').isVisible().catch(() => false)) ? 'Akun'
    : (await p.getByPlaceholder('Masukkan nama lengkap Anda').isVisible().catch(() => false)) ? 'Data Diri' : 'lain';
  await p.context().close();
  return { m, tahap };
}

const { data: { users: sebelum } } = await admin.auth.admin.listUsers({ perPage: 1000 });
const b = await browser();
console.log('B. Uji ulang data duplikat');

for (const [id, a] of [
  ['B13', { username: 'desfian', email: 'b13.uji.duplikat@summity.id', nik: '3302170926100031', harap: 'Username sudah dipakai. Pilih yang lain.' }],
  ['B14', { username: 'rivera3', email: 'b14.uji.duplikat@summity.id', nik: LUBNA_NIK,          harap: 'NIK ini sudah terdaftar dalam sistem.' }],
  ['B15', { username: 'paiz3',   email: 'lubna@summity.id',            nik: '3302170926100033', harap: 'Email ini sudah terdaftar. Silakan login.' }],
]) {
  const { m, tahap } = await daftar(b, a);
  const { data: { users: kini } } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const bocor = kini.filter(u => u.email === a.email && !sebelum.some(x => x.id === u.id));
  const ok = m === a.harap && bocor.length === 0;
  catat(id, ok, m === a.harap
    ? `Muncul pesan “${m}” di tahap ${tahap}; ${bocor.length ? 'TETAPI akun Auth setengah jadi tercipta' : 'tidak ada akun yang tercipta'}`
    : `Muncul “${m ?? '-'}”`);
}
await b.close();
