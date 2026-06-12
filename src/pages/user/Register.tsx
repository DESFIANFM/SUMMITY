import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { saveRegistration } from '../../lib/db';
import { getSupabaseClient } from '../../lib/db';
import { 
  Mountain, 
  User, 
  ArrowRight, 
  Phone, 
  HeartHandshake, 
  ChevronLeft,
  AlertCircle,
  Sparkles,
  Lock,
  Mail,
  Scale,
  Ruler,
  Copy,
  Check,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Register() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  
  // Submit complete flags
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  // Redirect on load if already logged in
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  // Tabs / Stepper
  const [activeTab, setActiveTab] = useState<'account' | 'personal' | 'address'>('account');
  const [formData, setFormData] = useState({
    // Step 1: Account
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    emergencyPhone: '',
    
    // Step 2: Personal Identitas
    citizenship: 'WNI' as 'WNI' | 'WNA',
    identityType: 'KTP' as 'KTP' | 'Paspor' | 'KITAS',
    nik: '',
    name: '',
    gender: 'Laki-laki' as 'Laki-laki' | 'Perempuan',
    weight: '',
    height: '',

    // Step 3: Alamat
    province: '',
    city: '',
    district: '',
    subdistrict: '',
    address: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const validateRegisterStep = (tab: 'account' | 'personal' | 'address') => {
    const errors: Record<string, string> = {};

    if (tab === 'account') {
      if (!formData.username) errors.username = 'Username wajib diisi';
      else if (formData.username.length < 4) errors.username = 'Username minimal 4 karakter';
      
      if (!formData.email) errors.email = 'Email wajib diisi';
      else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'Format email tidak valid';
      
      if (!formData.password) errors.password = 'Password wajib diisi';
      else if (formData.password.length < 6) errors.password = 'Password minimal 6 karakter';
      
      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Konfirmasi password tidak cocok';
      }
      
      if (!formData.phone) errors.phone = 'Nomor telepon wajib diisi';
      if (!formData.emergencyPhone) errors.emergencyPhone = 'Nomor wali darurat wajib diisi';
    }

    if (tab === 'personal') {
      if (!formData.name) errors.name = 'Nama lengkap wajib diisi sesuai kartu identitas';
      if (!formData.nik) errors.nik = `${formData.identityType} wajib diisi`;
      else if (formData.identityType === 'KTP' && formData.nik.length !== 16) errors.nik = 'NIK harus tepat 16 digit';
      
      if (!formData.weight) errors.weight = 'Berat badan wajib diisi';
      if (!formData.height) errors.height = 'Tinggi badan wajib diisi';
    }

    if (tab === 'address') {
      if (!formData.province) errors.province = 'Provinsi wajib diisi';
      if (!formData.city) errors.city = 'Kota / Kabupaten wajib diisi';
      if (!formData.district) errors.district = 'Kecamatan wajib diisi';
      if (!formData.subdistrict) errors.subdistrict = 'Kelurahan / Desa wajib diisi';
      if (!formData.address) errors.address = 'Alamat jalan lengkap wajib diisi';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextTab = (current: 'account' | 'personal' | 'address', next: 'account' | 'personal' | 'address') => {
    if (validateRegisterStep(current)) {
      setActiveTab(next);
    }
  };

  const handleAccountRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    
    if (!validateRegisterStep(activeTab)) {
      return;
    }

    if (activeTab === 'account') {
      setActiveTab('personal');
      return;
    }
    if (activeTab === 'personal') {
      setActiveTab('address');
      return;
    }

    // Load list
    let usersList: any[] = [];
    try {
      const stored = localStorage.getItem('summity_users_list');
      if (stored) {
        usersList = JSON.parse(stored);
      }
    } catch(err) {}

    // Check duplicate username/email/nik
    const isUserExists = usersList.some(u => 
      u.username?.toLowerCase() === formData.username.toLowerCase() || 
      u.email?.toLowerCase() === formData.email.toLowerCase() ||
      (formData.nik && u.nik === formData.nik)
    );

    if (isUserExists) {
      setFormErrors({ address: 'Username, Email, atau NIK sudah terdaftar dalam sistem!' });
      return;
    }

    // Step 3 submission: create account
    const internalId = (typeof crypto !== 'undefined' && (crypto as any).randomUUID)
      ? (crypto as any).randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    // Find sequence suffix
    let maxSeq = 0;
    if (Array.isArray(usersList)) {
      for (const u of usersList) {
        const idVal = String(u.id_pendaki || u.idPendaki || u.displayId || '');
        if (idVal.startsWith(dateStr)) {
          const seqStr = idVal.substring(dateStr.length);
          const seq = parseInt(seqStr, 10);
          if (!isNaN(seq) && seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }
    }
    const nextSeq = maxSeq + 1;
    const seqStr = String(nextSeq).padStart(4, '0');
    const displayId = `${dateStr}${seqStr}`;

    const newClimberAccount = {
      id: internalId,
      displayId,
      idPendaki: displayId,
      id_pendaki: displayId,
      role: 'USER' as const,
      name: formData.name,
      email: formData.email,
      username: formData.username,
      password: formData.password,
      phone: formData.phone,
      emergencyPhone: formData.emergencyPhone,
      citizenship: formData.citizenship,
      identityType: formData.identityType,
      nik: formData.nik,
      gender: formData.gender,
      weight: formData.weight,
      height: formData.height,
      province: formData.province,
      city: formData.city,
      district: formData.district,
      subdistrict: formData.subdistrict,
      address: formData.address,
    };

    // Save user to memory list
    usersList.push(newClimberAccount);
    localStorage.setItem('summity_users_list', JSON.stringify(usersList));

    // Also persist the newly created user as the active stored identity
    try {
      localStorage.setItem('summity_user', JSON.stringify(newClimberAccount));
    } catch (e) {
      console.error('Failed to persist summity_user to localStorage', e);
    }

    // Log the user in
    login('USER', newClimberAccount);

    // Save user account to local IndexedDB and sync to Supabase `users` table
    (async () => {
      try {
        console.log('Saving account to IndexedDB and syncing to Supabase...');
        await saveRegistration({
          userId: internalId,
          name: formData.name,
          nik: formData.nik,
          phone: formData.phone,
          emergencyPhone: formData.emergencyPhone,
          birthDate: '1995-01-01',
          address: formData.address,
          gender: formData.gender,
          mountain: '',
          date: '',
          endDate: '',
          status: 'APPROVED',
          createdAt: new Date().toISOString(),
          ...(newClimberAccount as any),
        });
        console.log('Account saved and sync initiated!');
      } catch (err) {
        console.warn('Account sync failed (will retry when online):', err);
      }
    })();

    setSubmitted(true);
  };

  const handleCopyId = () => {
    const activeUser = (user || JSON.parse(localStorage.getItem('summity_user') || '{}')) as any;
    const idToCopy = activeUser.id_pendaki || activeUser.idPendaki || activeUser.displayId || 'USER-SUMMITY';
    navigator.clipboard.writeText(idToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2050);
  };

  const formatMaskedNIK = (nik: string) => {
    if (!nik) return '----------------';
    if (nik.length <= 6) return nik + '-'.repeat(16 - nik.length);
    const firstPart = nik.substring(0, 6);
    const lastPart = nik.substring(nik.length - 4);
    const maskedLength = Math.max(0, nik.length - 10);
    return `${firstPart}${'*'.repeat(maskedLength || 6)}${lastPart}`;
  };

  // SUCCESS PAGE: ACCOUNT CREATED
  if (submitted) {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const fallbackId = `${dateStr}0001`;
    const activeUser = (user || {
      id: `temp-${Math.random().toString(36).substr(2, 8)}`,
      displayId: fallbackId,
      idPendaki: fallbackId,
      id_pendaki: fallbackId,
      name: formData.name,
      email: formData.email,
      username: formData.username,
      phone: formData.phone,
      emergencyPhone: formData.emergencyPhone,
      nik: formData.nik,
      identityType: formData.identityType,
      citizenship: formData.citizenship,
      gender: formData.gender,
      weight: formData.weight,
      height: formData.height,
      province: formData.province,
      city: formData.city,
      district: formData.district,
      subdistrict: formData.subdistrict,
      address: formData.address,
    }) as any;

    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] text-center p-4 sm:p-6 relative">
        <div className="absolute inset-0 bg-radial from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
        
        <div className="w-16 h-16 bg-emerald-100/80 rounded-full flex items-center justify-center text-emerald-600 mb-6 border border-emerald-250 shadow-md animate-bounce">
          <ShieldCheck className="w-8 h-8" strokeWidth={2} />
        </div>

        <h2 className="text-2xl sm:text-3.5xl font-black text-slate-800 mb-3 italic uppercase tracking-tight">AKUN SELESAI DIGENERATE!</h2>
        
        <p className="text-[10px] sm:text-[11.5px] text-slate-500 font-black uppercase tracking-widest max-w-lg leading-relaxed mb-6">
          Selamat! Keanggotaan Anda di sistem registrasi pendakian Gunung Slamet telah terdaftar sebagai pendaki tersinkronisasi.
        </p>

        {/* ACCOUNT PASS CARD - ULTRA LUXURY STYLING */}
        <motion.div 
          initial={{ y: 25, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full max-w-sm bg-slate-900 text-white rounded-[2rem] p-5 sm:p-6 mb-8 border border-slate-700/60 shadow-2xl relative overflow-hidden"
        >
          {/* Hologram aesthetic strip */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-tr from-emerald-500/20 to-teal-400/[0.15] blur-2xl rounded-full pointer-events-none" />
          
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4 text-left">
            <div className="flex items-center gap-2.5">
              <div className="bg-gradient-to-tr from-emerald-400 to-emerald-600 p-1.5 rounded-xl text-white">
                <Mountain className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-[11px] font-black tracking-tight uppercase italic leading-none">SUMMITY SAFETY PASSPORT</h4>
                <p className="text-[7.5px] text-emerald-400 font-bold uppercase tracking-widest mt-1">SLAMET SINGLE-ENTRY SYNC</p>
              </div>
            </div>
            <span className="text-[8px] font-black bg-emerald-550 text-white border border-emerald-500/30 px-2 py-0.5 rounded-md leading-none">ACTIVE USER</span>
          </div>

          <div className="space-y-4 text-left">
            <div>
              <span className="block text-[7px] text-white/40 font-black tracking-widest">ID ANGGOTA PENDAKI</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-sm font-black tracking-widest text-amber-300 font-mono">
                  #{ (activeUser.id_pendaki || activeUser.idPendaki || activeUser.displayId || activeUser.id).toUpperCase() }
                </span>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
              </div>
            </div>

            {/* Personal Info Grid */}
            <div className="grid grid-cols-2 gap-3 text-[10px] leading-tight">
              <div>
                <span className="block text-[7px] text-white/40 font-black tracking-widest">Nama Lengkap</span>
                <span className="font-extrabold text-white text-[11px] leading-tight break-words tracking-tight">{activeUser.name}</span>
              </div>
              <div>
                <span className="block text-[7px] text-white/40 font-black tracking-widest">No. Identitas ({activeUser.identityType})</span>
                <span className="font-semibold text-white/90 font-mono text-[10px]">{activeUser.nik}</span>
              </div>
              <div>
                <span className="block text-[7px] text-white/40 font-black tracking-widest">Telepon</span>
                <span className="font-bold text-white/95 text-[9px]">{activeUser.phone || '-'}</span>
              </div>
              <div>
                <span className="block text-[7px] text-white/40 font-black tracking-widest">Kontak Darurat</span>
                <span className="font-bold text-white/95 text-[9px]">{activeUser.emergencyPhone || '-'}</span>
              </div>
              <div>
                <span className="block text-[7px] text-white/40 font-black tracking-widest">Berat / Tinggi</span>
                <span className="font-bold text-white/95">
                  {activeUser.weight ? `${activeUser.weight} KG` : '-'} / {activeUser.height ? `${activeUser.height} CM` : '-'}
                </span>
              </div>
              <div>
                <span className="block text-[7px] text-white/40 font-black tracking-widest">Keanggotaan</span>
                <span className="font-bold text-emerald-400 tracking-wider text-[8px] flex items-center gap-1">
                  🟢 PENDAKI AKTIF
                </span>
              </div>
            </div>

            {/* Alamat Domisili */}
            <div className="border-t border-white/5 pt-2.5">
              <span className="block text-[7px] text-white/40 font-black tracking-widest">Wilayah Asal KTP</span>
              <p className="text-[9px] font-bold text-white/90 leading-normal line-clamp-1 truncate">
                {activeUser.address ? `${activeUser.address}, ${activeUser.subdistrict || ''}, ${activeUser.district || ''}, ${activeUser.city || ''} (${activeUser.province || ''})` : '-'}
              </p>
            </div>

          </div>

          {/* Secure watermark seal */}
          <div className="border-t border-white/10 mt-5 pt-3.5 flex items-center justify-between text-[7px] font-bold tracking-widest text-emerald-400/90 uppercase">
            <span>MEMBERSHIP VALID ON ALL REGISTRATION CHECKPOINTS</span>
            <div className="flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
              <ShieldCheck className="w-3 h-3" /> SECURITY PASSED
            </div>
          </div>
        </motion.div>

        {/* --- ACTIONS BOARD --- */}
        <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full max-w-md">
          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopyId}
            className="w-full sm:w-auto flex-1 bg-white hover:bg-slate-50 text-slate-800 text-[10px] sm:text-xs font-black uppercase tracking-widest py-4 px-5 rounded-2xl border border-slate-200 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                ID Berhasil Disalin!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-500" />
                Salin ID Anggota
              </>
            )}
          </button>

          {/* Proceed Button */}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full sm:w-auto flex-[1.5] bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-2.5 active:scale-95 shadow-xl shadow-emerald-600/10"
          >
            Masuk ke Beranda Utama
            <ArrowRight className="w-4 h-4 text-emerald-300" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pt-10 sm:pt-16 pb-12 px-4 sm:px-6">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-slate-100">
        <div>
          <button 
            type="button"
            onClick={() => navigate('/')}
            className="group flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-colors mb-3"
          >
            <ChevronLeft className="w-4 h-4 text-emerald-500 group-hover:-translate-x-1 transition-transform" />
            Kembali ke Beranda
          </button>
          
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-emerald-500 to-teal-600 p-2.5 rounded-2xl text-white shadow-lg shadow-emerald-250">
              <Mountain className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-800 tracking-tight italic uppercase leading-none">
                REGISTRASI PENDAKI
              </h2>
              <p className="text-slate-400 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] mt-1.5 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                Slamet Climbing Safety System - Pendaftaran Akun
              </p>
            </div>
          </div>
        </div>
        
        <button 
          onClick={() => navigate('/login')}
          className="self-start md:self-auto text-[10px] font-black text-emerald-600 hover:text-emerald-700 uppercase tracking-widest px-5 py-3.5 bg-emerald-50 hover:bg-emerald-100 rounded-2xl border border-emerald-200 transition-all shadow-sm active:scale-95"
        >
          Sudah Punya Akun? Masuk
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: THE STEPPER BAR & FORM */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Steps indicator */}
          <div className="bg-white p-3 sm:p-4 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-100/50 flex items-center justify-between gap-1 overflow-x-auto scrollbar-none">
            
            {/* Tab 1 */}
            <button
              type="button"
              onClick={() => setActiveTab('account')}
              className="flex items-center gap-2 sm:gap-3 p-1 rounded-xl hover:bg-slate-50 transition-all shrink-0 group"
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black transition-all ${
                activeTab === 'account' 
                  ? 'bg-gradient-to-tr from-emerald-400 to-emerald-500 text-white shadow-lg' 
                  : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
              }`}>1</div>
              <div className="hidden sm:block text-left py-0.5">
                <span className={`block text-[7px] font-black uppercase tracking-widest ${activeTab === 'account' ? 'text-emerald-500' : 'text-slate-400'}`}>TAHAP 01</span>
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-800">Akun Login</span>
              </div>
            </button>

            <div className="flex-1 h-[2px] bg-slate-150 min-w-[12px] sm:flex-none sm:w-8 shrink-0"></div>

            {/* Tab 2 */}
            <button
              type="button"
              onClick={() => handleNextTab('account', 'personal')}
              className="flex items-center gap-2 sm:gap-3 p-1 rounded-xl hover:bg-slate-50 transition-all shrink-0 group"
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black transition-all ${
                activeTab === 'personal' 
                  ? 'bg-gradient-to-tr from-emerald-400 to-emerald-500 text-white shadow-lg' 
                  : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
              }`}>2</div>
              <div className="hidden sm:block text-left py-0.5">
                <span className={`block text-[7px] font-black uppercase tracking-widest ${activeTab === 'personal' ? 'text-emerald-500' : 'text-slate-400'}`}>TAHAP 02</span>
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-800">Data Diri</span>
              </div>
            </button>

            <div className="flex-1 h-[2px] bg-slate-150 min-w-[12px] sm:flex-none sm:w-8 shrink-0"></div>

            {/* Tab 3 */}
            <button
              type="button"
              onClick={() => {
                if (validateRegisterStep('account') && validateRegisterStep('personal')) {
                  setActiveTab('address');
                }
              }}
              className="flex items-center gap-2 sm:gap-3 p-1 rounded-xl hover:bg-slate-50 transition-all shrink-0 group"
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black transition-all ${
                activeTab === 'address' 
                  ? 'bg-gradient-to-tr from-emerald-400 to-emerald-500 text-white shadow-lg' 
                  : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
              }`}>3</div>
              <div className="hidden sm:block text-left py-0.5">
                <span className={`block text-[7px] font-black uppercase tracking-widest ${activeTab === 'address' ? 'text-emerald-500' : 'text-slate-400'}`}>TAHAP 03</span>
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-800">Alamat KTP</span>
              </div>
            </button>

          </div>

          {/* Form Container */}
          <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-100/60 p-6 sm:p-8 border border-slate-100 overflow-hidden relative">
            
            <form onSubmit={handleAccountRegisterSubmit} className="space-y-6">
              
              <AnimatePresence mode="wait">
                
                {/* ====== STEP 1: ACCOUNT & CONTACTS ====== */}
                {activeTab === 'account' && (
                  <motion.div
                    key="account-tab"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-5"
                  >
                    <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-4 bg-emerald-500 rounded-full"></div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Kredensial Akun & Kontak</h3>
                      </div>
                      <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border border-emerald-100/30">Step 1 dari 3</span>
                    </div>

                    {/* Username */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-emerald-500" />
                        Username Akun
                      </label>
                      <input 
                        type="text"
                        required
                        value={formData.username}
                        onChange={(e) => {
                          setFormData({...formData, username: e.target.value.toLowerCase().trim()});
                          if (formErrors.username) setFormErrors({...formErrors, username: ''});
                        }}
                        className={`w-full bg-slate-50 border ${formErrors.username ? 'border-rose-300 ring-2 ring-rose-500/10' : 'border-slate-100'} rounded-2xl py-4.5 px-5 text-slate-800 font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all text-xs`}
                        placeholder="Masukkan username untuk login pendaki"
                      />
                      {formErrors.username && (
                        <p className="text-[9px] text-rose-500 font-bold ml-1 flex items-center gap-1">
                          <AlertCircle className="w-3" /> {formErrors.username}
                        </p>
                      )}
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest ml-1">
                        * Digunakan bersama password Anda untuk login melihat Data Pribadi
                      </p>
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-emerald-500" />
                        Alamat Email Aktif
                      </label>
                      <input 
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => {
                          setFormData({...formData, email: e.target.value.trim()});
                          if (formErrors.email) setFormErrors({...formErrors, email: ''});
                        }}
                        className={`w-full bg-slate-50 border ${formErrors.email ? 'border-rose-300 ring-2 ring-rose-500/10' : 'border-slate-100'} rounded-2xl py-4.5 px-5 text-slate-800 font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all text-xs`}
                        placeholder="Contoh: pendaki@email.com"
                      />
                      {formErrors.email && (
                        <p className="text-[9px] text-rose-500 font-bold ml-1 flex items-center gap-1">
                          <AlertCircle className="w-3" /> {formErrors.email}
                        </p>
                      )}
                    </div>

                    {/* Passwords */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-emerald-500" />
                          Password Akun
                        </label>
                        <input 
                          type="password"
                          required
                          value={formData.password}
                          onChange={(e) => {
                            setFormData({...formData, password: e.target.value});
                            if (formErrors.password) setFormErrors({...formErrors, password: ''});
                          }}
                          className={`w-full bg-slate-50 border ${formErrors.password ? 'border-rose-300 ring-2 ring-rose-500/10' : 'border-slate-100'} rounded-2xl py-4.5 px-5 text-slate-800 font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all text-xs`}
                          placeholder="Maksimal aman, min 6 digit"
                        />
                        {formErrors.password && (
                          <p className="text-[9px] text-rose-500 font-bold ml-1 flex items-center gap-1">
                            <AlertCircle className="w-3" /> {formErrors.password}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-emerald-500" />
                          Ketik ulang Password
                        </label>
                        <input 
                          type="password"
                          required
                          value={formData.confirmPassword}
                          onChange={(e) => {
                            setFormData({...formData, confirmPassword: e.target.value});
                            if (formErrors.confirmPassword) setFormErrors({...formErrors, confirmPassword: ''});
                          }}
                          className={`w-full bg-slate-50 border ${formErrors.confirmPassword ? 'border-rose-300 ring-2 ring-rose-500/10' : 'border-slate-100'} rounded-2xl py-4.5 px-5 text-slate-800 font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all text-xs`}
                          placeholder="Ketik ulang sandi Anda"
                        />
                        {formErrors.confirmPassword && (
                          <p className="text-[9px] text-rose-500 font-bold ml-1 flex items-center gap-1">
                            <AlertCircle className="w-3" /> {formErrors.confirmPassword}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Contacts phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-emerald-500" />
                          No Telepon Pendaki
                        </label>
                        <input 
                          type="tel"
                          required
                          value={formData.phone}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setFormData({...formData, phone: val});
                            if (formErrors.phone) setFormErrors({...formErrors, phone: ''});
                          }}
                          className={`w-full bg-slate-50 border ${formErrors.phone ? 'border-rose-300 ring-2 ring-rose-500/10' : 'border-slate-100'} rounded-2xl py-4.5 px-5 text-slate-800 font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all text-xs`}
                          placeholder="Contoh: 08123456789"
                        />
                        {formErrors.phone && (
                          <p className="text-[9px] text-rose-500 font-bold ml-1 flex items-center gap-1">
                            <AlertCircle className="w-3" /> {formErrors.phone}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                          <HeartHandshake className="w-3.5 h-3.5 text-rose-500" />
                          No Telepon Darurat (Keluarga)
                        </label>
                        <input 
                          type="tel"
                          required
                          value={formData.emergencyPhone}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setFormData({...formData, emergencyPhone: val});
                            if (formErrors.emergencyPhone) setFormErrors({...formErrors, emergencyPhone: ''});
                          }}
                          className={`w-full bg-slate-50 border ${formErrors.emergencyPhone ? 'border-rose-300 ring-2 ring-rose-500/10' : 'border-slate-100'} rounded-2xl py-4.5 px-5 text-slate-800 font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all text-xs`}
                          placeholder="No telepon wali / keluarga"
                        />
                        {formErrors.emergencyPhone && (
                          <p className="text-[9px] text-rose-500 font-bold ml-1 flex items-center gap-1">
                            <AlertCircle className="w-3" /> {formErrors.emergencyPhone}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Navigation */}
                    <div className="pt-6 border-t border-slate-100 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleNextTab('account', 'personal')}
                        className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-black px-7 py-4 rounded-2xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl shadow-slate-200 text-center"
                      >
                        <span>Berikutnya: Data Diri</span>
                        <ArrowRight className="w-4 h-4 text-emerald-400" />
                      </button>
                    </div>

                  </motion.div>
                )}

                {/* ====== STEP 2: PROFILE & IDENTITY ====== */}
                {activeTab === 'personal' && (
                  <motion.div
                    key="personal-tab"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-5"
                  >
                    <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-4 bg-emerald-500 rounded-full"></div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Kewarganegaraan & Data Pribadi</h3>
                      </div>
                      <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border border-emerald-100/30">Step 2 dari 3</span>
                    </div>

                    {/* Nationality & Identity Type */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-bold">Kewarganegaraan</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setFormData({...formData, citizenship: 'WNI'})}
                            className={`p-3 rounded-xl border font-black text-xs transition-all ${
                              formData.citizenship === 'WNI' 
                                ? 'bg-emerald-50/50 border-emerald-300 text-emerald-800' 
                                : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'
                            }`}
                          >
                            🇮🇩 WNI
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData({...formData, citizenship: 'WNA'})}
                            className={`p-3 rounded-xl border font-black text-xs transition-all ${
                              formData.citizenship === 'WNA' 
                                ? 'bg-emerald-50/50 border-emerald-300 text-emerald-800' 
                                : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'
                            }`}
                          >
                            🌍 WNA
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-bold">Jenis Identitas</label>
                        <div className="grid grid-cols-3 gap-2">
                          {['KTP', 'Paspor', 'KITAS'].map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => {
                                setFormData({...formData, identityType: type as any, nik: ''});
                                if (formErrors.nik) setFormErrors({...formErrors, nik: ''});
                              }}
                              className={`p-3 rounded-xl border font-black text-[10px] sm:text-xs transition-all ${
                                formData.identityType === type 
                                  ? 'bg-emerald-50/50 border-emerald-300 text-emerald-800' 
                                  : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* NIK and Nama Lengkap */}
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-bold">
                          Nomor Kartu Identitas ({formData.identityType})
                        </label>
                        <input 
                          type="text"
                          required
                          value={formData.nik}
                          onChange={(e) => {
                            const val = formData.identityType === 'KTP' 
                              ? e.target.value.replace(/[^0-9]/g, '') 
                              : e.target.value.toUpperCase();
                            setFormData({...formData, nik: val});
                            if (formErrors.nik) setFormErrors({...formErrors, nik: ''});
                          }}
                          className={`w-full bg-slate-50 border ${formErrors.nik ? 'border-rose-300 ring-2 ring-rose-500/10' : 'border-slate-100'} rounded-2xl py-4 flex items-center font-mono font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all text-xs px-5`}
                          placeholder={`Masukkan nomor ${formData.identityType} Anda`}
                        />
                        {formErrors.nik && (
                          <p className="text-[9px] text-rose-500 font-bold ml-1 flex items-center gap-1">
                            <AlertCircle className="w-3" /> {formErrors.nik}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-bold">Nama Lengkap Sesuai Identitas</label>
                        <input 
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => {
                            setFormData({...formData, name: e.target.value});
                            if (formErrors.name) setFormErrors({...formErrors, name: ''});
                          }}
                          className={`w-full bg-slate-50 border ${formErrors.name ? 'border-rose-300 ring-2 ring-rose-500/10' : 'border-slate-100'} rounded-2xl py-4 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all text-xs font-bold px-5 uppercase`}
                          placeholder="Masukkan nama lengkap Anda"
                        />
                        {formErrors.name && (
                          <p className="text-[9px] text-rose-500 font-bold ml-1 flex items-center gap-1">
                            <AlertCircle className="w-3" /> {formErrors.name}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Gender, Weight, Height */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-bold">Jenis Kelamin</label>
                        <div className="grid grid-cols-2 gap-2">
                          {['Laki-laki', 'Perempuan'].map((g) => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => setFormData({...formData, gender: g as any})}
                              className={`py-3 px-1.5 rounded-xl border font-black text-[10px] sm:text-xs transition-all ${
                                formData.gender === g 
                                  ? 'bg-emerald-50/50 border-emerald-300 text-emerald-800' 
                                  : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              {g === 'Laki-laki' ? '🙋‍♂️ Pria' : '🙋‍♀️ Wanita'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-bold">Berat Badan (KG)</label>
                        <input 
                          type="number"
                          required
                          value={formData.weight}
                          onChange={(e) => {
                            setFormData({...formData, weight: e.target.value});
                            if (formErrors.weight) setFormErrors({...formErrors, weight: ''});
                          }}
                          placeholder="Contoh: 65"
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-xs font-bold text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                        />
                        {formErrors.weight && (
                          <p className="text-[9px] text-rose-500 font-bold ml-1">{formErrors.weight}</p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-bold">Tinggi Badan (CM)</label>
                        <input 
                          type="number"
                          required
                          value={formData.height}
                          onChange={(e) => {
                            setFormData({...formData, height: e.target.value});
                            if (formErrors.height) setFormErrors({...formErrors, height: ''});
                          }}
                          placeholder="Contoh: 170"
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-xs font-bold text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                        />
                        {formErrors.height && (
                          <p className="text-[9px] text-rose-500 font-bold ml-1">{formErrors.height}</p>
                        )}
                      </div>

                    </div>

                    {/* Navigation */}
                    <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveTab('account')}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-black px-5 py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all"
                      >
                        Kembali
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNextTab('personal', 'address')}
                        className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-black px-7 py-4 rounded-2xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl shadow-slate-200 text-center"
                      >
                        <span>Berikutnya: Alamat Lengkap</span>
                        <ArrowRight className="w-4 h-4 text-emerald-400" />
                      </button>
                    </div>

                  </motion.div>
                )}

                {/* ====== STEP 3: ADDRESS ====== */}
                {activeTab === 'address' && (
                  <motion.div
                    key="address-tab"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-4"
                  >
                    <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-4 bg-emerald-500 rounded-full"></div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Alamat Lengkap KTP</h3>
                      </div>
                      <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border border-emerald-100/30">Step 3 dari 3</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-bold">Provinsi</label>
                        <input 
                          type="text"
                          required
                          value={formData.province}
                          onChange={(e) => setFormData({...formData, province: e.target.value})}
                          placeholder="Jawa Tengah"
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-xs font-bold text-slate-800 focus:outline-none focus:bg-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-bold">Kota / Kabupaten</label>
                        <input 
                          type="text"
                          required
                          value={formData.city}
                          onChange={(e) => setFormData({...formData, city: e.target.value})}
                          placeholder="Purbalingga"
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-xs font-bold text-slate-800 focus:outline-none focus:bg-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-bold">Kecamatan</label>
                        <input 
                          type="text"
                          required
                          value={formData.district}
                          onChange={(e) => setFormData({...formData, district: e.target.value})}
                          placeholder="Kertanegara"
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-xs font-bold text-slate-800 focus:outline-none focus:bg-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-bold">Kelurahan / Desa</label>
                        <input 
                          type="text"
                          required
                          value={formData.subdistrict}
                          onChange={(e) => setFormData({...formData, subdistrict: e.target.value})}
                          placeholder="Kasih"
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-xs font-bold text-slate-800 focus:outline-none focus:bg-white"
                        />
                      </div>

                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-bold">Alamat Rumah Lengkap (Jalan, RT/RW, No. Rumah)</label>
                      <textarea 
                        required
                        value={formData.address}
                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                        rows={2}
                        placeholder="Contoh: Jl. Bambangan Raya No 14 RT 02 RW 09"
                        className="w-full bg-slate-50 border border-slate-100 rounded-3xl p-4 text-xs font-semibold text-slate-800 focus:outline-none focus:bg-white"
                      />
                    </div>

                    {formErrors.address && (
                      <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-semibold">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                        <span>{formErrors.address}</span>
                      </div>
                    )}

                    {/* Navigation */}
                    <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveTab('personal')}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-black px-5 py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all"
                      >
                        Kembali
                      </button>
                      <button
                        type="submit"
                        className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 py-4.5 rounded-2xl text-[11px] uppercase tracking-[0.15em] flex items-center justify-center gap-2.5 transition-all shadow-xl shadow-emerald-600/10"
                      >
                        Daftar & Konfirmasi Akun
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>

                  </motion.div>
                )}

              </AnimatePresence>

            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: BENEFITS AND GUIDELINES */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Card 1 - High Fidelity Account Features */}
          <div className="bg-slate-900 text-white rounded-[2rem] p-6 shadow-2xl relative overflow-hidden text-left">
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 to-transparent pointer-events-none" />
            <h4 className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.2em] mb-4 flex items-center gap-1.5 leading-none">
              <ShieldCheck className="w-5 h-5 shrink-0" strokeWidth={2} /> 
              SYSTEM ACCOUNT SECURE
            </h4>
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 leading-none mb-1">Benefit Single-Entry ID</p>
            <h3 className="text-xl font-black italic tracking-tight uppercase leading-snug mb-3">Keuntungan Memiliki Akun Pendaki</h3>
            <p className="text-xs text-slate-300 leading-relaxed font-semibold">
              Dengan membuat akun, Anda dapat masuk kapan saja untuk mendaftarkan rencana naik, melihat barcode e-ticket checkout, melacak cuaca, serta tidak perlu mengetik detail identitas berulang-ulang di masa depan.
            </p>
          </div>

          {/* Card 2 - Physical standards */}
          <div className="bg-white rounded-[2rem] border border-slate-100 p-5 shadow-lg shadow-slate-100/50 space-y-4 text-left">
            <div>
              <span className="text-[7.5px] font-black text-teal-600 uppercase tracking-widest bg-teal-50 px-2 py-0.5 border border-teal-100/50 rounded-md">MEDICAL STANDARD</span>
              <h4 className="text-xs font-black uppercase tracking-tight text-slate-800 mt-2">Standar Kebugaran Fisik</h4>
              <p className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider leading-relaxed mt-0.5">Semua data fisik wajib diisi valid sesuai kondisi Anda untuk referensi tim SAR jika terjadi darurat.</p>
            </div>

            <div className="space-y-3.5 pt-1.5">
              <div className="flex gap-3">
                <div className="w-7 h-7 bg-amber-50 text-amber-600 border border-amber-100 font-mono text-[9px] font-black rounded-lg flex items-center justify-center shrink-0">
                  <Scale className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h6 className="text-[10px] font-black text-slate-800 uppercase tracking-wide">Berat Badan Ideal</h6>
                  <p className="text-[9px] text-slate-400 font-bold leading-normal uppercase tracking-wider">Menentukan rasio beban tas carrier (mak. 1/3 berat tubuh).</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-7 h-7 bg-amber-50 text-amber-600 border border-amber-100 font-mono text-[9px] font-black rounded-lg flex items-center justify-center shrink-0">
                  <Ruler className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h6 className="text-[10px] font-black text-slate-800 uppercase tracking-wide">Tinggi Badan</h6>
                  <p className="text-[9px] text-slate-400 font-bold leading-normal uppercase tracking-wider">Mempengaruhi ketahanan langkah di medan terjal Gunung Slamet.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3 - Instruction Warning banner */}
          <div className="bg-amber-50 border border-amber-100 rounded-3xl p-5 text-amber-900 flex gap-3 text-xs leading-relaxed font-semibold shadow-sm text-left">
            <span className="text-xl">💡</span>
            <div>
              <strong className="block text-amber-950 mb-0.5">Informasi Sistem Akun Pribadi:</strong>
              Pendaftaran akun ini menyimpan profile fisik, tinggi badan, kartu identitas, dan alamat KTP Anda secara aman. Saat Anda log in, data ini otomatis di-load tanpa perlu mengetik ulang form identifikasi di kemudian hari.
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
