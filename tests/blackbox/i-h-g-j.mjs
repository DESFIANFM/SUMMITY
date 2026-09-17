import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { browser, halaman, catat, tungguTeks, loginPendaki, loginPetugas, teks, bersih, BASE } from './lib.mjs';
import { PASSWORD, emailOf } from './akun.mjs';
import { qr, scanGambar } from './qr.mjs';

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const idUser = async (u) => (await admin.from('users').select('id').eq('username', u).single()).data.id;
const LUBNA = (await admin.from('simaksi').select('id,kode_simaksi,status').eq('ketua_user_id', await idUser('lubna')).order('created_at', { ascending: false }).limit(1).single()).data;
const b = await browser();

console.log('I. Dashboard Petugas & H2');
{ const p = await halaman(b);
  await loginPetugas(p, 'desfianfemas', '123456');
  await tungguTeks(p, ['Sebaran Pendaki']); await p.waitForTimeout(3000);

  // H2 + I2: buka pos Basecamp yang berisi pendaki
  const posBasecamp = p.getByRole('button', { name: /^Basecamp Bambangan/ });
  const labelPos = bersih(await posBasecamp.innerText());
  await posBasecamp.click();
  const modalPos = p.locator('div.fixed', { hasText: 'Rombongan di Pos' });
  await modalPos.waitFor();
  const grupLubna = modalPos.getByRole('button', { name: new RegExp(`${LUBNA.kode_simaksi}.*Lubna`, 's') });
  const adaLubna = await grupLubna.isVisible().catch(() => false);
  catat('H2', adaLubna, adaLubna ? `Baris “${labelPos}” pada Sebaran Pendaki; rombongan ${LUBNA.kode_simaksi} (Lubna) tercantum di pos tersebut` : 'Rombongan lubna tidak tampil di pos Basecamp');
  catat('I2', adaLubna, `Modal “Rombongan di Pos — Basecamp Bambangan” terbuka${adaLubna ? `, berisi ${LUBNA.kode_simaksi} · Lubna` : ''}`);

  // I3: buka lalu tutup akordeon
  { await grupLubna.click(); await p.waitForTimeout(800);
    const terbuka = await modalPos.getByText('Terpantau di pos ini').isVisible().catch(() => false);
    const anggota = terbuka ? bersih(await modalPos.innerText()).match(/Anggota\s*\(\d+\)[^T]*/)?.[0] : '';
    await grupLubna.click(); await p.waitForTimeout(900);
    const tertutup = !(await modalPos.getByText('Terpantau di pos ini').isVisible().catch(() => false));
    catat('I3', terbuka && tertutup, `Klik pertama ${terbuka ? `membuka rincian (Ketua: Lubna; ${anggota?.trim()})` : 'tidak membuka rincian'}; klik kedua ${tertutup ? 'menutup kembali' : 'tidak menutup'}`); }
  await modalPos.getByRole('button').first().click();  // tombol tutup (X)
  await p.waitForTimeout(600);

  // I4: pos kosong
  { const kosong = p.locator('button[disabled]', { hasText: /Kosong/i }).first();
    const nama = bersih(await kosong.innerText()).replace(/Kosong/i, '').trim();
    await kosong.click({ force: true }).catch(() => {});
    await p.waitForTimeout(700);
    const terbuka = await p.locator('div.fixed', { hasText: 'Rombongan di Pos' }).isVisible().catch(() => false);
    catat('I4', !terbuka, `Pos kosong “${nama}” ${terbuka ? 'membuka modal' : 'tidak dapat dibuka (tombol nonaktif)'}`); }

  // I1: klik baris log milik lubna
  { await p.getByRole('button', { name: new RegExp(LUBNA.kode_simaksi) }).first().click();
    const modal = p.locator('div.fixed', { hasText: 'Posisi Terakhir' });
    await modal.waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
    const isi = bersih(await modal.innerText());
    const ok = /Pos Check Log/i.test(isi) && /Posisi Terakhir/i.test(isi);
    catat('I1', ok, ok ? `Modal detail tampil dengan kartu “Pos Check Log” dan “Posisi Terakhir” (${/Basecamp/i.test(isi) ? 'Basecamp Bambangan' : 'posisi tertera'})` : `Kartu tidak lengkap: ${isi.slice(0,120)}`);
    await p.keyboard.press('Escape');
    await modal.locator('button').first().click().catch(() => {}); await p.waitForTimeout(600); }

  // I5: cari pendaki berdasarkan nama
  { const cari = p.getByPlaceholder(/Cari nama pendaki, ID pendaki, NIK/);
    await cari.fill('Rendita'); await p.waitForTimeout(800);
    const label = bersih(await p.getByText(/\d+\/\d+ Pendaki/).first().innerText());
    const adaRendita = await p.getByRole('button', { name: /Rendita/ }).first().isVisible().catch(() => false);
    catat('I5', adaRendita && /^1\//.test(label), `Daftar tersaring menjadi ${label}${adaRendita ? ', berisi Rendita' : ''}`);
    await cari.fill(''); await p.waitForTimeout(500); }

  // I6: filter status Di Perjalanan
  { await p.getByRole('button', { name: /Di Perjalanan/ }).first().click(); await p.waitForTimeout(800);
    const label = bersih(await p.getByText(/\d+\/\d+ Pendaki/).first().innerText());
    const blok = p.locator('div.divide-y').filter({ hasText: /Masih di Perjalanan|Tidak ada pendaki/ }).first();
    const isi = bersih(await blok.innerText());
    const lain = /Sudah Lapor Pulang|Menunggu Verifikasi|Tidak Ada Perjalanan/.test(isi);
    catat('I6', !lain && /Lubna/.test(isi), `Tersaring ${label}; ${lain ? 'masih ada status lain di daftar' : 'hanya berstatus “Masih di Perjalanan”'}${/Lubna/.test(isi) ? ', termasuk Lubna' : ''}`); }
  await p.context().close(); }

console.log('\nH. Pemindaian oleh Petugas');
// H4: QR yang salah
{ const p = await halaman(b);
  await loginPetugas(p, 'desfianfemas', '123456'); await tungguTeks(p, ['Dashboard Monitor']);
  await p.goto(`${BASE}/scanner`, { waitUntil: 'networkidle' });
  await scanGambar(p, await qr('SUMMITY-POS-0'));
  const exp = 'QR tidak dikenal. Gunakan QR kepulangan dari aplikasi pendaki.';
  const m = await tungguTeks(p, [exp, 'Format QR tidak valid.', 'Kepulangan Tercatat'], 15000);
  catat('H4', m === exp, m ? `Muncul “${m}”` : 'Tidak ada respons');
  await p.context().close(); }

// H3: QR kepulangan milik lubna
{ const p = await halaman(b);
  await loginPetugas(p, 'desfianfemas', '123456'); await tungguTeks(p, ['Dashboard Monitor']);
  await p.goto(`${BASE}/scanner`, { waitUntil: 'networkidle' });
  await scanGambar(p, await qr(`SUMMITY-RETURN-${LUBNA.id}`));
  const m = await tungguTeks(p, ['Pendaki berhasil checkout', 'Kepulangan Tercatat', 'QR tidak dikenal'], 20000);
  await p.waitForTimeout(3000);
  const { data } = await admin.from('simaksi').select('status').eq('id', LUBNA.id).single();
  catat('H3', /checkout|Kepulangan/i.test(m || '') && ['complete', 'checkout'].includes(data.status), m ? `Muncul “${m}”; status SIMAKSI ${LUBNA.kode_simaksi} menjadi ${data.status}` : 'Tidak ada respons');
  await p.context().close(); }

console.log('\nG4. Pendaki dengan riwayat lama (iqbal)');
{ const iq = await idUser('iqbal');
  const { count } = await admin.from('simaksi').select('id', { count: 'exact', head: true }).eq('ketua_user_id', iq);
  if (!count) {
    // Siapkan riwayat pendakian lama: simaksi selesai + tiket + scan pada Agustus.
    await admin.from('simaksi').insert({ ketua_user_id: iq, gunung_id: 1, tanggal_naik: '2026-08-01', tanggal_turun: '2026-08-02', total_anggota: 1, status: 'complete', created_at: '2026-08-01T01:00:00Z' });
    const tiket = randomUUID();
    await admin.from('tickets').insert({ id: tiket, user_id: iq, mountain_name: 'Gn. Slamet', date: '2026-08-01', end_date: '2026-08-02', status: 'COMPLETED', qr_code: `SUMMITY-USER-${iq}`, created_at: '2026-08-01T01:30:00Z' });
    await admin.from('tracking_history').insert({ ticket_id: tiket, user_id: iq, pos_id: 0, scanned_at: '2026-08-01T02:00:00Z', is_offline: false, validation_status: 'valid' });
    // SIMAKSI baru yang baru disetujui.
    await admin.from('simaksi').insert({ ketua_user_id: iq, gunung_id: 1, tanggal_naik: '2026-10-03', tanggal_turun: '2026-10-04', total_anggota: 1, status: 'approved' });
    console.log('  (riwayat lama Agustus + SIMAKSI baru disetujui disiapkan untuk iqbal)');
  }
  const p = await halaman(b);
  await loginPendaki(p, 'iqbal', PASSWORD);
  const m = await tungguTeks(p, ['SIMAKSI Telah Disetujui', 'Sedang Dalam Perjalanan'], 15000);
  catat('G4', m === 'SIMAKSI Telah Disetujui', m ? `Banner “${m}” (riwayat scan 1 Agustus tidak memengaruhi)` : 'Banner tidak muncul');
  await p.context().close(); }

console.log('\nJ. Hak Akses');
{ const p = await halaman(b);
  await loginPendaki(p, 'rendita', PASSWORD); await tungguTeks(p, ['Registrasi SIMAKSI', 'Uji penolakan']);
  await p.goto(`${BASE}/scanner`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  const path = new URL(p.url()).pathname;
  catat('J1', path === '/', `Membuka /scanner sebagai pendaki berakhir di ${path}`);

  await p.getByTitle('Logout').first().click(); await p.waitForTimeout(2000);
  const setelah = new URL(p.url()).pathname;
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  const ulang = new URL(p.url()).pathname;
  catat('J3', setelah === '/login' && ulang === '/login', `Setelah logout di ${setelah}; membuka / kembali dialihkan ke ${ulang}`);
  await p.context().close(); }

{ const p = await halaman(b);
  await p.goto(`${BASE}/tickets`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  const path = new URL(p.url()).pathname;
  catat('J2', path === '/login', `Membuka /tickets tanpa login berakhir di ${path}`);
  await p.context().close(); }

{ const cli = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await cli.auth.signInWithPassword({ email: emailOf('rendita'), password: PASSWORD });
  const { data: s } = await admin.from('simaksi').select('id,status').eq('ketua_user_id', await idUser('rendita')).order('created_at', { ascending: false }).limit(1).single();
  const { data: upd, error } = await cli.from('simaksi').update({ status: 'approved' }).eq('id', s.id).select('id');
  const { data: after } = await admin.from('simaksi').select('status').eq('id', s.id).single();
  catat('J4', (!!error || !upd?.length) && after.status === s.status, `Permintaan ubah status ke approved ${error ? `ditolak (${error.message})` : `mengubah ${upd?.length ?? 0} baris`}; status tetap ${after.status}`); }

await b.close();
