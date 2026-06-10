import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mountain, User, ShieldCheck, Lock, ChevronLeft, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleLogin = (role: 'USER' | 'ADMIN') => {
    login(role);
    navigate('/');
  };

  const handleAdminVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'admin123') {
      setPasswordError('');
      handleLogin('ADMIN');
    } else {
      setPasswordError('Password petugas salah. Silakan coba lagi!');
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-6 text-white overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/background desktop.png" 
          alt="Mountain Background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" />
      </div>

      <div className="relative z-10 mb-12 text-center">
        <div className="bg-white p-4 rounded-3xl inline-block mb-4 shadow-2xl">
          <Mountain className="w-12 h-12 text-emerald-800" />
        </div>
        <h1 className="text-5xl font-black tracking-tighter mb-2 italic">SUMMITY</h1>
        <p className="text-emerald-100/60 uppercase tracking-[0.4em] text-[10px] font-bold">Mountain Safety System</p>
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <AnimatePresence mode="wait">
          {!showAdminPassword ? (
            <motion.div
              key="role-selection"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <button
                onClick={() => handleLogin('USER')}
                className="w-full bg-white text-emerald-900 p-6 rounded-3xl font-black flex items-center justify-between group hover:bg-emerald-50 transition-all shadow-2xl active:scale-[0.98]"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-emerald-100 p-3 rounded-2xl group-hover:bg-white transition-colors">
                    <User className="w-6 h-6 text-emerald-700" />
                  </div>
                  <div className="text-left">
                    <div className="text-xl leading-none mb-1">MASUK</div>
                    <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Sudah punya tiket/SIMAKSI</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => navigate('/register')}
                className="w-full bg-emerald-600 text-white p-6 rounded-3xl font-black flex items-center justify-between group hover:bg-emerald-500 transition-all shadow-2xl active:scale-[0.98] border border-emerald-400"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-white/20 p-3 rounded-2xl">
                    <Mountain className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="text-xl leading-none mb-1">DAFTAR SIMAKSI</div>
                    <div className="text-[10px] text-emerald-100 font-bold uppercase tracking-wider">Registrasi pendaki baru</div>
                  </div>
                </div>
              </button>

              <div className="pt-4">
                <button
                  onClick={() => setShowAdminPassword(true)}
                  className="w-full bg-slate-900/40 backdrop-blur-md border border-white/10 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-3 group hover:bg-slate-900 transition-all opacity-60 hover:opacity-100"
                >
                  <ShieldCheck className="w-5 h-5 text-emerald-300" />
                  <span className="text-sm">Panel Petugas</span>
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="admin-password"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-6 rounded-[2.5rem] shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setShowAdminPassword(false);
                    setPasswordError('');
                    setAdminPassword('');
                  }}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-emerald-300" />
                </button>
                <span className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.2em]">Otentikasi Petugas</span>
                <div className="w-9 h-9"></div>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black italic uppercase italic tracking-tight text-white leading-none">
                  Verifikasi Staf
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">
                  Masukkan password untuk mengakses admin
                </p>
              </div>

              <form onSubmit={handleAdminVerify} className="space-y-4">
                <div className="relative">
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-2xl p-4 text-center tracking-[0.5em] text-white text-base font-bold placeholder-slate-600 outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                    autoFocus
                  />
                </div>

                {passwordError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3 flex items-start gap-2 text-rose-400 text-[10px] font-bold">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                <div className="grid grid-cols-5 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdminPassword(false);
                      setPasswordError('');
                      setAdminPassword('');
                    }}
                    className="col-span-2 py-3 bg-white/5 hover:bg-white/10 active:scale-95 text-white/80 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="col-span-3 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-950/30 transition-all"
                  >
                    Konfirmasi
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="relative z-10 mt-16 text-[10px] uppercase tracking-[0.5em] font-black opacity-30">
        © 2026 Summity Project
      </p>
    </div>
  );
}
