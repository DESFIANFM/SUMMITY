import React, { useEffect, useRef, useState } from 'react';
import { Search, Plus, X, Loader2 } from 'lucide-react';
import { searchPendaki, findPendaki, PendakiRef } from '../lib/db';

interface Props {
  /** Dipanggil saat satu pendaki dipilih. Kembalikan pesan error bila ditolak. */
  onPick: (pendaki: PendakiRef) => string | null;
  /** Gaya gelap dipakai di InlineSimaksiForm, terang di SimaksiSubmit. */
  tone?: 'light' | 'dark';
}

/**
 * Pencarian anggota rombongan: bisa dengan ID Pendaki maupun potongan nama.
 *
 * Pencarian nama lewat RPC search_pendaki (SECURITY DEFINER) karena setelah
 * RLS dikunci, seorang pendaki tidak boleh membaca baris pendaki lain. RPC
 * itu hanya mengembalikan id, id_pendaki, dan nama.
 */
export default function MemberSearchInput({ onPick, tone = 'light' }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PendakiRef[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const dark = tone === 'dark';

  // Tunda pencarian 300ms supaya tidak memanggil RPC pada tiap ketikan.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) { setResults([]); setSearching(false); return; }

    setSearching(true);
    let batal = false;
    const t = setTimeout(async () => {
      const hasil = await searchPendaki(q);
      if (batal) return;
      setResults(hasil);
      setSearching(false);
    }, 300);

    return () => { batal = true; clearTimeout(t); };
  }, [query]);

  // Tutup daftar hasil saat klik di luar.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setTouched(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pilih = (p: PendakiRef) => {
    const err = onPick(p);
    if (err) { setError(err); return; }
    setQuery(''); setResults([]); setError(''); setTouched(false);
  };

  // Tombol + : perlakukan isian sebagai ID Pendaki persis.
  const tambahLangsung = async () => {
    const q = query.trim();
    if (!q) { setError('Masukkan ID Pendaki atau nama anggota.'); return; }

    setSearching(true);
    const found = await findPendaki(q) ?? results[0] ?? null;
    setSearching(false);

    if (!found) { setError(`Pendaki "${q}" tidak ditemukan.`); return; }
    pilih(found);
  };

  const inputCls = dark
    ? 'w-full bg-slate-950/60 border border-white/10 rounded-2xl py-3.5 pl-10 pr-9 text-white text-sm font-bold placeholder-slate-600 outline-none focus:border-emerald-500/60 transition-all'
    : 'w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-10 pr-9 text-slate-800 text-sm font-bold placeholder-slate-400 outline-none focus:border-emerald-400 focus:bg-white transition-all';

  return (
    <div className="space-y-2" ref={boxRef}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setError(''); setTouched(true); }}
            onFocus={() => setTouched(true)}
            placeholder="ID Pendaki atau nama"
            autoCapitalize="none"
            className={inputCls}
          />
          {searching && (
            <Loader2 className={`w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
          )}
          {!searching && query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setResults([]); setError(''); }}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full ${dark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={tambahLangsung}
          disabled={searching}
          className={`shrink-0 w-12 rounded-2xl flex items-center justify-center transition-all disabled:opacity-50 ${
            dark ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
          title="Tambahkan"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Daftar hasil pencarian */}
      {touched && query.trim().length >= 3 && !searching && (
        <div className={`rounded-2xl border overflow-hidden ${dark ? 'border-white/10 bg-slate-950/40' : 'border-slate-200 bg-white'}`}>
          {results.length > 0 ? (
            results.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => pilih(p)}
                className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors ${
                  dark ? 'hover:bg-white/5 border-b border-white/5' : 'hover:bg-emerald-50/50 border-b border-slate-100'
                } last:border-b-0`}
              >
                <span className={`text-sm font-bold truncate ${dark ? 'text-white' : 'text-slate-800'}`}>{p.name}</span>
                {p.idPendaki && (
                  <span className={`text-[9px] font-mono shrink-0 px-2 py-1 rounded-lg ${
                    dark ? 'text-slate-400 bg-white/5' : 'text-slate-500 bg-slate-100'
                  }`}>{p.idPendaki}</span>
                )}
              </button>
            ))
          ) : (
            <div className={`px-4 py-3 text-[11px] font-bold ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
              Tidak ada pendaki yang cocok.
            </div>
          )}
        </div>
      )}

      {query.trim().length > 0 && query.trim().length < 3 && (
        <p className={`text-[10px] font-bold ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          Ketik minimal 3 karakter untuk mencari nama.
        </p>
      )}

      {error && (
        <p className="text-[10px] font-bold text-rose-500">{error}</p>
      )}
    </div>
  );
}
