import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getAllScans, getAllRegistrations, updateRegistrationStatus, deleteRegistration } from '../../lib/db';
import { MOUNTAIN_POS } from '../../lib/mockData';
import { ScanLog, RegistrationRequest } from '../../types';
import { Users, Clock, TrendingUp, Mail, Check, X, Calendar, Trash2, Phone, Fingerprint, MapPin, ChevronRight, Info, Search, Download, Filter, QrCode, Printer } from 'lucide-react';
import { formatDateRange } from '../../lib/formatters';

export default function AdminDashboard() {
  const [hikerLocations, setHikerLocations] = useState<Record<number, { ascent: number, descent: number }>>({});
  const [recentScans, setRecentScans] = useState<ScanLog[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationRequest[]>([]);
  const [selectedReg, setSelectedReg] = useState<RegistrationRequest | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'APPROVED' | 'REJECTED' | 'PENDING'>('ALL');
  const [hasSearched, setHasSearched] = useState(false);
  
  // QR Code Simulator page states
  const [activeQrTab, setActiveQrTab] = useState<'pos' | 'ticket'>('pos');
  const [selectedQrTicketId, setSelectedQrTicketId] = useState<string>('');
  const [fullscreenQr, setFullscreenQr] = useState<{ title: string; value: string; subtitle: string } | null>(null);
  
  useEffect(() => {
    const fetchData = async () => {
      const scans = (await getAllScans()) as ScanLog[];
      const regs = await getAllRegistrations();
      
      setRecentScans([...scans].reverse().slice(0, 5));
      setRegistrations(regs.reverse());

      // Calculate where each hiker is based on their latest scan
      const latestScansByTicket: Record<string, { posId: number; type: string; direction: 'ASCENT' | 'DESCENT' }> = {};
      
      // Sort scans by timestamp ascending to track flow
      const sortedScans = [...scans].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      const ticketPeaks: Record<string, boolean> = {};

      sortedScans.forEach(scan => {
        if (!scan.ticketId) return;

        if (scan.posId === MOUNTAIN_POS.length - 1) {
          ticketPeaks[scan.ticketId] = true;
        }

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
          if (!locationCounts[status.posId]) {
            locationCounts[status.posId] = { ascent: 0, descent: 0 };
          }
          if (status.direction === 'ASCENT') {
            locationCounts[status.posId].ascent += 1;
          } else {
            locationCounts[status.posId].descent += 1;
          }
        }
      });
      setHikerLocations(locationCounts);
    };
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateReg = async (id: number, status: 'APPROVED' | 'REJECTED') => {
    await updateRegistrationStatus(id, status);
    // Refresh will happen via interval
  };

  const handleDeleteReg = async (id: number) => {
    if (confirm('Hapus data registrasi ini?')) {
      await deleteRegistration(id);
    }
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Nama', 'NIK', 'Gender', 'Gunung', 'Tgl Naik', 'Tgl Turun', 'Status', 'Dibuat'];
    const rows = registrations.map(r => [
      r.id,
      r.name,
      r.nik,
      r.gender,
      r.mountain,
      r.date,
      r.endDate,
      r.status,
      r.createdAt
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `registrasi-summity-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const query = searchInput.trim().toLowerCase();
      if (!query) {
        setSearchQuery('');
        setHasSearched(false);
        return;
      }

      // Cari kecocokan data
      const matches = registrations.filter(reg => 
        reg.name.toLowerCase().includes(query) || 
        reg.nik.includes(query) ||
        reg.mountain.toLowerCase().includes(query)
      );

      setSearchQuery(searchInput);
      setHasSearched(true);

      // Jika ada yang cocok, langsung buka detailnya (pindah ke visualisasi data)
      if (matches.length > 0) {
        setSelectedReg(matches[0]);
      }
    }
  };

  const filteredRegistrations = registrations.filter(reg => {
    const matchesSearch = !searchQuery || 
                         reg.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         reg.nik.includes(searchQuery) ||
                         reg.mountain.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'ALL' || reg.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const pendingRegs = filteredRegistrations.filter(r => r.status === 'PENDING');
  const historyRegs = filteredRegistrations.filter(r => r.status !== 'PENDING');
  
  const totalActive = Object.values(hikerLocations).reduce((sum, loc) => sum + loc.ascent + loc.descent, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Dashboard Monitor</h2>
        <div className="relative">
          <div className="absolute inset-0 bg-emerald-400 blur-sm rounded-full opacity-50 animate-pulse"></div>
          <div className="relative bg-white text-emerald-600 text-[10px] px-2.5 py-1 rounded-full font-bold border border-emerald-100 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
            LIVE MONITORING
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
          <div className="bg-blue-100 w-10 h-10 rounded-2xl flex items-center justify-center mb-4">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-3xl font-black text-slate-800 mb-1">{totalActive}</div>
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Pendaki Aktif</div>
        </div>

        <div className="bg-emerald-700 p-6 rounded-3xl shadow-lg border border-emerald-600 text-white">
          <div className="bg-white/20 w-10 h-10 rounded-2xl flex items-center justify-center mb-4">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div className="text-3xl font-black mb-1">{pendingRegs.length}</div>
          <div className="text-[10px] text-emerald-100 font-bold uppercase tracking-widest text-white/60">Registrasi Pending</div>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="bg-white p-4 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${searchInput !== searchQuery ? 'text-emerald-500' : 'text-slate-400'}`} />
            <input 
              type="text"
              placeholder="Cari Nama, NIK, atau Gunung... (Tekan Enter)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 pl-11 pr-4 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all uppercase tracking-wider"
            />
            {hasSearched && searchQuery && (
              <button 
                onClick={() => {
                  setSearchInput('');
                  setSearchQuery('');
                  setHasSearched(false);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] font-black text-rose-400 hover:text-rose-600 uppercase tracking-tighter"
              >
                Reset
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="bg-slate-50 border border-slate-100 rounded-2xl py-3 pl-9 pr-8 text-[10px] font-black text-slate-600 focus:outline-none appearance-none uppercase tracking-widest cursor-pointer"
              >
                <option value="ALL">SEMUA STATUS</option>
                <option value="APPROVED">DISETUJUI</option>
                <option value="REJECTED">DITOLAK</option>
                <option value="PENDING">PENDING</option>
              </select>
            </div>
            <button 
              onClick={exportToCSV}
              className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl flex items-center gap-2 hover:bg-emerald-100 transition-colors group"
              title="Unduh CSV"
            >
              <Download className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {pendingRegs.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Permohonan Registrasi</h3>
          <div className="space-y-2">
            {pendingRegs.map(reg => (
              <div 
                key={reg.id} 
                className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group transition-all hover:border-emerald-200"
              >
                <div 
                  className="flex items-center gap-4 cursor-pointer flex-1"
                  onClick={() => setSelectedReg(reg)}
                >
                  <div className="bg-slate-100 p-3 rounded-2xl group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                    <Calendar className="w-6 h-6 text-slate-400 group-hover:text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 text-lg leading-none mb-1 italic">{reg.name}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 flex-wrap">
                      {reg.mountain} • {formatDateRange(reg.date, reg.endDate)}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                       <span className="text-[8px] bg-slate-50 px-2 py-0.5 rounded-full font-black text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-700">KLIK UNTUK DETAIL</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => reg.id && handleUpdateReg(reg.id, 'REJECTED')}
                    className="p-3 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-100 transition-colors"
                    title="Tolak"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => reg.id && handleUpdateReg(reg.id, 'APPROVED')}
                    className="p-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-95"
                    title="Setujui"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Permohonan Registrasi</h3>
          <div className="bg-white p-10 rounded-3xl border border-dashed border-slate-200 text-center">
            <p className="text-slate-400 font-bold text-xs italic uppercase tracking-widest">Tidak ada permohonan SIMAKSI baru</p>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedReg && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-end sm:items-center justify-center p-4">
          <div 
            className="w-full max-w-lg bg-white rounded-[40px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-emerald-700 p-8 text-white relative">
              <button 
                onClick={() => setSelectedReg(null)}
                className="absolute top-6 right-6 p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
                <Info className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-black italic uppercase tracking-tighter">Detail Registrasi</h3>
              <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest opacity-70">Verifikasi data sebelum persetujuan</p>
            </div>

            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Lengkap</span>
                  </div>
                  <p className="font-black text-slate-800 italic uppercase">{selectedReg.name}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Fingerprint className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NIK / Identitas</span>
                  </div>
                  <p className="font-black text-slate-800 tracking-wider">{selectedReg.nik}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jenis Kelamin</span>
                  </div>
                  <p className="font-black text-slate-800">{selectedReg.gender}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tgl Lahir</span>
                  </div>
                  <p className="font-black text-slate-800">{selectedReg.birthDate}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nomor Telepon</span>
                  </div>
                  <p className="font-black text-slate-800">{selectedReg.phone}</p>
                </div>
                <div className="p-4 bg-rose-50 rounded-3xl border border-rose-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="w-3.5 h-3.5 text-rose-400" />
                    <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">No. Darurat</span>
                  </div>
                  <p className="font-black text-rose-800">{selectedReg.emergencyPhone || '-'}</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alamat (KTP)</span>
                </div>
                <p className="font-bold text-slate-700 text-xs leading-relaxed">{selectedReg.address}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gunung</span>
                  </div>
                  <p className="font-black text-slate-800 uppercase italic">{selectedReg.mountain}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100 col-span-2">
                   <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jadwal Pendakian</span>
                  </div>
                  <p className="font-black text-slate-800">{formatDateRange(selectedReg.date, selectedReg.endDate)}</p>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => {
                    handleUpdateReg(selectedReg.id!, 'REJECTED');
                    setSelectedReg(null);
                  }}
                  className="flex-1 bg-slate-100 text-slate-600 font-black py-4 rounded-2xl text-xs uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all"
                >
                  Tolak
                </button>
                <button 
                  onClick={() => {
                    handleUpdateReg(selectedReg.id!, 'APPROVED');
                    setSelectedReg(null);
                  }}
                  className="flex-[2] bg-emerald-600 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95"
                >
                  Setujui SIMAKSI
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {historyRegs.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest italic leading-none">
              {searchQuery ? `Hasil Pencarian: "${searchQuery}"` : 'Riwayat Data'} ({historyRegs.length})
            </h3>
          </div>
          <div className="space-y-2">
            {historyRegs.map(reg => (
              <div 
                key={reg.id} 
                className="bg-white p-4 rounded-3xl border border-slate-50 flex items-center justify-between group hover:border-slate-200 transition-all cursor-pointer"
                onClick={() => setSelectedReg(reg)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    reg.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                  }`}>
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-700 text-sm italic">{reg.name}</h4>
                      <span className="text-[8px] bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-500 uppercase">NIK: {reg.nik}</span>
                    </div>
                    <p className="text-[9px] text-slate-400 uppercase font-black">
                      {reg.mountain} • {formatDateRange(reg.date, reg.endDate)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <div className="text-[9px] text-slate-300 font-mono uppercase leading-none mb-1">Status</div>
                    <div className={`text-[10px] font-black uppercase tracking-tighter ${
                      reg.status === 'APPROVED' ? 'text-emerald-500' : 'text-rose-500'
                    }`}>
                      {reg.status}
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      reg.id && handleDeleteReg(reg.id);
                    }}
                    className="p-2 sm:p-3 bg-slate-50 text-slate-300 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : searchQuery ? (
        <div className="bg-white p-12 rounded-[2.5rem] border border-dashed border-slate-200 text-center animate-in fade-in duration-500">
          <div className="bg-rose-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-100">
             <Search className="w-8 h-8 text-rose-400" />
          </div>
          <h4 className="text-slate-800 font-black italic uppercase tracking-tight">Data Tidak Ditemukan</h4>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
             Maaf, tidak terdapat nama atau data "{searchQuery}" dalam sistem.
          </p>
          <button 
            onClick={() => {
              setSearchInput('');
              setSearchQuery('');
              setHasSearched(false);
            }}
            className="mt-6 text-[9px] font-black text-emerald-600 underline uppercase tracking-[0.2em]"
          >
            Tampilkan Semua Data
          </button>
        </div>
      ) : null}

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
                    {registrations.filter(r => r.status === 'APPROVED').map(reg => (
                      <option key={reg.id} value={`SUMMITY-USER-${reg.id}`}>
                        {reg.name} ({reg.mountain}) - APPROVED
                      </option>
                    ))}
                    {/* Dummy fallbacks so there is always something to test with */}
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

      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Log Aktivitas Terbaru</h3>
        <div className="bg-white rounded-3xl border border-slate-100 divide-y divide-slate-50 overflow-hidden shadow-sm">
          {recentScans.length > 0 ? recentScans.map(log => (
            <div key={log.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${
                  log.type === 'CHECK_IN' ? 'bg-emerald-500' : (log.type === 'CHECK_OUT' ? 'bg-rose-500' : 'bg-sky-500')
                }`}></div>
                <div>
                  <div className="text-sm font-black text-slate-700">{log.ticketId}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">
                    {MOUNTAIN_POS[log.posId || 0]?.name || 'Lokasi Tidak Diketahui'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-black text-slate-600">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className={`text-[9px] font-black uppercase tracking-tighter ${
                  log.type === 'CHECK_IN' ? 'text-emerald-500' : (log.type === 'CHECK_OUT' ? 'text-rose-500' : 'text-sky-500')
                }`}>
                  {(log.type || 'POST_CHECK').replace('_', ' ')}
                </div>
              </div>
            </div>
          )) : (
            <div className="p-10 text-center text-slate-300 text-xs font-bold uppercase tracking-widest italic">
              Tidak ada aktivitas
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
