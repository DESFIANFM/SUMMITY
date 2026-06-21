import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { saveSimaksi, getSupabaseClient } from '../lib/db';
import {
  Mountain,
  Calendar,
  Plus,
  Trash2,
  ShieldCheck,
  Users,
  AlertCircle,
  Check,
} from 'lucide-react';

interface InlineSimaksiFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

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

const initialGears = Object.fromEntries(MANDATORY_ITEMS.map(item => [item.id, false]));

export default function InlineSimaksiForm({ onSuccess, onCancel }: InlineSimaksiFormProps) {
  const { user } = useAuth();

  const [climbSubmitted, setClimbSubmitted] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [memberIdInput, setMemberIdInput] = useState('');
  const [memberList, setMemberList] = useState<{ id: string; name: string }[]>([]);
  const [memberError, setMemberError] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [checkedGears, setCheckedGears] = useState<Record<string, boolean>>(initialGears);

  const [climbData, setClimbData] = useState({
    date: '',
    endDate: '',
  });

  const handleAddMember = async () => {
    setMemberError('');
    const inputId = memberIdInput.trim().toUpperCase();
    if (!inputId) {
      setMemberError('Silakan masukkan ID Pendaki yang valid');
      return;
    }

    const loggedInId = ((user as any)?.id_pendaki || (user as any)?.idPendaki || (user as any)?.displayId || user?.id || '').toUpperCase();
    if (inputId === loggedInId) {
      setMemberError('Anda adalah ketua kelompok. Tidak perlu menambahkan ID Anda sendiri sebagai anggota.');
      return;
    }

    if (memberList.some(m => m.id.toUpperCase() === inputId)) {
      setMemberError('Pendaki dengan ID ini sudah ditambahkan ke kelompok.');
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

  const handleRemoveMember = (idx: number) => {
    setMemberList(memberList.filter((_, i) => i !== idx));
  };

  const handleToggleGear = (id: string) => {
    setCheckedGears(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const checkedCount = Object.values(checkedGears).filter(Boolean).length;
  const allGearChecked = checkedCount === MANDATORY_ITEMS.length;
  const canSubmit = !isLeader || allGearChecked;

  const handleSubmit = async (e: React.FormEvent) => {
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
      setFormErrors({ endDate: 'Tanggal turun tidak boleh mendahului tanggal naik' });
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
      onSuccess();
    }, 2000);
  };

  if (climbSubmitted) {
    return (
      <div className="bg-white rounded-[2.5rem] border border-emerald-100 p-8 text-center shadow-xl shadow-emerald-50 max-w-md mx-auto space-y-4 animate-in fade-in duration-500">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 animate-bounce">
          <Check className="w-8 h-8" />
        </div>
        <h3 className="font-black italic uppercase text-lg text-slate-800 tracking-tight">SIMAKSI Berhasil Terdaftar!</h3>
        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
          Pengajuan SIMAKSI Anda dikirim. Status: <span className="text-amber-600">Menunggu Persetujuan</span>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] border border-slate-100 p-5 sm:p-6 shadow-xl shadow-slate-100">
      <div className="flex items-center justify-between border-b border-slate-50 pb-4 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="bg-emerald-50 p-2 rounded-xl">
            <Mountain className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-black italic uppercase tracking-tight text-slate-800 text-sm sm:text-base">Pendaftaran SIMAKSI</h3>
            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-0.5">Formulir Pendakian Resmi</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-[10px] font-black text-rose-500 tracking-widest uppercase hover:underline"
        >
          Batal
        </button>
      </div>

      <div className="space-y-4">
        {/* Destination Info */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <span className="block text-[8px] text-slate-400 font-black uppercase tracking-widest mb-1.5">TUJUAN GUNUNG</span>
          <div className="flex items-center gap-2 text-slate-800 font-extrabold text-xs uppercase italic">
            <Mountain className="w-4 h-4 text-emerald-600" />
            <span>Gunung Slamet via Bambangan (3.428 mdpl)</span>
          </div>
        </div>

        {/* Tanggal Pendakian */}
        <div>
          <span className="block text-[8px] text-slate-400 font-black uppercase tracking-widest mb-2.5 ml-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Tanggal Pendakian
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <div>
              <label className="block text-[7px] text-slate-400 font-black uppercase tracking-widest mb-1.5">Tanggal Naik</label>
              <input
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                value={climbData.date}
                onChange={(e) => {
                  setClimbData({ ...climbData, date: e.target.value });
                  if (formErrors.date) setFormErrors({ ...formErrors, date: '' });
                }}
                className="w-full bg-white border border-slate-150 rounded-xl py-2 px-2 text-[11px] font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[7px] text-slate-400 font-black uppercase tracking-widest mb-1.5">Tanggal Turun</label>
              <input
                type="date"
                required
                min={climbData.date || new Date().toISOString().split('T')[0]}
                value={climbData.endDate}
                onChange={(e) => {
                  setClimbData({ ...climbData, endDate: e.target.value });
                  if (formErrors.endDate) setFormErrors({ ...formErrors, endDate: '' });
                }}
                className="w-full bg-white border border-slate-150 rounded-xl py-2 px-2 text-[11px] font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          {formErrors.date && <p className="text-[8px] text-rose-500 font-bold mt-1 ml-1">*{formErrors.date}</p>}
          {formErrors.endDate && <p className="text-[8px] text-rose-500 font-bold mt-1 ml-1">*{formErrors.endDate}</p>}
        </div>

        {/* Ketua toggle */}
        <div className="border border-slate-150 p-4 rounded-2xl space-y-3 bg-slate-50/50">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isLeader}
              onChange={(e) => {
                setIsLeader(e.target.checked);
                if (!e.target.checked) setCheckedGears(initialGears);
              }}
              className="peer h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
            />
            <div>
              <span className="block text-[11px] font-black text-slate-800 uppercase tracking-tight">Daftarkan Sebagai Ketua Rombongan</span>
              <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Membawa anggota tim pendakian tambahan</span>
            </div>
          </label>

          {isLeader && (
            <div className="space-y-3 pt-3 border-t border-slate-150 animate-in slide-in-from-top-2 duration-300">
              {/* Tambah Anggota */}
              <span className="block text-[8px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-1">
                <Users className="w-3 h-3 text-emerald-600" /> Tambah Anggota Rombongan
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={memberIdInput}
                  onChange={(e) => setMemberIdInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddMember(); } }}
                  placeholder="ID PENDAKI (U-XXXX)"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold font-mono uppercase focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAddMember}
                  className="bg-slate-900 text-white font-black px-4 rounded-xl text-[9px] uppercase tracking-widest hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              {memberError && (
                <p className="text-[8px] text-rose-500 font-bold ml-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {memberError}
                </p>
              )}

              {memberList.length > 0 ? (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {memberList.map((member, index) => (
                    <div key={index} className="flex items-center justify-between bg-white border border-slate-150 rounded-xl p-2 text-[10px]">
                      <div>
                        <span className="font-extrabold text-slate-800 uppercase">{member.name}</span>
                        <span className="text-[8px] text-slate-400 font-mono uppercase ml-2">#{member.id}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(index)}
                        className="text-rose-500 hover:bg-rose-50 p-1 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[8px] text-slate-400 font-bold text-center py-2 border border-dashed border-slate-200 rounded-xl">
                  Silakan masukkan ID Pendaki anggota Anda.
                </p>
              )}

              {/* Checklist Gear — hanya untuk ketua */}
              <div className="border border-emerald-100 bg-emerald-50/10 p-4 rounded-2xl space-y-3 text-left">
                <div className="flex items-center gap-1.5 border-b border-emerald-100/40 pb-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <div>
                    <h4 className="text-[10px] font-black text-emerald-800 uppercase tracking-tight">Perlengkapan Wajib Kelompok</h4>
                    <p className="text-[7.5px] text-emerald-500 font-bold uppercase tracking-wider leading-none mt-0.5">
                      Ketua wajib memastikan seluruh perlengkapan tersedia
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                  {MANDATORY_ITEMS.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleToggleGear(item.id)}
                      className={`flex items-start gap-2.5 p-2 rounded-xl border text-[10px] font-bold cursor-pointer transition-all select-none ${
                        checkedGears[item.id]
                          ? 'bg-emerald-50 bg-opacity-40 border-emerald-200 text-emerald-800'
                          : 'bg-white border-slate-150 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checkedGears[item.id] || false}
                        readOnly
                        className="peer h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 accent-emerald-600 mt-0.5 pointer-events-none"
                      />
                      <div className="flex-1 flex justify-between gap-2">
                        <span className="uppercase">{item.label}</span>
                        <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded leading-none ${
                          item.category === 'Kelompok' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {item.category}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {formErrors.gear && (
                  <p className="text-[8px] text-rose-500 font-black text-center uppercase tracking-wider mt-1">
                    {formErrors.gear}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit}
          className={`w-full font-black text-xs py-3.5 rounded-2xl uppercase tracking-widest transition-all ${
            canSubmit
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-50 hover:bg-emerald-700 active:scale-95'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          {canSubmit
            ? 'Kirim Pengajuan SIMAKSI'
            : `Lengkapi Perlengkapan (${checkedCount}/${MANDATORY_ITEMS.length})`
          }
        </button>
      </div>
    </form>
  );
}
