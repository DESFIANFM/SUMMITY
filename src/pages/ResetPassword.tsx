import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mountain, Lock, AlertTriangle, Check } from 'lucide-react';
import { updatePassword } from '../lib/auth';
import { getSupabaseClient } from '../lib/db';

/**
 * Halaman tujuan tautan "lupa password" dari email.
 *
 * Supabase mengirim tautan berisi token recovery di fragment URL.
 * supabase-js membacanya otomatis (detectSessionInUrl) lalu memicu event
 * PASSWORD_RECOVERY dan membuka sesi sementara — sesi itulah yang membuat
 * updateUser({ password }) diizinkan.
 *
 * Halaman ini sengaja berada DI LUAR ProtectedRoute dan di luar pengalihan
 * "sudah login → ke beranda", karena saat dibuka penggunanya memang sudah
 * punya sesi recovery.
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) { setError('Aplikasi berjalan tanpa koneksi server.'); return; }

    // Sesi recovery bisa sudah terpasang sebelum komponen ini mount,
    // jadi periksa keduanya: sesi yang ada DAN event yang menyusul.
    supabase.auth.getSession().then(({ data }: any) => {
      if (data.session) setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event: string, session: any) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true);
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) { setError('Password minimal 6 karakter.'); return; }
    if (password !== confirm) { setError('Konfirmasi password tidak cocok.'); return; }

    setSubmitting(true);
    try {
      const { error: err } = await updatePassword(password);
      if (err) { setError(err); return; }
      setDone(true);
      // Beri jeda agar pesan sukses sempat terbaca.
      setTimeout(() => navigate('/login'), 2500);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-6 text-white overflow-hidden bg-slate-900">
      <div className="relative z-10 mb-10 text-center">
        <div className="bg-white p-4 rounded-3xl inline-block mb-4 shadow-2xl">
          <Mountain className="w-12 h-12 text-emerald-800" />
        </div>
        <h1 className="text-4xl font-black tracking-tighter mb-2 italic">SUMMITY</h1>
        <p className="text-emerald-100/60 uppercase tracking-[0.4em] text-[10px] font-bold">Atur Ulang Password</p>
      </div>

      <div className="relative z-10 w-full max-w-sm bg-slate-800/60 backdrop-blur border border-white/10 rounded-[32px] p-8 space-y-5">
        {done ? (
          <div className="text-center space-y-3 py-4">
            <div className="w-14 h-14 bg-emerald-500/15 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto">
              <Check className="w-7 h-7" />
            </div>
            <h3 className="font-black italic uppercase tracking-tight">Password Diperbarui</h3>
            <p className="text-[11px] font-bold text-slate-400">Mengalihkan ke halaman login…</p>
          </div>
        ) : !ready ? (
          <div className="text-center space-y-3 py-6">
            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
              {error || 'Memeriksa tautan reset…'}
            </p>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Halaman ini hanya bisa dipakai lewat tautan yang dikirim ke email Anda.
              Kalau tautannya kedaluwarsa, minta ulang dari halaman login.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="text-[10px] font-black uppercase tracking-wider text-emerald-400 hover:underline"
            >
              Kembali ke Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center mb-2">
              <h3 className="text-lg font-black italic uppercase tracking-tight leading-none">Password Baru</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">
                Minimal 6 karakter
              </p>
            </div>

            <input
              type="password"
              placeholder="Password baru"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="w-full bg-slate-950/60 border border-white/10 rounded-2xl p-4 text-white text-sm font-bold placeholder-slate-600 outline-none focus:border-emerald-500/60 transition-all"
            />
            <input
              type="password"
              placeholder="Ulangi password baru"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full bg-slate-950/60 border border-white/10 rounded-2xl p-4 text-white text-sm font-bold placeholder-slate-600 outline-none focus:border-emerald-500/60 transition-all"
            />

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3 flex items-start gap-2 text-rose-400 text-[10px] font-bold">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all"
            >
              {submitting ? 'Menyimpan…' : 'Simpan Password Baru'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
