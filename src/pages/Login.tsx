import React, { useState } from 'react';
const APP_VERSION = '1.0.0';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSupabaseClient } from '../lib/db';
import { Mountain, User, ShieldCheck, Lock, ChevronLeft, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [showUserLogin, setShowUserLogin] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleLogin = (role: 'USER' | 'ADMIN', customData?: any) => {
    login(role, customData);
    navigate('/');
  };

  // Get users from localStorage, initialize with default if empty
  const getRegisteredUsers = () => {
    const listStr = localStorage.getItem('summity_users_list');
    if (listStr) {
      try {
        return JSON.parse(listStr);
      } catch (e) {
        console.error(e);
      }
    }
    
    // Default account
    const defaultUser = {
      id: 'user-default',
      name: 'Aditya Rahman',
      email: 'pendaki@summity.com',
      role: 'USER',
      citizenship: 'WNI',
      identityType: 'KTP',
      nik: '1234567890123456',
      phone: '081234567890',
      emergencyPhone: '081298765432',
      gender: 'Laki-laki',
      weight: '65',
      height: '170',
      province: 'Jawa Tengah',
      city: 'Banyumas',
      district: 'Baturraden',
      subdistrict: 'Karangmangu',
      address: 'Jl. Raya Baturraden No. 12',
      username: 'pendaki',
      password: 'password'
    };
    
    localStorage.setItem('summity_users_list', JSON.stringify([defaultUser]));
    return [defaultUser];
  };

  const handleUserVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    try {
      // Try to lookup user in Supabase users table first (if online)
      const supabase = getSupabaseClient();

      if (supabase) {
        console.log('[LOGIN] 🔍 Querying Supabase users table...');
        
        const { data: users, error } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .eq('password', password);

        if (!error && users && users.length > 0) {
          console.log('[LOGIN] ✅ User found in Supabase:', users[0].id);
          const supabaseUser = users[0];
          
          // Map snake_case from DB to camelCase for frontend
          const now = new Date();
          const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
          const displayId = supabaseUser.id_pendaki || `${dateStr}0001`;
          const userData = {
            id: supabaseUser.id,
            displayId,
            idPendaki: displayId,
            id_pendaki: displayId,
            name: supabaseUser.name,
            email: supabaseUser.email,
            username: supabaseUser.username,
            password: supabaseUser.password,
            phone: supabaseUser.phone,
            emergencyPhone: supabaseUser.emergency_phone,
            citizenship: supabaseUser.citizenship,
            identityType: supabaseUser.identity_type,
            nik: supabaseUser.nik,
            gender: supabaseUser.gender,
            weight: supabaseUser.weight,
            height: supabaseUser.height,
            province: supabaseUser.province,
            city: supabaseUser.city,
            district: supabaseUser.district,
            subdistrict: supabaseUser.subdistrict,
            address: supabaseUser.address,
            role: supabaseUser.role || 'USER',
          };

          setLoginError('');
          handleLogin('USER', userData);
          return;
        } else if (error) {
          console.warn('[LOGIN] ⚠️ Supabase query error:', error);
        }
      }

      // Fallback: check localStorage if Supabase is unavailable or user not found
      console.log('[LOGIN] 📦 Falling back to localStorage lookup...');
      const users = getRegisteredUsers();
      const matchedUser = users.find(
        (u: any) => u.username?.toLowerCase() === username.toLowerCase() && u.password === password
      );

      if (matchedUser) {
        setLoginError('');
        handleLogin('USER', matchedUser);
      } else {
        setLoginError('Username atau Password pendaki salah!');
      }
    } catch (err) {
      console.warn('[LOGIN] ⚠️ Login error:', err);
      // Fallback: check localStorage
      const users = getRegisteredUsers();
      const matchedUser = users.find(
        (u: any) => u.username?.toLowerCase() === username.toLowerCase() && u.password === password
      );

      if (matchedUser) {
        setLoginError('');
        handleLogin('USER', matchedUser);
      } else {
        setLoginError('Username atau Password pendaki salah!');
      }
    }
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
          referrerPolicy="no-referrer"
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
          {!showAdminPassword && !showUserLogin ? (
            <motion.div
              key="role-selection"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <button
                onClick={() => setShowUserLogin(true)}
                className="w-full bg-white text-emerald-900 p-6 rounded-3xl font-black flex items-center justify-between group hover:bg-emerald-50 transition-all shadow-2xl active:scale-[0.98]"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-emerald-100 p-3 rounded-2xl group-hover:bg-white transition-colors">
                    <User className="w-6 h-6 text-emerald-700" />
                  </div>
                  <div className="text-left">
                    <div className="text-xl leading-none mb-1">MASUK PENDAKI</div>
                    <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Gunakan akun terdaftar Anda</div>
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
                    <div className="text-xl leading-none mb-1">DAFTAR PENDAKI</div>
                    <div className="text-[10px] text-emerald-100 font-bold uppercase tracking-wider">Registrasi akun pendaki baru</div>
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
          ) : showUserLogin ? (
            <motion.div
              key="user-login"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-6 rounded-[2.5rem] shadow-2xl space-y-6 animate-in zoom-in-95 duration-200"
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setShowUserLogin(false);
                    setLoginError('');
                    setUsername('');
                    setPassword('');
                  }}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-emerald-300" />
                </button>
                <span className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.2em] italic">Masuk Pendaki</span>
                <div className="w-9 h-9"></div>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <User className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black italic uppercase tracking-tight text-white leading-none">
                  Akses Data Pribadi
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">
                  Gunakan username & password terdaftar
                </p>
              </div>

              <form onSubmit={handleUserVerify} className="space-y-4 text-slate-800">
                <div className="space-y-3">
                  <input
                    type="text"
                    required
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="password"
                    required
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {loginError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3 flex items-start gap-2 text-rose-450 text-[10px] font-bold text-rose-300">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-450" />
                    <span>{loginError}</span>
                  </div>
                )}

                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 text-center text-white">
                  <span className="text-[7px] font-black uppercase opacity-60 block tracking-widest leading-none mb-1">AKUN PERCOBAAN DEFAULT</span>
                  <div className="text-[10px] font-mono select-all">
                    Username: <span className="text-emerald-450 font-black">pendaki</span> | Pass: <span className="text-emerald-450 font-black">password</span>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserLogin(false);
                      setLoginError('');
                      setUsername('');
                      setPassword('');
                    }}
                    className="col-span-2 py-3 bg-white/5 hover:bg-white/10 active:scale-95 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="col-span-3 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all"
                  >
                    Masuk
                  </button>
                </div>
              </form>

              <div className="text-center">
                <span className="text-[10px] text-slate-400 font-bold block">
                  Belum punya akun?{' '}
                  <button 
                    onClick={() => navigate('/register')}
                    className="text-emerald-400 hover:underline font-black uppercase"
                  >
                    Daftar Sekarang
                  </button>
                </span>
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
                <span className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.2em] italic">Otentikasi Petugas</span>
                <div className="w-9 h-9"></div>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black italic uppercase tracking-tight text-white leading-none">
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
                    className="w-full bg-slate-950/60 border border-white/10 rounded-2xl p-4 text-center tracking-[0.5em] text-white text-base font-bold placeholder-slate-600 outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10 transition-all-custom"
                    autoFocus
                  />
                </div>

                {passwordError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3 flex items-start gap-2 text-rose-400 text-[10px] font-bold">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3.5 text-center">
                  <span className="text-[8px] font-black uppercase opacity-40 block tracking-widest leading-none mb-1">PASSWORD PENGUJIAN</span>
                  <span className="text-xs font-mono font-black text-emerald-400 tracking-wider">admin123</span>
                </div>

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

      <div className="relative z-10 mt-16 flex flex-col items-center gap-1">
        <p className="text-[9px] uppercase tracking-[0.4em] font-black opacity-20">V{APP_VERSION}</p>
        <p className="text-[10px] uppercase tracking-[0.5em] font-black opacity-30">© 2026 Summity Project</p>
      </div>
    </div>
  );
}
