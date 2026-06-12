import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { saveSimaksi, getSupabaseClient } from '../../lib/db';
import {
  Mountain,
  Calendar,
  ArrowRight,
  Compass,
  AlertCircle,
  Ticket,
  ShieldCheck,
  Plus,
  Trash2,
  Users,
  CheckSquare,
  Square
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function SubmitSimaksi() {
  const { user } = useAuth();
  const [, setSearchParams] = useSearchParams();
  
  const [climbSubmitted, setClimbSubmitted] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [memberIdInput, setMemberIdInput] = useState('');
  const [memberList, setMemberList] = useState<{ id: string; name: string }[]>([]);
  const [memberError, setMemberError] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const MANDATORY_ITEMS = [
    { id: 'TENDA_DOME', label: 'Tenda Dome (Sesuai Kapasitas)', category: 'Kelompok' },
    { id: 'KOMPOR_PORTABLE', label: 'Kompor Portable', category: 'Kelompok' },
    { id: 'NESTING', label: 'Nesting / Wadah Memasak', category: 'Kelompok' },
    { id: 'P3K', label: 'P3K & Obat-obatan', category: 'Kelompok' },
    { id: 'TRASH_BAG', label: 'Kantong Sampah / Trash Bag', category: 'Kelompok' },
    { id: 'HEADLAMP', label: 'Headlamp', category: 'Pribadi' },
    { id: 'JAKET_GUNUNG', label: 'Jaket Gunung', category: 'Pribadi' },
    { id: 'SEPATU_HIKING', label: 'Sepatu Hiking', category: 'Pribadi' },
    { id: 'SLEEPING_BAG', label: 'Sleeping Bag', category: 'Pribadi' },
    { id: 'RAINCOAT', label: 'Jas Hujan', category: 'Pribadi' },
  ];

  const [checkedGears, setCheckedGears] = useState<Record<string, boolean>>(
    Object.fromEntries(MANDATORY_ITEMS.map(item => [item.id, false]))
  );

  const [climbData, setClimbData] = useState({
    date: '',
    endDate: '',
  });

  const checkedCount = Object.values(checkedGears).filter(Boolean).length;
  const allGearChecked = checkedCount === MANDATORY_ITEMS.length;
  const canSubmit = !isLeader || allGearChecked;

  const handleAddMember = async () => {
    setMemberError('');
    const inputId = memberIdInput.trim().toUpperCase();
    if (!inputId) {
      setMemberError('Silakan masukkan ID Anggota yang valid');
      return;
    }

    const selfIds = [user?.id, (user as any)?.displayId, (user as any)?.id_pendaki, (user as any)?.idPendaki]
      .filter(Boolean)
      .map((v: any) => String(v).toUpperCase());
    if (selfIds.includes(inputId)) {
      setMemberError('Anda tidak bisa menambahkan ID Anda sendiri sebagai anggota kelompok');
      return;
    }

    if (memberList.some((m: any) => m.id.toUpperCase() === inputId)) {
      setMemberError('Anggota ini sudah ditambahkan ke dalam daftar kelompok');
      return;
    }

    // 1. Cek localStorage — tapi hanya pakai kalau ada nama
    let resolvedName: string | null = null;
    let resolvedId: string = inputId;
    try {
      const usersListStr = localStorage.getItem('summity_users_list');
      if (usersListStr) {
        const usersList = JSON.parse(usersListStr);
        const found = usersList.find((u: any) => {
          const ids = [u.id, u.displayId, u.id_pendaki, u.idPendaki]
            .filter(Boolean)
            .map((v: any) => String(v).toUpperCase());
          return ids.includes(inputId);
        });
        if (found?.name) {
          resolvedName = found.name;
          resolvedId = found.id_pendaki || found.idPendaki || found.displayId || found.id || inputId;
        }
      }
    } catch (_) {}

    // 2. Kalau nama tidak ada di localStorage, lookup ke Supabase
    if (!resolvedName) {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data } = await supabase
          .from('users')
          .select('id, name, id_pendaki')
          .eq('id_pendaki', inputId)
          .maybeSingle();
        if (data?.name) {
          resolvedName = data.name;
          resolvedId = data.id_pendaki || inputId;
        }
      }
    }

    if (resolvedName) {
      setMemberList([...memberList, { id: resolvedId, name: resolvedName }]);
      setMemberIdInput('');
    } else {
      setMemberError(`Pendaki dengan ID "${inputId}" tidak ditemukan.`);
    }
  };

  const handleRemoveMember = (indexToRemove: number) => {
    setMemberList(memberList.filter((_, idx) => idx !== indexToRemove));
  };

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

    if (!user) return;

    await saveSimaksi({
      ketuaUserId: user.id,
      ketuaName: user.name,
      gunungId: 1,
      tanggalNaik: climbData.date,
      tanggalTurun: climbData.endDate,
      status: 'pending',
      createdAt: new Date().toISOString(),
      members: isLeader ? memberList : [],
    });

    setClimbSubmitted(true);
    setTimeout(() => {
      setSearchParams({}); // Close popup
    }, 2500);
  };

  if (!user) return null;

  if (climbSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center relative px-4">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="bg-gradient-to-tr from-emerald-500/20 to-teal-500/5 p-8 rounded-[2.5rem] border border-emerald-500/20 mb-6"
        >
          <Ticket className="w-16 h-16 text-emerald-500 animate-pulse mx-auto" strokeWidth={1.5} />
        </motion.div>
        <h2 className="text-2xl font-black text-slate-800 mb-2 italic uppercase tracking-tight">SIMAKSI Terkirim!</h2>
        <p className="text-slate-400 mb-6 max-w-sm text-[10px] leading-relaxed uppercase tracking-wider font-extrabold text-center">
          Pengajuan SIMAKSI Anda dikirim. Status: <span className="text-amber-600">Menunggu Persetujuan</span> dari petugas.
        </p>
        <div className="flex items-center gap-2 text-amber-600 font-extrabold text-[9px] tracking-widest uppercase bg-amber-50 px-5 py-2.5 rounded-xl border border-amber-100/50 shadow-sm animate-pulse">
          <span className="w-2 h-2 rounded-full bg-amber-500 shadow-md"></span>
          MENUNGGU VERIFIKASI PETUGAS...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6 text-left">
      <div className="bg-emerald-50/40 border border-emerald-100/70 p-4 rounded-3xl space-y-2">
        <label className="text-[9px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
          <Compass className="w-4 h-4 text-emerald-500" />
          Destinasi Gunung & Pos Registrasi
        </label>
        <div className="relative">
          <Mountain className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
          <input 
            type="text"
            readOnly
            value="Gunung Slamet via Bambangan (3.428 mdpl)"
            className="w-full bg-white border border-emerald-100 rounded-xl py-2.5 pl-9 pr-3 text-emerald-800 font-black cursor-not-allowed text-xs focus:outline-none"
          />
        </div>
        <p className="text-[8px] text-emerald-700/80 font-bold italic leading-relaxed">
          * Jalur resmi terintegrasi dengan pemantauan pos 1 - 9 Bambangan.
        </p>
      </div>

      <div className="space-y-3">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-emerald-500" />
          Jadwal Naik & Estimasi Turun
        </label>
        
        <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-3xl flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
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
              className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 font-bold focus:outline-none focus:border-emerald-400 text-xs shadow-sm"
            />
          </div>

          <div className="text-slate-305 text-center hidden sm:block font-black text-xs pt-4">→</div>

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
              className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 font-bold focus:outline-none focus:border-emerald-400 text-xs shadow-sm"
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

      {/* Role selection toggle */}
      <div className="bg-emerald-50/10 border border-emerald-500/20 p-4 rounded-3xl text-left relative overflow-hidden transition-all hover:border-emerald-500/35">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input 
            type="checkbox"
            checked={isLeader}
            onChange={(e) => {
              setIsLeader(e.target.checked);
              if (formErrors.gear) setFormErrors({...formErrors, gear: ''});
            }}
            className="peer h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600 mt-0.5 shrink-0"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="block text-xs font-black text-slate-800 uppercase tracking-tight">Daftarkan Sebagai Ketua Rombongan</span>
              <span className="text-[7px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded leading-none">GRUP</span>
            </div>
            <span className="block text-[9px] text-slate-400 font-semibold leading-relaxed mt-1 uppercase tracking-wider">
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
            className="space-y-5 overflow-hidden"
          >
            {/* PROCEDURAL RESPONSIBLE LEADER SECTION */}
            <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-1.5 text-left relative overflow-hidden">
              <span className="text-[8px] font-black text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded uppercase tracking-wider inline-block leading-none">
                PROSEDUR KETUA BERTANGGUNG JAWAB
              </span>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5 mt-1">
                <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                Registrasi Terpadu Melalui Ketua Rombongan
              </h4>
              <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider leading-relaxed">
                Pendaftaran wajib dikoordinasikan oleh Ketua Rombongan yang bertanggung jawab penuh atas logistik, keselamatan seluruh anggota kelompok, dan validasi perlengkapan di basecamp.
              </p>
            </div>

            {/* MANAGE MEMBERS ROW */}
            <div className="bg-white border border-slate-150 p-4 rounded-3xl shadow-sm space-y-3.5 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-emerald-500" />
                    Tambah Anggota Rombongan
                  </h4>
                  <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Daftarkan anggota pendaki dengan NIK / ID Anggota unik mereka</p>
                </div>
                <span className="self-start sm:self-auto text-[7px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full leading-none shrink-0">
                  Min. 1 Anggota tambahan
                </span>
              </div>

              <div className="flex gap-2">
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
                  placeholder="ID Anggota (USER-XXXXXX)"
                  className="w-full sm:flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold font-mono focus:outline-none focus:bg-white focus:border-emerald-400 uppercase tracking-wider"
                />
                <button
                  type="button"
                  onClick={handleAddMember}
                  className="bg-slate-905 hover:bg-slate-800 font-black px-4 rounded-xl text-[10px] text-slate-900 border border-slate-250 bg-slate-100 hover:bg-slate-200 uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600" /> <span>Tambah</span>
                </button>
              </div>

              {memberError && (
                <p className="text-[9px] text-rose-500 font-bold ml-1 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {memberError}
                </p>
              )}

              {/* MEMBERS LIST */}
              {memberList.length > 0 ? (
                <div className="space-y-2 pt-2.5 border-t border-slate-100">
                  <div className="flex items-center justify-between text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">
                    <span>Daftar Anggota Kelompok</span>
                    <span className="text-emerald-600 font-black bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 leading-none">{memberList.length} Orang</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {memberList.map((member, index) => (
                      <div key={index} className="flex items-center justify-between bg-slate-50/50 border border-slate-150 rounded-xl p-2.5 text-xs">
                        <div className="flex items-center gap-2 truncate mr-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-700 font-black flex items-center justify-center text-xs shrink-0">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="text-left truncate">
                            <span className="block font-black text-slate-800 text-[10px] truncate uppercase tracking-tight">{member.name}</span>
                            <span className="text-[8px] text-slate-400 font-mono tracking-widest leading-none block">#{member.id}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(index)}
                          className="p-1.5 text-slate-350 hover:bg-rose-50 hover:text-rose-500 rounded-lg transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center p-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider leading-relaxed">
                    Belum ada anggota rombongan tambahan.<br/>
                    <span className="font-semibold text-[8px] text-slate-450 mt-1 block">
                      * Anggota Anda dapat melihat ID unik login pada banner profil kustom mereka, lalu bagikan ke Anda.
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* MANDATORY GEARS CHECKBOX LIST */}
            <div className="bg-emerald-50/10 border border-emerald-100 p-4 rounded-3xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-emerald-100/50 pb-2 text-left">
                <div>
                  <h4 className="text-xs font-black text-emerald-800 uppercase tracking-tight flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Perlengkapan Wajib Kelompok
                  </h4>
                  <p className="text-[8px] text-emerald-600 font-bold uppercase tracking-widest mt-0.5">Ketua harus memastikan semua perlengkapan berikut telah lengkap</p>
                </div>
                <div className="bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded leading-none">
                  {Object.values(checkedGears).filter(v => v).length} / {MANDATORY_ITEMS.length} Lengkap
                </div>
              </div>

              {/* Gears Grid List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
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
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all relative ${
                      checkedGears[item.id]
                        ? 'bg-emerald-50/20 border-emerald-300 text-emerald-950'
                        : 'bg-white border-slate-200 hover:bg-slate-55/40'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {checkedGears[item.id] ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div className="text-[10px] sm:text-[10.5px] leading-tight grow">
                      <span className={`block font-black text-[6.5px] uppercase tracking-wider leading-none mb-0.5 ${
                        item.category === 'Kelompok' ? 'text-blue-500' : 'text-amber-500'
                      }`}>
                        Bagian {item.category}
                      </span>
                      <span className={`font-bold block ${checkedGears[item.id] ? 'text-slate-500 line-through opacity-70' : 'text-slate-700'}`}>
                        {item.label}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pt-4 border-t border-slate-100 flex flex-col items-stretch justify-between gap-3 text-left">
        <p className="text-[8px] text-slate-400 font-extrabold uppercase tracking-widest leading-relaxed">
          * Pastikan profil medis & jadwal naik-turun Anda sudah sesuai aturan basecamp demi kelancaran check-in.
        </p>
        <button
          type="button"
          onClick={handleSIMAKSISubmit}
          disabled={!canSubmit}
          className={`font-black px-6 py-4 rounded-xl text-[10.5px] uppercase tracking-[0.15em] flex items-center justify-center gap-2 transition-all w-full ${
            canSubmit
              ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.97] text-white shadow-lg shadow-emerald-200/50'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          {canSubmit
            ? <>Kirim Rencana SIMAKSI <ArrowRight className="w-4 h-4" /></>
            : `Lengkapi Perlengkapan (${checkedCount}/${MANDATORY_ITEMS.length})`
          }
        </button>
      </div>
    </div>
  );
}
