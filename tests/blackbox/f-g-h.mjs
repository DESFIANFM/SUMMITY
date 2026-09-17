import { createClient } from '@supabase/supabase-js';
import { browser, halaman, catat, tungguTeks, loginPendaki, loginPetugas, teks, BASE } from './lib.mjs';
import { PASSWORD } from './akun.mjs';
import { qr, scanGambar } from './qr.mjs';

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ALASAN = 'Uji penolakan: kuota pendakian pada tanggal tersebut sudah penuh';
const b = await browser();

const idUser = async (u) => (await admin.from('users').select('id').eq('username', u).single()).data.id;
const simaksiTerbaru = async (u) => (await admin.from('simaksi').select('id,status,kode_simaksi').eq('ketua_user_id', await idUser(u)).order('created_at', { ascending: false }).limit(1).single()).data;

console.log('F. Verifikasi SIMAKSI oleh Petugas');
{ const p = await halaman(b);
  await loginPetugas(p, 'desfianfemas', '123456');
  await tungguTeks(p, ['Permohonan SIMAKSI']);
  const modal = () => p.locator('div.fixed', { hasText: 'Verifikasi sebelum persetujuan' });

  // F1
  { await p.locator('h4', { hasText: /^Lubna$/ }).first().click();
    await modal().getByText('Perlengkapan Wajib').waitFor();
    await p.waitForTimeout(2500);
    const isi = await modal().innerText();
    const hitung = isi.match(/(\d+)\s*\/\s*(\d+)/g)?.find(x => /\/\s*14/.test(x));
    catat('F1', !!hitung, hitung ? `Tampil detail beserta ceklis perlengkapan wajib (${hitung.replace(/\s/g,'')})` : 'Ceklis perlengkapan tidak tampil'); }

  // F2
  { await modal().getByRole('button', { name: /Setujui SIMAKSI/ }).click();
    await p.waitForTimeout(3000);
    const masihAda = await p.locator('h4', { hasText: /^Lubna$/ }).count();
    const s = await simaksiTerbaru('lubna');
    catat('F2', s.status === 'approved' && masihAda === 0, `Status menjadi ${s.status}${s.kode_simaksi ? ` (${s.kode_simaksi})` : ''}; ${masihAda ? 'masih' : 'hilang dari'} daftar permohonan`); }

  // F3
  { await p.locator('h4', { hasText: /^Rendita$/ }).first().click();
    await modal().getByRole('button', { name: /^Tolak$/ }).click();
    await p.getByPlaceholder('Tuliskan alasan penolakan...').fill(ALASAN);
    await p.getByRole('button', { name: /^Tolak SIMAKSI$/ }).click();
    await p.waitForTimeout(3000);
    const { data } = await admin.from('simaksi').select('status,catatan_verifikator').eq('ketua_user_id', await idUser('rendita')).order('created_at', { ascending: false }).limit(1).single();
    catat('F3', data.status === 'rejected' && data.catatan_verifikator === ALASAN, `Status menjadi ${data.status}; alasan tersimpan: “${data.catatan_verifikator}”`); }
  await p.context().close(); }

// F4
{ const p = await halaman(b);
  await loginPendaki(p, 'rendita', PASSWORD);
  const m = await tungguTeks(p, [ALASAN], 15000);
  catat('F4', !!m, m ? `Tampil pemberitahuan penolakan beserta alasan “${ALASAN}”` : 'Alasan penolakan tidak tampil');
  await p.context().close(); }

console.log('\nG. Status Perjalanan & H. Pemindaian (lubna)');
{ const p = await halaman(b);
  await loginPendaki(p, 'lubna', PASSWORD);

  // G2
  { const m = await tungguTeks(p, ['SIMAKSI Telah Disetujui', 'Sedang Dalam Perjalanan', 'SIMAKSI Dalam Proses'], 15000);
    const pesan = (await teks(p)).toLowerCase().includes('jangan lupa bawa turun sampahmu');
    catat('G2', m === 'SIMAKSI Telah Disetujui' && pesan, m ? `Banner “${m}”${pesan ? ' beserta pesan keselamatan dan “Jangan lupa bawa turun sampahmu!!”' : ''}` : 'Banner tidak muncul'); }

  // H1: scan QR pos 0 lewat unggah gambar
  { await p.goto(`${BASE}/scan`, { waitUntil: 'networkidle' });
    await scanGambar(p, await qr('SUMMITY-POS-0'));
    const m = await tungguTeks(p, ['Basecamp Bambangan'], 15000);
    await p.waitForTimeout(3000);
    const { data } = await admin.from('tracking_history').select('pos_id,scanned_at').eq('user_id', await idUser('lubna')).order('scanned_at', { ascending: false }).limit(1);
    catat('H1', !!m && data?.length === 1, m ? `Tampil “Basecamp Bambangan”; tercatat di riwayat (pos ${data?.[0]?.pos_id}, ${data?.[0]?.scanned_at?.slice(11,19)} UTC)` : 'Nama pos tidak tampil / tidak tercatat'); }

  // G3
  { await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    const m = await tungguTeks(p, ['Sedang Dalam Perjalanan', 'SIMAKSI Telah Disetujui'], 15000);
    catat('G3', m === 'Sedang Dalam Perjalanan', m ? `Banner berubah menjadi “${m}”` : 'Banner tidak muncul'); }
  await p.context().close(); }

await b.close();
