import React, { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  getAllTrackingHistory,
  getPendingSimaksi,
  getActiveSimaksiCount,
  approveSimaksi,
  rejectSimaksi,
  getSimaksiDetail,
  getHikerStatuses,
  getMandatoryGear,
  getSimaksiGear,
  getSimaksiMembers,
  getLastScanForUsers,
} from '../../lib/db';
import type { SimaksiDetail, SimaksiPersonDetail, HikerStatusRow, HikerTripStatus, GearItem, LastScanInfo } from '../../lib/db';
import { MOUNTAIN_POS } from '../../lib/mockData';
import { ScanLog } from '../../types';
import { Users, User, TrendingUp, Mail, Check, X, Calendar, ChevronLeft, ChevronRight, Info, QrCode, Printer, RefreshCw, Search, Map, Phone, MapPin, CreditCard, Crown, CheckSquare, Square, Package, ChevronDown, Mountain, Clock, Navigation } from 'lucide-react';
import { formatDateRange, formatSingleDate } from '../../lib/formatters';
import GPSMap from '../../components/GPSMap';
import { motion, AnimatePresence } from 'motion/react';

// Label + warna untuk tiap status perjalanan pendaki, dipakai chip filter & badge.
const HIKER_STATUS_META: Record<HikerTripStatus, { label: string; short: string; dot: string; chip: string; badge: string }> = {
  DI_PERJALANAN: {
    label: 'Masih di Perjalanan',
    short: 'Di Perjalanan',
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-600 text-white shadow-sm',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  },
  SUDAH_PULANG: {
    label: 'Sudah Lapor Pulang',
    short: 'Lapor Pulang',
    dot: 'bg-sky-500',
    chip: 'bg-sky-600 text-white shadow-sm',
    badge: 'bg-sky-50 text-sky-700 border-sky-100',
  },
  MENUNGGU: {
    label: 'Menunggu Verifikasi',
    short: 'Menunggu',
    dot: 'bg-amber-500',
    chip: 'bg-amber-500 text-white shadow-sm',
    badge: 'bg-amber-50 text-amber-700 border-amber-100',
  },
  TIDAK_ADA: {
    label: 'Tidak Ada Perjalanan',
    short: 'Tidak Ada',
    dot: 'bg-slate-300',
    chip: 'bg-slate-700 text-white shadow-sm',
    badge: 'bg-slate-50 text-slate-500 border-slate-200',
  },
};

/** Satu rombongan yang sedang berada di sebuah pos. */
interface PosSimaksi {
  key: string;
  simaksiId: number | null;
  kodeSimaksi: string;
  ketuaName: string;
  pendaki: { name: string; direction: 'ASCENT' | 'DESCENT' }[];
}

const HIKER_STATUS_ORDER: HikerTripStatus[] = ['DI_PERJALANAN', 'SUDAH_PULANG', 'MENUNGGU', 'TIDAK_ADA'];

const SIMAKSI_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  pending: 'Menunggu Verifikasi',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  checkin: 'Check-In',
  checkout: 'Check-Out',
  complete: 'Selesai',
};

function DetailField({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="w-3 h-3 text-slate-300 shrink-0" />
        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-[11px] font-bold text-slate-700 break-words">{value || '—'}</p>
    </div>
  );
}

