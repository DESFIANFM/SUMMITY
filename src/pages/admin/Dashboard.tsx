import React, { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getAllTrackingHistory, getPendingSimaksi, getActiveSimaksiCount, approveSimaksi, rejectSimaksi } from '../../lib/db';
import { MOUNTAIN_POS } from '../../lib/mockData';
import { ScanLog } from '../../types';
import { Users, User, TrendingUp, Mail, Check, X, Calendar, ChevronLeft, ChevronRight, Info, QrCode, Printer, RefreshCw, Search } from 'lucide-react';
import { formatDateRange } from '../../lib/formatters';

export default function AdminDashboard() {
  const [hikerLocations, setHikerLocations] = useState<Record<number, { ascent: number, descent: number }>>({});
  const [allScans, setAllScans] = useState<ScanLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pendingSimaksi, setPendingSimaksi] = useState<any[]>([]);
  const [activeSimaksiCount, setActiveSimaksiCount] = useState(0);
  const [selectedSimaksi, setSelectedSimaksi] = useState<any | null>(null);
  const [isLoadingSimaksi, setIsLoadingSimaksi] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [pendingRejectItem, setPendingRejectItem] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  
  // QR Code Simulator page states
  const [activeQrTab, setActiveQrTab] = useState<'pos' | 'ticket'>('pos');
  const [selectedQrTicketId, setSelectedQrTicketId] = useState<string>('');
  const [fullscreenQr, setFullscreenQr] = useState<{ title: string; value: string; subtitle: string } | null>(null);
  
  const filteredScans = useMemo(() => {
    const seenCheckoutKeys = new Set<string>();
    let result = allScans.filter(log => {
      const isCheckout = log.validationStatus === 'checkout' || log.type === 'CHECK_OUT';
      if (isCheckout) {
        const key = log.kodeSimaksi || log.ticketId || 'unknown';
        if (seenCheckoutKeys.has(key)) return false;
        seenCheckoutKeys.add(key);
      }
      return true;
    });
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(log =>
        (log.kodeSimaksi || '').toLowerCase().includes(q) ||
        (log.ketuaName || '').toLowerCase().includes(q) ||
        (log.anggotaName || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [allScans, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredScans.length / itemsPerPage));

  const paginatedScans = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredScans.slice(start, start + itemsPerPage);
  }, [filteredScans, currentPage, itemsPerPage]);

  const fetchData = async () => {
    const scans = (await getAllTrackingHistory()) as ScanLog[];
    setAllScans(scans);

    setIsLoadingSimaksi(true);
    try {
      const [pending, activeCount] = await Promise.all([
        getPendingSimaksi(),
        getActiveSimaksiCount(),
      ]);
      setPendingSimaksi(pending);
      setActiveSimaksiCount(activeCount);
    } finally {
      setIsLoadingSimaksi(false);
    }

    const latestScansByTicket: Record<string, { posId: number; type: string; direction: 'ASCENT' | 'DESCENT' }> = {};
    const sortedScans = [...scans].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const ticketPeaks: Record<string, boolean> = {};

    sortedScans.forEach(scan => {
      if (!scan.ticketId) return;
      if (scan.posId === MOUNTAIN_POS.length - 1) ticketPeaks[scan.ticketId] = true;
      const isDescent = ticketPeaks[scan.ticketId] && scan.posId < MOUNTAIN_POS.length - 1;
      latestScansByTicket[scan.ticketId] = {
        posId: scan.posId ?? 0,
        type: scan.type || 'POST_CHECK',
        direction: isDescent ? 'DESCENT' : 'ASCENT'
      };
    });

    const locationCounts: Record<number, { ascent: number, descent: number }> = {};
    Object.values(latestScansByTicket).forEach(status => {
      if (status.type !== 'CHECK_OUT') {
        if (!locationCounts[status.posId]) locationCounts[status.posId] = { ascent: 0, descent: 0 };
        if (status.direction === 'ASCENT') locationCounts[status.posId].ascent += 1;
        else locationCounts[status.posId].descent += 1;
      }
    });
    setHikerLocations(locationCounts);
    setLastRefresh(new Date());
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (item: any) => {
    await approveSimaksi(item.simaksiId, item.localId);
    setSelectedSimaksi(null);
    await fetchData();
  };

  const openRejectModal = (item: any) => {
    setPendingRejectItem(item);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!pendingRejectItem) return;
    await rejectSimaksi(pendingRejectItem.simaksiId, pendingRejectItem.localId, rejectReason.trim() || undefined);
    setShowRejectModal(false);
    setPendingRejectItem(null);
    setRejectReason('');
    setSelectedSimaksi(null);
    await fetchData();
  };

  const totalActive = Object.values(hikerLocations).reduce((sum, loc) => sum + loc.ascent + loc.descent, 0);


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Dashboard Monitor</h2>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider hidden sm:block">
              {lastRefresh.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={isLoadingSimaksi}
            className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 text-[10px] px-3 py-1.5 rounded-full font-black uppercase tracking-wider hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingSimaksi ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
          <div className="bg-blue-100 w-10 h-10 rounded-2xl flex items-center justify-center mb-4">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-3xl font-black text-slate-800 mb-1">{activeSimaksiCount}</div>
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Pendaki Aktif</div>
        </div>

        <div className="bg-emerald-700 p-6 rounded-3xl shadow-lg border border-emerald-600 text-white">
          <div className="bg-white/20 w-10 h-10 rounded-2xl flex items-center justify-center mb-4">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div className="text-3xl font-black mb-1">{pendingSimaksi.length}</div>
          <div className="text-[10px] text-emerald-100 font-bold uppercase tracking-widest text-white/60">SIMAKSI Pending</div>
        </div>
      </div>

      {/* Permohonan SIMAKSI */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Permohonan SIMAKSI</h3>
          {isLoadingSimaksi && (
            <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest animate-pulse">Memuat...</span>
          )}
        </div>

        {pendingSimaksi.length > 0 ? (
          <div className="space-y-2">
            {pendingSimaksi.map((item) => (
              <div
                key={item.simaksiId}
                className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group transition-all hover:border-emerald-200"
              >
                <div
                  className="flex items-center gap-4 cursor-pointer flex-1"
                  onClick={() => setSelectedSimaksi(item)}
                >
                  <div className="bg-slate-100 p-3 rounded-2xl group-hover:bg-emerald-50 transition-colors">
                    <Calendar className="w-6 h-6 text-slate-400 group-hover:text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-slate-800 text-base leading-none italic">{item.ketuaName}</h4>
                      {item.source === 'local' && (
                        <span className="text-[7px] font-black uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded tracking-wider">Offline</span>
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      Gn. Slamet • {formatDateRange(item.tanggalNaik, item.tanggalTurun)}
                    </p>
                    <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mt-0.5">
                      {item.totalAnggota} orang • ID #{item.simaksiId}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openRejectModal(item)}
                    className="p-3 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-100 transition-colors"
                    title="Tolak"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleApprove(item)}
                    className="p-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-95"
                    title="Setujui"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : !isLoadingSimaksi ? (
          <div className="bg-white p-10 rounded-3xl border border-dashed border-slate-200 text-center">
            <p className="text-slate-400 font-bold text-xs italic uppercase tracking-widest">Tidak ada permohonan SIMAKSI baru</p>
          </div>
        ) : null}
      </div>

      {/* Detail Modal SIMAKSI */}
      {selectedSimaksi && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-end sm:items-center justify-center p-4">
          <div
            className="w-full max-w-lg bg-white rounded-[40px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-emerald-700 p-8 text-white relative shrink-0">
              <button
                onClick={() => setSelectedSimaksi(null)}
                className="absolute top-6 right-6 p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
                <Info className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-black italic uppercase tracking-tighter">Detail SIMAKSI</h3>
              <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest opacity-70">
                ID #{selectedSimaksi.simaksiId} • Verifikasi sebelum persetujuan
              </p>
            </div>

            <div className="p-8 space-y-4 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100 col-span-2">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ketua Kelompok</span>
                  </div>
                  <p className="font-black text-slate-800 italic uppercase text-lg">{selectedSimaksi.ketuaName}</p>
                  {selectedSimaksi.idPendaki && (
                    <p className="text-[9px] font-mono text-slate-400 mt-0.5">ID: {selectedSimaksi.idPendaki}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal Naik</span>
                  </div>
                  <p className="font-black text-slate-800 text-sm">{selectedSimaksi.tanggalNaik}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal Turun</span>
                  </div>
                  <p className="font-black text-slate-800 text-sm">{selectedSimaksi.tanggalTurun}</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Rombongan</span>
                </div>
                <span className="font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl text-sm">
                  {selectedSimaksi.totalAnggota} Orang
                </span>
              </div>

              <div className="p-4 bg-amber-50 rounded-3xl border border-amber-100 flex items-center justify-between">
                <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Status Saat Ini</span>
                <span className="font-black text-amber-700 uppercase text-xs bg-amber-100 px-3 py-1 rounded-xl">
                  {selectedSimaksi.status}
                </span>
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  onClick={() => openRejectModal(selectedSimaksi)}
                  className="flex-1 bg-slate-100 text-slate-600 font-black py-4 rounded-2xl text-xs uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all"
                >
                  Tolak
                </button>
                <button
                  onClick={() => handleApprove(selectedSimaksi)}
                  className="flex-[2] bg-emerald-600 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95"
                >
                  Setujui SIMAKSI
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= PUSAT CETAK & SIMULATOR QR CODE ================= */}
      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-md space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[9px] font-black uppercase text-emerald-600 tracking-[0.2em] block mb-1">
              Alat Verifikasi & Simulasi RAD
            </span>
            <h3 className="text-xl font-black italic text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <QrCode className="w-5 h-5 text-emerald-600 animate-pulse" />
              Pusat Cetak & Simulator QR Code
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Gunakan perangkat kamera PWA Anda untuk men-scan QR code di bawah ini selama pengujian sistem / sidang.
            </p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-2xl shrink-0 self-start sm:self-center">
            <button
              onClick={() => setActiveQrTab('pos')}
              className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${
                activeQrTab === 'pos'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              QR Pos Jalur
            </button>
            <button
              onClick={() => setActiveQrTab('ticket')}
              className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${
                activeQrTab === 'ticket'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              QR Tiket Pendaki
            </button>
          </div>
        </div>

        {activeQrTab === 'pos' ? (
          <div>
            <div className="bg-emerald-50 border border-emerald-100/50 p-4 rounded-2xl text-[10px] sm:text-xs text-emerald-800 font-bold mb-4 flex items-start gap-2 italic">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                QR Code Pos Jalur dicetak dan ditempel di setiap checkpoint. Gunakan <strong>Scanner di aplikasi Pendaki</strong> untuk memindai kode-kode ini guna memperbarui progress tracking perjalanan secara realtime.
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {MOUNTAIN_POS.map((pos) => {
                const qrValue = `SUMMITY-POS-${pos.id}`;
                return (
                  <div
                    key={pos.id}
                    className="bg-slate-50 rounded-2xl p-4 border border-slate-100/80 flex flex-col items-center justify-between text-center group hover:border-emerald-300 transition-all hover:shadow-md cursor-pointer"
                    onClick={() => setFullscreenQr({
                      title: pos.name,
                      value: qrValue,
                      subtitle: `Elevasi: ${pos.elevation} mdpl • Jarak: ${pos.distanceFromBase} km`
                    })}
                  >
                    <div className="text-[8px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-full mb-2">
                      POS {pos.id}
                    </div>
                    
                    <div className="bg-white p-2.5 rounded-xl shadow-inner border border-slate-100 mb-3 group-hover:scale-105 transition-transform">
                      <QRCodeSVG value={qrValue} size={64} level="M" />
                    </div>

                    <div className="space-y-1">
                      <h4 className="font-black text-slate-800 text-[10px] uppercase tracking-tight leading-none italic truncate max-w-[100px]">
                        {pos.name.replace(/Pos \d+: /, '')}
                      </h4>
                      <p className="text-[8px] font-bold text-slate-400 font-mono">
                        {pos.elevation} MDPL
                      </p>
                    </div>

                    <button
                      className="mt-3 text-[8px] font-black uppercase text-slate-400 group-hover:text-emerald-600 transition-colors flex items-center gap-1.5"
                    >
                      <span>Perbesar</span>
                      <ChevronRight className="w-2.5 h-2.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            <div className="bg-emerald-50 border border-emerald-100/50 p-4 rounded-2xl text-[10px] sm:text-xs text-emerald-800 font-bold mb-4 flex items-start gap-2 italic">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                QR Tiket Pendaki berada di HP Pendaki. Gunakan <strong>Scanner Petugas</strong> untuk memindai kode tiket pendaki ini guna mencatat check-in masuk atau checkout keluar secara offline/online di pos basecamp.
              </span>
            </div>

            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-4 w-full md:max-w-xs">
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Pilih Pendaki Terdaftar</label>
                  <select
                    value={selectedQrTicketId}
                    onChange={(e) => setSelectedQrTicketId(e.target.value)}
                    className="w-full mt-1.5 p-3 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">-- Pilih Tiket Pendaki --</option>
                    <option value="SUMMITY-USER-9942">Ahmad Fauzi (Gn. Slamet) - Demo Hiker</option>
                    <option value="SUMMITY-USER-8831">Budi Setiawan (Gn. Slamet) - Demo Hiker</option>
                  </select>
                </div>

                {selectedQrTicketId ? (
                  <div className="space-y-2 bg-white/50 p-3 rounded-2xl border border-slate-100">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Konten QR Code:</div>
                    <div className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg break-all">
                      {selectedQrTicketId}
                    </div>
                  </div>
                ) : (
                  <p className="text-[10.5px] text-slate-400 leading-relaxed font-medium">
                    Silakan pilih salah satu pendaki dari daftar di atas untuk men-generate QR Tiket pendaki secara instan.
                  </p>
                )}
              </div>

              <div className="flex flex-col items-center justify-center p-4 bg-white border border-slate-100 rounded-3xl shrink-0 w-44 shadow-inner min-h-[190px]">
                {selectedQrTicketId ? (
                  <>
                    <div className="p-3 bg-slate-50 rounded-2xl mb-3 border border-slate-100">
                      <QRCodeSVG value={selectedQrTicketId} size={110} level="H" includeMargin={true} />
                    </div>
                    <button
                      onClick={() => setFullscreenQr({
                        title: `Tiket: ${selectedQrTicketId}`,
                        value: selectedQrTicketId,
                        subtitle: "Gunakan Scanner Petugas (Admin) untuk memindai tiket pendaki ini"
                      })}
                      className="text-[9px] font-black uppercase text-emerald-600 tracking-wider hover:underline"
                    >
                      Buka Layar Penuh
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 text-slate-300">
                    <QrCode className="w-12 h-12 stroke-[1.5]" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-center leading-none">Menunggu Pilihan</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reject Reason Modal */}
      {showRejectModal && pendingRejectItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2100] flex items-end sm:items-center justify-center p-4">
          <div
            className="w-full max-w-md bg-white rounded-[2.5rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-blue-700 p-7 text-white relative">
              <button
                onClick={() => { setShowRejectModal(false); setPendingRejectItem(null); setRejectReason(''); }}
                className="absolute top-5 right-5 p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="bg-white/20 w-10 h-10 rounded-2xl flex items-center justify-center mb-3">
                <X className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black italic uppercase tracking-tight">Tolak SIMAKSI</h3>
              <p className="text-blue-200 text-[10px] font-bold uppercase tracking-widest opacity-70 mt-0.5">
                {pendingRejectItem.ketuaName} • ID #{pendingRejectItem.simaksiId}
              </p>
            </div>

            <div className="p-7 space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Alasan Penolakan
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value.slice(0, 250))}
                  placeholder="Tuliskan alasan penolakan..."
                  rows={4}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:bg-white transition-all resize-none placeholder:text-slate-300"
                />
                <div className="text-right mt-1.5">
                  <span className={`text-[9px] font-black tabular-nums ${rejectReason.length >= 250 ? 'text-blue-600' : 'text-slate-300'}`}>
                    {rejectReason.length}/250
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowRejectModal(false); setPendingRejectItem(null); setRejectReason(''); }}
                  className="flex-1 bg-slate-100 text-slate-600 font-black py-3.5 rounded-2xl text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={handleReject}
                  className="flex-[2] bg-blue-700 text-white font-black py-3.5 rounded-2xl text-xs uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-800 transition-all active:scale-95"
                >
                  Tolak SIMAKSI
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen QR Modal */}
      {fullscreenQr && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full text-center relative border border-slate-100 shadow-2xl animate-in zoom-in-95 duration-300">
            <button
              onClick={() => setFullscreenQr(null)}
              className="absolute top-5 right-5 w-10 h-10 bg-slate-100 text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-all rounded-full flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.3em] block mb-2">
              Summury PWA QR Checkpoint
            </span>
            <h3 className="text-xl font-black italic uppercase text-slate-800 tracking-tight leading-snug">
              {fullscreenQr.title}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-6">
              {fullscreenQr.subtitle}
            </p>

            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 shadow-inner inline-block mx-auto mb-6">
              <QRCodeSVG value={fullscreenQr.value} size={200} level="H" includeMargin={true} />
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50/80 p-3.5 rounded-2xl text-left border border-slate-100">
                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Raw Code Value:</div>
                <div className="text-xs font-mono font-bold text-slate-700 select-all break-all">{fullscreenQr.value}</div>
              </div>
              <button
                onClick={() => window.print()}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Cetak Kode QR
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl">
        <h3 className="font-bold text-xs uppercase tracking-[0.2em] opacity-40 mb-8 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          Sebaran Pendaki
        </h3>
        <div className="space-y-6">
          {MOUNTAIN_POS.map(pos => {
            const data = hikerLocations[pos.id] || { ascent: 0, descent: 0 };
            const count = data.ascent + data.descent;
            const percentage = totalActive > 0 ? (count / totalActive) * 100 : 0;
            return (
              <div key={pos.id}>
                <div className="flex justify-between items-center text-xs mb-3">
                  <span className="font-bold text-slate-400">{pos.name}</span>
                  <div className="flex gap-2">
                    {data.ascent > 0 && <span className="font-black text-emerald-400 px-2 py-0.5 bg-emerald-400/10 rounded-lg">↑ {data.ascent}</span>}
                    {data.descent > 0 && <span className="font-black text-blue-400 px-2 py-0.5 bg-blue-400/10 rounded-lg">↓ {data.descent}</span>}
                    {count === 0 && <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest opacity-30 mt-1">Kosong</span>}
                  </div>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden flex">
                  {totalActive > 0 && (
                    <>
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-1000"
                        style={{ width: `${(data.ascent / totalActive) * 100}%` }}
                      ></div>
                      <div 
                        className="h-full bg-blue-500 transition-all duration-1000"
                        style={{ width: `${(data.descent / totalActive) * 100}%` }}
                      ></div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Log Aktivitas Terbaru</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowSearch(s => !s); setSearchQuery(''); setCurrentPage(1); }}
              title="Cari Simaksi"
              className={`p-1.5 rounded-xl transition-all ${showSearch ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
            >
              <Search className="w-3.5 h-3.5" />
            </button>
            {showSearch && (
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Nomor Simaksi"
                autoFocus
                className="w-40 text-xs font-medium text-slate-700 px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-400 transition-all placeholder:text-slate-300"
              />
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 divide-y divide-slate-50 overflow-hidden shadow-sm">
          {paginatedScans.length > 0 ? paginatedScans.map(log => {
            const isCheckout = log.validationStatus === 'checkout' || log.type === 'CHECK_OUT';
            return (
            <div key={`${log.id}-${log.timestamp}`} className={`p-4 flex items-center justify-between transition-colors ${
              isCheckout ? 'bg-rose-50 hover:bg-rose-100/60' : 'hover:bg-slate-50/50'
            }`}>
              <div className="flex items-center gap-4">
                <div className={`w-2.5 h-2.5 rounded-full shadow-sm shrink-0 ${
                  isCheckout ? 'bg-rose-500' : (log.type === 'CHECK_IN' ? 'bg-emerald-500' : 'bg-sky-500')
                }`}></div>
                <div>
                  <div className={`text-sm font-black ${isCheckout ? 'text-rose-700' : 'text-slate-700'}`}>
                    {log.kodeSimaksi
                      ? `${log.kodeSimaksi} - ${log.ketuaName || 'Ketua'}`
                      : (log.anggotaName || log.ticketId)}
                  </div>
                  <div className={`text-[10px] font-bold uppercase ${isCheckout ? 'text-rose-400' : 'text-slate-400'}`}>
                    {isCheckout
                      ? 'Lapor Kepulangan Pendaki'
                      : `${log.anggotaName || 'Pendaki'} • ${MOUNTAIN_POS[log.posId || 0]?.name || 'Lokasi Tidak Diketahui'}`
                    }
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0 ml-2">
                <div className={`text-xs font-black ${isCheckout ? 'text-rose-600' : 'text-slate-600'}`}>
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className={`text-[9px] font-black uppercase tracking-tighter ${
                  isCheckout ? 'text-rose-500' : (log.type === 'CHECK_IN' ? 'text-emerald-500' : 'text-sky-500')
                }`}>
                  {isCheckout ? 'CHECK-OUT' : (log.type || 'POST_CHECK').replace('_', ' ')}
                </div>
              </div>
            </div>
            );
          }) : (
            <div className="p-10 text-center text-slate-300 text-xs font-bold uppercase tracking-widest italic">
              {searchQuery ? 'Tidak ada hasil pencarian' : 'Tidak ada aktivitas'}
            </div>
          )}

          {filteredScans.length > 0 && (
            <div className="px-4 py-3 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider hidden sm:block mr-1">Tampilkan</span>
                {[5, 10, 20, 30].map(n => (
                  <button
                    key={n}
                    onClick={() => { setItemsPerPage(n); setCurrentPage(1); }}
                    className={`w-6 h-6 text-[9px] font-black rounded-lg transition-all ${
                      itemsPerPage === n
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-slate-400 font-bold tabular-nums">
                  {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredScans.length)}/{filteredScans.length}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="w-6 h-6 bg-white border border-slate-200 text-slate-500 rounded-lg flex items-center justify-center hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="w-6 h-6 bg-white border border-slate-200 text-slate-500 rounded-lg flex items-center justify-center hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
