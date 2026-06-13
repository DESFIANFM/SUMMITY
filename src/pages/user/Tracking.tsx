import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MOUNTAIN_POS, calculateETA } from '../../lib/mockData';
import { getUserActiveTicket, getTrackingHistoryByTicket, getUserSimaksi } from '../../lib/db';
import { useAuth } from '../../context/AuthContext';
import GPSMap from '../../components/GPSMap';
import { ArrowUpCircle, Map, Info, ShieldCheck, Clock, MapPinned } from 'lucide-react';
import { formatDateRange } from '../../lib/formatters';

export default function UserTracking() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentPosIndex, setCurrentPosIndex] = useState(0);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [mountainName, setMountainName] = useState<string>('Gn. Slamet');
  const [direction, setDirection] = useState<'ASCENT' | 'DESCENT'>('ASCENT');
  const [scansList, setScansList] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [registrationStatus, setRegistrationStatus] = useState<'NONE' | 'PENDING' | 'APPROVED'>('NONE');

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;

      // 1. Cek tiket individu user dari tabel tickets
      const ticket = await getUserActiveTicket(user.id);

      if (ticket) {
        setRegistrationStatus('APPROVED');
        setMountainName(ticket.mountain_name || 'Gn. Slamet');

        // 2. Ambil tracking history dari tracking_history (supabase) / antrian lokal IndexedDB
        const history = await getTrackingHistoryByTicket(ticket.id);
        setScansList(history);

        const lastRecord = history[history.length - 1];
        if (lastRecord) {
          const posIdx = lastRecord.posId ?? 0;
          setCurrentPosIndex(posIdx);
          const ts = lastRecord.scanned_at || lastRecord.timestamp;
          setLastScanTime(new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

          // Deteksi arah: jika ada pos yang lebih tinggi dari posisi terakhir → sedang turun
          let maxPosReached = posIdx;
          history.forEach((h: any) => {
            const hIdx = h.posId ?? 0;
            if (hIdx > maxPosReached) maxPosReached = hIdx;
          });
          setDirection(maxPosReached > posIdx ? 'DESCENT' : 'ASCENT');
        }
      } else {
        // Tidak ada tiket aktif — cek apakah ada simaksi pending
        const simaksiList = await getUserSimaksi(user.id);
        const pending = simaksiList.find((s: any) => s.status === 'pending');
        if (pending) setRegistrationStatus('PENDING');
        else setRegistrationStatus('NONE');
      }

      setLoading(false);
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [user?.id]);

  if (loading) {
    return (
      <div className="min-h-[30vh] flex flex-col items-center justify-center p-10 text-center">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Memuat Tracking...</p>
      </div>
    );
  }

  if (registrationStatus === 'PENDING') {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="bg-amber-50 w-24 h-24 rounded-[2rem] flex items-center justify-center shadow-inner border border-amber-100/50">
          <Clock className="w-12 h-12 text-amber-500 animate-spin" style={{ animationDuration: '4s' }} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-800 italic uppercase">SIMAKSI MENUNGGU</h2>
          <p className="text-slate-500 text-sm max-w-xs mx-auto leading-relaxed">
            Data registrasi Anda sedang diverifikasi oleh petugas. Fitur tracking akan aktif setelah SIMAKSI disetujui.
          </p>
        </div>
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3 text-left">
           <Info className="w-5 h-5 text-slate-400 shrink-0" />
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
             Mohon tunggu paling lambat 1x24 jam atau hubungi basecamp terdekat.
           </p>
        </div>
      </div>
    );
  }

  if (registrationStatus === 'NONE') {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="bg-emerald-50 w-24 h-24 rounded-[2rem] flex items-center justify-center shadow-inner border border-emerald-100/50">
          <MapPinned className="w-12 h-12 text-emerald-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-800 italic uppercase">Belum Ada Perjalanan</h2>
          <p className="text-slate-500 text-sm max-w-xs mx-auto leading-relaxed">
            Wah, sepertinya Anda belum memiliki SIMAKSI yang aktif untuk melakukan tracking.
          </p>
        </div>
        <button 
          onClick={() => {
            setSearchParams({ view: 'simaksi' });
          }}
          className="bg-slate-900 shadow-xl shadow-slate-200 text-white font-black px-8 py-4 rounded-2xl text-xs uppercase tracking-[0.2em]"
        >
          Daftar SIMAKSI
        </button>
      </div>
    );
  }

  const currentPos = MOUNTAIN_POS[currentPosIndex];
  const targetPos = direction === 'ASCENT' ? MOUNTAIN_POS[MOUNTAIN_POS.length - 1] : MOUNTAIN_POS[0];
  
  const distanceRemaining = direction === 'ASCENT' 
    ? targetPos.distanceFromBase - currentPos.distanceFromBase
    : currentPos.distanceFromBase; // Remaining to basecamp is the distance from base
    
  const eta = calculateETA(
    distanceRemaining, 
    currentPos.elevation, 
    targetPos.elevation
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
           <button 
             onClick={() => setShowMap(!showMap)}
             className={`p-2.5 rounded-xl border transition-all ${
               showMap ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400'
             }`}
           >
             <MapPinned className="w-5 h-5" />
           </button>
           {lastScanTime ? (
             <div className="bg-emerald-100 text-emerald-700 text-[10px] px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5 shadow-sm border border-emerald-200">
               <ShieldCheck className="w-3.5 h-3.5" />
               UPDATE {lastScanTime}
             </div>
           ) : (
             <div className="bg-slate-100 text-slate-500 text-[10px] px-3 py-1.5 rounded-full font-bold animate-pulse border border-slate-200">
               BELUM MULAI
             </div>
           )}
        </div>
      </div>

      {showMap ? (
        <div className="space-y-4">
          <GPSMap 
            currentPosIndex={currentPosIndex} 
            mountainName={mountainName} 
            userScans={scansList} 
            direction={direction} 
          />
          <div className="bg-emerald-900 rounded-[2.5rem] p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
               <Map className="w-24 h-24" />
             </div>
             <div className="relative z-10 flex items-center justify-between">
                <div>
                   <div className="text-[9px] font-black text-emerald-300 uppercase tracking-widest mb-1 italic opacity-70">Lokasi Sekarang</div>
                   <div className="text-lg sm:text-xl font-black italic uppercase leading-none">{currentPos.name}</div>
                </div>
                <div className="text-right">
                   <div className="text-[9px] font-black text-emerald-300 uppercase tracking-widest mb-1 italic opacity-70">Tingkat {direction === 'ASCENT' ? 'Kenaikan' : 'Penurunan'}</div>
                   <div className="text-lg sm:text-xl font-black italic uppercase leading-none">{currentPos.elevation} <span className="text-[10px] opacity-60">MDPL</span></div>
                </div>
             </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] shadow-xl p-6 sm:p-8 border border-slate-100">
          <div className="flex items-center justify-between mb-8 sm:mb-10">
            <div className={`p-3.5 sm:p-4 rounded-2xl shadow-lg ${direction === 'ASCENT' ? 'bg-emerald-600 shadow-emerald-100' : 'bg-blue-600 shadow-blue-100'}`}>
              <Map className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="text-right">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Status Perjalanan</span>
              <div className={`text-xl sm:text-2xl font-black italic ${direction === 'ASCENT' ? 'text-emerald-600' : 'text-blue-600'}`}>
                {direction === 'ASCENT' ? 'MENDAKI' : 'TURUN'}
              </div>
            </div>
          </div>

          <div className="relative mb-14 mt-8 px-2 sm:px-4 overflow-x-auto pb-4">
            <div className="absolute left-6 right-6 h-1.5 sm:h-2 bg-slate-100 top-1/2 -translate-y-1/2 rounded-full overflow-hidden min-w-[500px]">
              <div 
                className={`h-full transition-all duration-1000 shadow-[0_0_12px_rgba(16,185,129,0.4)] ${
                  direction === 'ASCENT' ? 'bg-emerald-500' : 'bg-blue-500'
                }`}
                style={{ width: `${(currentPos.id / (MOUNTAIN_POS.length - 1)) * 100}%` }}
              />
            </div>
            <div className="flex justify-between relative min-w-[500px]">
              {MOUNTAIN_POS.map((pos) => (
                <div key={pos.id} className="flex flex-col items-center">
                  <div 
                    className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-[3px] sm:border-4 transition-all duration-700 z-10 flex items-center justify-center ${
                      pos.id <= currentPos.id ? (direction === 'ASCENT' ? 'bg-emerald-500 border-white' : 'bg-blue-500 border-white') : 'bg-white border-slate-100'
                    } ${pos.id === currentPos.id ? 'scale-125 shadow-xl' : ''}`}
                  >
                    {pos.id === currentPos.id && <ShieldCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />}
                  </div>
                  <span className={`text-[8px] mt-3 sm:mt-4 font-black uppercase transition-colors text-center w-12 sm:w-14 tracking-tighter ${
                    pos.id === currentPos.id ? (direction === 'ASCENT' ? 'text-emerald-600' : 'text-blue-600') : 'text-slate-300'
                  }`}>
                    {pos.name.split(':')[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-slate-50 p-4 sm:p-5 rounded-[2rem] border border-slate-100">
              <div className="text-[9px] text-slate-400 font-bold mb-2 flex items-center gap-1.5 uppercase tracking-widest">
                <ArrowUpCircle className={`w-3.5 h-3.5 text-slate-300 ${direction === 'DESCENT' ? 'rotate-180' : ''}`} />
                Elevasi
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-slate-800">{currentPos.elevation}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">MDPL</span>
              </div>
            </div>
            <div className={`${direction === 'ASCENT' ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'} p-4 sm:p-5 rounded-[2rem] border`}>
              <div className={`text-[9px] font-bold mb-2 flex items-center gap-1.5 uppercase tracking-widest ${
                direction === 'ASCENT' ? 'text-emerald-600' : 'text-blue-600'
              }`}>
                <Clock className={`w-3.5 h-3.5 ${direction === 'ASCENT' ? 'text-emerald-300' : 'text-blue-300'}`} />
                {direction === 'ASCENT' ? 'PUNCAK' : 'BC'}
              </div>
              <div className="flex items-baseline gap-1">
                { (direction === 'ASCENT' && currentPosIndex === MOUNTAIN_POS.length - 1) || (direction === 'DESCENT' && currentPosIndex === 0) ? (
                  <span className={`text-lg sm:text-xl font-black ${direction === 'ASCENT' ? 'text-emerald-700' : 'text-blue-700'}`}>SAMPAI!</span>
                ) : (
                  <span className={`text-2xl sm:text-3xl font-black ${direction === 'ASCENT' ? 'text-emerald-800' : 'text-blue-800'}`}>
                    {eta.hours}j {eta.minutes}m
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
          <Info className="w-4 h-4 text-emerald-500" />
          Detail Perjalanan (Jalur Bambangan)
        </h3>
        <div className="space-y-3">
          {MOUNTAIN_POS.map(pos => (
            <div key={pos.id} className={`flex flex-col p-4 rounded-[1.5rem] border transition-all ${
              pos.id === currentPos.id ? 'bg-emerald-50 border-emerald-200 shadow-sm shadow-emerald-100/50' : 'bg-slate-50/50 border-transparent hover:bg-slate-50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-bold text-[10px] ${
                    pos.id <= currentPos.id ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'
                  }`}>
                    {pos.id === 0 ? 'BC' : pos.id === 10 ? 'MT' : pos.id}
                  </div>
                  <div>
                    <div className={`text-xs sm:text-sm font-bold ${pos.id === currentPos.id ? 'text-emerald-900 font-extrabold' : 'text-slate-800'}`}>
                      {pos.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {pos.elevation} MDPL • Jarak {pos.distanceFromBase} km
                    </div>
                  </div>
                </div>
                {pos.id <= currentPos.id && <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />}
              </div>
              {pos.desc && (
                <p className={`mt-2 text-[10.5px] leading-relaxed pl-10 border-l border-dashed ${
                  pos.id === currentPos.id ? 'text-emerald-700/80 font-bold border-emerald-300' : 'text-slate-500 border-slate-200'
                }`}>
                  {pos.desc}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
