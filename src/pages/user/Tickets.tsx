import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { getUserSimaksi } from '../../lib/db';
import { useAuth } from '../../context/AuthContext';
import { Calendar, MapPin, QrCode, PlusCircle, Clock, AlertCircle, Camera, Users, ShieldCheck, CheckCircle2, Mountain, X, LogOut } from 'lucide-react';
import { formatDateRange } from '../../lib/formatters';

export default function UserTickets() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [simaksiList, setSimaksiList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showKepulangan, setShowKepulangan] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      if (!user?.id) return;
      const data = await getUserSimaksi(user.id);
      setSimaksiList(data);
      setLoading(false);
    };
    fetch();
    const interval = setInterval(fetch, 3000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const activeSimaksi = simaksiList.find(s => ['approved', 'checkin', 'checkout'].includes(s.status))
    || simaksiList.find(s => s.status === 'pending')
    || simaksiList.find(s => s.status === 'rejected')
    || simaksiList.find(s => s.status === 'complete');

  const otherSimaksi = simaksiList.filter(s => s.simaksiId !== activeSimaksi?.simaksiId);

  const statusLabel: Record<string, string> = {
    pending: 'MENUNGGU VERIFIKASI',
    approved: 'DISETUJUI / AKTIF',
    rejected: 'DITOLAK',
    checkin: 'SEDANG MENDAKI',
    checkout: 'DALAM PERJALANAN TURUN',
    complete: 'SELESAI',
  };

  const statusColor: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-rose-100 text-rose-700',
    checkin: 'bg-blue-100 text-blue-700',
    checkout: 'bg-sky-100 text-sky-700',
    complete: 'bg-slate-100 text-slate-600',
  };

  if (loading) return (
    <div className="min-h-[30vh] flex flex-col items-center justify-center p-10 text-center">
      <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Memuat Tiket...</p>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* Riwayat SIMAKSI lain */}
      {otherSimaksi.map(s => (
        <div key={s.simaksiId} className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-5 flex items-center justify-between shadow-sm relative overflow-hidden group">
          <div className={`absolute top-0 left-0 w-1 h-full ${s.status === 'approved' ? 'bg-emerald-400' : s.status === 'pending' ? 'bg-amber-400' : 'bg-rose-400'}`}></div>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${statusColor[s.status] || 'bg-slate-100 text-slate-400'}`}>
              {s.status === 'pending' ? <Clock className="w-5 h-5 animate-pulse" />
                : s.status === 'approved' || s.status === 'checkin' ? <QrCode className="w-5 h-5" />
                : s.status === 'complete' ? <CheckCircle2 className="w-5 h-5" />
                : <AlertCircle className="w-5 h-5" />}
            </div>
            <div>
              <h4 className="font-black text-slate-800 leading-none mb-1 uppercase tracking-tighter italic">
                {s.kodeSimaksi || `SIMAKSI #${s.simaksiId}`}
              </h4>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">
                {formatDateRange(s.tanggalNaik, s.tanggalTurun)}
              </p>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${statusColor[s.status] || 'bg-slate-100 text-slate-500'}`}>
                {statusLabel[s.status] || s.status.toUpperCase()}
              </span>
            </div>
          </div>
          {s.status === 'rejected' && (
            <button
              onClick={() => setSearchParams({ view: 'simaksi' })}
              className="bg-slate-900 text-white text-[8px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest"
            >
              Daftar Lagi
            </button>
          )}
        </div>
      ))}

      {/* State: pending tapi belum approved */}
      {activeSimaksi?.status === 'pending' && (
        <div className="bg-slate-50 border border-slate-100 rounded-3xl p-10 text-center space-y-4">
          <div className="bg-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
            <Clock className="w-8 h-8 text-amber-500 animate-spin" style={{ animationDuration: '3s' }} />
          </div>
          <div className="space-y-1">
            <h3 className="font-black text-slate-800 italic uppercase">Sedang Diverifikasi</h3>
            <p className="text-xs text-slate-400 font-medium max-w-[240px] mx-auto">
              Admin sedang memeriksa pengajuan SIMAKSI Anda. Tiket akan aktif otomatis setelah disetujui.
            </p>
            <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mt-2">
              {formatDateRange(activeSimaksi.tanggalNaik, activeSimaksi.tanggalTurun)}
            </p>
          </div>
        </div>
      )}

      {/* State: kosong */}
      {simaksiList.length === 0 && (
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

      {/* Tiket aktif (approved / checkin / checkout / complete) */}
      {activeSimaksi && activeSimaksi.status !== 'pending' && activeSimaksi.status !== 'rejected' && (
        <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300">
          {/* Header */}
          <div className="bg-emerald-700 p-5 sm:p-6 text-white relative">
            <div className="flex items-center gap-2 mb-1">
              <Mountain className="w-4 h-4 text-emerald-300" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-300">Gunung Slamet</span>
            </div>
            <h3 className="text-lg sm:text-xl font-black italic uppercase tracking-tight">
              {activeSimaksi.kodeSimaksi || `SIMAKSI #${activeSimaksi.simaksiId}`}
            </h3>
            <p className="text-emerald-100 text-[10px] flex items-center gap-1 opacity-80 mt-0.5">
              <MapPin className="w-3 h-3" />
              Jalur pendakian resmi
            </p>
          </div>

          <div className="p-6 sm:p-8 flex flex-col items-center">
            {/* QR Code */}
            <div className="bg-slate-50 p-4 sm:p-6 rounded-[2rem] mb-5 shadow-inner border border-slate-100">
              <QRCodeSVG
                value={activeSimaksi.qrCode}
                size={140}
                className="w-28 h-28 sm:w-36 sm:h-36"
                level="H"
                includeMargin={true}
              />
            </div>

            {/* Kode & Status */}
            <div className="text-center mb-6">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">KODE QR TIKET</div>
              <div className="text-xs font-mono font-bold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl">{activeSimaksi.qrCode}</div>
              <div className="mt-2 flex justify-center">
                <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${statusColor[activeSimaksi.status] || ''}`}>
                  {statusLabel[activeSimaksi.status] || activeSimaksi.status.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Tombol Scanner + Lapor Kepulangan */}
            {['approved', 'checkin', 'checkout'].includes(activeSimaksi.status) && (
              <div className="flex flex-col gap-3 w-full mb-6 max-w-xs">
                <button
                  onClick={() => setSearchParams({ view: 'scan' })}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 sm:py-4 rounded-2xl shadow-xl shadow-emerald-100 flex items-center justify-center gap-2 transition-all active:scale-[0.98] text-xs sm:text-sm"
                >
                  <Camera className="w-5 h-5" />
                  PINDAI POS
                </button>
                {activeSimaksi.isKetua && (
                  <button
                    onClick={() => setShowKepulangan(true)}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-3 sm:py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] text-xs sm:text-sm"
                  >
                    <LogOut className="w-5 h-5" />
                    LAPOR KEPULANGAN
                  </button>
                )}
              </div>
            )}

            {/* Info Jadwal */}
            <div className="w-full pt-5 border-t border-slate-100 space-y-4">
              <div className="flex items-center gap-3">
                <div className="bg-slate-100 p-2 rounded-xl">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
                </div>
                <div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Jadwal Pendakian</div>
                  <div className="text-xs sm:text-sm font-bold text-slate-700 italic">
                    {formatDateRange(activeSimaksi.tanggalNaik, activeSimaksi.tanggalTurun)}
                  </div>
                </div>
              </div>

              {/* Info Rombongan */}
              <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-100/80 space-y-3 text-left w-full">
                <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight">Rombongan</span>
                  </div>
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${activeSimaksi.isKetua ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                    {activeSimaksi.isKetua ? 'Ketua Kelompok' : 'Anggota Kelompok'}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider mb-1.5">
                    Ketua: <span className="text-slate-600">{activeSimaksi.ketuaName}</span>
                  </div>
                  {activeSimaksi.members.length > 0 ? (
                    <>
                      <span className="block text-[8px] text-slate-400 font-extrabold uppercase tracking-wider">
                        Anggota ({activeSimaksi.members.length} orang):
                      </span>
                      <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto">
                        {activeSimaksi.members.map((m: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between bg-white border border-slate-100 rounded-xl px-2.5 py-1.5 text-[10px]">
                            <span className="font-extrabold text-slate-800 uppercase">{m.name}</span>
                            <span className="font-mono text-[8px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                              ID: {m.id}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-[9px] text-slate-400 font-bold italic">Pendaki mandiri / solo</p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200/40 flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1 text-slate-500 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Total Rombongan</span>
                  </div>
                  <span className="font-mono font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                    {activeSimaksi.totalAnggota} Orang
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 p-4 border-t border-emerald-100">
            <p className="text-[10px] text-emerald-800 leading-relaxed font-medium italic">
              * Tunjukkan QR Code ini di setiap POS pemeriksaan jalur pendakian.
            </p>
          </div>
        </div>
      )}

      {/* State: ditolak */}
      {activeSimaksi?.status === 'rejected' && (
        <div className="bg-rose-50 border border-rose-100 rounded-3xl p-8 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="font-black text-rose-800 italic uppercase">Pengajuan Ditolak</h3>
          <p className="text-xs text-rose-500 font-medium">SIMAKSI Anda tidak disetujui. Silakan ajukan kembali.</p>
          <button
            onClick={() => setSearchParams({ view: 'simaksi' })}
            className="mt-2 bg-rose-600 text-white font-black px-6 py-3 rounded-2xl text-xs uppercase tracking-widest"
          >
            Daftar Ulang
          </button>
        </div>
      )}

      {/* Modal QR Lapor Kepulangan */}
      {showKepulangan && activeSimaksi && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[2000] flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-[2.5rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="bg-slate-800 p-6 text-white relative">
              <button
                onClick={() => setShowKepulangan(false)}
                className="absolute top-5 right-5 p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="bg-white/20 w-10 h-10 rounded-2xl flex items-center justify-center mb-3">
                <LogOut className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black italic uppercase tracking-tight">Lapor Kepulangan</h3>
              <p className="text-slate-300 text-[10px] font-bold uppercase tracking-widest opacity-70 mt-0.5">
                Tunjukkan ke petugas untuk dipindai
              </p>
            </div>

            <div className="p-8 flex flex-col items-center gap-4">
              <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 shadow-inner">
                <QRCodeSVG
                  value={`SUMMITY-RETURN-${activeSimaksi.simaksiId}`}
                  size={180}
                  level="H"
                  marginSize={2}
                />
              </div>

              <div className="text-center space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Kode Kepulangan</p>
                <p className="font-mono font-black text-slate-700 text-sm bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                  SUMMITY-RETURN-{activeSimaksi.simaksiId}
                </p>
                <p className="text-[8px] font-bold text-slate-400 italic mt-1">
                  {activeSimaksi.kodeSimaksi || `SIMAKSI #${activeSimaksi.simaksiId}`} • {activeSimaksi.ketuaName}
                </p>
              </div>

              <p className="text-[10px] text-center text-slate-400 font-medium italic max-w-[220px]">
                Setelah dipindai petugas, status SIMAKSI akan berubah menjadi <strong>Selesai</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
