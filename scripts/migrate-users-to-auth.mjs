/**
 * Migrasi user lama (tabel `users`, password plaintext) ke Supabase Auth.
 *
 * PENDEKATAN: akun Auth dibuat dengan `id` yang DIPAKSA sama dengan
 * public.users.id yang sudah ada. Dengan begitu tidak ada id yang perlu
 * diubah, sehingga seluruh foreign key (simaksi.ketua_user_id,
 * simaksi_anggota.user_id, tracking_history.user_id, tickets.user_id)
 * tetap utuh tanpa perlu ON UPDATE CASCADE.
 *
 * Kalau instans GoTrue menolak `id` yang ditentukan, script BERHENTI dan
 * melaporkannya — tidak diam-diam beralih ke penimpaan id, karena jalur
 * itu bisa gagal di tengah dan meninggalkan data tidak sinkron.
 *
 * Baris tanpa `username` dilewati secara default: baris seperti itu tidak
 * bisa login lewat UI (login butuh username), jadi akun Auth untuknya hanya
 * jadi sampah. Baris tersebut tetap terlihat petugas lewat policy is_admin().
 * Pakai --include-all kalau tetap ingin memigrasi semuanya.
 *
 * BUTUH service_role key — jangan pernah menaruhnya di file VITE_* atau
 * di kode frontend. Rotate setelah selesai.
 *
 * Cara pakai:
 *   set -a; . ./.env.secrets; set +a
 *   node scripts/migrate-users-to-auth.mjs --dry-run
 *   node scripts/migrate-users-to-auth.mjs
 */

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const INCLUDE_ALL = process.argv.includes('--include-all');

if (!URL || !KEY) {
  console.error('✗ SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib di-set.');
  process.exit(1);
}

const db = createClient(URL, KEY, { auth: { persistSession: false } });

// Dipakai kalau baris lama tidak punya password yang layak. User tersebut
// harus memakai "lupa password" untuk bisa masuk.
const placeholderPassword = () => `Smy-${crypto.randomUUID()}`;

async function main() {
  const { data: rows, error } = await db
    .from('users')
    .select('id, email, username, name, password, role, id_pendaki')
    .order('created_at');

  if (error) {
    console.error('✗ Gagal membaca tabel users:', error.message);
    process.exit(1);
  }

  console.log(`Ditemukan ${rows.length} baris di public.users.`);
  console.log(DRY_RUN
    ? '── DRY RUN: tidak ada perubahan yang ditulis ──\n'
    : '── MODE NYATA: akun Auth akan dibuat ──\n');

  const summary = { migrated: 0, skipped: 0, failed: 0, needsReset: 0 };
  const needResetList = [];

  for (const row of rows) {
    const label = `${row.name || '(tanpa nama)'} <${row.email || 'tanpa email'}>`;

    if (!row.email) {
      console.warn(`  ⊘ Lewati — tanpa email: ${label}`);
      summary.skipped++;
      continue;
    }

    if (!row.username && !INCLUDE_ALL) {
      console.log(`  ⊘ Lewati — tanpa username (tidak bisa login): ${label}`);
      summary.skipped++;
      continue;
    }

    // Idempotensi: lewati kalau id itu sudah punya akun Auth.
    const { data: existing } = await db.auth.admin.getUserById(row.id);
    if (existing?.user) {
      console.log(`  = Sudah ada di Auth: ${label}`);
      summary.skipped++;
      continue;
    }

    let password = row.password;
    let needsReset = false;
    if (!password || String(password).length < 6) {
      password = placeholderPassword();
      needsReset = true;
    }

    if (DRY_RUN) {
      console.log(`  → Akan dibuat: ${label}  id=${row.id}${needsReset ? '  [perlu reset password]' : ''}`);
      summary.migrated++;
      if (needsReset) { summary.needsReset++; needResetList.push(row.email); }
      continue;
    }

    const { data: created, error: createErr } = await db.auth.admin.createUser({
      id: row.id,              // <-- kunci: id Auth = id profil yang sudah ada
      email: row.email,
      password,
      email_confirm: true,     // user lama dianggap sudah terverifikasi
      user_metadata: { username: row.username, migrated: true },
    });

    if (createErr || !created?.user) {
      console.error(`  ✗ Gagal: ${label} — ${createErr?.message}`);
      summary.failed++;
      continue;
    }

    // Pengaman keras: kalau GoTrue mengabaikan `id` yang kita tentukan,
    // seluruh policy berbasis auth.uid() akan salah. Berhenti total.
    if (created.user.id !== row.id) {
      console.error(
        `\n✗ BERHENTI: instans ini mengabaikan id yang ditentukan.\n` +
        `    diminta : ${row.id}\n` +
        `    dibuat  : ${created.user.id}\n` +
        `  Akun Auth di atas sudah terbuat dan perlu dihapus manual di\n` +
        `  dashboard (Authentication → Users) sebelum mencoba lagi.\n` +
        `  Jalur alternatifnya adalah menyamakan id lewat UPDATE, tapi itu\n` +
        `  butuh ON UPDATE CASCADE di semua foreign key ke users.id.\n`
      );
      process.exit(1);
    }

    console.log(`  ✓ Dimigrasi: ${label}${needsReset ? '  [perlu reset password]' : ''}`);
    summary.migrated++;
    if (needsReset) { summary.needsReset++; needResetList.push(row.email); }
  }

  console.log('\n── Ringkasan ──');
  console.log(`  Dimigrasi        : ${summary.migrated}`);
  console.log(`  Dilewati         : ${summary.skipped}`);
  console.log(`  Gagal            : ${summary.failed}`);
  console.log(`  Perlu reset pass : ${summary.needsReset}`);
  if (needResetList.length) {
    console.log('\n  Email yang harus pakai "lupa password":');
    needResetList.forEach(e => console.log(`    - ${e}`));
  }
  if (DRY_RUN) console.log('\n(DRY RUN — jalankan tanpa --dry-run untuk benar-benar memigrasi)');
}

main().catch(err => {
  console.error('✗ Error tak terduga:', err);
  process.exit(1);
});
