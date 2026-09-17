import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, existsSync } from 'fs';

export const BASE = process.env.BB_BASE || 'https://www.summity.id';
const HASIL = new URL('./hasil.json', import.meta.url).pathname;

export async function browser() {
  return chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
}

/** Konteks baru = sesi bersih (tanpa login, tanpa service worker lama). */
export async function halaman(b) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  p.setDefaultTimeout(15000);
  return p;
}

/** Catat hasil aktual satu skenario. */
export function catat(id, valid, aktual) {
  const all = existsSync(HASIL) ? JSON.parse(readFileSync(HASIL, 'utf8')) : {};
  all[id] = { status: valid ? 'Valid' : 'Tidak Valid', aktual };
  writeFileSync(HASIL, JSON.stringify(all, null, 2));
  console.log(`  ${valid ? '✅' : '❌'} ${id}  ${aktual}`);
}

export const bersih = (s) => (s || '').replace(/\s+/g, ' ').trim();

/** Teks yang terlihat di halaman, untuk mencari pesan. */
export async function teks(p) { return bersih(await p.locator('body').innerText()); }

export async function loginPendaki(p, username, password) {
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: /MASUK PENDAKI/i }).click();
  await p.getByPlaceholder('Username', { exact: true }).fill(username);
  await p.getByPlaceholder('Password', { exact: true }).fill(password);
  await p.getByRole('button', { name: /^Masuk$/ }).click();
}

export async function loginPetugas(p, username, password) {
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: /Panel Petugas/i }).click();
  await p.getByPlaceholder('Username / email petugas').fill(username);
  await p.getByPlaceholder('••••••••').fill(password);
  await p.getByRole('button', { name: /^Konfirmasi$/ }).click();
}

/** Tunggu salah satu teks muncul; kembalikan yang ditemukan atau null. */
export async function tungguTeks(p, daftar, ms = 12000) {
  const akhir = Date.now() + ms;
  while (Date.now() < akhir) {
    // innerText mengikuti CSS text-transform, jadi bandingkan tanpa peka huruf.
    const t = (await teks(p)).toLowerCase();
    for (const d of daftar) if (t.includes(d.toLowerCase())) return d;
    await p.waitForTimeout(300);
  }
  return null;
}
