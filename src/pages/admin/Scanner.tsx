import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { completeSimaksi } from '../../lib/db';
import { Camera, CheckCircle, WifiOff, RefreshCw, AlertCircle, LogOut } from 'lucide-react';

export default function AdminScanner() {
  const [scanResult, setScanResult] = useState<{ simaksiId: number; kodeSimaksi: string | null } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const doneRef = useRef(false); // guard: onScanSuccess hanya fire sekali per sesi

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
    if (scanResult) return;

    // Bersihkan elemen manual sebelum init — mencegah double render dari StrictMode
    // karena scanner.clear() async dan tidak bisa di-await di cleanup
    const el = document.getElementById('admin-return-reader');
    if (el) el.innerHTML = '';

    const scanner = new Html5QrcodeScanner(
      'admin-return-reader',
      {
        fps: 10,
        qrbox: (w: number, h: number) => {
          const size = Math.min(Math.floor(Math.min(w, h) * 0.7), 250);
          return { width: size < 180 ? 180 : size, height: size < 180 ? 180 : size };
        },
        aspectRatio: 1.0,
      },
      false
    );

    scanner.render(
      async (decodedText: string) => {
        if (doneRef.current) return; // sudah diproses, abaikan callback berikutnya

        if (!decodedText.startsWith('SUMMITY-RETURN-')) {
          setError('QR tidak dikenal. Gunakan QR kepulangan dari aplikasi pendaki.');
          setTimeout(() => setError(null), 3000);
          return;
        }

        const simaksiId = parseInt(decodedText.replace('SUMMITY-RETURN-', ''));
        if (isNaN(simaksiId)) {
          setError('Format QR tidak valid.');
          setTimeout(() => setError(null), 3000);
          return;
        }

        doneRef.current = true; // kunci sebelum async agar tidak double-trigger
        const { kodeSimaksi } = await completeSimaksi(simaksiId);
        setScanResult({ simaksiId, kodeSimaksi });
        setToast('Pendaki berhasil checkout');
        setTimeout(() => setToast(null), 3000);
      },
      () => {}
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [scanResult]);

  const handleReset = () => {
    doneRef.current = false;
    setScanResult(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <style>{`
        #admin-return-reader {
          border: none !important;
          width: 100% !important;
          background: #000000 !important;
        }
        #admin-return-reader video {
          width: 100% !important;
          height: auto !important;
          max-height: 70vh !important;
          object-fit: cover !important;
          border-radius: 1.5rem !important;
        }
        #admin-return-reader__dashboard {
          width: 100% !important;
          padding: 1rem 0.5rem !important;
          box-sizing: border-box !important;
          background: #ffffff !important;
          border-radius: 0 0 1.5rem 1.5rem !important;
        }
        #admin-return-reader__dashboard_section_csr button,
        #admin-return-reader__dashboard_section_csr a {
          background-color: #1e293b !important;
          color: white !important;
          border: none !important;
          padding: 0.65rem 1.25rem !important;
          border-radius: 0.75rem !important;
          font-size: 0.75rem !important;
          font-weight: 800 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          cursor: pointer !important;
        }
        #admin-return-reader__dashboard_section_csr select {
          background-color: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          padding: 0.65rem !important;
          border-radius: 0.75rem !important;
          font-size: 0.75rem !important;
          max-width: 100% !important;
          outline: none !important;
          font-weight: 700 !important;
        }
        #admin-return-reader__scan_region {
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
          background: #000000 !important;
          border-radius: 1.5rem 1.5rem 0 0 !important;
          overflow: hidden !important;
        }
      `}</style>

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[3000] animate-in slide-in-from-top duration-300">
          <div className="bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-black text-sm uppercase tracking-wider whitespace-nowrap">
            <CheckCircle className="w-5 h-5 shrink-0" />
            {toast}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Pindai Kepulangan</h2>
        {isOffline ? (
          <div className="bg-amber-100 text-amber-700 text-[10px] px-2.5 py-1 rounded-full font-black flex items-center gap-1 uppercase tracking-wider">
            <WifiOff className="w-3 h-3" /> Offline
          </div>
        ) : (
          <div className="bg-emerald-100 text-emerald-700 text-[10px] px-2.5 py-1 rounded-full font-black flex items-center gap-1 uppercase tracking-wider">
            <RefreshCw className="w-3 h-3" /> Online
          </div>
        )}
      </div>

      {/* Info banner */}
      <div className="bg-slate-800 p-5 rounded-3xl text-white flex items-center gap-4">
        <div className="bg-white/10 p-3 rounded-2xl shrink-0">
          <LogOut className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-black uppercase tracking-tight text-sm">Scan QR Kepulangan Pendaki</h3>
          <p className="text-[10px] text-slate-300 font-medium mt-0.5">
            Arahkan kamera ke QR Code pada halaman <strong>Lapor Kepulangan</strong> milik ketua rombongan.
          </p>
        </div>
      </div>

      {/* Scanner — hanya render saat belum ada hasil, pola sama dengan user scanner */}
      {!scanResult && (
        <div className="bg-white p-4 rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
          <div id="admin-return-reader" className="rounded-[1.5rem] bg-black overflow-hidden w-full"></div>
        </div>
      )}

      {/* Sukses */}
      {scanResult && (
        <div className="space-y-4 animate-in zoom-in-95 duration-500">
          <div className="bg-emerald-600 text-white p-8 rounded-[2.5rem] flex flex-col items-center gap-6 shadow-xl shadow-emerald-100 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
              <CheckCircle className="w-64 h-64 -ml-20 -mt-20" />
            </div>
            <div className="bg-white/20 p-5 rounded-[2rem] backdrop-blur-md border border-white/20 relative z-10">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
            <div className="relative z-10">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70 mb-2">Kepulangan Tercatat</div>
              <div className="text-3xl font-black italic mb-2 uppercase tracking-tighter">
                {scanResult.kodeSimaksi ?? `SIMAKSI #${scanResult.simaksiId}`}
              </div>
            </div>
          </div>

          <button
            onClick={handleReset}
            className="w-full py-4 bg-slate-900 text-white font-black rounded-[2rem] shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest"
          >
            <Camera className="w-4 h-4" />
            Pindai Pendaki Berikutnya
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-rose-50 border-2 border-rose-200 p-4 rounded-3xl flex items-center gap-3 text-rose-700 animate-in fade-in duration-200">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="font-bold text-sm">{error}</span>
        </div>
      )}

      {!scanResult && (
        <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-3xl">
          <Camera className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-400 font-medium">Hadapkan QR Code kepulangan ke kamera</p>
        </div>
      )}
    </div>
  );
}
