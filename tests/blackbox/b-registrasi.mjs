import { browser, halaman, catat, teks, tungguTeks, BASE } from './lib.mjs';

const BASIS = { username: 'zakiuji', email: 'uji.registrasi@summity.id', password: 'Summity123', confirm: 'Summity123', phone: '81234567890', emerg: '81398765432' };

async function isiAkun(p, d) {
  const set = async (ph, v, i = 0) => { const el = p.getByPlaceholder(ph).nth(i); await el.fill(''); await el.fill(v); };
  await set('Masukkan username untuk login pendaki', d.username);
  await set('Contoh: pendaki@email.com', d.email);
  await set('Maksimal aman, min 6 digit', d.password);
  await set('Ketik ulang sandi Anda', d.confirm);
  await set('81234567890', d.phone, 0);
  await set('81234567890', d.emerg, 1);
}
const diTahapDataDiri = async (p) => p.getByPlaceholder('Masukkan nama lengkap Anda').isVisible().catch(() => false);
const diTahapAlamat   = async (p) => p.getByPlaceholder(/Jl\. Bambangan Raya/).isVisible().catch(() => false);
const lanjutAkun  = (p) => p.getByRole('button', { name: /Berikutnya: Data Diri/ }).last().click();
const lanjutDiri  = (p) => p.getByRole('button', { name: /Berikutnya: Alamat Lengkap/ }).click();
const kembali     = (p) => p.getByRole('button', { name: /^Kembali$/ }).first().click();

async function isiDiri(p, nik, nama = 'Uji Registrasi') {
  await p.getByPlaceholder(/Masukkan nomor KTP Anda/).fill(nik);
  await p.getByPlaceholder('Masukkan nama lengkap Anda').fill(nama);
  await p.getByPlaceholder('Contoh: 65').fill('60');
  await p.getByPlaceholder('Contoh: 170').fill('168');
}

async function pilihWilayah(p) {
  const pola = [/JAWA TENGAH/i, /PURBALINGGA/i, /KARANG ?REJA/i, /./];
  for (let i = 0; i < 4; i++) {
    const s = p.locator('select').nth(i);
    await p.waitForFunction((idx) => { const e = document.querySelectorAll('select')[idx]; return e && !e.disabled && e.options.length > 1; }, i, { timeout: 20000 });
    const opsi = await s.locator('option').allInnerTexts();
    const idx = opsi.findIndex((t, k) => k > 0 && pola[i].test(t));
    await s.selectOption({ index: idx > 0 ? idx : 1 });
    await p.waitForTimeout(400);
  }
  await p.getByPlaceholder(/Jl\. Bambangan Raya/).fill('Jl. Raya Bambangan No. 21');
}

const bukaRegister = async (p) => { await p.goto(`${BASE}/register`, { waitUntil: 'networkidle' }); };
const kirim = (p) => p.getByRole('button', { name: /Daftar & Konfirmasi Akun/ }).click();

const b = await browser();
console.log('B. Registrasi Akun');

// ---------- validasi tahap akun ----------
const p = await halaman(b);
await bukaRegister(p);

async function ujiAkun(id, override, harap) {
  await isiAkun(p, { ...BASIS, ...override });
  await lanjutAkun(p); await p.waitForTimeout(700);
  if (harap === 'LANJUT') {
    const ok = await diTahapDataDiri(p);
    catat(id, ok, ok ? 'Diterima, lanjut ke tahap Data Diri' : `Tertahan; terlihat: ${(await teks(p)).match(/(Username|Password|Format|Nomor|Konfirmasi)[^.]*?(karakter|valid|cocok|\+62|8\))/i)?.[0] || '-'}`);
    if (ok) { await kembali(p); await p.waitForTimeout(500); }
  } else {
    const m = await tungguTeks(p, [harap], 3000);
    const maju = await diTahapDataDiri(p);
    catat(id, m === harap && !maju, m ? `Muncul pesan “${m}”` : maju ? 'Tidak ada pesan; langsung lanjut ke tahap Data Diri' : 'Tidak muncul pesan yang diharapkan');
    if (maju) { await kembali(p); await p.waitForTimeout(500); }
  }
}

