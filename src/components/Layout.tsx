import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Outlet, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Mountain,
  LogOut,
  Menu,
  User,
  ShieldCheck,
  QrCode,
  Map,
  Home,
  Ticket,
  X,
  Compass,
  Scan,
  LayoutDashboard,
  ChevronRight,
  Copy,
  Check,
  Camera,
  Pencil,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getSupabaseClient, syncAllUnsyncedData } from '../lib/db';

// Components for User Popups
import UserTickets from '../pages/user/Tickets';
import UserTracking from '../pages/user/Tracking';
import UserScanner from '../pages/user/Scanner';
import SubmitSimaksi from '../pages/user/SimaksiSubmit';

export default function Layout() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [copiedId, setCopiedId] = useState(false);
  
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced'>('idle');
  const hasSupabase = !!getSupabaseClient();
  
  const activeView = searchParams.get('view');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closePopup = () => {
    setSearchParams({});
  };

  const setView = (view: string) => {
    if (view === 'home') {
      setSearchParams({});
      if (location.pathname !== '/') navigate('/');
    } else {
      setSearchParams({ view });
    }
  };

  // Connection listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus('syncing');
      syncAllUnsyncedData()
        .then(() => setSyncStatus('synced'))
        .catch(() => setSyncStatus('idle'));
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync
    if (isOnline && hasSupabase) {
      setSyncStatus('syncing');
      syncAllUnsyncedData()
        .then(() => setSyncStatus('synced'))
        .catch(() => setSyncStatus('idle'));
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOnline, hasSupabase]);

  // Prevent background scroll when popup is open
  useEffect(() => {
    if (activeView) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [activeView]);

  if (!user) return <Outlet />;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900 overflow-x-hidden">
      {/* Header */}
      <header className="bg-emerald-700 text-white shadow-lg sticky top-0 z-[100]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 shrink-0">
            <div className="flex items-center gap-2 font-black text-xl cursor-pointer italic tracking-tighter" onClick={() => setView('home')}>
              <Mountain className="w-6 h-6" />
              <span>Summity</span>
              {user.role === 'ADMIN' && (
                <span className="bg-amber-400 text-amber-950 text-[9px] px-2 py-0.5 rounded-full uppercase tracking-widest ml-2 not-italic font-black">
                  Admin
                </span>
              )}
            </div>
            
            {/* Sync Status Badge */}
            <div className="flex items-center gap-1.5 bg-emerald-800/60 px-2.5 py-1 rounded-full border border-emerald-500/10 self-start sm:self-auto">
              <span className={`w-1.5 h-1.5 rounded-full ${
                !hasSupabase ? 'bg-slate-400' :
                !isOnline ? 'bg-amber-400' :
                syncStatus === 'syncing' ? 'bg-amber-300 animate-ping' : 'bg-emerald-400'
              }`} />
              <span className="text-[8px] font-black uppercase tracking-wider text-emerald-100">
                {!hasSupabase ? 'Offline Mode' :
                 !isOnline ? 'Offline Mode' :
                 syncStatus === 'syncing' ? 'Menyelaraskan...' : 'Online Mode'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="hidden sm:flex flex-col items-end mr-1 text-white/90">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] leading-none mb-1 shadow-sm opacity-60">Profil Pendaki</span>
                <span className="text-sm font-black leading-none uppercase italic drop-shadow-sm">{user.name}</span>
             </div>
             <button 
               onClick={handleLogout}
               className="p-2.5 bg-white/10 hover:bg-white/20 rounded-2xl transition-all active:scale-95"
               title="Logout"
             >
               <LogOut className="w-5 h-5" />
             </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 pt-10 sm:pt-14 pb-8 sm:pb-12 mb-24">
        <Outlet />
      </main>

      {/* User Overlays (Popups) */}
      <AnimatePresence>
        {user.role === 'USER' && activeView && (
          <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center px-0 sm:px-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closePopup}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md pointer-events-auto"
            />
            
            {/* Sheet Container */}
            <motion.div 
              initial={{ y: "100%", scale: 1 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: "100%", scale: 1 }}
              transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
              className="relative w-full max-w-lg bg-white rounded-t-[3rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden pointer-events-auto h-[90vh] sm:h-[80vh] flex flex-col border border-slate-100"
            >
              {/* Drag Handle (Mobile only) */}
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-3 sm:hidden shrink-0"></div>

              {/* Sheet Header */}
              <div className="bg-white border-b border-slate-50 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-50 p-2 rounded-xl">
                    {activeView === 'tickets' && <Ticket className="w-5 h-5 text-emerald-600" />}
                    {activeView === 'scan' && <QrCode className="w-5 h-5 text-emerald-600" />}
                    {activeView === 'tracking' && <Compass className="w-5 h-5 text-emerald-600" />}
                    {activeView === 'account' && <User className="w-5 h-5 text-emerald-600" />}
                    {activeView === 'simaksi' && <Mountain className="w-5 h-5 text-emerald-600" />}
                  </div>
                  <h3 className="font-black italic uppercase tracking-tight text-slate-800 text-sm sm:text-base">
                    {activeView === 'tickets' && 'TIKET & STATUS'}
                    {activeView === 'scan' && 'SCAN QR JALUR'}
                    {activeView === 'tracking' && 'TRACKING MONITOR'}
                    {activeView === 'account' && 'PROFIL SAYA'}
                    {activeView === 'simaksi' && 'DAFTAR SIMAKSI'}
                  </h3>
                </div>
                <button 
                  onClick={closePopup}
                  className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-100 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              {/* Sheet Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth">
                <div className="max-w-md mx-auto">
                   {activeView === 'tickets' && <UserTickets />}
                   {activeView === 'scan' && <UserScanner />}
                   {activeView === 'tracking' && <UserTracking />}
                   {activeView === 'simaksi' && <SubmitSimaksi />}
                   {activeView === 'account' && (
                     <ProfileSection
                       user={user}
                       updateUser={updateUser}
                       handleLogout={handleLogout}
                       copiedId={copiedId}
                       setCopiedId={setCopiedId}
                     />
                   )}
                </div>
              </div>
              
              {/* Sheet Footer Decoration */}
              <div className="h-6 bg-white shrink-0 sm:hidden"></div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Improved Bottom Nav */}
      <nav className="fixed bottom-4 left-4 right-4 bg-white/95 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] rounded-[2rem] border border-white/50 h-16 flex items-center justify-between z-[500] max-w-lg mx-auto px-2 sm:px-4 ring-1 ring-slate-200/50">
        {user.role === 'USER' ? (
          <>
            <NavButton 
              active={!activeView && location.pathname === '/'}
              onClick={() => setView('home')}
              icon={<Home className="w-5 h-5" />}
              label="Kabar"
            />
            <NavButton 
              active={activeView === 'tickets'}
              onClick={() => setView('tickets')}
              icon={<Ticket className="w-5 h-5" />}
              label="Tiket"
            />
            
            {/* Center Scan Button */}
            <div className="flex-1 flex justify-center -mt-6">
              <button 
                onClick={() => setView('scan')}
                className={`relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 group shadow-lg ${
                  activeView === 'scan' 
                  ? 'bg-emerald-600 shadow-emerald-200' 
                  : 'bg-slate-900 shadow-slate-400 active:scale-95 hover:bg-slate-800'
                }`}
              >
                <div className="absolute inset-0 bg-emerald-400 blur h-full w-full rounded-2xl opacity-0 group-hover:opacity-40 transition-opacity"></div>
                <QrCode className={`w-6 h-6 text-white relative z-10 ${activeView === 'scan' ? 'animate-pulse' : ''}`} />
                <span className={`absolute -bottom-6 text-[8px] font-black uppercase tracking-widest ${activeView === 'scan' ? 'text-emerald-600' : 'text-slate-400'}`}>SCAN</span>
              </button>
            </div>
            
            <NavButton 
              active={activeView === 'tracking'}
              onClick={() => setView('tracking')}
              icon={<Compass className="w-5 h-5" />}
              label="Jalur"
            />
            <NavButton 
              active={activeView === 'account'}
              onClick={() => setView('account')}
              icon={<User className="w-5 h-5" />}
              label="Akun"
            />
          </>
        ) : (
          <>
            <NavButton 
              active={location.pathname === '/'}
              onClick={() => navigate('/')}
              icon={<LayoutDashboard className="w-6 h-6" />}
              label="Dashboard"
            />
            <NavButton 
              active={location.pathname === '/scanner'}
              onClick={() => navigate('/scanner')}
              icon={<Scan className="w-6 h-6" />}
              label="Scanner"
            />
          </>
        )}
      </nav>
    </div>
  );
}

