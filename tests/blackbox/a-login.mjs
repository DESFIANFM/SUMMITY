import { browser, halaman, catat, loginPendaki, loginPetugas, tungguTeks, BASE } from './lib.mjs';
import { PASSWORD } from './akun.mjs';
const ADMIN = { u: 'desfianfemas', p: '123456' };
const SALAH = 'Username atau password salah.';

const b = await browser();
console.log('A. Login');

{ const p = await halaman(b);
  await loginPendaki(p, 'lubna', PASSWORD);
  const ok = await tungguTeks(p, ['Registrasi SIMAKSI', 'SIMAKSI Dalam Proses', 'SIMAKSI Telah Disetujui', 'Sedang Dalam Perjalanan']);
  catat('A1', !!ok && !p.url().includes('/login'), ok ? `Masuk ke dashboard pendaki (${p.url().replace(BASE,'') || '/'})` : `Tetap di ${p.url()}`);
  await p.context().close(); }

{ const p = await halaman(b);
  await loginPendaki(p, 'lubna', 'passwordSalah99');
  const m = await tungguTeks(p, [SALAH]);
  catat('A2', m === SALAH, m ? `Muncul pesan “${m}”` : 'Tidak muncul pesan kesalahan');
  await p.context().close(); }

{ const p = await halaman(b);
  await loginPendaki(p, 'tidakadasiapa999', 'apasaja123');
  const m = await tungguTeks(p, [SALAH]);
  catat('A3', m === SALAH, m ? `Muncul pesan “${m}”` : 'Tidak muncul pesan kesalahan');
  await p.context().close(); }

{ const p = await halaman(b);
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: /MASUK PENDAKI/i }).click();
  await p.getByRole('button', { name: /^Masuk$/ }).click();
  await p.waitForTimeout(1500);
  const invalid = await p.locator('input[placeholder="Username"]:invalid').count();
  const pesan = await p.locator('input[placeholder="Username"]').evaluate(e => e.validationMessage);
  catat('A4', invalid === 1 && p.url().includes('/login'), invalid ? `Form tidak terkirim; browser menolak field kosong (“${pesan}”)` : 'Form terkirim meski kosong');
  await p.context().close(); }

{ const p = await halaman(b);
  await loginPendaki(p, ADMIN.u, ADMIN.p);
  const exp = 'Akun ini adalah akun petugas. Silakan masuk lewat menu Petugas.';
  const m = await tungguTeks(p, [exp, 'Dashboard Monitor']);
  catat('A5', m === exp, m === exp ? `Muncul pesan “${m}”` : m ? 'Pesan tidak muncul; langsung masuk ke dashboard petugas (Dashboard Monitor)' : 'Tidak muncul pesan');
  await p.context().close(); }

{ const p = await halaman(b);
  await loginPetugas(p, ADMIN.u, ADMIN.p);
  const m = await tungguTeks(p, ['Dashboard Monitor']);
  catat('A6', !!m, m ? 'Masuk ke dashboard petugas (“Dashboard Monitor”)' : `Tetap di ${p.url()}`);
  await p.context().close(); }

{ const p = await halaman(b);
  await loginPetugas(p, 'lubna', PASSWORD);
  const exp = 'Akun ini tidak punya akses petugas.';
  const m = await tungguTeks(p, [exp, 'Registrasi SIMAKSI']);
  catat('A7', m === exp, m === exp ? `Muncul pesan “${m}”` : m ? 'Pesan tidak muncul; langsung masuk ke dashboard pendaki' : 'Tidak muncul pesan');
  await p.context().close(); }

await b.close();
