import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { saveScan, getAllRegistrations, getAllScans } from '../../lib/db';
import { MOUNTAIN_POS, MOCK_TICKETS } from '../../lib/mockData';
import { useAuth } from '../../context/AuthContext';
import { Camera, CheckCircle, WifiOff, MapPin, Navigation, Clock } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function UserScanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [loading, setLoading] = useState(true);
  const [registrationStatus, setRegistrationStatus] = useState<'NONE' | 'PENDING' | 'APPROVED'>('NONE');
  
  useEffect(() => {
    const handleStatusChange = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  useEffect(() => {
    const checkStatus = async () => {
      const regs = await getAllRegistrations();
      const userRegs = regs.filter(r => r.userId === user?.id);
      
      const approvedReg = userRegs.find(r => r.status === 'APPROVED');
      const pendingReg = userRegs.find(r => r.status === 'PENDING');
      
      if (approvedReg) {
        setRegistrationStatus('APPROVED');
      } else if (pendingReg) {
        setRegistrationStatus('PENDING');
      } else {
        setRegistrationStatus('NONE');
      }
      setLoading(false);
    };
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    if (registrationStatus !== 'APPROVED' || scanResult) return;

    const scanner = new Html5QrcodeScanner(
      "user-reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      },
      false
    );

    scanner.render((decodedText: string) => onScanSuccess(decodedText), (error) => {
      // ignore failures
    });

    return () => {
      scanner.clear().catch(err => console.error("Failed to clear scanner", err));
    };
  }, [registrationStatus, scanResult]);



  async function onScanSuccess(decodedText: string) {
    // Format QR Pos: "SUMMITY-POS-{id}"
    if (decodedText.startsWith('SUMMITY-POS-')) {
      const posId = parseInt(decodedText.split('-').pop() || '0');
      const posName = MOUNTAIN_POS[posId]?.name || 'Pos Tidak Dikenal';

      setScanResult(posName);

      // Determine real ticket ID
      let ticketId = '';
      
      const regs = await getAllRegistrations();
      const approved = regs.find(r => r.userId === user?.id && r.status === 'APPROVED');
      
      if (approved) {
        ticketId = `SUMMITY-USER-${approved.id}`;
      } else {
        // Fallback for demo if no registration found
        ticketId = `SUMMITY-DEMO-TICKET`;
      }

      // Fetch all scans for this ticket to determine type
      const allScans = await getAllScans();
      const userScans = allScans.filter(s => s.ticketId === ticketId);
      
      let scanType: 'CHECK_IN' | 'CHECK_OUT' | 'POST_CHECK' = 'POST_CHECK';
      
      if (posId === 0) {
        if (userScans.length === 0) {
          scanType = 'CHECK_IN';
        } else {
          const reachedPeak = userScans.some(s => s.posId === MOUNTAIN_POS.length - 1);
          if (reachedPeak || userScans.length > 2) {
            scanType = 'CHECK_OUT';
          } else {
            scanType = 'CHECK_IN';
          }
        }
      }

      // Simpan log scan
      await saveScan({
        ticketId: ticketId,
        timestamp: new Date().toISOString(),
        type: scanType,
        posId: posId,
        synced: navigator.onLine,
      });

      // Shorter delay + clearer feedback
      setTimeout(() => setSearchParams({ view: 'tracking' }), 1500);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-10 text-center">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Memuat Scanner...</p>
      </div>
    );
  }

  if (registrationStatus === 'PENDING') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="bg-amber-50 w-24 h-24 rounded-[2rem] flex items-center justify-center shadow-inner border border-amber-100/50">
          <Clock className="w-12 h-12 text-amber-500 animate-spin" style={{ animationDuration: '4s' }} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-800 italic uppercase tracking-tighter">Scanner Belum Aktif</h2>
          <p className="text-slate-500 text-sm max-w-xs mx-auto leading-relaxed">
            SIMAKSI Anda sedang menunggu persetujuan petugas. Fitur scanner akan terbuka otomatis setelah diverifikasi.
          </p>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="bg-slate-900 shadow-xl shadow-slate-200 text-white font-black px-8 py-4 rounded-2xl text-xs uppercase tracking-[0.2em]"
        >
          Cek Status Tiket
        </button>
      </div>
    );
  }

  if (registrationStatus === 'NONE') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="bg-emerald-50 w-24 h-24 rounded-[2rem] flex items-center justify-center shadow-inner border border-emerald-100/50">
          <Camera className="w-12 h-12 text-emerald-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-800 italic uppercase">Tidak Ada Tiket</h2>
          <p className="text-slate-500 text-sm max-w-xs mx-auto leading-relaxed">
            Anda belum memiliki pendaftaran aktif. Silakan daftar SIMAKSI terlebih dahulu.
          </p>
        </div>
        <button 
          onClick={() => navigate('/register')}
          className="bg-slate-900 shadow-xl shadow-slate-200 text-white font-black px-8 py-4 rounded-2xl text-xs uppercase tracking-[0.2em]"
        >
          Daftar SIMAKSI
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {!scanResult && (
        <div className="bg-white p-4 sm:p-6 rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden relative">
          <div className="absolute top-4 right-6 z-10">
             <div className="bg-slate-900/60 backdrop-blur-md text-white text-[8px] font-black px-3 py-1.5 rounded-full flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                LENSA AKTIF
             </div>
          </div>
          <div id="user-reader" className="rounded-[1.5rem] sm:rounded-[2rem] bg-black overflow-hidden aspect-square sm:aspect-video md:aspect-square"></div>
          <div className="mt-6 flex items-center gap-3 bg-slate-50 p-4 rounded-3xl border border-slate-100">
             <div className="bg-emerald-100 p-2 rounded-xl">
                <Navigation className="w-4 h-4 text-emerald-600" />
             </div>
             <p className="text-[10px] sm:text-xs text-slate-500 font-bold leading-tight">
               Arahkan kamera ke QR Code yang tersedia di setiap Pos/Checkpoint jalur pendakian.
             </p>
          </div>
        </div>
      )}

      {scanResult ? (
        <div className="space-y-4 animate-in zoom-in-95 duration-500">
          <div className="bg-emerald-600 text-white p-8 sm:p-10 rounded-[2.5rem] flex flex-col items-center gap-6 shadow-xl shadow-emerald-100 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
               <CheckCircle className="w-64 h-64 -ml-20 -mt-20" />
            </div>
            <div className="bg-white/20 p-5 rounded-[2rem] backdrop-blur-md border border-white/20 relative z-10">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
            <div className="relative z-10">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70 mb-3">Verifikasi Berhasil</div>
              <div className="text-3xl sm:text-4xl font-black italic mb-3 uppercase tracking-tighter">{scanResult}</div>
              <p className="text-xs sm:text-sm text-emerald-100 font-medium opacity-80 max-w-[200px] mx-auto italic">
                Data perjalanan Anda telah diperbarui secara otomatis.
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => setSearchParams({ view: 'tracking' })}
            className="w-full py-4.5 bg-slate-900 text-white font-black rounded-[2rem] shadow-xl shadow-slate-200 active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest border-t border-white/10"
          >
            LIHAT LOKASI SAYA
            <Navigation className="w-4 h-4 text-emerald-400" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 py-12 opacity-30">
          <Navigation className="w-12 h-12 text-slate-300 animate-pulse" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Menunggu Deteksi Jalur...</p>
        </div>
      )}

      {isOffline && (
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-3xl flex items-center gap-3 mt-4">
          <WifiOff className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-[10px] text-amber-800 font-bold uppercase tracking-tight leading-relaxed">
            Mode Offline: Progress akan disinkron saat perangkat terhubung internet.
          </p>
        </div>
      )}
    </div>
  );
}
