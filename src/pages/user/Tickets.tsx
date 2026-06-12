import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { MOCK_TICKETS } from '../../lib/mockData';
import { getAllRegistrations, deleteRegistration } from '../../lib/db';
import { RegistrationRequest } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Calendar, MapPin, QrCode, PlusCircle, Clock, AlertCircle, Trash2, Camera, Users, ShieldCheck } from 'lucide-react';
import { formatDateRange } from '../../lib/formatters';

export default function UserTickets() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [registrations, setRegistrations] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchRegistrations = async () => {
      const regs = await getAllRegistrations();
      // Filter by current user and sort newest first
      const userRegs = regs
        .filter(r => r.userId === user?.id || (r.members && r.members.some((m: any) => m.id.toUpperCase() === user?.id?.toUpperCase())))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
      setRegistrations(userRegs);
      setLoading(false);
    };
    fetchRegistrations();
    const interval = setInterval(fetchRegistrations, 3000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // Find the single best active registration (the one that owns the ticket UI)
  const approvedReg = registrations.find(r => r.status === 'APPROVED');
  const pendingReg = registrations.find(r => r.status === 'PENDING');
  const rejectedReg = registrations.find(r => r.status === 'REJECTED');
  
  const featuredReg = approvedReg || pendingReg || rejectedReg;
  
  const handleDelete = async (id: number) => {
    if (confirm('Batalkan dan hapus registrasi ini?')) {
      await deleteRegistration(id);
    }
  };

  const activeTicket = featuredReg ? {
    id: `TICK-${featuredReg.id}`,
    mountainName: featuredReg.mountain,
    date: featuredReg.date,
    endDate: featuredReg.endDate,
    status: featuredReg.status,
    qrCode: `SUMMITY-USER-${featuredReg.id}`
  } : null;

  if (loading) return (
    <div className="min-h-[30vh] flex flex-col items-center justify-center p-10 text-center">
      <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Memuat Tiket...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Other Registrations List */}
      {registrations.filter(r => r.id !== featuredReg?.id).map(reg => (
        <div key={reg.id} className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-6 flex items-center justify-between shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-400 group-last:bg-rose-400"></div>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${
              reg.status === 'PENDING' ? 'bg-amber-100 text-amber-600' : (reg.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600')
            }`}>
              {reg.status === 'PENDING' ? <Clock className="w-6 h-6 animate-pulse" /> : (reg.status === 'APPROVED' ? <QrCode className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />)}
            </div>
            <div>
              <h4 className="font-black text-slate-800 leading-none mb-1 uppercase tracking-tighter italic">{reg.mountain}</h4>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">
                {formatDateRange(reg.date, reg.endDate)}
              </p>
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                  reg.status === 'PENDING' ? 'bg-amber-50 text-amber-600' : (reg.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')
                }`}>
                  {reg.status === 'PENDING' ? 'MENUNGGU KONFIRMASI' : (reg.status === 'APPROVED' ? 'DISETUJUI' : 'REGISTRASI DITOLAK')}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {reg.status === 'REJECTED' && (
              <button 
                onClick={() => setSearchParams({ view: 'simaksi' })}
                className="bg-slate-900 text-white text-[8px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest"
              >
                Daftar Lagi
              </button>
            )}
            <button 
              onClick={() => reg.id && handleDelete(reg.id)}
              className="p-3 bg-slate-50 text-slate-300 hover:bg-rose-50 hover:text-rose-500 rounded-2xl transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      {/* Ticket Card (Show either approved reg or mock) */}
      {!activeTicket && registrations.filter(r => r.status === 'PENDING').length > 0 && (
        <div className="bg-slate-50 border border-slate-100 rounded-3xl p-10 text-center space-y-4">
           <div className="bg-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <Clock className="w-8 h-8 text-amber-500 animate-spin" style={{ animationDuration: '3s' }} />
           </div>
           <div className="space-y-1">
             <h3 className="font-black text-slate-800 italic uppercase">Sedang Diverifikasi</h3>
             <p className="text-xs text-slate-400 font-medium max-w-[200px] mx-auto">Petugas sedang memeriksa data registrasi Anda. Tiket akan muncul otomatis jika disetujui.</p>
           </div>
        </div>
      )}

      {/* Empty State when no registrations and no mock (unlikely due to initial state) */}
      {registrations.length === 0 && !activeTicket && (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
          <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <PlusCircle className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-slate-400 font-bold mb-6 italic">Belum ada SIMAKSI</p>
          <button 
            onClick={() => setSearchParams({ view: 'simaksi' })}
            className="bg-slate-900 text-white font-black px-6 py-4 rounded-2xl text-xs uppercase tracking-widest"
          >
            Mulai Registrasi
          </button>
        </div>
      )}

      {/* Ticket Card (Show either approved reg or mock) */}
      {activeTicket && (
        <div className="bg-white rounded-[2rem] sm:rounded-3xl shadow-xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300">
          <div className="bg-emerald-700 p-5 sm:p-6 text-white relative">
            <h3 className="text-lg sm:text-xl font-bold mb-0.5 sm:mb-1">{activeTicket.mountainName}</h3>
            <p className="text-emerald-100 text-[10px] sm:text-sm flex items-center gap-1 opacity-80">
              <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              Jalur pendakian resmi
            </p>
          </div>

          <div className="p-6 sm:p-8 flex flex-col items-center">
            <div className="bg-slate-50 p-4 sm:p-6 rounded-[2rem] mb-5 sm:mb-6 shadow-inner border border-slate-100">
              <QRCodeSVG 
                value={activeTicket.qrCode} 
                size={140}
                className="w-28 h-28 sm:w-36 sm:h-36"
                level="H"
                includeMargin={true}
              />
            </div>
            
            <div className="text-center mb-6">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">KODE TIKET</div>
              <div className="text-lg sm:text-xl font-mono font-bold text-slate-800">{activeTicket.id}</div>
              <div className="mt-1.5 flex justify-center">
                <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                  activeTicket.status === 'APPROVED'
                    ? 'bg-emerald-100 text-emerald-700'
                    : activeTicket.status === 'PENDING'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-rose-100 text-rose-700'
                }`}>
                  {activeTicket.status === 'APPROVED'
                    ? 'DISETUJUI / AKTIF'
                    : activeTicket.status === 'PENDING'
                    ? 'MENUNGGU VERIFIKASI'
                    : 'DITOLAK'}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full mb-6 max-w-xs">
              <button 
                onClick={() => setSearchParams({ view: 'scan' })}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 sm:py-4 rounded-2xl shadow-xl shadow-emerald-100 flex items-center justify-center gap-2 sm:gap-3 transition-all active:scale-[0.98] text-xs sm:text-sm"
              >
                <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
                SCANNER POS JALUR
              </button>
            </div>

            <div className="w-full pt-5 border-t border-slate-100 space-y-4">
              <div className="flex items-center gap-3">
                <div className="bg-slate-100 p-2 rounded-xl">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
                </div>
                <div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Jadwal Pendakian</div>
                  <div className="text-xs sm:text-sm font-bold text-slate-700 italic">
                    {formatDateRange(activeTicket.date, activeTicket.endDate)}
                  </div>
                </div>
              </div>

              {/* Group & Role Information */}
              <div className="bg-slate-50/70 rounded-2xl p-4.5 border border-slate-100/80 space-y-3.5 text-left w-full">
                <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight">Status Rombongan</span>
                  </div>
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
                    featuredReg?.userId === user?.id 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : (featuredReg?.members?.some((m: any) => m.id.toUpperCase() === user?.id?.toUpperCase()) 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-slate-200 text-slate-600')
                  }`}>
                    {featuredReg?.userId === user?.id 
                      ? 'Ketua Kelompok' 
                      : (featuredReg?.members?.some((m: any) => m.id.toUpperCase() === user?.id?.toUpperCase()) 
                          ? 'Anggota Kelompok' 
                          : 'Solo Climber')}
                  </span>
                </div>

                {featuredReg?.isLeader ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <span className="block text-[8px] text-slate-400 font-extrabold uppercase tracking-wider">Anggota Terdaftar ({featuredReg.members?.length || 0} Orang):</span>
                      {featuredReg.members && featuredReg.members.length > 0 ? (
                        <div className="grid grid-cols-1 gap-1.5 max-h-32 overflow-y-auto pr-0.5">
                          {featuredReg.members.map((m: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between bg-white border border-slate-100 rounded-xl px-2.5 py-1.5 text-[10px]">
                              <span className="font-extrabold text-slate-805 uppercase">{m.name}</span>
                              <span className="font-mono text-[8px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">ID: {m.id}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 block">Belum ada anggota rombongan ditambahkan.</span>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-200/40 flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1 text-slate-500 font-bold">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Kesiapan Alat Wajib</span>
                      </div>
                      <span className="font-mono font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        {featuredReg.checkedGears?.length || 0} / 11 Alat Siap
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[9px] text-slate-450 font-bold tracking-normal leading-normal italic">
                    * Terdaftar sebagai pendaki tunggal. Perlengkapan wajib diperiksa secara mandiri di pos registrasi sebelum mendaki.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 p-4 border-t border-emerald-100">
            <p className="text-[10px] sm:text-[11px] text-emerald-800 leading-relaxed font-medium italic">
              * Tunjukkan QR Code ini di setiap POS pemeriksaan jalur.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
