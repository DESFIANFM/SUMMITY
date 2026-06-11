import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAllScans, getAllRegistrations } from '../../lib/db';
import { MOUNTAIN_POS } from '../../lib/mockData';
import { ScanLog, RegistrationRequest } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { 
  CloudRain, 
  Sun, 
  Wind, 
  CircleCheck, 
  CircleX, 
  ShieldAlert, 
  TrendingUp, 
  Info,
  Calendar,
  ChevronRight,
  MapPin,
  AlertTriangle,
  ArrowRight,
  Ticket
} from 'lucide-react';
import { formatDateRange } from '../../lib/formatters';

export default function UserDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [totalActive, setTotalActive] = useState(0);
  const [hikerData, setHikerData] = useState<{ ascent: number, descent: number }>({ ascent: 0, descent: 0 });
  const [activeTicket, setActiveTicket] = useState<RegistrationRequest | null>(null);
  
  useEffect(() => {
    const fetchData = async () => {
      const scans = (await getAllScans()) as ScanLog[];
      const regs = await getAllRegistrations();
      
      const userRegs = regs.filter(r => 
        r.userId === user?.id || 
        (r.members && r.members.some((m: any) => m.id.toUpperCase() === user?.id?.toUpperCase()))
      );
      
      // Sort userRegs by createdAt descending to get newest first reliably
      const sortedUserRegs = [...userRegs].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      // Look for the most relevant ticket status
      const latestTicket = sortedUserRegs.find(r => r.status === 'APPROVED') 
        || sortedUserRegs.find(r => r.status === 'PENDING')
        || sortedUserRegs.find(r => r.status === 'REJECTED');
        
      setActiveTicket(latestTicket || null);

      const latestScansByTicket: Record<string, { type: string; direction: 'ASCENT' | 'DESCENT' }> = {};
      const sortedScans = [...scans].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const ticketPeaks: Record<string, boolean> = {};

      sortedScans.forEach(scan => {
        if (!scan.ticketId) return;
        if (scan.posId === MOUNTAIN_POS.length - 1) ticketPeaks[scan.ticketId] = true;
        const isDescent = ticketPeaks[scan.ticketId] && scan.posId! < MOUNTAIN_POS.length - 1;
        
        latestScansByTicket[scan.ticketId] = { 
          type: scan.type || 'POST_CHECK',
          direction: isDescent ? 'DESCENT' : 'ASCENT'
        };
      });

      let ascent = 0;
      let descent = 0;
      Object.values(latestScansByTicket).forEach(status => {
        if (status.type !== 'CHECK_OUT') {
          if (status.direction === 'ASCENT') ascent++;
          else descent++;
        }
      });
      
      setHikerData({ ascent, descent });
      setTotalActive(ascent + descent);
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const mountainStatus = "OPEN"; // Mock status
  const weather = {
    temp: "22°C",
    condition: "Cerah Berawan",
    icon: <Sun className="w-8 h-8 text-amber-400" />,
    wind: "12 km/h"
  };

  const rules = [
    { title: "Bawa Turun Sampah", desc: "Denda Rp 500.000 jika melanggar" },
    { title: "Dilarang Membawa Tisu Basah", desc: "Demi menjaga ekosistem" },
    { title: "Gunakan Perlengkapan Standar", desc: "Sepatu gunung & sleeping bag wajib" },
    { title: "Dilarang Membuat Api Unggun", desc: "Gunakan kompor portable" }
  ];

  return (
    <div className="space-y-6 pb-4">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 italic uppercase leading-none">Beranda Kabar</h2>
          <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 sm:mt-2">Info Terkini Jalur Pendakian</p>
        </div>
        <div className={`self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${mountainStatus === 'OPEN' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-600'}`}>
          {mountainStatus === 'OPEN' ? <CircleCheck className="w-3.5 h-3.5" /> : <CircleX className="w-3.5 h-3.5" />}
          <span className="text-[9px] font-black uppercase tracking-widest">Jalur {mountainStatus === 'OPEN' ? 'Dibuka' : 'Ditutup'}</span>
        </div>
      </div>

      {/* Weather & Active Counter */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-[2.5rem] shadow-xl shadow-slate-100 border border-slate-50 relative overflow-hidden group transition-all active:scale-[0.98]">
          <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            {weather.icon}
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <span className="text-xl sm:text-2xl font-black text-slate-800 tracking-tighter">{weather.temp}</span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{weather.condition}</p>
            <div className="flex items-center gap-1 mt-2 text-[8px] font-black text-slate-300 uppercase">
              <Wind className="w-3 h-3" /> {weather.wind}
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-4 sm:p-5 rounded-[2.5rem] shadow-xl shadow-slate-200 border border-slate-800 relative overflow-hidden transition-all active:scale-[0.98]">
          <div className="absolute -bottom-2 -right-2 opacity-20">
            <TrendingUp className="w-16 h-16 text-emerald-400" />
          </div>
          <div className="relative z-10">
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 mb-1 leading-none">{totalActive}</div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Pendaki Jalur</p>
            <div className="flex gap-2 mt-3 sm:mt-4">
              <span className="text-[8px] font-black bg-emerald-400/10 text-emerald-400 px-1.5 py-0.5 rounded-lg">↑ {hikerData.ascent}</span>
              <span className="text-[8px] font-black bg-blue-400/10 text-blue-400 px-1.5 py-0.5 rounded-lg">↓ {hikerData.descent}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action CTA */}
      {activeTicket ? (
        <div className="bg-white p-5 sm:p-6 rounded-[2.5rem] border border-emerald-100 shadow-xl shadow-emerald-50/50 space-y-4 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-32 h-32 bg-emerald-50 rounded-full blur-2xl opacity-50"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-emerald-100 p-2 sm:p-3 rounded-2xl">
                <Ticket className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-black italic uppercase text-slate-800 leading-none mb-1 text-sm sm:text-base">Tiket Saya</h3>
                <span className={`text-[8px] sm:text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                  activeTicket.status === 'APPROVED' ? 'bg-emerald-500 text-white shadow-sm' : 
                  activeTicket.status === 'REJECTED' ? 'bg-rose-500 text-white' : 'bg-amber-100 text-amber-700'
                }`}>
                  {activeTicket.status === 'APPROVED' ? 'SIAP BERANGKAT' : 
                   activeTicket.status === 'REJECTED' ? 'DITOLAK / BATAL' : 'MENUNGGU KONFIRMASI'}
                </span>
              </div>
            </div>
            {activeTicket.status === 'APPROVED' && (
              <button 
                onClick={() => setSearchParams({ view: 'tickets' })}
                className="bg-emerald-600 text-white text-[8px] font-black px-3 sm:px-4 py-2 rounded-xl shadow-lg shadow-emerald-200 animate-bounce"
              >
                LIHAT TIKET
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-2 relative z-10">
            <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-100/50">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Gunung Tujuan</p>
              <p className="font-black text-slate-800 text-[10px] sm:text-xs italic uppercase leading-tight truncate">{activeTicket.mountain}</p>
            </div>
            <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-100/50">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Jadwal</p>
              <p className="font-black text-slate-800 text-[9px] sm:text-[10px] italic uppercase leading-tight">
                {formatDateRange(activeTicket.date, activeTicket.endDate)}
              </p>
            </div>
            {activeTicket.isLeader && (
              <div className={`col-span-2 p-3.5 rounded-2xl border flex justify-between items-center text-left ${
                activeTicket.userId === user?.id 
                  ? 'bg-emerald-50/40 border-emerald-100/60' 
                  : 'bg-blue-50/40 border-blue-100/60'
              }`}>
                <div>
                  <p className={`text-[7.5px] font-black uppercase tracking-widest mb-1 ${
                    activeTicket.userId === user?.id ? 'text-emerald-700/80' : 'text-blue-700/80'
                  }`}>
                    {activeTicket.userId === user?.id ? 'SISTEM KELOMPOK (KETUA)' : 'SISTEM KELOMPOK (ANGGOTA)'}
                  </p>
                  <p className="font-black text-slate-800 text-[10.5px] uppercase leading-tight">
                    {activeTicket.userId === user?.id 
                      ? `Membawa ${activeTicket.members?.length || 0} Anggota Rombongan`
                      : `Tergabung dalam Rombongan Kelompok`}
                  </p>
                </div>
                <span className={`text-[9px] font-extrabold px-2.5 py-1 rounded-lg shrink-0 ${
                  activeTicket.userId === user?.id 
                    ? 'text-emerald-700 bg-emerald-100/60' 
                    : 'text-blue-700 bg-blue-100/60'
                }`}>
                  {activeTicket.checkedGears?.length || 0} / 11 Alat Siap
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <button 
          onClick={() => navigate('/user/simaksi')}
          className="w-full bg-emerald-600 p-5 sm:p-6 rounded-[2rem] text-white flex items-center justify-between group shadow-xl shadow-emerald-100 transition-all hover:bg-emerald-700 active:scale-[0.98]"
        >
          <div className="text-left">
            <h3 className="font-black italic uppercase text-base sm:text-lg leading-none mb-1">Ajukan SIMAKSI</h3>
            <p className="text-[9px] sm:text-[10px] font-bold text-emerald-100 uppercase tracking-widest opacity-70">Pendaftaran pendakian resmi</p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center group-hover:translate-x-2 transition-transform">
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </button>
      )}

      {/* Rules Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            Aturan & Larangan
          </h3>
          <button className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline">Lihat Semua</button>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {rules.map((rule, i) => (
            <div key={i} className="bg-white p-4 rounded-3xl border border-slate-100 flex items-start gap-4">
              <div className="bg-slate-50 w-10 h-10 rounded-2xl flex items-center justify-center shrink-0">
                <Info className="w-5 h-5 text-slate-300" />
              </div>
              <div>
                <h4 className="font-black text-slate-800 text-sm leading-tight mb-1 uppercase italic">{rule.title}</h4>
                <p className="text-[10px] text-slate-400 font-bold leading-relaxed">{rule.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Emergency Warning */}
      <div className="bg-amber-50 border border-amber-100 p-5 rounded-[2rem] flex items-start gap-4">
        <div className="bg-amber-400/20 p-2 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h4 className="font-black text-amber-700 text-xs italic uppercase mb-1">Peringatan Keselamatan</h4>
          <p className="text-[10px] text-amber-600 font-bold leading-relaxed">
            Harap selalu melapor di setiap POS dan hindari mendaki saat malam hari jika cuaca berkabut tebal.
          </p>
        </div>
      </div>
    </div>
  );
}
