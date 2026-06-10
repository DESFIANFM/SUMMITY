import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { saveRegistration, getAllRegistrations } from '../../lib/db';
import { 
  Mountain, 
  Calendar, 
  User, 
  ArrowRight, 
  CheckCircle2, 
  ArrowRightLeft, 
  Phone, 
  HeartHandshake, 
  Fingerprint, 
  Compass, 
  ChevronLeft,
  AlertCircle,
  Sparkles,
  Shield,
  Ticket,
  MapPin,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function RegisterHike() {
  const { user, login, updateUser } = useAuth();
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [activeTab, setActiveTab] = useState<'personal' | 'contact' | 'schedule'>('personal');
  
  const [formData, setFormData] = useState({
    mountain: 'Gn. Slamet',
    date: '',
    endDate: '',
    name: user?.name || '',
    nik: '',
    phone: '',
    emergencyPhone: '',
    birthDate: '',
    gender: 'Laki-laki' as 'Laki-laki' | 'Perempuan',
    address: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const checkExisting = async () => {
      if (user) {
        const regs = await getAllRegistrations();
        const active = regs.find(r => r.userId === user.id && (r.status === 'APPROVED' || r.status === 'PENDING'));
        if (active) {
          navigate('/');
        }
      }
      setCheckingStatus(false);
    };
    checkExisting();
  }, [user, navigate]);

  if (checkingStatus) return null;

  const validateStep = (tab: 'personal' | 'contact' | 'schedule') => {
    const errors: Record<string, string> = {};
    if (tab === 'personal') {
      if (!formData.name) errors.name = 'Nama lengkap wajib diisi sesuai KTP';
      if (!formData.nik) {
        errors.nik = 'NIK KTP wajib diisi';
      } else if (formData.nik.length < 16) {
        errors.nik = 'NIK harus berisi tepat 16 digit angka';
      }
      if (!formData.birthDate) errors.birthDate = 'Tanggal lahir wajib diisi';
    } else if (tab === 'contact') {
      if (!formData.phone) {
        errors.phone = 'Nomor telepon wajib diisi';
      } else if (!/^[0-9]{9,15}$/.test(formData.phone)) {
        errors.phone = 'Nomor telepon tidak valid (9-15 digit)';
      }
      if (!formData.emergencyPhone) {
        errors.emergencyPhone = 'Nomor kontak darurat wajib diisi';
      } else if (formData.phone === formData.emergencyPhone) {
        errors.emergencyPhone = 'Nomor kontak darurat tidak boleh sama dengan nomor utama';
      }
    } else if (tab === 'schedule') {
      if (!formData.date) errors.date = 'Tanggal naik wajib diisi';
      if (!formData.endDate) {
        errors.endDate = 'Tanggal turun wajib diisi';
      } else if (new Date(formData.date) > new Date(formData.endDate)) {
        errors.endDate = 'Tanggal turun tidak boleh lebih awal dari tanggal naik';
      }
      if (!formData.address) errors.address = 'Alamat KTP wajib diisi';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextTab = (current: 'personal' | 'contact', target: 'contact' | 'schedule') => {
    if (validateStep(current)) {
      setActiveTab(target);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep('personal') || !validateStep('contact') || !validateStep('schedule')) {
      return;
    }

    const userId = user?.id || `USER-${Math.random().toString(36).substr(2, 6)}`;

    await saveRegistration({
      userId: userId,
      name: formData.name,
      nik: formData.nik,
      phone: formData.phone,
      emergencyPhone: formData.emergencyPhone,
      birthDate: formData.birthDate,
      gender: formData.gender,
      address: formData.address,
      mountain: formData.mountain,
      date: formData.date,
      endDate: formData.endDate,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    });

    if (user) {
      updateUser({ name: formData.name });
    } else {
      login('USER', { id: userId, name: formData.name });
    }

    setSubmitted(true);
    setTimeout(() => {
      navigate('/');
    }, 3000);
  };

  // Human readable dates helper
  const formatDateString = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Formatted NIK with privacy mask
  const formatMaskedNIK = (nik: string) => {
    if (!nik) return '----------------';
    if (nik.length <= 6) return nik + '-'.repeat(16 - nik.length);
    const firstPart = nik.substring(0, 6);
    const lastPart = nik.substring(nik.length - 4);
    const maskedLength = Math.max(0, nik.length - 10);
    return `${firstPart}${'*'.repeat(maskedLength || 6)}${lastPart}`;
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh] text-center p-6 relative">
        <div className="absolute inset-0 bg-radial from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="bg-gradient-to-tr from-emerald-500/20 to-teal-500/5 p-10 rounded-[2.5rem] border border-emerald-500/20 mb-8 relative shadow-2xl shadow-emerald-500/10"
        >
          <div className="absolute inset-0.5 rounded-[2.4rem] bg-white pointer-events-none" />
          <CheckCircle2 className="w-20 h-20 text-emerald-500 animate-pulse relative z-10 mx-auto" />
        </motion.div>
        <h2 className="text-3xl font-black text-slate-800 mb-2 italic uppercase tracking-tight">Pendaftaran Berhasil!</h2>
        <p className="text-slate-500 mb-8 max-w-sm text-xs font-bold uppercase tracking-wider leading-relaxed">
          Permohonan SIMAKSI Anda sedang diproses oleh petugas. Mohon tunggu status tiket disetujui.
        </p>
        <div className="flex items-center gap-3 text-emerald-600 font-extrabold text-[10px] tracking-widest uppercase bg-emerald-50 px-6 py-3 rounded-2xl border border-emerald-100/50 shadow-sm animate-pulse">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-400"></span>
          Mengalihkan ke Dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pt-10 sm:pt-16 md:pt-20 pb-12 px-4 sm:px-6">
      
      {/* Header with back options */}
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
            <div className="bg-gradient-to-tr from-emerald-500 to-teal-600 p-2.5 rounded-2xl text-white shadow-lg shadow-emerald-200">
              <Mountain className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-800 tracking-tight italic uppercase leading-none">
                SIMAKSI REGISTRASI
              </h2>
              <p className="text-slate-400 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] mt-1.5 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                Slamet Climbing Tracking System & Pelunasan
              </p>
            </div>
          </div>
        </div>
        
        <button 
          onClick={() => navigate('/login')}
          className="self-start md:self-auto text-[10px] font-black text-slate-600 uppercase tracking-widest px-5 py-3.5 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200 hover:border-slate-350 transition-all shadow-sm active:scale-95"
        >
          Masuk Akun Petugas / Admin
        </button>
      </div>

      {/* Grid Layout: Left is Form, Right is Real-Time Digital Ticket Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: THE STEPPER & MULTI-STEP FORM */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Progress step bar - beautifully modern */}
          <div className="bg-white p-4.5 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-100/50 flex items-center justify-between gap-2 overflow-x-auto">
            {/* Step 1 */}
            <button
              type="button"
              onClick={() => setActiveTab('personal')}
              className="flex items-center gap-3 p-1 rounded-xl hover:bg-slate-50 transition-all shrink-0 group"
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black transition-all ${
                activeTab === 'personal' 
                  ? 'bg-gradient-to-tr from-emerald-400 to-emerald-500 text-white shadow-lg shadow-emerald-200 scale-105' 
                  : 'bg-slate-100 text-slate-550 group-hover:bg-slate-200'
              }`}>1</div>
              <div className="text-left py-0.5">
                <span className={`block text-[8px] font-black uppercase tracking-widest ${activeTab === 'personal' ? 'text-emerald-500' : 'text-slate-400'}`}>TAHAP 01</span>
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-800">Profil Diri</span>
              </div>
            </button>

            <div className="w-4 h-[2px] bg-slate-100 shrink-0"></div>

            {/* Step 2 */}
            <button
              type="button"
              onClick={() => handleNextTab('personal', 'contact')}
              className="flex items-center gap-3 p-1 rounded-xl hover:bg-slate-50 transition-all shrink-0 group"
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black transition-all ${
                activeTab === 'contact' 
                  ? 'bg-gradient-to-tr from-emerald-400 to-emerald-500 text-white shadow-lg shadow-emerald-200 scale-105' 
                  : 'bg-slate-100 text-slate-550 group-hover:bg-slate-200'
              }`}>2</div>
              <div className="text-left py-0.5">
                <span className={`block text-[8px] font-black uppercase tracking-widest ${activeTab === 'contact' ? 'text-emerald-500' : 'text-slate-400'}`}>TAHAP 02</span>
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-800">Kontak</span>
              </div>
            </button>

            <div className="w-4 h-[2px] bg-slate-100 shrink-0"></div>

            {/* Step 3 */}
            <button
              type="button"
              onClick={() => {
                if (validateStep('personal') && validateStep('contact')) {
                  setActiveTab('schedule');
                }
              }}
              className="flex items-center gap-3 p-1 rounded-xl hover:bg-slate-50 transition-all shrink-0 group"
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black transition-all ${
                activeTab === 'schedule' 
                  ? 'bg-gradient-to-tr from-emerald-400 to-emerald-500 text-white shadow-lg shadow-emerald-200 scale-105' 
                  : 'bg-slate-100 text-slate-550 group-hover:bg-slate-200'
              }`}>3</div>
              <div className="text-left py-0.5">
                <span className={`block text-[8px] font-black uppercase tracking-widest ${activeTab === 'schedule' ? 'text-emerald-500' : 'text-slate-400'}`}>TAHAP 03</span>
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-800">Rencana</span>
              </div>
            </button>
          </div>

          {/* Form Container */}
          <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-100/60 p-6 sm:p-8 border border-slate-100 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-[0.02] pointer-events-none select-none">
              <Mountain className="w-64 h-64 text-emerald-500" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
              
              {/* TAB 1: PERSONAL INFORMATION */}
              <AnimatePresence mode="wait">
                {activeTab === 'personal' && (
                  <motion.div 
                    key="personal-tab"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-5"
                  >
                    <div className="border-b border-slate-100 pb-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2 h-4.5 bg-emerald-500 rounded-full"></div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">IDENTITAS DIRI (IDENTIFICATION)</h3>
                      </div>
                      <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border border-emerald-100/30">Langkah 1 dari 3</span>
                    </div>

                    {/* Full Name */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-emerald-500" />
                        Nama Lengkap Sesuai KTP / Paspor
                      </label>
                      <input 
                        type="text" 
                        required
                        value={formData.name}
                        onChange={(e) => {
                          setFormData({...formData, name: e.target.value});
                          if (formErrors.name) setFormErrors({...formErrors, name: ''});
                        }}
                        className={`w-full bg-slate-50 border ${formErrors.name ? 'border-rose-300 ring-2 ring-rose-550/10' : 'border-slate-100'} rounded-2xl py-4.5 px-5 text-slate-800 font-extrabold focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all text-sm`}
                        placeholder="Contoh: ADITYA RAHMAN"
                      />
                      {formErrors.name && (
                        <p className="text-[9px] text-rose-500 font-bold ml-1.5 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {formErrors.name}
                        </p>
                      )}
                    </div>

                    {/* NIK & Birthdate */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      
                      {/* NIK Field */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                          <Fingerprint className="w-3.5 h-3.5 text-emerald-500" />
                          NIK (Nomor Induk Kependudukan)
                        </label>
                        <input 
                          type="text" 
                          required
                          maxLength={16}
                          value={formData.nik}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setFormData({...formData, nik: val});
                            if (formErrors.nik) setFormErrors({...formErrors, nik: ''});
                          }}
                          className={`w-full bg-slate-50 border ${formErrors.nik ? 'border-rose-300 ring-2 ring-rose-550/10' : 'border-slate-100'} rounded-2xl py-4.5 px-5 text-slate-800 font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all text-sm tracking-wider`}
                          placeholder="NIK KTP 16 digit"
                        />
                        {formErrors.nik ? (
                          <p className="text-[9px] text-rose-500 font-bold ml-1.5 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {formErrors.nik}
                          </p>
                        ) : (
                          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest ml-1.5 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5 text-slate-350" /> NIK Anda dienkripsi demi keamanan
                          </p>
                        )}
                      </div>

                      {/* Birth Date */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                          Tanggal Lahir
                        </label>
                        <input 
                          type="date" 
                          required
                          value={formData.birthDate || ''}
                          max={new Date().toISOString().split('T')[0]}
                          onChange={(e) => {
                            setFormData({...formData, birthDate: e.target.value});
                            if (formErrors.birthDate) setFormErrors({...formErrors, birthDate: ''});
                          }}
                          className={`w-full bg-slate-50 border ${formErrors.birthDate ? 'border-rose-300 ring-2 ring-rose-550/10' : 'border-slate-100'} rounded-2xl py-4.5 px-5 text-slate-800 font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all text-sm`}
                        />
                        {formErrors.birthDate && (
                          <p className="text-[9px] text-rose-500 font-bold ml-1.5 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {formErrors.birthDate}
                          </p>
                        )}
                      </div>

                    </div>

                    {/* Gender Selection */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Jenis Kelamin</label>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setFormData({...formData, gender: 'Laki-laki'})}
                          className={`p-4 rounded-2xl border flex items-center justify-center gap-3 transition-all ${
                            formData.gender === 'Laki-laki' 
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-850 font-black shadow-lg shadow-emerald-500/5' 
                              : 'bg-slate-50 border-slate-100 text-slate-500 font-bold hover:bg-slate-100'
                          }`}
                        >
                          <span className="text-2xl filter drop-shadow">👦</span>
                          <span className="text-xs uppercase tracking-widest font-black">Laki-laki</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({...formData, gender: 'Perempuan'})}
                          className={`p-4 rounded-2xl border flex items-center justify-center gap-3 transition-all ${
                            formData.gender === 'Perempuan' 
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-850 font-black shadow-lg shadow-emerald-500/5' 
                              : 'bg-slate-50 border-slate-100 text-slate-500 font-bold hover:bg-slate-100'
                          }`}
                        >
                          <span className="text-2xl filter drop-shadow">👧</span>
                          <span className="text-xs uppercase tracking-widest font-black">Perempuan</span>
                        </button>
                      </div>
                    </div>

                    {/* Navigation Buttons */}
                    <div className="pt-6 border-t border-slate-50 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleNextTab('personal', 'contact')}
                        className="bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-black px-7 py-4 rounded-2xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl shadow-slate-200"
                      >
                        Berikutnya: Info Kontak
                        <ArrowRight className="w-4 h-4 text-emerald-400" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* TAB 2: CONTACT & EMERGENCY */}
                {activeTab === 'contact' && (
                  <motion.div 
                    key="contact-tab"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-5"
                  >
                    <div className="border-b border-slate-100 pb-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2 h-4.5 bg-emerald-500 rounded-full"></div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">KONTAK & KOORDINASI MEDIS (CONTACTS)</h3>
                      </div>
                      <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border border-emerald-100/30">Langkah 2 dari 3</span>
                    </div>

                    {/* WhatsApp Phone */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-emerald-500" />
                        Nomor Handphone Pendaki (Aktif WhatsApp)
                      </label>
                      <div className="relative">
                        <input 
                          type="tel" 
                          required
                          value={formData.phone}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setFormData({...formData, phone: val});
                            if (formErrors.phone) setFormErrors({...formErrors, phone: ''});
                          }}
                          className={`w-full bg-slate-50 border ${formErrors.phone ? 'border-rose-300 ring-2 ring-rose-550/10' : 'border-slate-100'} rounded-2xl py-4.5 px-5 text-slate-805 font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all text-sm`}
                          placeholder="Masukkan nomor HP utama (misal: 08123456789)"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 rounded-md border border-emerald-100/30">WHATSAPP</div>
                      </div>
                      {formErrors.phone ? (
                        <p className="text-[9px] text-rose-500 font-bold ml-1.5 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {formErrors.phone}
                        </p>
                      ) : (
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest ml-1.5">* Tim pertolongan pertama (SAR/Basecamp) akan menggunakan nomor ini untuk mengirimkan update tracking</p>
                      )}
                    </div>

                    {/* Emergency Contact */}
                    <div className="space-y-2 bg-gradient-to-tr from-rose-50/20 to-rose-100/10 border border-rose-100/60 rounded-[2rem] p-5 sm:p-6 mt-2">
                      <label className="text-[11px] font-black text-rose-700 uppercase tracking-widest flex items-center gap-2 mb-1.5">
                        <HeartHandshake className="w-4.5 h-4.5 text-rose-500 shrink-0" />
                        Kontak Darurat Keluarga Terdekat
                      </label>
                      
                      <div className="space-y-3">
                        <div className="relative">
                          <input 
                            type="tel" 
                            required
                            value={formData.emergencyPhone}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              setFormData({...formData, emergencyPhone: val});
                              if (formErrors.emergencyPhone) setFormErrors({...formErrors, emergencyPhone: ''});
                            }}
                            className={`w-full bg-white border ${formErrors.emergencyPhone ? 'border-rose-300 ring-2 ring-rose-550/10' : 'border-slate-200'} rounded-xl py-4.5 px-5 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/15 focus:border-rose-450 transition-all text-sm`}
                            placeholder="Nomor HP Orangtua / Saudara / Pasangan"
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] font-black text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-md">SIAGA DARURAT</div>
                        </div>
                        {formErrors.emergencyPhone && (
                          <p className="text-[9px] text-rose-500 font-bold ml-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {formErrors.emergencyPhone}
                          </p>
                        )}
                        <p className="text-[8.5px] text-rose-700/70 font-bold tracking-wide leading-relaxed">
                          * Sesuai Ketentuan Keamanan Nasional SIMAKSI, petugas berhak membatalkan pendaftaran jika kontak darurat tidak dapat dihubungi atau diisi dengan nomor tiruan.
                        </p>
                      </div>
                    </div>

                    {/* Navigation Buttons */}
                    <div className="pt-6 border-t border-slate-50 flex items-center justify-between gap-4">
                      <button
                        type="button"
                        onClick={() => setActiveTab('personal')}
                        className="bg-slate-100 hover:bg-slate-250 active:scale-95 text-slate-700 font-black px-6 py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all border border-slate-200/50"
                      >
                        Kembali
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNextTab('contact', 'schedule')}
                        className="bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-black px-7 py-4 rounded-2xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl shadow-slate-200"
                      >
                        Berikutnya: Rencana
                        <ArrowRight className="w-4 h-4 text-emerald-400" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* TAB 3: SCHEDULE & TARGET */}
                {activeTab === 'schedule' && (
                  <motion.div 
                    key="schedule-tab"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-5"
                  >
                    <div className="border-b border-slate-100 pb-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2 h-4.5 bg-emerald-500 rounded-full"></div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">RENCANA & DESTINASI PENDAKIAN (SCHEDULE)</h3>
                      </div>
                      <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border border-emerald-100/30">Langkah 3 dari 3</span>
                    </div>

                    {/* Mountain lock notification */}
                    <div className="bg-emerald-50/50 border border-emerald-100/70 p-4.5 rounded-[2rem] space-y-2">
                      <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-2">
                        <Compass className="w-4 h-4 text-emerald-500" />
                        Tujuan Gunung & Pos Lapangan
                      </label>
                      <div className="relative">
                        <Mountain className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-emerald-600" />
                        <input 
                          type="text"
                          readOnly
                          value="Gunung Slamet via Bambangan (3.428 mdpl)"
                          className="w-full bg-white border border-emerald-200 rounded-xl py-3.5 pl-12 pr-4 text-emerald-850 font-black cursor-not-allowed text-xs focus:outline-none"
                        />
                      </div>
                      <p className="text-[8.5px] text-emerald-700/80 font-bold italic leading-relaxed ml-1">
                        * Skripsi tracker ini berfokus eksklusif pada sensor pos pemancar tracking di Gunung Slamet Pos 1 - 9 Bambangan sebagai subjek penelitian.
                      </p>
                    </div>

                    {/* Check-in Card Datepicker */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                        Jadwal Mendaki & Rencana Turun Kembali
                      </label>
                      
                      <div className="bg-slate-50 border border-slate-100/80 p-3 rounded-2xl flex flex-col sm:flex-row items-center gap-3">
                        <div className="w-full">
                          <span className="block text-[8px] text-slate-400 font-extrabold uppercase tracking-widest mb-1 ml-1">TANGGAL NAIK</span>
                          <input 
                            type="date" 
                            required
                            min={new Date().toISOString().split('T')[0]}
                            value={formData.date}
                            onChange={(e) => {
                              setFormData({...formData, date: e.target.value});
                              if (formErrors.date) setFormErrors({...formErrors, date: ''});
                            }}
                            className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-slate-800 font-bold focus:outline-none focus:border-emerald-400 text-xs"
                          />
                        </div>

                        <div className="text-slate-300 shrink-0">
                          <ArrowRightLeft className="w-4 h-4 hidden sm:block rotate-0" />
                          <div className="h-[1px] w-full bg-slate-100 sm:hidden py-1"></div>
                        </div>

                        <div className="w-full">
                          <span className="block text-[8px] text-slate-400 font-extrabold uppercase tracking-widest mb-1 ml-1">TANGGAL TURUN</span>
                          <input 
                            type="date" 
                            required
                            min={formData.date || new Date().toISOString().split('T')[0]}
                            value={formData.endDate}
                            onChange={(e) => {
                              setFormData({...formData, endDate: e.target.value});
                              if (formErrors.endDate) setFormErrors({...formErrors, endDate: ''});
                            }}
                            className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-slate-800 font-bold focus:outline-none focus:border-emerald-400 text-xs"
                          />
                        </div>
                      </div>
                      
                      {formErrors.date && (
                        <p className="text-[9px] text-rose-500 font-bold ml-1.5 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {formErrors.date}
                        </p>
                      )}
                      {formErrors.endDate && (
                        <p className="text-[9px] text-rose-500 font-bold ml-1.5 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {formErrors.endDate}
                        </p>
                      )}
                    </div>

                    {/* Address Domisili */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                        Alamat Domisili KTP Sesuai Surat SIMAKSI
                      </label>
                      <textarea 
                        required
                        rows={3}
                        value={formData.address}
                        onChange={(e) => {
                          setFormData({...formData, address: e.target.value});
                          if (formErrors.address) setFormErrors({...formErrors, address: ''});
                        }}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-slate-800 font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all text-sm leading-relaxed"
                        placeholder="Tuliskan alamat lengkap RT/RW, Kelurahan, Kecamatan, Kota & Provinsi asal"
                      />
                      {formErrors.address && (
                        <p className="text-[9px] text-rose-500 font-bold ml-1.5 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {formErrors.address}
                        </p>
                      )}
                    </div>

                    {/* Navigation Buttons */}
                    <div className="pt-6 border-t border-slate-105 flex items-center justify-between gap-4">
                      <button
                        type="button"
                        onClick={() => setActiveTab('contact')}
                        className="bg-slate-105 hover:bg-slate-200 active:scale-95 text-slate-700 font-black px-6 py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all"
                      >
                        Kembali
                      </button>
                      <button
                        type="submit"
                        className="bg-slate-900 hover:bg-black active:scale-[0.97] text-white font-black px-8 py-4 rounded-2xl text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-2.5 transition-all shadow-xl shadow-emerald-500/10"
                      >
                        Kirim SIMAKSI
                        <ArrowRight className="w-4 h-4 text-emerald-400" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: THE DIGITAL TICKET SIMAKSI PREVIEW CARD */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
          
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4 text-emerald-500" />
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Digital Boarding Pass Preview</h4>
          </div>

          {/* Real-time Dynamic Pass Design */}
          <div className="relative overflow-hidden bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl p-6 text-white min-h-[360px] flex flex-col justify-between group">
            
            {/* Ambient visual background flow */}
            <div className="absolute inset-0 bg-radial-gradient from-emerald-500/10 via-slate-905 to-slate-950 pointer-events-none z-0" />
            
            {/* Top glass reflection overlay */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/5 to-transparent pointer-events-none z-0 rounded-t-[2.5rem]" />
            
            <div className="relative z-10 space-y-6 pb-4">
              {/* Header pass */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-emerald-500/15 p-2 rounded-xl border border-emerald-500/30">
                    <Mountain className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h5 className="text-[11px] font-black uppercase tracking-widest leading-none">SUMMITY PASS</h5>
                    <span className="text-[7.5px] text-slate-400 font-extrabold uppercase tracking-widest">Gn. Slamet 3.428 mdpl</span>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <span className="text-[7.5px] text-slate-500 font-black uppercase tracking-widest leading-none">STATUS</span>
                  <span className="text-[9px] font-black text-amber-450 uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md mt-1 italic animate-pulse">PENDING REVIEW</span>
                </div>
              </div>

              {/* Mountains stylized wireframe grid */}
              <div className="h-16 relative flex items-end justify-center overflow-hidden border-b border-white/[0.06] pb-1">
                <div className="absolute bottom-0 w-full h-8 bg-gradient-to-t from-slate-900 to-transparent z-15 pointer-events-none" />
                
                {/* Visual mountain line artwork */}
                <svg className="w-full h-14 text-emerald-500/15" viewBox="0 0 100 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M0,30 L20,10 L35,22 L55,5 L75,21 L100,5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                  <path d="M0,30 L15,18 L30,26 L50,12 L70,24 L85,15 L100,28" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 2" />
                </svg>

                <div className="absolute top-0 right-1/4 w-1.5 h-1.5 rounded-full bg-emerald-400 blur-[1px] animate-ping" />
              </div>

              {/* Passenger Metadata details */}
              <div className="space-y-4 text-xs font-mono">
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[7.5px] text-slate-400 font-sans font-black uppercase tracking-widest">NAMA PENDAKI</span>
                    <span className="block text-[11px] font-sans font-black uppercase truncate tracking-wider text-slate-100 min-h-[16px]">
                      {formData.name || 'BELUM DIISI'}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[7.5px] text-slate-400 font-sans font-black uppercase tracking-widest">REGISTRASI ID</span>
                    <span className="block text-[11px] font-sans font-black text-emerald-400 tracking-widest">
                      {user ? `#${user.id.toUpperCase()}` : '#PENDING'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[7.5px] text-slate-400 font-sans font-black uppercase tracking-widest">NIK KTP</span>
                    <span className="block text-[10px] text-slate-300 font-extrabold min-h-[14px]">
                      {formatMaskedNIK(formData.nik)}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[7.5px] text-slate-400 font-sans font-black uppercase tracking-widest">GENDER</span>
                    <span className="block text-[10px] text-slate-300 font-sans font-black uppercase">
                      {formData.gender}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-white/[0.06] pt-3.5">
                  <div>
                    <span className="block text-[7.5px] text-emerald-400 font-sans font-black uppercase tracking-widest flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-emerald-400"></span> Tanggal Naik
                    </span>
                    <span className="block text-[10px] text-slate-200 font-bold min-h-[14px]">
                      {formatDateString(formData.date) || '----'}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[7.5px] text-rose-400 font-sans font-black uppercase tracking-widest flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-rose-400"></span> Rencana Turun
                    </span>
                    <span className="block text-[10px] text-slate-200 font-bold min-h-[14px]">
                      {formatDateString(formData.endDate) || '----'}
                    </span>
                  </div>
                </div>

              </div>

            </div>

            {/* Bottom Barcode section of Boarding Pass */}
            <div className="border-t-2 border-dashed border-slate-800 pt-4 mt-2 flex items-center justify-between relative">
              
              {/* Left ticket punch notch */}
              <div className="absolute -left-10 w-8 h-8 rounded-full bg-slate-50 border border-slate-100/10 z-20" />
              {/* Right ticket punch notch */}
              <div className="absolute -right-10 w-8 h-8 rounded-full bg-slate-50 border border-slate-100/10 z-20" />

              <div className="space-y-1">
                <span className="block text-[7px] text-slate-500 font-black uppercase tracking-widest">SISTEM VALIDASI JALUR</span>
                <span className="block text-[9px] text-emerald-500/90 font-black tracking-widest">BAMBANGAN MULTI-SECURE V3</span>
              </div>

              {/* Simulated barcode */}
              <div className="flex flex-col items-end shrink-0 gap-0.5 opacity-80">
                <div className="flex gap-[1px] h-7 items-center bg-white px-1.5 py-1 rounded">
                  <div className="w-[1.5px] h-full bg-slate-900"></div>
                  <div className="w-[1px] h-full bg-slate-900"></div>
                  <div className="w-[3px] h-full bg-slate-900"></div>
                  <div className="w-[0.5px] h-full bg-slate-900"></div>
                  <div className="w-[1.5px] h-full bg-slate-900"></div>
                  <div className="w-[2px] h-full bg-slate-900"></div>
                  <div className="w-[0.5px] h-full bg-slate-900"></div>
                  <div className="w-[1px] h-full bg-slate-900"></div>
                  <div className="w-[3px] h-full bg-slate-900"></div>
                  <div className="w-[1.5px] h-full bg-slate-900"></div>
                </div>
                <span className="text-[6.5px] text-slate-450 font-mono scale-90 tracking-widest">#{user?.id ? user.id.toUpperCase() : 'PENDING'}</span>
              </div>

            </div>

          </div>

          <div className="bg-amber-50/70 border border-amber-100 rounded-[1.5rem] p-4 flex gap-3 shadow-sm text-[10.5px] text-amber-800 leading-relaxed font-semibold">
            <span className="text-lg shrink-0">⚠️</span>
            <p>
              <strong>Pastikan Nama Sesuai Identitas Asli:</strong> Data yang diajukan akan divalidasi manual oleh petugas basecamp saat check-in fisik di Bambangan sebelum penyerahan gelang pelacak.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
