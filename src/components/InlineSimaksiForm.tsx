import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { saveRegistration } from '../lib/db';
import { 
  Mountain, 
  Calendar, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  Users, 
  AlertCircle, 
  Check, 
  Sparkles, 
  Terminal 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface InlineSimaksiFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function InlineSimaksiForm({ onSuccess, onCancel }: InlineSimaksiFormProps) {
  const { user } = useAuth();
  
  const [climbSubmitted, setClimbSubmitted] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [memberIdInput, setMemberIdInput] = useState('');
  const [memberList, setMemberList] = useState<{ id: string; name: string }[]>([]);
  const [memberError, setMemberError] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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
    { id: 'tenda', label: 'Tenda Dome (Sesuai Kapasitas)', category: 'Kelompok' },
    { id: 'kompor', label: 'Kompor Portable', category: 'Kelompok' },
    { id: 'nesting', label: 'Nesting / Wadah Memasak', category: 'Kelompok' },
    { id: 'p3k', label: 'P3K & Obat-obatan', category: 'Kelompok' },
    { id: 'trash_bag', label: 'Kantong Sampah / Trash Bag', category: 'Kelompok' },
    { id: 'sleeping_bag', label: 'Sleeping Bag (Pribadi)', category: 'Pribadi' },
    { id: 'matras', label: 'Matras Alas Tidur (Pribadi)', category: 'Pribadi' },
    { id: 'jaket', label: 'Jaket Gunung Tebal (Pribadi)', category: 'Pribadi' },
    { id: 'jas_hujan', label: 'Jas Hujan / Ponco (Pribadi)', category: 'Pribadi' },
    { id: 'air', label: 'Air Cadangan Min. 3 Liter (Pribadi)', category: 'Pribadi' },
    { id: 'senter', label: 'Senter & Baterai Cadangan (Pribadi)', category: 'Pribadi' }
  ];

  const [climbData, setClimbData] = useState({
    mountain: 'Gn. Slamet via Bambangan',
    date: '',
    endDate: '',
  });

  const handleAddMember = () => {
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

    // Lookup user in summity_users_list from localStorage
    try {
      const usersListStr = localStorage.getItem('summity_users_list');
      let foundUser = null;
      if (usersListStr) {
        const usersList = JSON.parse(usersListStr);
        foundUser = usersList.find((u: any) => {
          const uId = String(u.id || '').toUpperCase();
          const uDisplay = String(u.id_pendaki || u.idPendaki || u.displayId || '').toUpperCase();
          return uId === inputId || uDisplay === inputId;
        });
      }
      
      if (foundUser) {
        setMemberList([...memberList, { id: foundUser.id_pendaki || foundUser.idPendaki || foundUser.displayId || foundUser.id, name: foundUser.name }]);
        setMemberIdInput('');
      } else {
        // Fallback for demo or user simplicity if not found exactly
        setMemberList([...memberList, { id: inputId, name: `Pendaki #${inputId}` }]);
        setMemberIdInput('');
      }
    } catch (e) {
      setMemberList([...memberList, { id: inputId, name: `Pendaki #${inputId}` }]);
      setMemberIdInput('');
    }
  };

  const handleRemoveMember = (idx: number) => {
    setMemberList(memberList.filter((_, i) => i !== idx));
  };

  const handleToggleGear = (id: string) => {
    setCheckedGears(prev => ({ ...prev, [id]: !prev[id] }));
  };

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

    // Ensure all mandatory items are checked
    const allGearsChecked = Object.values(checkedGears).every(val => val === true);
    if (!allGearsChecked) {
      setFormErrors({ gear: 'Semua barang bawaan wajib dicentang demi kelayakan keselamatan!' });
      return;
    }

    if (!user) return;

    const finalIdPendaki = (user as any)?.id_pendaki || (user as any)?.idPendaki || (user as any)?.displayId || user.id;

    await saveRegistration({
      userId: user.id,
      name: user.name,
      email: user.email,
      nik: user.nik || '',
      phone: user.phone || '',
      emergencyPhone: user.emergencyPhone || '',
      birthDate: '1995-01-01',
      gender: user.gender || 'Laki-laki',
      address: `${user.address || ''}, ${user.subdistrict || ''}, ${user.district || ''}, ${user.city || ''}, ${user.province || ''}`,
      mountain: climbData.mountain,
      date: climbData.date,
      endDate: climbData.endDate,
      status: 'APPROVED',
      createdAt: new Date().toISOString(),
      isLeader: isLeader,
      members: isLeader ? memberList : [],
      checkedGears: Object.keys(checkedGears).filter(k => checkedGears[k])
    } as any);

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
          Rencana pendakian Anda telah disetujui otomatis secara seketika. Tiket aktif Anda sekarang tersedia.
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
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
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

        {/* Ketua / Anggota Section */}
        <div className="border border-slate-150 p-4 rounded-2xl space-y-3 bg-slate-50/50">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input 
              type="checkbox"
              checked={isLeader}
              onChange={(e) => setIsLeader(e.target.checked)}
              className="peer h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
            />
            <div>
              <span className="block text-[11px] font-black text-slate-805 uppercase tracking-tight">Daftarkan Sebagai Ketua Rombongan</span>
              <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Membawa anggota tim pendakian tambahan</span>
            </div>
          </label>

          {isLeader && (
            <div className="space-y-3 pt-3 border-t border-slate-150 animate-in slide-in-from-top-2 duration-305">
              <span className="block text-[8px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-1">
                <Users className="w-3 h-3 text-emerald-600" /> Tambah Anggota Rombongan
              </span>
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={memberIdInput}
                  onChange={(e) => setMemberIdInput(e.target.value)}
                  placeholder="ID PENDAKI (U-XXXX)"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold font-mono uppercase focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAddMember}
                  className="bg-slate-900 text-white font-black px-4 rounded-xl text-[9px] uppercase tracking-widest hover:bg-slate-800 active:scale-95 transition-all text-center flex items-center justify-center"
                >
                  Tambah
                </button>
              </div>
              {memberError && (
                <p className="text-[8px] text-rose-500 font-bold ml-1 flex items-center gap-1">
                  <AlertCircle className="w-3 w-3" /> {memberError}
                </p>
              )}

              {/* Members List */}
              {memberList.length > 0 ? (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {memberList.map((member, index) => (
                    <div key={index} className="flex items-center justify-between bg-white border border-slate-150 rounded-xl p-2 text-[10px]">
                      <div>
                        <span className="font-extrabold text-slate-850 uppercase">{member.name}</span>
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
            </div>
          )}
        </div>

        {/* Barang Barang Yang Wajib Dibawa */}
        <div className="border border-emerald-100 bg-emerald-50/10 p-4 rounded-2xl space-y-3 text-left">
          <div className="flex items-center gap-1.5 border-b border-emerald-100/40 pb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <div>
              <h4 className="text-[10px] font-black text-emerald-800 uppercase tracking-tight">Barat Wajib (Aspek Keselamatan)</h4>
              <p className="text-[7.5px] text-emerald-500 font-bold uppercase tracking-wider leading-none mt-0.5">Semua checklist logistik wajib harus dicentang</p>
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
            <p className="text-[8px] text-rose-500 font-bolder text-center uppercase tracking-wider mt-1 font-black">
              {formErrors.gear}
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="w-full bg-emerald-600 text-white font-black text-xs py-3.5 rounded-2xl uppercase tracking-widest shadow-lg shadow-emerald-50 hover:bg-emerald-700 transition-all active:scale-95"
        >
          Konfirmasi SIMAKSI Seketika
        </button>
      </div>
    </form>
  );
}
