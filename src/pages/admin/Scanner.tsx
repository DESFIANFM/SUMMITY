import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { completeSimaksi } from '../../lib/db';
import { Camera, CheckCircle, WifiOff, RefreshCw, AlertCircle, LogOut } from 'lucide-react';

export default function AdminScanner() {
  const [scanResult, setScanResult] = useState<{ simaksiId: number; raw: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isProcessing, setIsProcessing] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    const handleStatusChange = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);

    const scanner = new Html5QrcodeScanner(
      'admin-return-reader',
      { fps: 10, qrbox: { width: 260, height: 260 } },
      false
    );
    scanner.render(onScanSuccess, () => {});
    scannerRef.current = scanner;

    return () => {
      scanner.clear().catch(() => {});
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  async function onScanSuccess(decodedText: string) {
    if (isProcessing || scanResult) return;

    if (!decodedText.startsWith('SUMMITY-RETURN-')) {
      setError(`QR tidak dikenal: ${decodedText}`);
      setTimeout(() => setError(null), 3000);
      return;
    }

    const simaksiId = parseInt(decodedText.replace('SUMMITY-RETURN-', ''));
    if (isNaN(simaksiId)) {
      setError('Format QR tidak valid.');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setIsProcessing(true);
    setError(null);

    const ok = await completeSimaksi(simaksiId);
    setScanResult({ simaksiId, raw: decodedText });
    setIsProcessing(false);

    if (!ok) {
      setError('Gagal update ke server — tersimpan lokal, akan sync saat online.');
    }
  }

  const handleReset = () => {
    setScanResult(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Pindai Kepulangan</h2>
        {isOffline ? (
          <div className="bg-amber-100 text-amber-700 text-[10px] px-2.5 py-1 rounded-full font-black flex items-center gap-1 uppercase tracking-wider">
            <WifiOff className="w-3 h-3" />
            Offline
          </div>
        ) : (
          <div className="bg-emerald-100 text-emerald-700 text-[10px] px-2.5 py-1 rounded-full font-black flex items-center gap-1 uppercase tracking-wider">
            <RefreshCw className="w-3 h-3" />
            Online
          </div>
        )}
      </div>

      <div className="bg-slate-800 p-5 rounded-3xl text-white flex items-center gap-4">
        <div className="bg-white/10 p-3 rounded-2xl shrink-0">
          <LogOut className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="font-black uppercase tracking-tight text-sm">Scan QR Kepulangan Pendaki</h3>
          <p className="text-[10px] text-slate-300 font-medium mt-0.5">
            Arahkan kamera ke QR Code pada halaman "Lapor Kepulangan" milik pendaki.
            Status SIMAKSI akan berubah menjadi <strong>Selesai</strong>.
          </p>
        </div>
      </div>

      {/* Scanner */}
      {!scanResult && (
        <div className="bg-white p-4 rounded-3xl shadow-xl overflow-hidden border-2 border-slate-800/20">
          <div id="admin-return-reader" className="overflow-hidden rounded-2xl bg-black"></div>
        </div>
      )}

      {/* Sukses */}
      {scanResult && (
        <div className="bg-emerald-50 border-2 border-emerald-200 p-6 rounded-3xl space-y-4 animate-in fade-in zoom-in duration-300">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-500 p-3 rounded-full shrink-0">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="text-xs text-emerald-600 font-black uppercase tracking-widest">Kepulangan Dicatat</div>
              <div className="text-base font-black text-emerald-900 leading-tight mt-0.5">
                SIMAKSI #{scanResult.simaksiId}
              </div>
              <div className="text-[10px] text-emerald-600 font-bold mt-0.5">
                Status berubah → <span className="uppercase font-black">Selesai</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="w-full bg-slate-800 text-white font-black py-3 rounded-2xl text-xs uppercase tracking-widest hover:bg-slate-900 transition-colors flex items-center justify-center gap-2"
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

      {/* Idle hint */}
      {!scanResult && !isProcessing && (
        <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-3xl">
          <Camera className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-400 font-medium">Hadapkan QR Code kepulangan ke kamera</p>
        </div>
      )}
    </div>
  );
}
