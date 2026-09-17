import { createClient } from '@supabase/supabase-js';
import { browser, halaman, catat, tungguTeks, loginPendaki, teks, bersih } from './lib.mjs';
import { PASSWORD } from './akun.mjs';

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const PRIBADI = ['Headlamp','Jaket Gunung','Sepatu Hiking','Sleeping Bag','Jas Hujan','Sarung Tangan','Topi Gunung','Air Minum Minimal 2 Liter','Logistik / Makanan'];
const KELOMPOK = ['Tenda Dome (Sesuai Kapasitas)','Kompor Portable','Nesting / Wadah Memasak','P3K & Obat-obatan','Kantong Sampah / Trash Bag'];

const b = await browser();

async function bukaForm(username) {
  const p = await halaman(b);
  await loginPendaki(p, username, PASSWORD);
  await tungguTeks(p, ['Registrasi SIMAKSI']);
  await p.getByText('Registrasi SIMAKSI', { exact: true }).click();
  await p.getByText(PRIBADI[0], { exact: true }).waitFor();
  return p;
}
const tombol = (p) => p.getByRole('button', { name: /Kirim Pengajuan SIMAKSI|Lengkapi Perlengkapan/ });
const centang = async (p, daftar) => { for (const n of daftar) await p.getByText(n, { exact: true }).click(); };
const ketua = (p) => p.locator('input[type="checkbox"]').first();
const tanggal = (p, i) => p.locator('input[type="date"]').nth(i);
const jumlahItemTampil = async (p) => {
  let n = 0; for (const x of [...PRIBADI, ...KELOMPOK]) if (await p.getByText(x, { exact: true }).isVisible().catch(() => false)) n++; return n;
};

// ================= D: pendaki solo (rendita) =================
console.log('D. Pengajuan SIMAKSI — pendaki solo (rendita)');
{ const p = await bukaForm('rendita');

  // D8: tanpa status ketua, hanya barang pribadi yang tampil
  { await ketua(p).check(); await p.waitForTimeout(300);
    const saatKetua = await jumlahItemTampil(p);
    await ketua(p).uncheck(); await p.waitForTimeout(300);
    const saatSolo = await jumlahItemTampil(p);
    catat('D8', saatKetua === 14 && saatSolo === 9, `Saat ketua tampil ${saatKetua} barang; setelah dibatalkan tampil ${saatSolo} barang`); }

  // D4: 5 dari 9 barang pribadi
  { await centang(p, PRIBADI.slice(0, 5));
    const t = bersih(await tombol(p).innerText()); const nonaktif = await tombol(p).isDisabled();
    catat('D4', nonaktif && /\(5\/9\)/.test(t), `Tombol ${nonaktif ? 'nonaktif' : 'aktif'} bertuliskan “${t}”`); }

  await centang(p, PRIBADI.slice(5));

  // D1: tanggal naik kosong
  { await tombol(p).click(); await p.waitForTimeout(800);
    const m = await tungguTeks(p, ['Tanggal naik wajib diisi'], 1500);
    const nativ = await tanggal(p, 0).evaluate(e => e.validity.valid ? '' : e.validationMessage);
    catat('D1', !!m || !!nativ, m ? `Muncul pesan “${m}”` : nativ ? `Pengajuan tidak terkirim; browser menolak tanggal naik kosong (“${nativ}”)` : 'Pengajuan terkirim tanpa tanggal naik'); }

  // D2: tanggal turun kosong
  { await tanggal(p, 0).fill('2026-09-28');
    await tombol(p).click(); await p.waitForTimeout(800);
    const m = await tungguTeks(p, ['Tanggal turun wajib diisi'], 1500);
    const nativ = await tanggal(p, 1).evaluate(e => e.validity.valid ? '' : e.validationMessage);
    catat('D2', !!m || !!nativ, m ? `Muncul pesan “${m}”` : nativ ? `Pengajuan tidak terkirim; browser menolak tanggal turun kosong (“${nativ}”)` : 'Pengajuan terkirim tanpa tanggal turun'); }

  // D3: tanggal turun mendahului tanggal naik
  { await tanggal(p, 1).fill('2026-09-26');
    await tombol(p).click(); await p.waitForTimeout(800);
    const m = await tungguTeks(p, ['Tanggal turun tidak boleh mendahului tanggal naik', 'Tanggal turun tidak boleh lebih awal'], 1500);
    const nativ = await tanggal(p, 1).evaluate(e => e.validity.valid ? '' : e.validationMessage);
    const terkirim = await tungguTeks(p, ['SIMAKSI Berhasil Terdaftar!'], 1500);
    catat('D3', (!!m || !!nativ) && !terkirim, m ? `Muncul pesan “${m}”` : nativ ? `Pengajuan tidak terkirim; browser menolak tanggal turun (“${nativ}”)` : 'Pengajuan terkirim dengan tanggal terbalik'); }

  // D5: 9/9 barang pribadi, tanggal benar
  { await tanggal(p, 1).fill('2026-09-29');
    const t = bersih(await tombol(p).innerText());
    await tombol(p).click();
    const m = await tungguTeks(p, ['SIMAKSI Berhasil Terdaftar!'], 15000);
    catat('D5', !!m, m ? `Tombol aktif (“${t}”); muncul “${m}”` : `Tidak terkirim; tombol “${t}”`); }
  await p.context().close(); }

