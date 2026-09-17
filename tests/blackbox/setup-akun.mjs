import { createClient } from '@supabase/supabase-js';
import { AKUN, PASSWORD, emailOf } from './akun.mjs';

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: ada } = await admin.from('users').select('username, nik');
const usernameAda = new Set(ada.map(r => (r.username || '').toLowerCase()));
const nikAda = new Set(ada.map(r => r.nik).filter(Boolean));

let seq = 1;
const nikBaru = () => { let n; do { n = `3302170926${String(seq++).padStart(6, '0')}`; } while (nikAda.has(n)); nikAda.add(n); return n; };

for (const [i, a] of AKUN.entries()) {
  if (usernameAda.has(a.username)) { console.log(`  = ${a.username} sudah ada, dilewati`); continue; }

  const { data: au, error: ae } = await admin.auth.admin.createUser({
    email: emailOf(a.username), password: PASSWORD, email_confirm: true,
    user_metadata: { username: a.username, akun_uji: true },
  });
  if (ae) { console.log(`  ✗ ${a.username} auth: ${ae.message}`); continue; }

  const { error: pe } = await admin.from('users').insert({
    id: au.user.id, username: a.username, name: a.name, email: emailOf(a.username), role: 'USER',
    phone: `+62812${String(3000000 + i).padStart(7, '0')}`, emergency_phone: `+62813${String(3000000 + i).padStart(7, '0')}`,
    citizenship: 'WNI', identity_type: 'KTP', nik: nikBaru(), gender: a.gender,
    weight: '60', height: '165', province: 'JAWA TENGAH', city: 'KABUPATEN PURBALINGGA',
    district: 'KARANGREJA', subdistrict: 'KUTABAWA', address: 'Jl. Bambangan No. ' + (i + 1),
  });
  if (pe) { console.log(`  ✗ ${a.username} profil: ${pe.message}`); await admin.auth.admin.deleteUser(au.user.id); continue; }
  console.log(`  ✓ ${a.username}`);
}

const { data: hasil } = await admin.from('users').select('username, name, id_pendaki').in('username', AKUN.map(a => a.username)).order('username');
console.log(`\n${hasil.length} akun uji siap:`);
hasil.forEach(r => console.log(`  ${r.username.padEnd(9)} ${r.name.padEnd(9)} ${r.id_pendaki}`));
