import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { saveScan } from '../../lib/db';
import { MOUNTAIN_POS } from '../../lib/mockData';
import { Camera, CheckCircle, WifiOff, AlertCircle, RefreshCw, MapPin } from 'lucide-react';

export default function AdminScanner() {
  const [selectedPos, setSelectedPos] = useState<number>(0);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    const handleStatusChange = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);

    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scanner.render(onScanSuccess, onScanFailure);
    scannerRef.current = scanner;

    return () => {
      scanner.clear().catch(e => console.error(e));
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, [selectedPos]); // Re-render if pos changes to ensure correct context

  async function onScanSuccess(decodedText: string) {
    try {
      if (decodedText === scanResult) return;
      
      setScanResult(decodedText);
      setError(null);

      const type = selectedPos === 0 ? 'CHECK_IN' : (selectedPos === MOUNTAIN_POS.length - 1 ? 'CHECK_OUT' : 'POST_CHECK');

      await saveScan({
        ticketId: decodedText,
        timestamp: new Date().toISOString(),
        type,
        posId: selectedPos,
        synced: navigator.onLine,
      });

      setTimeout(() => setScanResult(null), 3000);
    } catch (err) {
      setError('Gagal menyimpan data scan.');
    }
  }

  function onScanFailure() {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Scanner Petugas</h2>
        {isOffline ? (
          <div className="bg-amber-100 text-amber-700 text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1">
            <WifiOff className="w-3 h-3" />
            OFFLINE
          </div>
        ) : (
          <div className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            ONLINE
          </div>
        )}
      </div>

      <div className="bg-white p-4 rounded-3xl shadow-lg border border-slate-100">
        <div className="flex items-center gap-2 mb-3 text-slate-400">
          <MapPin className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Lokasi Pos Penjagaan</span>
        </div>
        <select 
          value={selectedPos}
          onChange={(e) => setSelectedPos(Number(e.target.value))}
          className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 font-bold text-slate-700 focus:border-emerald-500 outline-none transition-all appearance-none"
        >
          {MOUNTAIN_POS.map(pos => (
            <option key={pos.id} value={pos.id}>{pos.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-white p-4 rounded-3xl shadow-xl overflow-hidden border-2 border-emerald-500/20">
        <div id="reader" className="overflow-hidden rounded-2xl bg-black"></div>
      </div>

      {scanResult && (
        <div className="bg-emerald-50 border-2 border-emerald-200 p-6 rounded-3xl flex items-center gap-4 animate-in fade-in zoom-in duration-300">
          <div className="bg-emerald-500 p-2 rounded-full">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <div>
            <div className="text-xs text-emerald-600 font-bold uppercase">Berhasil Scan</div>
            <div className="text-lg font-bold text-emerald-900 leading-tight">{scanResult}</div>
            <div className="text-[10px] text-emerald-500 italic mt-1">Dicatat di {MOUNTAIN_POS[selectedPos].name}</div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-2 border-red-200 p-4 rounded-3xl flex items-center gap-4 text-red-700">
          <AlertCircle className="w-6 h-6" />
          <span className="font-bold">{error}</span>
        </div>
      )}

      <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-3xl">
        <Camera className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-xs text-slate-400 font-medium">Pilih Pos & Hadapkan QR Code ke kamera</p>
      </div>
    </div>
  );
}
