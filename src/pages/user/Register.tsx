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
  Phone, 
  HeartHandshake, 
  Compass, 
  ChevronLeft,
  AlertCircle,
  Sparkles,
  Ticket,
  MapPin,
  Lock,
  Globe,
  FileText,
  Mail,
  Scale,
  Ruler,
  Info,
  QrCode,
  Copy,
  Check,
  ShieldCheck,
  Plus,
  Trash2,
  Users,
  CheckSquare,
  Square
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Register() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  
  // Submit complete flags
  const [submitted, setSubmitted] = useState(false);
  const [climbSubmitted, setClimbSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  // States for leader, members and gear checklist
  const [isLeader, setIsLeader] = useState(false);
  const [memberIdInput, setMemberIdInput] = useState('');
  const [memberList, setMemberList] = useState<{ id: string; name: string }[]>([]);
  const [memberError, setMemberError] = useState('');

  const [checkedGears, setCheckedGears] = useState<Record<string, boolean>>({
    tenda: false,
    kompor: false,
    nesting: false,
    p3k: false,
    trash_bag: false,
    sleeping_bag: false,
    matras: false,
    jaket: false,
    jas_hujan: false,
    air: false,
    senter: false,
  });

  const MANDATORY_ITEMS = [
    { id: 'tenda', label: 'Tenda Dome (min. 1 tenda kapasitas sesuai anggota)', category: 'Kelompok' },
    { id: 'kompor', label: 'Kompor Portable & Gas Cadangan', category: 'Kelompok' },
    { id: 'nesting', label: 'Peralatan Memasak / Nesting', category: 'Kelompok' },
    { id: 'p3k', label: 'Kotak P3K & Obat Darurat Kelompok', category: 'Kelompok' },
    { id: 'trash_bag', label: 'Kantong Sampah / Trash Bag (Wajib bawa turun kembali)', category: 'Kelompok' },
    { id: 'sleeping_bag', label: 'Sleeping Bag (1 buah per pendaki)', category: 'Pribadi' },
    { id: 'matras', label: 'Matras Alas Tidur (1 buah per pendaki)', category: 'Pribadi' },
    { id: 'jaket', label: 'Jaket Gunung Tebal (1 buah per pendaki)', category: 'Pribadi' },
    { id: 'jas_hujan', label: 'Jas Hujan / Windshield (1 buah per pendaki)', category: 'Pribadi' },
    { id: 'air', label: 'Air Konsumsi Bersih (Minimum 3 Liter)', category: 'Pribadi' },
    { id: 'senter', label: 'Headlamp / Senter & Baterai Cadangan', category: 'Pribadi' }
  ];

  // If NOT logged in: we are registering an account
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

  // If LOGGED IN: we are registering a climb
  const [climbData, setClimbData] = useState({
    mountain: 'Gn. Slamet',
    date: '',
    endDate: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const validateRegisterStep = (tab: 'account' | 'personal' | 'address') => {
    const errors: Record<string, string> = {};
    
    if (tab === 'account') {
      if (!formData.username) errors.username = 'Username wajib diisi';
      if (!formData.email) {
        errors.email = 'Email wajib diisi';
      } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        errors.email = 'Format email tidak valid';
      }
      if (!formData.password) {
        errors.password = 'Password wajib diisi';
      } else if (formData.password.length < 6) {
        errors.password = 'Password minimal berisi 6 karakter';
      }
      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Konfirmasi password tidak cocok';
      }
      if (!formData.phone) {
        errors.phone = 'Nomor telepon wajib diisi';
      } else if (!/^[0-9]{9,15}$/.test(formData.phone)) {
        errors.phone = 'Nomor telepon tidak valid (9-15 digit)';
      }
      if (!formData.emergencyPhone) {
        errors.emergencyPhone = 'Nomor kontak darurat wajib diisi';
      } else if (formData.phone === formData.emergencyPhone) {
        errors.emergencyPhone = 'Nomor darurat tidak boleh sama dengan nomor telepon utama';
      }
    } 
    
    else if (tab === 'personal') {
      if (!formData.name) errors.name = 'Nama lengkap wajib diisi sesuai identitas';
      if (!formData.nik) {
        errors.nik = 'Nomor kartu identitas/KTP wajib diisi';
      } else if (formData.identityType === 'KTP' && formData.nik.length < 16) {
        errors.nik = 'NIK KTP harus berisi 16 digit angka';
      }
      if (!formData.weight) {
        errors.weight = 'Berat badan wajib diisi';
      } else if (isNaN(Number(formData.weight)) || Number(formData.weight) <= 0) {
        errors.weight = 'Berat badan tidak valid';
      }
      if (!formData.height) {
        errors.height = 'Tinggi badan wajib diisi';
      } else if (isNaN(Number(formData.height)) || Number(formData.height) <= 0) {
        errors.height = 'Tinggi badan tidak valid';
      }
    } 
    
    else if (tab === 'address') {
      if (!formData.province) errors.province = 'Provinsi wajib diisi';
      if (!formData.city) errors.city = 'Kota/Kabupaten wajib diisi';
      if (!formData.district) errors.district = 'Kecamatan wajib diisi';
      if (!formData.subdistrict) errors.subdistrict = 'Kelurahan wajib diisi';
      if (!formData.address) errors.address = 'Alamat lengkap wajib diisi';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextTab = (current: 'account' | 'personal', target: 'personal' | 'address') => {
    if (validateRegisterStep(current)) {
      setActiveTab(target);
    }
  };

  // Submit new Account Registration
  const handleAccountRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateRegisterStep('account') || !validateRegisterStep('personal') || !validateRegisterStep('address')) {
      return;
    }

    // Get existing users
    const usersListStr = localStorage.getItem('summity_users_list');
    let usersList = [];
    if (usersListStr) {
      try {
        usersList = JSON.parse(usersListStr);
      } catch (err) {
        console.error(err);
      }
    }

    // Check if username already exists
    const existing = usersList.find((u: any) => u.username?.toLowerCase() === formData.username.toLowerCase());
    if (existing) {
      setFormErrors({ username: 'Username sudah digunakan oleh pendaki lain' });
      setActiveTab('account');
      return;
    }

    const newUserId = `USER-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const newClimberAccount = {
      id: newUserId,
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

    // Log the user in with their personal dashboard details
    login('USER', newClimberAccount);

    setSubmitted(true);
  };

  const handleAddMember = () => {
    setMemberError('');
    const inputId = memberIdInput.trim().toUpperCase();
    if (!inputId) {
      setMemberError('Silakan masukkan ID Anggota yang valid');
      return;
    }
    
    if (user && inputId === user.id.toUpperCase()) {
      setMemberError('Anda tidak bisa menambahkan ID Anda sendiri sebagai anggota kelompok');
      return;
    }

    if (memberList.some((m: any) => m.id.toUpperCase() === inputId)) {
      setMemberError('Anggota ini sudah ditambahkan ke dalam daftar kelompok');
      return;
    }

    // Lookup user in summity_users_list
    try {
      const usersListStr = localStorage.getItem('summity_users_list');
      let foundUser = null;
      if (usersListStr) {
        const usersList = JSON.parse(usersListStr);
        foundUser = usersList.find((u: any) => u.id?.toUpperCase() === inputId);
      }
      
      if (foundUser) {
        setMemberList([...memberList, { id: foundUser.id, name: foundUser.name }]);
        setMemberIdInput('');
      } else {
        // Allow adding with custom auto-name if not found, to be tolerant
        setMemberList([...memberList, { id: inputId, name: `Pendaki #${inputId.replace('USER-', '')}` }]);
        setMemberIdInput('');
      }
    } catch (e) {
      setMemberList([...memberList, { id: inputId, name: `Pendaki #${inputId}` }]);
      setMemberIdInput('');
    }
  };

  const handleRemoveMember = (indexToRemove: number) => {
    setMemberList(memberList.filter((_, idx) => idx !== indexToRemove));
  };

  // Submit SIMAKSI (while Logged In)
  const handleSIMAKSISubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    if (!climbData.date) {
      setFormErrors({ date: 'Tanggal naik wajib diisi' });
      return;
    }
    if (!climbData.endDate) {
      setFormErrors({ endDate: 'Tanggal turun wajib diisi' });
      return;
    }
    if (new Date(climbData.date) > new Date(climbData.endDate)) {
      setFormErrors({ endDate: 'Tanggal turun tidak boleh lebih awal dari tanggal naik' });
      return;
    }

    if (isLeader) {
      // Ensure all gears are checked
      const allChecked = Object.values(checkedGears).every(val => val === true);
      if (!allChecked) {
        setFormErrors({ gear: 'Seluruh checklist barang bawaan wajib harus dicentang demi aspek keselamatan kelompok.' });
        return;
      }
    }

    if (!user) return;

    // Save registration with logged-in "data pribadi"
    await saveRegistration({
      userId: user.id,
      name: user.name,
      nik: user.nik || '',
      phone: user.phone || '',
      emergencyPhone: user.emergencyPhone || '',
      birthDate: '1995-01-01', // fallback since it's not requested in registration
      gender: user.gender || 'Laki-laki',
      address: `${user.address || ''}, ${user.subdistrict || ''}, ${user.district || ''}, ${user.city || ''}, ${user.province || ''}`,
      mountain: climbData.mountain,
      date: climbData.date,
      endDate: climbData.endDate,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      // Custom added attributes
      isLeader,
      members: isLeader ? memberList : [],
      checkedGears: isLeader ? Object.keys(checkedGears).filter(k => checkedGears[k]) : [],
    });

    setClimbSubmitted(true);
    setTimeout(() => {
      navigate('/');
    }, 3000);
  };

  // Formatted date string helper
  const formatDateString = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // NIK mask print
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
    const activeUser = user || {
      id: 'USER-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
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
      address: formData.address,
      subdistrict: formData.subdistrict,
      district: formData.district
    };

    const handleCopyId = () => {
      navigator.clipboard.writeText(activeUser.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-4 sm:p-6 relative select-none">
        <div className="absolute inset-0 bg-radial from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
        
        {/* Animated Celebration Badge */}
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center gap-2.5 bg-emerald-50 text-emerald-700 px-5 py-2.5 rounded-full border border-emerald-100 shadow-sm mb-6 animate-pulse"
        >
          <Sparkles className="w-4 h-4 text-emerald-500" />
          <span className="text-[10px] font-black uppercase tracking-widest leading-none">REGISTRASI BERHASIL DISUMPAN</span>
        </motion.div>

        <h2 className="text-2xl sm:text-4xl font-black text-slate-800 mb-1 italic uppercase tracking-tight text-center leading-none">
          AKUN ANGGOTA AKTIF!
        </h2>
        <p className="text-slate-400 mb-8 max-w-sm text-[10px] sm:text-xs font-semibold uppercase tracking-wider leading-relaxed text-center">
          ID Anggota unik Anda telah diterbitkan. Berikut adalah kartu identitas resmi pemegang akun Summity Anda.
        </p>

        {/* --- PREMIUM PHYSICAL DIGITAL CARD WRAPPER --- */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 100 }}
          className="w-full max-w-md bg-gradient-to-br from-emerald-900 to-slate-950 text-white rounded-[2.5rem] border border-emerald-500/30 p-6 sm:p-8 relative shadow-2xl overflow-hidden shadow-emerald-950/20 mb-8"
        >
          {/* Glowing Top Ambient Ring */}
          <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-44 h-44 bg-emerald-400/5 rounded-full blur-3xl pointer-events-none"></div>

          {/* Micro Card grid & Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="bg-emerald-500/20 p-2 rounded-xl border border-emerald-500/30">
                <Mountain className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-left">
                <span className="block text-[7px] font-black text-emerald-400 uppercase tracking-widest leading-none">DIGITAL CLIMBER</span>
                <span className="text-xs font-black uppercase tracking-widest leading-none italic">SUMMITY CARD</span>
              </div>
            </div>
            <div className="text-right">
              <span className="block text-[6px] text-white/50 font-black uppercase tracking-[0.2em]">Otoritas Basecamp</span>
              <span className="text-[8px] font-black text-emerald-300 uppercase tracking-widest">BAMBANGAN OFFICIAL</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-start text-left">
            
            {/* Left QR & Barcode Section */}
            <div className="sm:col-span-4 flex flex-col items-center sm:items-start text-center sm:text-left gap-3">
              <div className="bg-white p-2.5 rounded-[1.5rem] box-content shadow-lg border border-white/5 flex items-center justify-center">
                <div className="relative">
                  <QrCode className="w-16 h-16 text-slate-900" />
                  <div className="absolute inset-x-0 bottom-0 bg-transparent" />
                </div>
              </div>
              
              <div className="w-full flex flex-col items-center sm:items-start">
                <div className="font-mono text-center sm:text-left leading-none tracking-[0.18em] font-extrabold text-[9px] text-emerald-400 mt-1 uppercase">
                  ||| | ||||| | ||| || ||
                </div>
                <span className="text-[6px] text-white/40 font-bold uppercase tracking-[0.2em] mt-1">CODE-PASS-SECURE</span>
              </div>
            </div>

            {/* Right Profile Details Section */}
            <div className="sm:col-span-8 space-y-3.5 w-full uppercase">
              
              {/* ID Badge Column */}
              <div>
                <span className="block text-[7px] text-white/40 font-black tracking-widest">ID ANGGOTA PENDAKI</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-sm font-black tracking-widest text-amber-300 font-mono">
                    #{activeUser.id.toUpperCase()}
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
          </div>

          {/* Secure watermark seal */}
          <div className="border-t border-white/10 mt-5 pt-3.5 flex items-center justify-between text-[7px] font-bold tracking-widest text-emerald-400/90 uppercase">
            <span>MEMBERSHIP VALID ON ALL REGESTRATION CHECKPOINTS</span>
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

  // SUCCESS PAGE: CLIMB REGISTRATION SUBMITTED
  if (climbSubmitted) {
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
          <Ticket className="w-20 h-20 text-emerald-500 animate-pulse relative z-10 mx-auto" strokeWidth={1.5} />
        </motion.div>
        <h2 className="text-3xl font-black text-slate-800 mb-2 italic uppercase tracking-tight">SIMAKSI Diajukan!</h2>
        <p className="text-slate-505 mb-8 max-w-sm text-xs font-bold uppercase tracking-wider leading-relaxed text-slate-400">
          Rencana pendakian Anda disetujui untuk peninjauan manual oleh petugas basecamp. 
        </p>
        <div className="flex items-center gap-3 text-emerald-600 font-extrabold text-[10px] tracking-widest uppercase bg-emerald-50 px-6 py-3 rounded-2xl border border-emerald-100/50 shadow-sm animate-pulse">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-400"></span>
          Kembali ke Tiket...
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
            <div className="bg-gradient-to-tr from-emerald-500 to-teal-600 p-2.5 rounded-2xl text-white shadow-lg shadow-emerald-200">
              <Mountain className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-800 tracking-tight italic uppercase leading-none">
                {user ? 'DAFTAR SIMAKSI BARU' : 'REGISTRASI PENDAKI'}
              </h2>
              <p className="text-slate-400 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] mt-1.5 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                {user ? 'Buat rencana pendakian baru dengan profile Anda' : 'Slamet Climbing Safety System - Pendaftaran Akun'}
              </p>
            </div>
          </div>
        </div>
        
        {!user && (
          <button 
            onClick={() => navigate('/login')}
            className="self-start md:self-auto text-[10px] font-black text-emerald-600 hover:text-emerald-700 uppercase tracking-widest px-5 py-3.5 bg-emerald-50 hover:bg-emerald-100 rounded-2xl border border-emerald-200 transition-all shadow-sm active:scale-95"
          >
            Sudah Punya Akun? Masuk
          </button>
        )}
      </div>

      {user ? (
        /* ================= IF LOGGED IN: SIMPLE CLIMB SCHEDULE REGISTER ================= */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Form left */}
          <div className="lg:col-span-12 xl:col-span-8 space-y-6">
            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-100/60 p-4 sm:p-8 border border-slate-100 relative overflow-hidden">
              {/* Glowing decorative background item */}
              <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <h3 className="text-base sm:text-lg font-black italic uppercase tracking-tight text-slate-800 mb-6 flex items-center gap-2.5">
                <Calendar className="w-5.5 h-5.5 text-emerald-600 shrink-0" />
                RENCANA KEBERANGKATAN PENDAKIAN
              </h3>

              <form onSubmit={handleSIMAKSISubmit} className="space-y-6 sm:space-y-7">
                
                {/* Mountain Target Locked */}
                <div className="bg-emerald-50/40 border border-emerald-100/70 p-4 sm:p-5 rounded-3xl space-y-2">
                  <label className="text-[10px] font-black text-emerald-850 uppercase tracking-widest flex items-center gap-2">
                    <Compass className="w-4 h-4 text-emerald-500" />
                    Destinasi Gunung & Pos Registrasi
                  </label>
                  <div className="relative">
                    <Mountain className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-emerald-600" />
                    <input 
                      type="text"
                      readOnly
                      value="Gunung Slamet via Bambangan (3.428 mdpl)"
                      className="w-full bg-white border border-emerald-200/80 rounded-2xl py-3.5 pl-11 pr-4 text-emerald-850 font-black cursor-not-allowed text-xs focus:outline-none"
                    />
                  </div>
                  <p className="text-[8.5px] text-emerald-700/80 font-bold italic leading-relaxed ml-1">
                    * Jalur resmi teregistrasi dengan gelang pelacak telemetry SAR pos 1 - 9 Bambangan.
                  </p>
                </div>

                {/* Climber Data Summary with High-fidelity visual cards */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                    <User className="w-4 h-4 text-emerald-500" /> Profil Pendaki Aktif (Data Pribadi)
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3 text-[11px]">
                    <div className="bg-slate-50/50 border border-slate-100 px-3 py-3 rounded-2xl">
                      <span className="block text-[7.5px] text-slate-400 uppercase font-black tracking-wider mb-0.5">Nama Lengkap</span>
                      <span className="font-extrabold text-slate-800 uppercase line-clamp-1 truncate">{user.name}</span>
                    </div>
                    
                    <div className="bg-slate-50/50 border border-slate-100 px-3 py-3 rounded-2xl">
                      <span className="block text-[7.5px] text-slate-400 uppercase font-black tracking-wider mb-0.5">NIK Identitas</span>
                      <span className="font-mono font-bold text-slate-800 text-[10px] sm:text-xs">{user.nik || 'BELUM DIISI'}</span>
                    </div>

                    <div className="bg-slate-50/50 border border-slate-100 px-3 py-3 rounded-2xl">
                      <span className="block text-[7.5px] text-slate-400 uppercase font-black tracking-wider mb-0.5">Nomor WA</span>
                      <span className="font-bold text-slate-800">{user.phone || 'BELUM DIISI'}</span>
                    </div>

                    <div className="bg-slate-50/50 border border-slate-100 px-3 py-3 rounded-2xl">
                      <span className="block text-[7.5px] text-slate-400 uppercase font-black tracking-wider mb-0.5">Jenis Kelamin</span>
                      <span className="font-bold text-slate-800">{user.gender || 'Laki-laki'}</span>
                    </div>

                    <div className="bg-slate-50/50 border border-slate-100 px-3 py-3 rounded-2xl">
                      <span className="block text-[7.5px] text-slate-400 uppercase font-black tracking-wider mb-0.5">Fisik (BB/TB)</span>
                      <span className="font-bold text-slate-800">{user.weight ? `${user.weight} kg` : '-'} / {user.height ? `${user.height} cm` : '-'}</span>
                    </div>

                    <div className="bg-slate-50/50 border border-slate-100 px-3 py-3 rounded-2xl col-span-2 md:col-span-1">
                      <span className="block text-[7.5px] text-slate-400 uppercase font-black tracking-wider mb-0.5">Provinsi</span>
                      <span className="font-bold text-slate-800 truncate block">{user.province || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Climb Date Selector */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                      Jadwal Naik & Jadwal Estimasi Turun
                    </label>
                    {climbData.date && climbData.endDate && (
                      <div className="self-start sm:self-auto bg-emerald-50 text-emerald-700 text-[9px] font-black px-2.5 py-1 rounded-full border border-emerald-100 flex items-center gap-1 shrink-0">
                        <Sparkles className="w-3 h-3 text-emerald-500" />
                        DURASI: {Math.max(1, Math.ceil((new Date(climbData.endDate).getTime() - new Date(climbData.date).getTime()) / (1000 * 60 * 60 * 24)) + 1)} HARI
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-slate-50 border border-slate-100/90 p-3 sm:p-4 rounded-[1.8rem] flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <div className="w-full">
                      <span className="block text-[8px] text-slate-400 font-black uppercase tracking-widest mb-1.5 ml-1">TANGGAL NAIK</span>
                      <input 
                        type="date" 
                        required
                        min={new Date().toISOString().split('T')[0]}
                        value={climbData.date}
                        onChange={(e) => {
                          setClimbData({...climbData, date: e.target.value});
                          if (formErrors.date) setFormErrors({...formErrors, date: ''});
                        }}
                        className="w-full bg-white border border-slate-200/80 rounded-xl py-3 px-4 text-slate-800 font-bold focus:outline-none focus:border-emerald-400 text-xs shadow-sm"
                      />
                    </div>

                    <div className="text-slate-350 shrink-0 hidden sm:block font-black text-sm pt-4">→</div>

                    <div className="w-full">
                      <span className="block text-[8px] text-slate-400 font-black uppercase tracking-widest mb-1.5 ml-1">TANGGAL TURUN</span>
                      <input 
                        type="date" 
                        required
                        min={climbData.date || new Date().toISOString().split('T')[0]}
                        value={climbData.endDate}
                        onChange={(e) => {
                          setClimbData({...climbData, endDate: e.target.value});
                          if (formErrors.endDate) setFormErrors({...formErrors, endDate: ''});
                        }}
                        className="w-full bg-white border border-slate-200/80 rounded-xl py-3 px-4 text-slate-800 font-bold focus:outline-none focus:border-emerald-400 text-xs shadow-sm"
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

                {/* ROLE SELECTION: ELEGANT CHECKLIST FOR LEADER ROLE */}
                <div className="bg-emerald-50/10 border border-emerald-500/25 p-4.5 sm:p-5 rounded-3xl text-left relative overflow-hidden transition-all hover:border-emerald-500/40">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
                  
                  <label className="flex items-start gap-3.5 cursor-pointer select-none">
                    <div className="relative flex items-center mt-0.5 shrink-0">
                      <input 
                        type="checkbox"
                        checked={isLeader}
                        onChange={(e) => {
                          setIsLeader(e.target.checked);
                          if (formErrors.gear) setFormErrors({...formErrors, gear: ''});
                        }}
                        className="peer h-5.5 w-5.5 rounded border-slate-350 text-emerald-600 focus:ring-emerald-550 cursor-pointer accent-emerald-600"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="block text-xs font-black text-slate-800 uppercase tracking-tight">Daftarkan Sebagai Ketua Rombongan</span>
                        <span className="text-[7.5px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md leading-none">GRUP / KELOMPOK</span>
                      </div>
                      <span className="block text-[9.5px] text-slate-400 font-bold leading-relaxed mt-1 uppercase tracking-wider">
                        Centang ini bila Anda membawa rombongan tambahan. Anda wajib mendaftarkan ID Anggota mereka serta melengkapi logistik keselamatan kelompok.
                      </span>
                    </div>
                  </label>
                </div>

                <AnimatePresence>
                  {isLeader && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-6 overflow-hidden"
                    >
                      {/* PROCEDURAL RESPONSIBLE LEADER SECTION */}
                      <div className="bg-slate-50 border border-slate-150 p-4 sm:p-5 rounded-3xl space-y-2 text-left relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
                        <span className="text-[8px] font-black text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full uppercase tracking-wider inline-block leading-none">
                          PROSEDUR KETUA BERTANGGUNG JAWAB
                        </span>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5 mt-1.5">
                          <Users className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                          Registrasi Terpadu Melalui Ketua Rombongan
                        </h4>
                        <p className="text-[9.5px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-relaxed">
                          Demi keselamatan, pendaftaran wajib dikoordinasikan oleh Ketua Rombongan yang bertanggung jawab penuh atas logistik darurat, keselamatan seluruh anggota kelompok, dan validasi perlengkapan di basecamp.
                        </p>
                      </div>

                      {/* MANAGE MEMBERS ROW - Enhanced and ultra-responsive for mobile */}
                      <div className="bg-white border border-slate-150 p-4 sm:p-5 rounded-3xl shadow-sm space-y-4 font-sans text-left">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
                          <div>
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                              <Plus className="w-4 h-4 text-emerald-500" />
                              Tambah Anggota Kelompok
                            </h4>
                            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1">Daftarkan anggota pendaki dengan NIK / ID Anggota unik mereka</p>
                          </div>
                          <span className="self-start sm:self-auto text-[7.5px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full leading-none shrink-0">
                            Min. 1 Anggota tambahan
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <input 
                            type="text"
                            value={memberIdInput}
                            onChange={(e) => setMemberIdInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddMember();
                              }
                            }}
                            placeholder="Contoh ID: USER-XXXXXX"
                            className="w-full sm:flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold font-mono focus:outline-none focus:bg-white focus:border-emerald-400 uppercase tracking-wider"
                          />
                          <button
                            type="button"
                            onClick={handleAddMember}
                            className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 font-black px-5 py-3.5 sm:py-0 rounded-xl text-[10px] text-white uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-1.5 shrink-0"
                          >
                            <Plus className="w-4 h-4" /> <span className="inline">Tambah Anggota</span>
                          </button>
                        </div>

                        {memberError && (
                          <p className="text-[9px] text-rose-500 font-bold ml-1 flex items-center gap-1.5 text-left">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {memberError}
                          </p>
                        )}

                        {/* MEMBERS LIST */}
                        {memberList.length > 0 ? (
                          <div className="space-y-2.5 pt-3 border-t border-slate-100 text-left">
                            <div className="flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                              <span>Daftar Anggota Kelompok</span>
                              <span className="text-emerald-600 font-black bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 leading-none">{memberList.length} Orang</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                              {memberList.map((member, index) => (
                                <div key={index} className="flex items-center justify-between bg-slate-50/50 border border-slate-150 rounded-2xl p-3 text-xs transition-all hover:bg-slate-50">
                                  <div className="flex items-center gap-2.5 truncate mr-2">
                                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-700 font-black flex items-center justify-center text-xs border border-emerald-500/10 shrink-0">
                                      {member.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="text-left font-semibold text-slate-750 truncate">
                                      <span className="block font-black text-slate-800 text-[11px] truncate uppercase tracking-tight">{member.name}</span>
                                      <span className="text-[9px] text-slate-400 font-mono tracking-widest leading-none block mt-0.5">#{member.id}</span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMember(index)}
                                    className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-xl transition-colors shrink-0"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center p-5 sm:p-7 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                            <p className="text-[10px] sm:text-[11px] font-extrabold text-slate-400 uppercase tracking-wider leading-relaxed">
                              Belum ada anggota kelompok tambahan.<br/>
                              <span className="font-medium text-[9px] text-slate-400/80 lowercase mt-1.5 block leading-normal">
                                * Anggota Anda dapat melihat ID unik login mereka pada banner profile dashboard kustom mereka sendiri, lalu bagikan ke Anda.
                              </span>
                            </p>
                          </div>
                        )}
                      </div>

                      {/* MANDATORY GEARS CHECKBOX LIST - Ultra responsive and premium */}
                      <div className="bg-emerald-50/10 border border-emerald-100 p-4 sm:p-5 rounded-[2rem] space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-emerald-100/50 pb-3 text-left">
                          <div>
                            <h4 className="text-xs font-black text-emerald-800 uppercase tracking-tight flex items-center gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-emerald-600" />
                              Daftar Perlengkapan Wajib Kelompok
                            </h4>
                            <p className="text-[8px] text-emerald-600 font-bold uppercase tracking-widest mt-1">Ketua kelompok harus memastikan semua perlengkapan berikut telah tersedia dan siap dibawa</p>
                          </div>
                          <div className="self-start sm:self-auto bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg">
                            {Object.values(checkedGears).filter(v => v).length} / {MANDATORY_ITEMS.length} Lengkap
                          </div>
                        </div>

                        {/* Gears Progress */}
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300" 
                            style={{ width: `${(Object.values(checkedGears).filter(v => v).length / MANDATORY_ITEMS.length) * 100}%` }}
                          />
                        </div>

                        {/* Gears Grid List */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scroll-smooth whitespace-normal">
                          {MANDATORY_ITEMS.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setCheckedGears({
                                  ...checkedGears,
                                  [item.id]: !checkedGears[item.id]
                                });
                                if (formErrors.gear) setFormErrors({...formErrors, gear: ''});
                              }}
                              className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all active:scale-[0.98] ${
                                checkedGears[item.id]
                                  ? 'bg-emerald-50/30 border-emerald-300 text-emerald-950 shadow-sm'
                                  : 'bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50/50'
                              }`}
                            >
                              <div className="mt-0.5 shrink-0 select-none">
                                {checkedGears[item.id] ? (
                                  <CheckSquare className="w-4.5 h-4.5 text-emerald-600" />
                                ) : (
                                  <Square className="w-4.5 h-4.5 text-slate-300" />
                                )}
                              </div>
                              <div className="text-[10px] sm:text-[11px] leading-tight grow">
                                <span className={`block font-black text-[7px] sm:text-[8px] uppercase tracking-wider leading-none mb-1 ${
                                  item.category === 'Kelompok' ? 'text-blue-500' : 'text-amber-500'
                                }`}>
                                  Bagian {item.category}
                                </span>
                                <span className={`font-bold block ${checkedGears[item.id] ? 'text-slate-505 line-through opacity-75' : 'text-slate-700'}`}>
                                  {item.label}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>

                        {formErrors.gear && (
                          <div className="bg-rose-50 border border-rose-150 p-3 rounded-xl flex items-start gap-2 text-rose-700 text-left">
                            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                            <p className="text-[9px] font-black uppercase tracking-wider leading-normal">{formErrors.gear}</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submitting Actions */}
                <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                  <p className="text-[8.5px] sm:text-[9px] text-slate-400 font-extrabold uppercase tracking-widest max-w-sm">
                    * Mohon pastikan profil fisik & tanggal rencana keberangkatan sudah benar sebelum mengirim permohonan SIMAKSI.
                  </p>
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.97] text-white font-black px-8 py-4.5 rounded-2xl text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-2.5 transition-all shadow-xl shadow-emerald-500/10 shrink-0 w-full sm:w-auto"
                  >
                    Kirim SIMAKSI Keberangkatan
                    <ArrowRight className="w-4 h-4 text-white" />
                  </button>
                </div>

              </form>
            </div>
          </div>

          {/* Right sidebar info */}
          <div className="lg:col-span-12 xl:col-span-4 space-y-6 lg:sticky lg:top-24">
            
            {/* Status Information Panel */}
            <div className="bg-slate-900 text-white rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden text-left">
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 to-transparent pointer-events-none" />
              <h4 className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.2em] mb-4 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Informasi Status SIMAKSI
              </h4>
              <p className="text-xs text-slate-350 leading-relaxed font-semibold mb-4 uppercase tracking-wide">
                Pendakian Gunung Slamet memberlakukan registrasi online wajib terverifikasi KTP guna monitoring kecelakaan dan manajemen kapasitas harian.
              </p>
              
              <div className="space-y-3 bg-white/5 border border-white/10 p-4 rounded-2xl text-[10px] sm:text-[11px] text-slate-300 font-mono">
                <div className="flex justify-between border-b border-white/[0.04] pb-2">
                  <span>Nama Akun:</span>
                  <span className="font-bold text-slate-100 uppercase">{user.username || 'pendaki'}</span>
                </div>
                <div className="flex justify-between border-b border-white/[0.04] pb-2">
                  <span>NIK Identitas:</span>
                  <span className="font-bold text-emerald-400">{user.identityType} #{user.nik}</span>
                </div>
                <div className="flex justify-between border-b border-white/[0.04] pb-2 text-right">
                  <span>Kab/Kota KTP:</span>
                  <span className="font-bold text-slate-100 truncate max-w-[130px]">{user.city || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Basecamp Regis:</span>
                  <span className="font-bold text-slate-100">Bambangan Purbalingga</span>
                </div>
              </div>
            </div>

            {/* Offline Basecamp Checklist Flow */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 p-5 shadow-lg shadow-slate-100/50 space-y-4 text-left">
              <div>
                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-emerald-500" /> Tahapan Penting Berikutnya
                </h5>
                <span className="text-xs font-black uppercase tracking-tight text-slate-800 mt-1 block">Prosedur Setelah Mengisi Rencana</span>
              </div>

              <div className="space-y-4.5 pt-1">
                {[
                  { step: '01', title: 'Verifikasi di Basecamp', desc: 'Tunjukkan identitas KTP/Paspor asli Anda ke petugas registrasi setibanya di basecamp Bambangan.' },
                  { step: '02', title: 'Cek Kesehatan Fisik', desc: 'Melakukan tes kesehatan di pos medis basecamp (tensi darah & saturasi oksigen wajib dipenuhi).' },
                  { step: '03', title: 'Pengambilan Gelang Pelacak', desc: 'Setiap kelompok dibekali 1 wristband GPS tracking untuk memonitor titik koordinat keselamatan Anda.' },
                  { step: '04', title: 'Pemeriksaan Barang Bawaan', desc: 'Pengecekan kantong sampah (trash bag) & perlengkapan standar tidur/penghangat tubuh demi mencegah hipotermia.' }
                ].map((item, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="w-7 h-7 bg-emerald-50 text-emerald-600 border border-emerald-100 font-mono text-[10px] font-black rounded-lg flex items-center justify-center shrink-0">
                      {item.step}
                    </div>
                    <div className="space-y-0.5">
                      <h6 className="text-[10px] font-black text-slate-800 uppercase tracking-wide">{item.title}</h6>
                      <p className="text-[9.5px] text-slate-400 font-bold leading-normal uppercase tracking-wider">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
          </div>

        </div>
      ) : (
        /* ================= IF NOT LOGGED IN: COMPLETE 18-FIELD REGISTRATION ================= */
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
                            <AlertCircle className="w-3 h-3" /> {formErrors.username}
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
                            <AlertCircle className="w-3 h-3" /> {formErrors.email}
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
                              <AlertCircle className="w-3 h-3" /> {formErrors.password}
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
                            placeholder="Ketik ulan sandi Anda"
                          />
                          {formErrors.confirmPassword && (
                            <p className="text-[9px] text-rose-500 font-bold ml-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> {formErrors.confirmPassword}
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
                              <AlertCircle className="w-3 h-3" /> {formErrors.phone}
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
                              <AlertCircle className="w-3 h-3" /> {formErrors.emergencyPhone}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Navigation */}
                      <div className="pt-6 border-t border-slate-50 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleNextTab('account', 'personal')}
                          className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-black px-7 py-4 rounded-2xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl shadow-slate-200 text-center animate-in fade-in"
                        >
                          <span>Berikutnya<span className="hidden sm:inline">: Data Diri</span></span>
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
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Jenis Kewarganegaraan</label>
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
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Jenis Identitas</label>
                          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                            {['KTP', 'Paspor', 'KITAS'].map((type) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => setFormData({...formData, identityType: type as any})}
                                className={`py-3 px-1 sm:p-3 rounded-xl border font-black text-[10px] transition-all text-center ${
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

                      {/* ID Number */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5 flex-wrap">
                          <FileText className="w-3.5 h-3.5 text-emerald-500" />
                          Nomor Identitas ({formData.identityType})
                        </label>
                        <input 
                          type="text"
                          required
                          value={formData.nik}
                          onChange={(e) => {
                            setFormData({...formData, nik: e.target.value.trim()});
                            if (formErrors.nik) setFormErrors({...formErrors, nik: ''});
                          }}
                          className={`w-full bg-slate-50 border ${formErrors.nik ? 'border-rose-300 ring-2 ring-rose-500/10' : 'border-slate-100'} rounded-2xl py-4.5 px-5 text-slate-800 font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all text-xs`}
                          placeholder={`Masukkan nomor ${formData.identityType}`}
                        />
                        {formErrors.nik && (
                          <p className="text-[9px] text-rose-500 font-bold ml-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {formErrors.nik}
                          </p>
                        )}
                      </div>

                      {/* Full Name */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-emerald-500" />
                          Nama Lengkap (Sesuai Identitas)
                        </label>
                        <input 
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => {
                            setFormData({...formData, name: e.target.value.toUpperCase()});
                            if (formErrors.name) setFormErrors({...formErrors, name: ''});
                          }}
                          className={`w-full bg-slate-50 border ${formErrors.name ? 'border-rose-300 ring-2 ring-rose-500/10' : 'border-slate-100'} rounded-2xl py-4.5 px-5 text-slate-800 font-extrabold focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all text-xs`}
                          placeholder="CONTOH: ADITYA RAHMAN"
                        />
                        {formErrors.name && (
                          <p className="text-[9px] text-rose-500 font-bold ml-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {formErrors.name}
                          </p>
                        )}
                      </div>

                      {/* Gender Selector */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Jenis Kelamin</label>
                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                          <button
                            type="button"
                            onClick={() => setFormData({...formData, gender: 'Laki-laki'})}
                            className={`p-3 sm:p-4 rounded-2xl border flex items-center justify-center gap-2 sm:gap-3 transition-all ${
                              formData.gender === 'Laki-laki' 
                                ? 'bg-emerald-50/50 border-emerald-300 text-emerald-800 font-black' 
                                : 'bg-slate-50 border-slate-100 text-slate-500 font-bold hover:bg-slate-100'
                            }`}
                          >
                            <span>👦</span>
                            <span className="text-xs uppercase tracking-widest font-black">Laki-laki</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData({...formData, gender: 'Perempuan'})}
                            className={`p-3 sm:p-4 rounded-2xl border flex items-center justify-center gap-2 sm:gap-3 transition-all ${
                              formData.gender === 'Perempuan' 
                                ? 'bg-emerald-50/50 border-emerald-300 text-emerald-800 font-black' 
                                : 'bg-slate-50 border-slate-100 text-slate-500 font-bold hover:bg-slate-100'
                            }`}
                          >
                            <span>👧</span>
                            <span className="text-xs uppercase tracking-widest font-black">Perempuan</span>
                          </button>
                        </div>
                      </div>

                      {/* Height & Weight */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                            <Scale className="w-3.5 h-3.5 text-emerald-500" />
                            Berat Badan (kg)
                          </label>
                          <input 
                            type="number"
                            required
                            value={formData.weight}
                            onChange={(e) => {
                              setFormData({...formData, weight: e.target.value});
                              if (formErrors.weight) setFormErrors({...formErrors, weight: ''});
                            }}
                            className={`w-full bg-slate-50 border ${formErrors.weight ? 'border-rose-300 ring-2 ring-rose-500/10' : 'border-slate-100'} rounded-2xl py-4.5 px-5 text-slate-800 font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all text-xs`}
                            placeholder="Contoh: 65"
                          />
                          {formErrors.weight && (
                            <p className="text-[9px] text-rose-500 font-bold ml-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> {formErrors.weight}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                            <Ruler className="w-3.5 h-3.5 text-emerald-500" />
                            Tinggi Badan (CM)
                          </label>
                          <input 
                            type="number"
                            required
                            value={formData.height}
                            onChange={(e) => {
                              setFormData({...formData, height: e.target.value});
                              if (formErrors.height) setFormErrors({...formErrors, height: ''});
                            }}
                            className={`w-full bg-slate-50 border ${formErrors.height ? 'border-rose-300 ring-2 ring-rose-500/10' : 'border-slate-100'} rounded-2xl py-4.5 px-5 text-slate-800 font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all text-xs`}
                            placeholder="Contoh: 170"
                          />
                          {formErrors.height && (
                            <p className="text-[9px] text-rose-500 font-bold ml-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> {formErrors.height}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Navigation */}
                      <div className="pt-6 border-t border-slate-50 flex items-center justify-between gap-4">
                        <button
                          type="button"
                          onClick={() => setActiveTab('account')}
                          className="flex-1 sm:flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 font-black px-6 py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all text-center"
                        >
                          Kembali
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNextTab('personal', 'address')}
                          className="flex-[1.5] sm:flex-none bg-slate-900 hover:bg-slate-800 text-white font-black px-7 py-4 rounded-2xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl shadow-slate-200 text-center"
                        >
                          <span>Berikutnya<span className="hidden sm:inline">: Alamat KTP</span></span>
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
                      className="space-y-5"
                    >
                      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-4 bg-emerald-500 rounded-full"></div>
                          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Alamat Domisili KTP</h3>
                        </div>
                        <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border border-emerald-100/30">Step 3 dari 3</span>
                      </div>

                      {/* Province & City */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Provinsi (Sesuai KTP)</label>
                          <input 
                            type="text"
                            required
                            value={formData.province}
                            onChange={(e) => {
                              setFormData({...formData, province: e.target.value});
                              if (formErrors.province) setFormErrors({...formErrors, province: ''});
                            }}
                            className={`w-full bg-slate-50 border ${formErrors.province ? 'border-rose-300 ring-2 ring-rose-500/10' : 'border-slate-100'} rounded-2xl py-4.5 px-5 text-slate-800 font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all text-xs`}
                            placeholder="Contoh: Jawa Tengah"
                          />
                          {formErrors.province && (
                            <p className="text-[9px] text-rose-500 font-bold ml-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> {formErrors.province}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Kota/Kabupaten (Sesuai KTP)</label>
                          <input 
                            type="text"
                            required
                            value={formData.city}
                            onChange={(e) => {
                              setFormData({...formData, city: e.target.value});
                              if (formErrors.city) setFormErrors({...formErrors, city: ''});
                            }}
                            className={`w-full bg-slate-50 border ${formErrors.city ? 'border-rose-300 ring-2 ring-rose-500/10' : 'border-slate-100'} rounded-2xl py-4.5 px-5 text-slate-800 font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all text-xs`}
                            placeholder="Contoh: Purwokerto"
                          />
                          {formErrors.city && (
                            <p className="text-[9px] text-rose-500 font-bold ml-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> {formErrors.city}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* District & Sub-district */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Kecamatan (Sesuai KTP)</label>
                          <input 
                            type="text"
                            required
                            value={formData.district}
                            onChange={(e) => {
                              setFormData({...formData, district: e.target.value});
                              if (formErrors.district) setFormErrors({...formErrors, district: ''});
                            }}
                            className={`w-full bg-slate-50 border ${formErrors.district ? 'border-rose-300 ring-2 ring-rose-500/10' : 'border-slate-100'} rounded-2xl py-4.5 px-5 text-slate-800 font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all text-xs`}
                            placeholder="Contoh: Baturraden"
                          />
                          {formErrors.district && (
                            <p className="text-[9px] text-rose-500 font-bold ml-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> {formErrors.district}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Kelurahan (Sesuai KTP)</label>
                          <input 
                            type="text"
                            required
                            value={formData.subdistrict}
                            onChange={(e) => {
                              setFormData({...formData, subdistrict: e.target.value});
                              if (formErrors.subdistrict) setFormErrors({...formErrors, subdistrict: ''});
                            }}
                            className={`w-full bg-slate-50 border ${formErrors.subdistrict ? 'border-rose-300 ring-2 ring-rose-500/10' : 'border-slate-100'} rounded-2xl py-4.5 px-5 text-slate-800 font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all text-xs`}
                            placeholder="Contoh: Karangmangu"
                          />
                          {formErrors.subdistrict && (
                            <p className="text-[9px] text-rose-500 font-bold ml-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> {formErrors.subdistrict}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Detail Address */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                          Alamat KTP Lengkap (Jalan, RT/RW)
                        </label>
                        <textarea 
                          required
                          rows={3}
                          value={formData.address}
                          onChange={(e) => {
                            setFormData({...formData, address: e.target.value});
                            if (formErrors.address) setFormErrors({...formErrors, address: ''});
                          }}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-slate-800 font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all text-xs leading-relaxed"
                          placeholder="Masukkan nama jalan, nomor rumah, RT dan RW"
                        />
                        {formErrors.address && (
                          <p className="text-[9px] text-rose-500 font-bold ml-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {formErrors.address}
                          </p>
                        )}
                      </div>

                      {/* Navigation */}
                      <div className="pt-6 border-t border-slate-50 flex items-center justify-between gap-4">
                        <button
                          type="button"
                          onClick={() => setActiveTab('personal')}
                          className="flex-1 sm:flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 font-black px-6 py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all text-center"
                        >
                          Kembali
                        </button>
                        <button
                          type="submit"
                          className="flex-[1.5] sm:flex-none bg-emerald-600 hover:bg-emerald-700 active:scale-[0.97] text-white font-black px-8 py-4 rounded-2xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl shadow-emerald-250 text-center"
                        >
                          <span>Daftar Selesai</span>
                          <ArrowRight className="w-4 h-4 text-white" />
                        </button>
                      </div>

                    </motion.div>
                  )}

                </AnimatePresence>

              </form>
            </div>
          </div>

          {/* RIGHT COLUMN: PREVIEW INFO OF REGISTERED DATA */}
          <div className="lg:col-span-12 xl:col-span-5 space-y-6 lg:sticky lg:top-24">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Digital Member Card Preview</h4>
            </div>

            {/* Micro card design showing visual feedback */}
            <div className="relative overflow-hidden bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl p-6 text-white min-h-[300px] flex flex-col justify-between group">
              <div className="absolute inset-0 bg-radial-gradient from-emerald-500/10 via-slate-905 to-slate-950 pointer-events-none z-0" />
              
              <div className="relative z-10 space-y-6">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2.5">
                    <div className="bg-emerald-500/15 p-2 rounded-xl">
                      <Mountain className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-200">SUMMITY PROFILE CARD</h5>
                      <span className="text-[7.5px] text-slate-400 font-extrabold uppercase">Official Climber Account</span>
                    </div>
                  </div>
                  <span className="text-[8px] uppercase tracking-widest font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-md">
                    REGISTERING
                  </span>
                </div>

                {/* User values preview */}
                <div className="space-y-4 font-mono text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block text-[7.5px] text-slate-400 font-sans font-black uppercase tracking-widest">USERNAME</span>
                      <span className="block text-[11px] font-sans font-black text-slate-100 min-h-[16px] truncate uppercase">{formData.username || '------'}</span>
                    </div>
                    <div>
                      <span className="block text-[7.5px] text-slate-400 font-sans font-black uppercase tracking-widest">NAMA PENDAKI</span>
                      <span className="block text-[11px] font-sans font-black text-slate-100 min-h-[16px] truncate">{formData.name || 'BELUM DIISI'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block text-[7.5px] text-slate-400 font-sans font-black uppercase tracking-widest">NEGARA / IDENTITAS</span>
                      <span className="block text-[10px] font-sans font-black text-slate-300 min-h-[14px]">
                        {formData.citizenship} / {formData.identityType}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[7.5px] text-slate-400 font-sans font-black uppercase tracking-widest">NOMOR ELEMEN</span>
                      <span className="block text-[10px] font-sans font-black text-emerald-300 min-h-[14px]">
                        {formatMaskedNIK(formData.nik)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-white/[0.06] pt-3.5">
                    <div>
                      <span className="block text-[7.5px] text-slate-400 font-sans font-black uppercase tracking-widest">FISIK PENDAKI</span>
                      <span className="block text-[10px] text-slate-300">
                        {formData.weight ? `${formData.weight} kg` : '-'} / {formData.height ? `${formData.height} cm` : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[7.5px] text-slate-400 font-sans font-black uppercase tracking-widest">ALAMAT DOMISILI</span>
                      <span className="block text-[9px] text-slate-300 truncate min-h-[12px]">
                        {formData.city ? `${formData.city}, ${formData.province}` : 'BELUM DIISI'}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Card foot */}
              <div className="border-t-2 border-dashed border-slate-800 pt-4 flex items-center justify-between relative text-[8px] font-mono text-slate-450 mt-4 leading-none">
                <span>TERTATA DI PUSTAKA BASECAMP</span>
                <span className="text-emerald-500 font-bold">SECURE MEMORY IDB</span>
              </div>
            </div>

            {/* Instruction Warning banner */}
            <div className="bg-amber-50 border border-amber-100 rounded-3xl p-5 text-amber-900 flex gap-3 text-xs leading-relaxed font-semibold shadow-sm">
              <span className="text-xl">💡</span>
              <div>
                <strong className="block text-amber-950 mb-0.5">Informasi Sistem Akun Pribadi:</strong>
                Pendaftaran akun ini menyimpan profile fisik, tinggi badang, kartu identitas, dan alamat KTP Anda secara aman. Saat Anda log in, data ini otomatis di-load tanpa perlu mengetik ulang form identifikasi di kemudian hari.
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