function ProfileSection({
  user,
  updateUser,
  handleLogout,
  copiedId,
  setCopiedId,
}: {
  user: any;
  updateUser: (data: any) => void;
  handleLogout: () => void;
  copiedId: boolean;
  setCopiedId: (v: boolean) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    name:           user.name || '',
    phone:          user.phone || '',
    emergencyPhone: user.emergencyPhone || '',
    weight:         user.weight || '',
    height:         user.height || '',
    address:        user.address || '',
    province:       user.province || '',
    city:           user.city || '',
    district:       user.district || '',
    subdistrict:    user.subdistrict || '',
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateUser({ avatar: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    updateUser(editData);
    setEditMode(false);
  };

  const handleCancel = () => {
    setEditData({
      name:           user.name || '',
      phone:          user.phone || '',
      emergencyPhone: user.emergencyPhone || '',
      weight:         user.weight || '',
      height:         user.height || '',
      address:        user.address || '',
      province:       user.province || '',
      city:           user.city || '',
      district:       user.district || '',
      subdistrict:    user.subdistrict || '',
    });
    setEditMode(false);
  };

  const initials = user.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'PD';

  const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#05D5FF]/20 focus:border-[#0399BF] transition-all';
  const phoneCls = 'flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#05D5FF]/20 focus-within:border-[#0399BF] transition-all';

  return (
    <div className="space-y-5 animate-in slide-in-from-bottom-4 duration-500">

      {/* ── PROFILE HEADER ── */}
      <div className="bg-gradient-to-br from-[#024F68] via-[#0399BF] to-[#05D5FF] p-7 rounded-[2.5rem] text-white text-center relative overflow-hidden shadow-xl">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <Mountain className="w-64 h-64 -ml-16 -mt-16" />
        </div>

        {/* Avatar */}
        <div className="relative z-10 inline-block mb-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative w-24 h-24 rounded-[2rem] overflow-hidden group border-2 border-white/30 shadow-xl block"
          >
            {user.avatar ? (
              <img src={user.avatar} alt="Foto profil" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                <span className="text-2xl font-black text-white">{initials}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
              <Camera className="w-7 h-7 text-white" />
            </div>
          </button>
          {/* camera badge */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-1 -right-1 bg-white text-[#0399BF] p-1.5 rounded-xl shadow-md border border-slate-100"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        <div className="relative z-10">
          <h4 className="text-xl font-black italic uppercase tracking-tight leading-none">{user.name}</h4>
          <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">{user.email}</p>
        </div>
      </div>

      {/* ── STATUS & ID ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 p-4 rounded-[2rem] border border-slate-100 shadow-sm">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Status</span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tight">PENDAKI AKTIF</span>
          </div>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText((user.id_pendaki || user.idPendaki || user.displayId || user.id).toUpperCase());
            setCopiedId(true);
            setTimeout(() => setCopiedId(false), 2500);
          }}
          className="bg-slate-50 hover:bg-slate-100 p-4 rounded-[2rem] border border-slate-100 shadow-sm text-left transition-all active:scale-[0.97] group flex flex-col justify-between w-full focus:outline-none"
        >
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">
            {copiedId ? 'Disalin!' : 'ID Pendaki'}
          </span>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${copiedId ? 'text-emerald-600' : 'text-slate-800'}`}>
              #{(user.id_pendaki || user.idPendaki || user.displayId || user.id).toUpperCase()}
            </span>
            {copiedId
              ? <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              : <Copy className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />}
          </div>
        </button>
      </div>

      {/* ── DATA PRIBADI ── */}
      <div className="bg-white rounded-[2.2rem] border border-slate-100 p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Profil Pribadi</h4>
          {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-1.5 text-[9px] font-black text-[#0399BF] uppercase tracking-widest hover:text-[#05D5FF] transition-colors"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
          ) : (
            <div className="flex gap-3">
              <button onClick={handleCancel} className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600">Batal</button>
              <button onClick={handleSave} className="text-[9px] font-black text-[#0399BF] uppercase tracking-widest hover:text-[#05D5FF]">Simpan</button>
            </div>
          )}
        </div>

        {editMode ? (
          <div className="space-y-3 text-left">
            {/* Nama */}
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Nama Lengkap</label>
              <input type="text" value={editData.name} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} className={inputCls} />
            </div>

            {/* Telepon */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">No. Telepon</label>
                <div className={phoneCls}>
                  <span className="px-2 py-2.5 text-[10px] font-black text-slate-500 bg-slate-100 border-r border-slate-200 shrink-0 select-none">+62</span>
                  <input
                    type="tel" inputMode="numeric"
                    value={editData.phone.replace(/^\+62/, '')}
                    onChange={e => setEditData(p => ({ ...p, phone: '+62' + e.target.value.replace(/[^0-9]/g, '').slice(0, 11) }))}
                    className="flex-1 bg-transparent py-2.5 px-2 text-xs font-bold text-slate-800 focus:outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Kontak Darurat</label>
                <div className={phoneCls}>
                  <span className="px-2 py-2.5 text-[10px] font-black text-slate-500 bg-slate-100 border-r border-slate-200 shrink-0 select-none">+62</span>
                  <input
                    type="tel" inputMode="numeric"
                    value={editData.emergencyPhone.replace(/^\+62/, '')}
                    onChange={e => setEditData(p => ({ ...p, emergencyPhone: '+62' + e.target.value.replace(/[^0-9]/g, '').slice(0, 11) }))}
                    className="flex-1 bg-transparent py-2.5 px-2 text-xs font-bold text-slate-800 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Fisik */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Berat (KG)</label>
                <input type="number" value={editData.weight} onChange={e => setEditData(p => ({ ...p, weight: e.target.value }))} className={inputCls} placeholder="65" />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Tinggi (CM)</label>
                <input type="number" value={editData.height} onChange={e => setEditData(p => ({ ...p, height: e.target.value }))} className={inputCls} placeholder="170" />
              </div>
            </div>

            {/* Alamat Wilayah */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Provinsi</label>
                <input type="text" value={editData.province} onChange={e => setEditData(p => ({ ...p, province: e.target.value }))} className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Kab / Kota</label>
                <input type="text" value={editData.city} onChange={e => setEditData(p => ({ ...p, city: e.target.value }))} className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Kecamatan</label>
                <input type="text" value={editData.district} onChange={e => setEditData(p => ({ ...p, district: e.target.value }))} className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Kelurahan / Desa</label>
                <input type="text" value={editData.subdistrict} onChange={e => setEditData(p => ({ ...p, subdistrict: e.target.value }))} className={inputCls} />
              </div>
            </div>

            {/* Alamat Jalan */}
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Alamat Lengkap</label>
              <textarea
                value={editData.address}
                onChange={e => setEditData(p => ({ ...p, address: e.target.value }))}
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#05D5FF]/20 focus:border-[#0399BF] resize-none transition-all"
              />
            </div>

            <button
              onClick={handleSave}
              className="w-full bg-gradient-to-r from-[#0399BF] to-[#05D5FF] text-white font-black py-3.5 rounded-2xl text-xs uppercase tracking-widest shadow-lg active:scale-[0.98] transition-all mt-1"
            >
              Simpan Perubahan
            </button>
          </div>
        ) : (
          <div className="space-y-4 text-left">
            <div className="grid grid-cols-2 gap-3.5 text-xs text-slate-700 font-semibold uppercase">
              <div>
                <span className="block text-[8px] text-slate-400 font-black">Kewarganegaraan</span>
                <span className="text-slate-800 font-extrabold">{user.citizenship || 'WNI'}</span>
              </div>
              <div>
                <span className="block text-[8px] text-slate-400 font-black">Identitas ({user.identityType || 'KTP'})</span>
                <span className="text-slate-800 font-extrabold font-mono text-[10px]">{user.nik || '-'}</span>
              </div>
              <div>
                <span className="block text-[8px] text-slate-400 font-black">Nomor Telepon</span>
                <span className="text-slate-800 font-extrabold">{user.phone || '-'}</span>
              </div>
              <div>
                <span className="block text-[8px] text-slate-400 font-black">Kontak Darurat</span>
                <span className="text-slate-800 font-extrabold">{user.emergencyPhone || '-'}</span>
              </div>
              <div>
                <span className="block text-[8px] text-slate-400 font-black">Fisik (BB / TB)</span>
                <span className="text-slate-800 font-extrabold">
                  {user.weight ? `${user.weight} KG` : '-'} / {user.height ? `${user.height} CM` : '-'}
                </span>
              </div>
              <div>
                <span className="block text-[8px] text-slate-400 font-black">Gender</span>
                <span className="text-slate-800 font-extrabold">{user.gender || '-'}</span>
              </div>
            </div>
            <div className="border-t border-slate-50 pt-3">
              <span className="block text-[8px] text-slate-400 font-black uppercase mb-1">Alamat Domisili KTP</span>
              <p className="font-extrabold text-slate-800 uppercase leading-relaxed text-[11px]">
                {user.address
                  ? `${user.address}, Kel. ${user.subdistrict || ''}, Kec. ${user.district || ''}, ${user.city || ''} (${user.province || ''})`
                  : '-'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── MENU BAWAH ── */}
      <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
        <button className="w-full p-5 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-50 active:bg-slate-100">
          <div className="flex items-center gap-4">
            <div className="bg-slate-100 p-2 rounded-xl">
              <ShieldCheck className="w-5 h-5 text-slate-600" />
            </div>
            <span className="text-xs font-black text-slate-700 uppercase tracking-tight">Pengaturan Keamanan</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </button>
        <button onClick={handleLogout} className="w-full p-5 flex items-center justify-between hover:bg-rose-50 transition-colors text-rose-500 group active:bg-rose-100">
          <div className="flex items-center gap-4">
            <div className="bg-rose-100 p-2 rounded-xl group-hover:bg-rose-200 transition-colors">
              <LogOut className="w-5 h-5 text-rose-600" />
            </div>
            <span className="text-xs font-black uppercase tracking-tight">Keluar Akun</span>
          </div>
          <ChevronRight className="w-4 h-4 text-rose-300 group-hover:text-rose-500" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-2 pt-2 pb-4">
        <p className="text-[9px] text-slate-300 font-bold uppercase tracking-[0.4em] italic">v{__APP_VERSION__} · SUMMITY</p>
        <div className="w-12 h-1 bg-slate-100 rounded-full" />
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-0.5 transition-all duration-300 relative py-1 rounded-xl focus:outline-none ${
        active ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-500'
      }`}
    >
      {active && (
        <motion.div 
          layoutId="activeNavIndicator"
          className="absolute -top-3 w-1.5 h-1.5 bg-emerald-600 rounded-full"
        />
      )}
      <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'scale-100'}`}>
        {icon}
      </div>
      <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-tight leading-none transition-all duration-300 ${active ? 'opacity-100' : 'opacity-70'}`}>
        {label}
      </span>
    </button>
  );
}