// ================= D & E: ketua rombongan (lubna) =================
console.log('\nE. Pencarian Anggota & D. Pengajuan ketua (lubna)');
const { data: amani } = await admin.from('users').select('id_pendaki, nik, phone').eq('username', 'amani').single();
{ const p = await bukaForm('lubna');
  await ketua(p).check();
  const cari = p.getByPlaceholder('ID Pendaki atau nama');
  await cari.waitFor();
  const isi = async (v) => { await cari.fill(''); await cari.fill(v); await p.waitForTimeout(1300); };

  { await isi('am');
    const m = await tungguTeks(p, ['Ketik minimal 3 karakter untuk mencari nama.'], 2000);
    catat('E1', !!m, m ? `Muncul “${m}”` : 'Tidak muncul petunjuk'); }

  { await isi('ama');
    const ada = await p.getByRole('button', { name: /Amani/ }).isVisible().catch(() => false);
    catat('E2', ada, ada ? 'Muncul daftar hasil berisi “Amani”' : 'Hasil pencarian tidak muncul'); }

  { await isi(amani.id_pendaki);
    const ada = await p.getByRole('button', { name: /Amani/ }).isVisible().catch(() => false);
    catat('E3', ada, ada ? `Pencarian ID ${amani.id_pendaki} menampilkan “Amani”` : 'Tidak ditemukan'); }

  { const hasil = bersih(await p.getByRole('button', { name: /Amani/ }).first().innerText());
    const bocor = [amani.nik, (amani.phone || '').replace(/\D/g, '').slice(-9)].filter(x => x && hasil.replace(/\D/g, '').includes(x));
    catat('E7', bocor.length === 0, bocor.length ? `Data sensitif ikut tampil: ${bocor.join(', ')}` : `Baris hasil hanya berisi “${hasil}” (nama dan ID Pendaki); NIK dan telepon tidak tampil`); }

  { await isi('zzqqxx');
    const m = await tungguTeks(p, ['Tidak ada pendaki yang cocok.'], 3000);
    catat('E4', !!m, m ? `Muncul “${m}”` : 'Tidak muncul pesan'); }

  { await isi('lubna');
    await p.getByRole('button', { name: /Lubna/ }).first().click();
    const m = await tungguTeks(p, ['Anda ketua kelompok, tidak perlu menambahkan diri sendiri.'], 3000);
    catat('E5', !!m, m ? `Muncul “${m}”` : 'Diri sendiri berhasil ditambahkan tanpa peringatan'); }

  { await isi('amani');
    await p.getByRole('button', { name: /Amani/ }).first().click(); await p.waitForTimeout(600);
    await isi('amani');
    await p.getByRole('button', { name: /Amani/ }).first().click();
    const m = await tungguTeks(p, ['Pendaki ini sudah ada di daftar rombongan.'], 3000);
    catat('E6', !!m, m ? `Muncul “${m}”` : 'Anggota ganda tidak ditolak'); }

  await cari.fill('');
  await tanggal(p, 0).fill('2026-09-25'); await tanggal(p, 1).fill('2026-09-26');

  // D6: 9 pribadi + 3 kelompok
  { await centang(p, PRIBADI); await centang(p, KELOMPOK.slice(0, 3));
    const t = bersih(await tombol(p).innerText()); const nonaktif = await tombol(p).isDisabled();
    catat('D6', nonaktif && /\(12\/14\)/.test(t), `Tombol ${nonaktif ? 'nonaktif' : 'aktif'} bertuliskan “${t}”`); }

  // D9: batal jadi ketua — centang pribadi bertahan, kelompok hilang
  { await ketua(p).uncheck(); await p.waitForTimeout(400);
    const t = bersih(await tombol(p).innerText()); const aktif = !(await tombol(p).isDisabled());
    await ketua(p).check(); await p.waitForTimeout(400);
    const t2 = bersih(await tombol(p).innerText());
    catat('D9', aktif && /\(9\/14\)/.test(t2), `Setelah batal jadi ketua tombol ${aktif ? 'aktif' : 'nonaktif'} (“${t}”); setelah jadi ketua lagi “${t2}”`); }

  // D7: lengkapi 14/14 lalu kirim
  { await centang(p, KELOMPOK);
    const t = bersih(await tombol(p).innerText());
    await tombol(p).click();
    const m = await tungguTeks(p, ['SIMAKSI Berhasil Terdaftar!'], 15000);
    catat('D7', !!m, m ? `Tombol “${t}”; muncul “${m}”` : `Tidak terkirim; tombol “${t}”`); }

  // G1: banner setelah mengajukan
  { await p.waitForTimeout(3500);
    const m = await tungguTeks(p, ['SIMAKSI Dalam Proses', 'SIMAKSI Telah Disetujui', 'Sedang Dalam Perjalanan'], 10000);
    catat('G1', m === 'SIMAKSI Dalam Proses', m ? `Banner “${m}”` : 'Banner tidak muncul'); }
  await p.context().close(); }

await b.close();