await ujiAkun('B2',  { username: 'zak' },                          'Username minimal 4 karakter');
await ujiAkun('B3',  { username: 'zaki' },                         'LANJUT');
await ujiAkun('B4',  { password: '12345', confirm: '12345' },       'Password minimal 6 karakter');
await ujiAkun('B5',  { password: '123456', confirm: '123456' },     'LANJUT');
await ujiAkun('B6',  { password: 'rahasia1', confirm: 'rahasia2' }, 'Konfirmasi password tidak cocok');
await ujiAkun('B7',  { email: 'pendaki.gmail.com' },               'Format email tidak valid');
await ujiAkun('B10', { phone: '71234567890' },                     'Nomor harus diawali 8 (contoh: 81234567890)');
await ujiAkun('B11', { phone: '812345' },                          'Nomor harus 7–11 digit setelah +62');
// B12: catat juga panjang yang benar-benar diterima input
{ await isiAkun(p, { ...BASIS, phone: '812345678901' });
  const nilai = await p.getByPlaceholder('81234567890').nth(0).inputValue();
  await lanjutAkun(p); await p.waitForTimeout(700);
  const m = await tungguTeks(p, ['Nomor harus 7–11 digit setelah +62'], 3000);
  const maju = await diTahapDataDiri(p);
  catat('B12', !!m && !maju, m ? `Muncul pesan “${m}”` : `Input hanya menerima ${nilai.replace(/\D/g,'').length} digit (“${nilai}”); tidak ada pesan, ${maju ? 'lanjut ke tahap Data Diri' : 'tertahan'}`);
  if (maju) { await kembali(p); await p.waitForTimeout(500); } }

// ---------- validasi tahap data diri ----------
await isiAkun(p, BASIS); await lanjutAkun(p); await p.waitForTimeout(700);
{ await isiDiri(p, '330217092610000');  // 15 digit
  await lanjutDiri(p); await p.waitForTimeout(700);
  const m = await tungguTeks(p, ['NIK harus tepat 16 digit'], 3000);
  catat('B8', !!m && !(await diTahapAlamat(p)), m ? `Muncul pesan “${m}”` : 'Tidak muncul pesan'); }
{ await isiDiri(p, '3302170926100099');  // 16 digit
  await lanjutDiri(p); await p.waitForTimeout(1200);
  const ok = await diTahapAlamat(p);
  catat('B9', ok, ok ? 'Diterima, lanjut ke tahap Alamat' : 'Tertahan di tahap Data Diri'); }
await p.context().close();

// ---------- pendaftaran penuh ----------
async function daftarPenuh(akun, nik, nama) {
  const q = await halaman(b);
  await bukaRegister(q);
  await isiAkun(q, { ...BASIS, ...akun }); await lanjutAkun(q); await q.waitForTimeout(700);
  await isiDiri(q, nik, nama); await lanjutDiri(q); await q.waitForTimeout(1000);
  await pilihWilayah(q);
  await kirim(q);
  const m = await tungguTeks(q, ['Cek Email Anda', 'ID Pendaki', 'Username sudah dipakai', 'NIK ini sudah terdaftar', 'Email ini sudah terdaftar', 'gagal disimpan', 'rate limit', 'Terlalu banyak'], 25000);
  const layar = (await teks(q)).slice(0, 4000);
  await q.context().close();
  return { m, layar };
}

{ const { m } = await daftarPenuh({ username: 'haikal', email: 'haikal@summity.id' }, '3302170926100017', 'Haikal');
  catat('B1', m === 'Cek Email Anda' || m === 'ID Pendaki', m === 'Cek Email Anda' ? 'Akun berhasil dibuat; tampil layar “Cek Email Anda” karena konfirmasi email aktif' : m ? `Akun berhasil dibuat (${m})` : 'Tidak ada konfirmasi pendaftaran'); }

const LUBNA_NIK = process.env.LUBNA_NIK;
for (const [id, akun, nik, harap] of [
  ['B13', { username: 'desfian',  email: 'rivera.duplikat@summity.id' }, '3302170926100018', 'Username sudah dipakai'],
  ['B14', { username: 'rivera2',  email: 'rivera2@summity.id' },         LUBNA_NIK,          'NIK ini sudah terdaftar'],
  ['B15', { username: 'paiz2',    email: 'lubna@summity.id' },           '3302170926100019', 'Email ini sudah terdaftar'],
]) {
  const { m } = await daftarPenuh(akun, nik, 'Uji Duplikat');
  catat(id, m === harap, m ? `Muncul pesan mengandung “${m}”` : 'Tidak muncul pesan');
}

await b.close();