function PersonCard({ person, isKetua }: { person: SimaksiPersonDetail; isKetua: boolean }) {
  return (
    <div className={`p-4 rounded-3xl border ${isKetua ? 'bg-emerald-50/60 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {isKetua ? <Crown className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
            <span className={`text-[8px] font-black uppercase tracking-widest ${isKetua ? 'text-emerald-600' : 'text-slate-400'}`}>
              {isKetua ? 'Ketua Kelompok' : 'Anggota'}
            </span>
          </div>
          <p className="font-black text-slate-800 italic uppercase text-sm leading-tight mt-1 break-words">{person.name}</p>
        </div>
        {person.idPendaki && (
          <span className="text-[8px] font-mono font-bold text-slate-400 bg-white border border-slate-100 px-2 py-1 rounded-lg shrink-0">
            {person.idPendaki}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <DetailField icon={CreditCard} label={person.identityType || 'NIK / Identitas'} value={person.nik} />
        <DetailField icon={User} label="Jenis Kelamin" value={person.gender} />
        <DetailField icon={Phone} label="No. Telepon" value={person.phone} />
        <DetailField icon={Phone} label="Kontak Darurat" value={person.emergencyPhone} />
        <div className="col-span-2">
          <DetailField icon={MapPin} label="Alamat" value={person.address} />
        </div>
      </div>
    </div>
  );
}

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
  const [showTrackingMap, setShowTrackingMap] = useState(false);
  
  // Detail SIMAKSI yang dibuka dari log aktivitas / hasil pencarian pendaki
  const [detailSimaksi, setDetailSimaksi] = useState<SimaksiDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Ceklis perlengkapan: katalog lengkap + kode yang dicentang pendaki
  const [gearCatalog, setGearCatalog] = useState<GearItem[]>([]);

  // Rincian penghuni tiap pos, untuk modal "Sebaran Pendaki"
  const [posOccupants, setPosOccupants] = useState<Record<number, PosSimaksi[]>>({});
  const [openPosId, setOpenPosId] = useState<number | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [memberCache, setMemberCache] = useState<Record<number, { id: string; name: string }[]>>({});
  const [detailGearKodes, setDetailGearKodes] = useState<string[] | null>(null);

  // Konteks check-in: baris log yang diklik, dan posisi aktual rombongan
  const [detailFromLog, setDetailFromLog] = useState<{ posId: number; timestamp: string; type?: string } | null>(null);
  const [detailLastScan, setDetailLastScan] = useState<LastScanInfo | null | undefined>(undefined);

  // Pencarian pendaki + filter status perjalanan
  const [hikers, setHikers] = useState<HikerStatusRow[]>([]);
  const [hikerQuery, setHikerQuery] = useState('');
  const [hikerStatusFilter, setHikerStatusFilter] = useState<'ALL' | HikerTripStatus>('ALL');

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

  const hikerStatusCounts = useMemo(() => {
    const counts: Record<HikerTripStatus, number> = {
      DI_PERJALANAN: 0, SUDAH_PULANG: 0, MENUNGGU: 0, TIDAK_ADA: 0,
    };
    hikers.forEach(h => { counts[h.status] += 1; });
    return counts;
  }, [hikers]);

  const filteredHikers = useMemo(() => {
    const q = hikerQuery.trim().toLowerCase();
    return hikers.filter(h => {
      if (hikerStatusFilter !== 'ALL' && h.status !== hikerStatusFilter) return false;
      if (!q) return true;
      return (
        h.name.toLowerCase().includes(q) ||
        (h.idPendaki || '').toLowerCase().includes(q) ||
        (h.kodeSimaksi || '').toLowerCase().includes(q) ||
        (h.nik || '').toLowerCase().includes(q)
      );
    });
  }, [hikers, hikerQuery, hikerStatusFilter]);

  const fetchData = async () => {
    const scans = (await getAllTrackingHistory()) as ScanLog[];
    setAllScans(scans);

    setIsLoadingSimaksi(true);
    try {
      const [pending, activeCount, hikerRows] = await Promise.all([
        getPendingSimaksi(),
        getActiveSimaksiCount(),
        getHikerStatuses(),
      ]);
      setPendingSimaksi(pending);
      setActiveSimaksiCount(activeCount);
      setHikers(hikerRows);
    } finally {
      setIsLoadingSimaksi(false);
    }

    // Selain jumlah per pos, kumpulkan juga SIAPA yang ada di sana supaya
    // daftar pos bisa diklik untuk melihat rinciannya.
    const latestScansByTicket: Record<string, {
      posId: number; type: string; direction: 'ASCENT' | 'DESCENT';
      simaksiId: number | null; kodeSimaksi: string; ketuaName: string; anggotaName: string;
    }> = {};
    const sortedScans = [...scans].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const ticketPeaks: Record<string, boolean> = {};

    sortedScans.forEach(scan => {
      if (!scan.ticketId) return;
      if (scan.posId === MOUNTAIN_POS.length - 1) ticketPeaks[scan.ticketId] = true;
      const isDescent = ticketPeaks[scan.ticketId] && scan.posId < MOUNTAIN_POS.length - 1;
      latestScansByTicket[scan.ticketId] = {
        posId: scan.posId ?? 0,
        type: scan.type || 'POST_CHECK',
        direction: isDescent ? 'DESCENT' : 'ASCENT',
        simaksiId: typeof scan.simaksiId === 'number' ? scan.simaksiId : null,
        kodeSimaksi: scan.kodeSimaksi || '',
        ketuaName: scan.ketuaName || 'Ketua',
        anggotaName: scan.anggotaName || 'Pendaki',
      };
    });

    const locationCounts: Record<number, { ascent: number, descent: number }> = {};
    const occupants: Record<number, PosSimaksi[]> = {};

    Object.values(latestScansByTicket).forEach(status => {
      if (status.type === 'CHECK_OUT') return;  // sudah lapor pulang

      if (!locationCounts[status.posId]) locationCounts[status.posId] = { ascent: 0, descent: 0 };
      if (status.direction === 'ASCENT') locationCounts[status.posId].ascent += 1;
      else locationCounts[status.posId].descent += 1;

      // Kelompokkan per rombongan. Log lama tanpa simaksiId dikelompokkan
      // sendiri memakai kode simaksi/nama sebagai kunci cadangan.
      const key = status.simaksiId !== null
        ? `s${status.simaksiId}`
        : `k${status.kodeSimaksi || status.ketuaName}`;

      if (!occupants[status.posId]) occupants[status.posId] = [];
      let grup = occupants[status.posId].find(g => g.key === key);
      if (!grup) {
        grup = {
          key,
          simaksiId: status.simaksiId,
          kodeSimaksi: status.kodeSimaksi || '(tanpa kode)',
          ketuaName: status.ketuaName,
          pendaki: [],
        };
        occupants[status.posId].push(grup);
      }
      grup.pendaki.push({ name: status.anggotaName, direction: status.direction });
    });

    setHikerLocations(locationCounts);
    setPosOccupants(occupants);
    setLastRefresh(new Date());
  };

  useEffect(() => {
    fetchData();
    getMandatoryGear().then(setGearCatalog);
  }, []);

  const openSimaksiDetail = async (
    simaksiId: number,
    fromLog?: { posId: number; timestamp: string; type?: string },
  ) => {
    setIsDetailOpen(true);
    setIsLoadingDetail(true);
    setDetailSimaksi(null);
    setDetailError(null);
    setDetailGearKodes(null);
    setDetailFromLog(fromLog ?? null);
    setDetailLastScan(undefined);
    try {
      getSimaksiGear(simaksiId).then(g => setDetailGearKodes(g.map(x => x.kode)));
      const detail = await getSimaksiDetail(simaksiId);
      if (detail) {
        setDetailSimaksi(detail);
        // Posisi aktual: scan terakhir dari seluruh anggota rombongan.
        const ids = [detail.ketua?.userId, ...detail.members.map(m => m.userId)].filter(Boolean) as string[];
        getLastScanForUsers(ids).then(setDetailLastScan);
      } else {
        setDetailError('Detail SIMAKSI tidak ditemukan.');
      }
    } catch (err) {
      console.warn('[DASHBOARD] Gagal memuat detail SIMAKSI:', err);
      setDetailError('Gagal memuat detail SIMAKSI. Periksa koneksi lalu coba lagi.');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  /** Buka rincian satu pos. Akordeon selalu mulai tertutup. */
  const openPos = (posId: number) => {
    if (!(posOccupants[posId] || []).length) return;   // pos kosong, tidak perlu dibuka
    setOpenPosId(posId);
    setExpandedKey(null);
  };

  /**
   * Buka/tutup rincian satu rombongan. Daftar anggota diambil sekali lalu
   * disimpan di cache, supaya membuka-tutup berulang tidak memanggil ulang.
   */
  const toggleGrup = async (grup: PosSimaksi) => {
    if (expandedKey === grup.key) { setExpandedKey(null); return; }
    setExpandedKey(grup.key);

    if (grup.simaksiId !== null && !memberCache[grup.simaksiId]) {
      const anggota = await getSimaksiMembers(grup.simaksiId);
      setMemberCache(prev => ({ ...prev, [grup.simaksiId as number]: anggota }));
    }
  };

  const closeSimaksiDetail = () => {
    setIsDetailOpen(false);
    setDetailSimaksi(null);
    setDetailError(null);
    setDetailFromLog(null);
    setDetailLastScan(undefined);
  };

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

      {/* ================= TRACKING MONITOR MAP ================= */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-md overflow-hidden">
        <button
          onClick={() => setShowTrackingMap(v => !v)}
          className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="bg-emerald-50 p-2.5 rounded-2xl">
              <Map className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-left">
              <span className="text-[9px] font-black uppercase text-emerald-600 tracking-[0.2em] block">Live GPS</span>
              <span className="text-sm font-black italic text-slate-800 uppercase tracking-tight">Tracking Monitor</span>
            </div>
          </div>
          <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showTrackingMap ? 'rotate-90' : ''}`} />
        </button>

        {showTrackingMap && (
          <div className="p-4 pt-0">
            <GPSMap currentPosIndex={0} mountainName="Gn. Slamet" />
          </div>
        )}
      </div>

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
            const bisaDibuka = count > 0;
            return (
              <div key={pos.id}>
                <button
                  type="button"
                  onClick={() => openPos(pos.id)}
                  disabled={!bisaDibuka}
                  title={bisaDibuka ? `Lihat rombongan di ${pos.name}` : 'Tidak ada pendaki di pos ini'}
                  className={`w-full text-left flex justify-between items-center text-xs mb-3 rounded-xl transition-colors ${
                    bisaDibuka ? 'cursor-pointer hover:bg-white/5 -mx-2 px-2 py-1' : 'cursor-default'
                  }`}
                >
                  <span className="font-bold text-slate-400 flex items-center gap-1.5">
                    {pos.name}
                    {bisaDibuka && <ChevronRight className="w-3 h-3 text-slate-600" />}
                  </span>
                  <div className="flex gap-2">
                    {data.ascent > 0 && <span className="font-black text-emerald-400 px-2 py-0.5 bg-emerald-400/10 rounded-lg">↑ {data.ascent}</span>}
                    {data.descent > 0 && <span className="font-black text-blue-400 px-2 py-0.5 bg-blue-400/10 rounded-lg">↓ {data.descent}</span>}
                    {count === 0 && <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest opacity-30 mt-1">Kosong</span>}
                  </div>
                </button>
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

      {/* ================= PENCARIAN PENDAKI & STATUS PERJALANAN ================= */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Cari Pendaki & Status</h3>
          <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider tabular-nums">
            {filteredHikers.length}/{hikers.length} Pendaki
          </span>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 space-y-3 border-b border-slate-50">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-300 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={hikerQuery}
                onChange={(e) => setHikerQuery(e.target.value)}
                placeholder="Cari nama pendaki, ID pendaki, NIK, atau kode simaksi..."
                className="w-full text-xs font-medium text-slate-700 pl-11 pr-10 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-emerald-400 focus:bg-white transition-all placeholder:text-slate-300"
              />
              {hikerQuery && (
                <button
                  onClick={() => setHikerQuery('')}
                  title="Bersihkan pencarian"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-300 hover:bg-slate-100 hover:text-slate-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setHikerStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                  hikerStatusFilter === 'ALL'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-500 border border-slate-100 hover:bg-slate-100'
                }`}
              >
                Semua <span className="tabular-nums opacity-60">{hikers.length}</span>
              </button>
              {HIKER_STATUS_ORDER.map(st => {
                const meta = HIKER_STATUS_META[st];
                const active = hikerStatusFilter === st;
                return (
                  <button
                    key={st}
                    onClick={() => setHikerStatusFilter(st)}
                    title={meta.label}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                      active ? meta.chip : 'bg-slate-50 text-slate-500 border border-slate-100 hover:bg-slate-100'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white/80' : meta.dot}`}></span>
                    {meta.short} <span className="tabular-nums opacity-60">{hikerStatusCounts[st]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="divide-y divide-slate-50 max-h-[420px] overflow-y-auto">
            {filteredHikers.length > 0 ? filteredHikers.map(h => {
              const meta = HIKER_STATUS_META[h.status];
              const clickable = h.simaksiId !== null;
              return (
                <button
                  key={h.userId}
                  onClick={() => clickable && openSimaksiDetail(h.simaksiId as number)}
                  disabled={!clickable}
                  className={`w-full text-left p-4 flex items-center justify-between gap-3 transition-colors ${
                    clickable ? 'hover:bg-emerald-50/40 cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dot}`}></span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-slate-700 truncate">{h.name}</span>
                        {h.isKetua && h.simaksiId !== null && (
                          <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                        )}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                        {h.simaksiId !== null
                          ? `${h.kodeSimaksi ? h.kodeSimaksi + ' • ' : ''}${formatDateRange(h.tanggalNaik || '', h.tanggalTurun || '')}`
                          : (h.idPendaki || 'Belum pernah mengajukan simaksi')}
                      </div>
                    </div>
                  </div>
                  <span className={`text-[8px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-xl border shrink-0 ${meta.badge}`}>
                    {meta.label}
                  </span>
                </button>
              );
            }) : (
              <div className="p-10 text-center text-slate-300 text-xs font-bold uppercase tracking-widest italic">
                {hikers.length === 0 ? 'Belum ada data pendaki' : 'Tidak ada pendaki yang cocok'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Log Aktivitas Terbaru</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowSearch(s => !s); setSearchQuery(''); setCurrentPage(1); }}
              title="Cari kode simaksi atau nama pendaki"
              className={`p-1.5 rounded-xl transition-all ${showSearch ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
            >
              <Search className="w-3.5 h-3.5" />
            </button>
            {showSearch && (
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Kode simaksi / nama"
                autoFocus
                className="w-40 text-xs font-medium text-slate-700 px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-400 transition-all placeholder:text-slate-300"
              />
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 divide-y divide-slate-50 overflow-hidden shadow-sm">
          {paginatedScans.length > 0 ? paginatedScans.map(log => {
            const isCheckout = log.validationStatus === 'checkout' || log.type === 'CHECK_OUT';
            // Log lama / hasil scan offline belum membawa simaksiId — baris itu tidak bisa dibuka.
            const clickable = typeof log.simaksiId === 'number';
            return (
            <button
              key={`${log.id}-${log.timestamp}`}
              onClick={() => clickable && openSimaksiDetail(log.simaksiId as number, {
                posId: log.posId ?? 0,
                timestamp: log.timestamp,
                type: isCheckout ? 'CHECK_OUT' : (log.type || 'POST_CHECK'),
              })}
              disabled={!clickable}
              title={clickable ? 'Lihat detail SIMAKSI' : 'Detail SIMAKSI tidak tersedia untuk log ini'}
              className={`w-full text-left p-4 flex items-center justify-between transition-colors ${isCheckout ? 'bg-rose-50' : ''} ${
                clickable
                  ? `cursor-pointer ${isCheckout ? 'hover:bg-rose-100/60' : 'hover:bg-slate-50/50'}`
                  : 'cursor-default'
              }`}
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className={`w-2.5 h-2.5 rounded-full shadow-sm shrink-0 ${
                  isCheckout ? 'bg-rose-500' : (log.type === 'CHECK_IN' ? 'bg-emerald-500' : 'bg-sky-500')
                }`}></div>
                <div className="min-w-0">
                  <div className={`text-sm font-black flex items-center gap-1.5 ${isCheckout ? 'text-rose-700' : 'text-slate-700'}`}>
                    <span className="truncate">
                      {log.kodeSimaksi
                        ? `${log.kodeSimaksi} - ${log.ketuaName || 'Ketua'}`
                        : (log.anggotaName || log.ticketId)}
                    </span>
                    {clickable && (
                      <Info className={`w-3 h-3 shrink-0 ${isCheckout ? 'text-rose-300' : 'text-slate-300'}`} />
                    )}
                  </div>
                  <div className={`text-[10px] font-bold uppercase truncate ${isCheckout ? 'text-rose-400' : 'text-slate-400'}`}>
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
            </button>
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

      {/* ================= RINCIAN PENGHUNI POS ================= */}
      <AnimatePresence>
        {openPosId !== null && (
          <motion.div
            key="pos-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 m-0 bg-slate-950/70 backdrop-blur-sm z-[2200] flex items-end sm:items-center justify-center p-4"
            onClick={() => setOpenPosId(null)}
          >
            <motion.div
              initial={{ y: 28, scale: 0.97, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 20, scale: 0.98, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="w-full max-w-lg bg-slate-900 rounded-[36px] overflow-hidden shadow-2xl max-h-[85vh] flex flex-col text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-7 pb-5 shrink-0 border-b border-white/5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Mountain className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400">Rombongan di Pos</span>
                    </div>
                    <h3 className="text-xl font-black italic uppercase tracking-tight leading-tight break-words">
                      {MOUNTAIN_POS[openPosId]?.name}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                      {MOUNTAIN_POS[openPosId]?.elevation} mdpl ·{' '}
                      {(posOccupants[openPosId] || []).reduce((n, g) => n + g.pendaki.length, 0)} pendaki
                    </p>
                  </div>
                  <button
                    onClick={() => setOpenPosId(null)}
                    className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-2 flex-1 overflow-y-auto">
                {(posOccupants[openPosId] || []).map(grup => {
                  const terbuka = expandedKey === grup.key;
                  const anggota = grup.simaksiId !== null ? memberCache[grup.simaksiId] : undefined;
                  return (
                    <div
                      key={grup.key}
                      className={`rounded-3xl border overflow-hidden transition-colors ${
                        terbuka ? 'bg-white/[0.07] border-emerald-500/30' : 'bg-white/[0.03] border-white/5'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleGrup(grup)}
                        className="w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-white/[0.04] transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="font-black text-sm text-white truncate">{grup.kodeSimaksi}</div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate mt-0.5">
                            <Crown className="w-2.5 h-2.5 inline text-amber-500 mr-1 -mt-0.5" />
                            {grup.ketuaName} · {grup.pendaki.length} pendaki
                          </div>
                        </div>
                        <motion.div
                          animate={{ rotate: terbuka ? 180 : 0 }}
                          transition={{ duration: 0.22 }}
                          className="shrink-0"
                        >
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        </motion.div>
                      </button>

                      <AnimatePresence initial={false}>
                        {terbuka && (
                          <motion.div
                            key="isi"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ height: { duration: 0.26, ease: [0.4, 0, 0.2, 1] }, opacity: { duration: 0.18 } }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 pt-1 space-y-3">
                              <div>
                                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">Ketua</span>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                                  <span className="text-xs font-bold text-white truncate">{grup.ketuaName}</span>
                                </div>
                              </div>

                              <div>
                                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">
                                  Anggota {anggota ? `(${anggota.length})` : ''}
                                </span>
                                <div className="mt-1.5 space-y-1.5">
                                  {grup.simaksiId === null ? (
                                    <p className="text-[10px] font-bold text-slate-500 italic">
                                      Data rombongan tidak tersedia untuk log lama ini.
                                    </p>
                                  ) : anggota === undefined ? (
                                    <p className="text-[10px] font-bold text-slate-500 italic">Memuat…</p>
                                  ) : anggota.length === 0 ? (
                                    <p className="text-[10px] font-bold text-slate-500 italic">
                                      Pendakian solo — tanpa anggota tambahan.
                                    </p>
                                  ) : (
                                    anggota.map((a, i) => (
                                      <div key={a.id || i} className="flex items-center gap-2">
                                        <User className="w-3 h-3 text-slate-500 shrink-0" />
                                        <span className="text-xs font-bold text-slate-300 truncate">{a.name}</span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>

                              <div className="pt-1">
                                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">Terpantau di pos ini</span>
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {grup.pendaki.map((h, i) => (
                                    <span
                                      key={i}
                                      className={`text-[9px] font-bold px-2 py-1 rounded-lg ${
                                        h.direction === 'ASCENT'
                                          ? 'bg-emerald-400/10 text-emerald-400'
                                          : 'bg-blue-400/10 text-blue-400'
                                      }`}
                                    >
                                      {h.direction === 'ASCENT' ? '↑' : '↓'} {h.name}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {grup.simaksiId !== null && (
                                <button
                                  onClick={() => { setOpenPosId(null); openSimaksiDetail(grup.simaksiId as number); }}
                                  className="w-full mt-1 py-2.5 bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase tracking-widest rounded-xl transition-colors text-slate-300"
                                >
                                  Lihat Detail SIMAKSI
                                </button>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= DETAIL SIMAKSI (dari log aktivitas / pencarian) ================= */}
      {isDetailOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2100] flex items-end sm:items-center justify-center p-4"
          onClick={closeSimaksiDetail}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-[40px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900 p-8 text-white relative shrink-0">
              <button
                onClick={closeSimaksiDetail}
                className="absolute top-6 right-6 p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
                <Info className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-black italic uppercase tracking-tighter">
                {detailSimaksi?.kodeSimaksi || 'Detail SIMAKSI'}
              </h3>
              <p className="text-slate-300 text-xs font-bold uppercase tracking-widest opacity-70">
                {detailSimaksi
                  ? `ID #${detailSimaksi.simaksiId} • ${SIMAKSI_STATUS_LABEL[detailSimaksi.status] || detailSimaksi.status}`
                  : 'Memuat data pendaki…'}
              </p>
            </div>

            <div className="p-8 space-y-4 flex-1 overflow-y-auto">
              {isLoadingDetail && (
                <div className="py-10 flex flex-col items-center gap-3">
                  <RefreshCw className="w-6 h-6 text-slate-300 animate-spin" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Memuat detail…</span>
                </div>
              )}

              {!isLoadingDetail && detailError && (
                <div className="p-6 bg-rose-50 border border-rose-100 rounded-3xl text-center">
                  <p className="text-xs font-bold text-rose-600">{detailError}</p>
                </div>
              )}

              {!isLoadingDetail && detailSimaksi && (
                <>
                  {detailSimaksi.source === 'local' && (
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-3xl flex items-start gap-2">
                      <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
                        Data diambil dari penyimpanan offline. Nomor identitas dan kontak baru tampil setelah perangkat kembali online.
                      </p>
                    </div>
                  )}

                  {/* Konteks pemindaian: baris log yang diklik + posisi aktual */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {detailFromLog && (
                      <div className="p-4 bg-sky-50/60 rounded-3xl border border-sky-100 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                          <span className="text-[10px] font-black text-sky-600 uppercase tracking-widest">
                            {detailFromLog.type === 'CHECK_OUT' ? 'Lapor Pulang' : 'Pos Check Log'}
                          </span>
                        </div>
                        {detailFromLog.type === 'CHECK_OUT' ? (
                          <p className="font-black text-slate-800 text-sm leading-tight">Kepulangan Tercatat</p>
                        ) : (
                          <>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              Pos {detailFromLog.posId}
                            </p>
                            <p className="font-black text-slate-800 text-sm leading-tight break-words">
                              {MOUNTAIN_POS[detailFromLog.posId]?.name?.replace(/^Pos \d+: /, '') || 'Lokasi Tidak Diketahui'}
                            </p>
                          </>
                        )}
                        <p className="text-[10px] font-bold text-slate-500 mt-1.5">
                          {new Date(detailFromLog.timestamp).toLocaleString('id-ID', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>
                    )}

                    <div className={`p-4 rounded-3xl border min-w-0 ${
                      detailFromLog ? 'bg-emerald-50/60 border-emerald-100' : 'bg-emerald-50/60 border-emerald-100 sm:col-span-2'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Navigation className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Posisi Terakhir</span>
                      </div>

                      {detailLastScan === undefined ? (
                        <p className="text-[11px] font-bold text-slate-400 italic">Memuat…</p>
                      ) : detailLastScan === null ? (
                        <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
                          Belum ada pemindaian pos untuk rombongan ini.
                        </p>
                      ) : detailLastScan.validationStatus === 'checkout' ? (
                        <>
                          <p className="font-black text-slate-800 text-sm leading-tight">Sudah Lapor Pulang</p>
                          <p className="text-[10px] font-bold text-slate-500 mt-1.5">
                            {new Date(detailLastScan.scannedAt).toLocaleString('id-ID', {
                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                            })}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            Pos {detailLastScan.posId} · {MOUNTAIN_POS[detailLastScan.posId]?.elevation ?? '-'} mdpl
                          </p>
                          <p className="font-black text-slate-800 text-sm leading-tight break-words">
                            {MOUNTAIN_POS[detailLastScan.posId]?.name?.replace(/^Pos \d+: /, '') || 'Lokasi Tidak Diketahui'}
                          </p>
                          <p className="text-[10px] font-bold text-slate-500 mt-1.5">
                            {new Date(detailLastScan.scannedAt).toLocaleString('id-ID', {
                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                            })}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal Naik</span>
                      </div>
                      <p className="font-black text-slate-800 text-sm">{formatSingleDate(detailSimaksi.tanggalNaik)}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal Turun</span>
                      </div>
                      <p className="font-black text-slate-800 text-sm">{formatSingleDate(detailSimaksi.tanggalTurun)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rombongan</span>
                      </div>
                      <p className="font-black text-emerald-700 text-sm">{detailSimaksi.totalAnggota} Orang</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</span>
                      </div>
                      <p className="font-black text-slate-800 text-sm uppercase break-words">
                        {SIMAKSI_STATUS_LABEL[detailSimaksi.status] || detailSimaksi.status}
                      </p>
                    </div>
                  </div>

                  {detailSimaksi.catatanVerifikator && (
                    <div className="p-4 bg-rose-50 rounded-3xl border border-rose-100">
                      <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Catatan Verifikator</span>
                      <p className="text-xs font-bold text-rose-700 mt-1 leading-relaxed">{detailSimaksi.catatanVerifikator}</p>
                    </div>
                  )}

                  {/* Ceklis perlengkapan wajib — hanya untuk dilihat petugas */}
                  <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Perlengkapan Wajib</span>
                      </div>
                      {detailGearKodes && gearCatalog.length > 0 && (
                        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg shrink-0 ${
                          detailGearKodes.length >= gearCatalog.length
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}>
                          {detailGearKodes.length}/{gearCatalog.length}
                        </span>
                      )}
                    </div>

                    {detailGearKodes === null ? (
                      <p className="text-[10px] font-bold text-slate-300 italic">Memuat…</p>
                    ) : detailGearKodes.length === 0 ? (
                      <p className="text-[10px] font-bold text-slate-400 leading-relaxed">
                        Ceklis tidak tercatat. SIMAKSI ini diajukan sebelum pencatatan
                        perlengkapan diaktifkan — periksa barang secara langsung.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                        {gearCatalog.map(item => {
                          const dicentang = detailGearKodes.includes(item.kode);
                          return (
                            <div key={item.kode} className="flex items-start gap-2">
                              {dicentang
                                ? <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                : <Square className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-0.5" />}
                              <span className={`text-[11px] font-bold leading-tight ${
                                dicentang ? 'text-slate-700' : 'text-slate-300'
                              }`}>
                                {item.namaBarang}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {detailSimaksi.ketua && <PersonCard person={detailSimaksi.ketua} isKetua={true} />}

                  <div className="pt-2 space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                      Anggota Rombongan ({detailSimaksi.members.length})
                    </h4>
                    {detailSimaksi.members.length > 0 ? (
                      detailSimaksi.members.map((m, i) => (
                        <PersonCard key={m.userId || i} person={m} isKetua={false} />
                      ))
                    ) : (
                      <div className="p-6 rounded-3xl border border-dashed border-slate-200 text-center">
                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">
                          Pendakian solo — tanpa anggota tambahan
                        </p>
                      </div>
                    )}
                  </div>

                  {detailSimaksi.createdAt && (
                    <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest text-center pt-2">
                      Diajukan {new Date(detailSimaksi.createdAt).toLocaleString('id-ID')}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
