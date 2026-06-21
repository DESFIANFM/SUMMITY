import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MOUNTAIN_POS } from '../lib/mockData';
import { getCachedTile, cacheTile, getCachedTileCount, preloadTiles, countTilesInArea } from '../lib/tileCache';
import {
  WifiOff, Download, CheckCircle2,
  Locate, LocateFixed, LocateOff,
  Maximize2, Minimize2, Database,
} from 'lucide-react';

// Bounding box derived from MOUNTAIN_POS coords + small padding
const SLAMET_BOUNDS = {
  north: -7.230,
  south: -7.285,
  east:  109.258,
  west:  109.210,
};
const CACHE_ZOOMS = [11, 12, 13, 14, 15, 16];
const TOTAL_TILES = countTilesInArea(SLAMET_BOUNDS, CACHE_ZOOMS);

// ─── Offline tile layer ───────────────────────────────────────────────────────
// Replaces react-leaflet's TileLayer. For each tile it checks IndexedDB first;
// fetches from OSM (and auto-caches) when online; leaves blank when offline & uncached.
function OfflineTileLayer() {
  const map = useMap();

  useEffect(() => {
    const SubdomainGrid = (L.GridLayer as any).extend({
      createTile(coords: any, done: any) {
        const img = document.createElement('img');
        img.setAttribute('role', 'presentation');
        img.setAttribute('alt', '');

        const s = ['a', 'b', 'c'][(Math.abs(coords.x) + Math.abs(coords.y)) % 3];
        const url = `https://${s}.tile.openstreetmap.org/${coords.z}/${coords.x}/${coords.y}.png`;
        const key = `osm/${coords.z}/${coords.x}/${coords.y}`;

        (async () => {
          try {
            const cached = await getCachedTile(key);
            if (cached) {
              const objUrl = URL.createObjectURL(cached);
              img.onload = () => { URL.revokeObjectURL(objUrl); done(null, img); };
              img.onerror = () => { URL.revokeObjectURL(objUrl); done(null, img); };
              img.src = objUrl;
            } else {
              const resp = await fetch(url);
              if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
              const blob = await resp.blob();
              cacheTile(key, blob).catch(() => {}); // save async, don't block render
              const objUrl = URL.createObjectURL(blob);
              img.onload = () => { URL.revokeObjectURL(objUrl); done(null, img); };
              img.onerror = () => { URL.revokeObjectURL(objUrl); done(null, img); };
              img.src = objUrl;
            }
          } catch {
            done(null, img); // offline + uncached → blank tile
          }
        })();

        return img;
      },
    });

    const layer = new SubdomainGrid({
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      tileSize: 256,
      detectRetina: true,
    });
    layer.addTo(map);
    return () => { map.removeLayer(layer); };
  }, [map]);

  return null;
}

// ─── Helper components ────────────────────────────────────────────────────────
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center); }, [center, map]);
  return null;
}

function LiveView({ coords }: { coords: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(coords, map.getZoom()); }, [coords, map]);
  return null;
}

function MapResizer({ trigger }: { trigger: boolean }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 120);
    return () => clearTimeout(t);
  }, [trigger, map]);
  return null;
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const LIVE_ICON = L.divIcon({
  className: 'live-location-icon',
  html: `
    <div class="relative flex items-center justify-center">
      <div class="absolute w-10 h-10 bg-blue-500/30 rounded-full animate-ping"></div>
      <div class="absolute w-6 h-6 bg-blue-400/20 rounded-full"></div>
      <div class="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-xl"></div>
    </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

// ─── Props ────────────────────────────────────────────────────────────────────
interface GPSMapProps {
  currentPosIndex: number;
  mountainName?: string;
  userScans?: any[];
  direction?: 'ASCENT' | 'DESCENT';
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function GPSMap({
  currentPosIndex,
  mountainName = 'Gn. Slamet',
  userScans = [],
  direction = 'ASCENT',
}: GPSMapProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Cache state
  const [cachedCount, setCachedCount] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [dlProgress, setDlProgress] = useState({ done: 0, total: TOTAL_TILES });
  const abortRef = useRef<AbortController | null>(null);

  // Live location
  const [liveTracking, setLiveTracking] = useState(false);
  const [liveCoords, setLiveCoords] = useState<[number, number] | null>(null);
  const [liveStatus, setLiveStatus] = useState<'idle' | 'waiting' | 'active' | 'error'>('idle');
  const [liveError, setLiveError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Load cached tile count on mount
  useEffect(() => {
    getCachedTileCount().then(setCachedCount);
  }, []);

  // Lock body scroll when fullscreen
  useEffect(() => {
    document.body.style.overflow = isFullscreen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isFullscreen]);

  // Escape exits fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFullscreen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullscreen]);

  // Cleanup geolocation watcher on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  // ── Pre-load tiles ──────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (downloading) {
      abortRef.current?.abort();
      setDownloading(false);
      return;
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setDownloading(true);
    setDlProgress({ done: 0, total: TOTAL_TILES });

    await preloadTiles(
      SLAMET_BOUNDS,
      CACHE_ZOOMS,
      (done, total) => setDlProgress({ done, total }),
      ctrl.signal
    );

    const count = await getCachedTileCount();
    setCachedCount(count);
    setDownloading(false);
  };

  // ── Live location ───────────────────────────────────────────────────────────
  const startLiveLocation = () => {
    if (!navigator.geolocation) {
      setLiveError('GPS tidak didukung browser ini');
      setLiveStatus('error');
      return;
    }
    setLiveStatus('waiting');
    setLiveError(null);
    setLiveTracking(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLiveCoords([pos.coords.latitude, pos.coords.longitude]);
        setLiveStatus('active');
      },
      (err) => {
        setLiveStatus('error');
        setLiveTracking(false);
        if (err.code === 1) setLiveError('Izin lokasi ditolak');
        else if (err.code === 2) setLiveError('Sinyal GPS tidak tersedia');
        else setLiveError('Gagal mendapatkan lokasi');
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    );
  };

  const stopLiveLocation = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setLiveTracking(false);
    setLiveCoords(null);
    setLiveStatus('idle');
    setLiveError(null);
  };

  // ── Map data ────────────────────────────────────────────────────────────────
  const currentPos = MOUNTAIN_POS[currentPosIndex];
  const center: [number, number] = currentPos.coords || [-7.2721, 109.2481];
  const trackPath = MOUNTAIN_POS.map(p => p.coords as [number, number]);

  const getMaxPosIdReached = () => {
    if (userScans.length > 0) {
      let max = currentPosIndex;
      userScans.forEach(s => { if (s.posId > max) max = s.posId; });
      return max;
    }
    return direction === 'DESCENT' ? MOUNTAIN_POS.length - 1 : currentPosIndex;
  };
  const maxPosIdReached = getMaxPosIdReached();

  const getState = (posId: number): 'ASCENT' | 'DESCENT' | 'UNREACHED' => {
    if (direction === 'DESCENT') {
      if (posId <= currentPosIndex) return 'ASCENT';
      if (posId <= maxPosIdReached) return 'DESCENT';
      return 'UNREACHED';
    }
    return posId <= currentPosIndex ? 'ASCENT' : 'UNREACHED';
  };

  const isCacheReady = cachedCount >= TOTAL_TILES * 0.9; // ≥90% tiles cached
  const cachePercent = Math.round((cachedCount / TOTAL_TILES) * 100);

  const wrapperClass = isFullscreen
    ? 'fixed inset-0 z-[9999] w-full h-full bg-black'
    : 'h-[250px] sm:h-[320px] md:h-[400px] w-full rounded-3xl overflow-hidden shadow-inner border-2 border-white relative group z-0';

  return (
    <div className={wrapperClass}>
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom={false}
        className="h-full w-full grayscale-[0.2] contrast-[1.1]"
      >
        <OfflineTileLayer />
        <ChangeView center={center} />
        <MapResizer trigger={isFullscreen} />

        {/* Trail polyline */}
        <Polyline positions={trackPath} color="#10b981" weight={6} opacity={0.8} />
        <Polyline positions={trackPath} color="white" weight={2} dashArray="5, 10" />

        {/* Checkpoint markers */}
        {MOUNTAIN_POS.map((pos) => {
          const state = getState(pos.id);
          let html = '';
          let w = 24, h = 24;

          if (state === 'DESCENT') {
            html = `<div class="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center bg-rose-500 shadow-lg"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg></div>`;
          } else if (state === 'ASCENT') {
            html = `<div class="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center bg-blue-500 shadow-lg"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></div>`;
          } else {
            w = 20; h = 20;
            html = `<div class="w-5 h-5 rounded-full border-2 border-white bg-slate-400 shadow-lg"></div>`;
          }

          return (
            <Marker
              key={pos.id}
              position={pos.coords || [0, 0]}
              icon={L.divIcon({ className: 'custom-div-icon', html, iconSize: [w, h], iconAnchor: [w / 2, h / 2] })}
            >
              <Popup>
                <div className="font-bold">{pos.name}</div>
                <div className="text-[10px] text-slate-500">{pos.elevation} MDPL</div>
              </Popup>
            </Marker>
          );
        })}

        {/* Current checkpoint marker */}
        <Marker
          position={center}
          zIndexOffset={1000}
          icon={L.divIcon({
            className: 'current-location-icon',
            html: `<div class="relative flex items-center justify-center"><div class="absolute w-8 h-8 bg-emerald-500/30 rounded-full animate-ping"></div><div class="w-4 h-4 bg-emerald-600 rounded-full border-2 border-white shadow-xl"></div></div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          })}
        />

        {/* Live GPS marker */}
        {liveCoords && (
          <>
            <LiveView coords={liveCoords} />
            <Marker position={liveCoords} icon={LIVE_ICON} zIndexOffset={2000}>
              <Popup>
                <div className="font-bold text-blue-700">Posisi GPS Anda</div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {liveCoords[0].toFixed(6)}, {liveCoords[1].toFixed(6)}
                </div>
              </Popup>
            </Marker>
          </>
        )}
      </MapContainer>

      {/* ── Top-left overlay ── */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-1.5">
        {/* Cache status badge */}
        <div className={`backdrop-blur px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm border border-white/10 flex items-center gap-1.5 ${
          isCacheReady
            ? 'bg-emerald-700/90 text-emerald-200'
            : 'bg-slate-900/80 text-slate-400'
        }`}>
          {isCacheReady ? (
            <><CheckCircle2 className="w-3 h-3" />Offline Ready</>
          ) : (
            <><WifiOff className="w-3 h-3" />{cachedCount > 0 ? `${cachePercent}% cached` : 'Perlu koneksi'}</>
          )}
        </div>

        {/* Live GPS error */}
        {liveError && (
          <div className="bg-rose-600/90 backdrop-blur px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-white shadow-sm flex items-center gap-1.5">
            <LocateOff className="w-3 h-3 shrink-0" />{liveError}
          </div>
        )}

        {/* Live coordinates */}
        {liveStatus === 'active' && liveCoords && (
          <div className="bg-blue-700/90 backdrop-blur px-2.5 py-1.5 rounded-xl text-[9px] font-black text-white shadow-sm border border-white/10 font-mono">
            {liveCoords[0].toFixed(5)}, {liveCoords[1].toFixed(5)}
          </div>
        )}
      </div>

      {/* ── Top-right overlay ── */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1.5 items-end">
        {/* Pre-load / Download button */}
        <button
          onClick={handleDownload}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg border ${
            isCacheReady
              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
              : downloading
              ? 'bg-blue-600 text-white border-blue-500'
              : 'bg-white text-slate-700 border-slate-100 hover:bg-slate-50'
          }`}
        >
          {downloading ? (
            <>
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
              {dlProgress.done}/{dlProgress.total}
            </>
          ) : isCacheReady ? (
            <>
              <Database className="w-3.5 h-3.5" />
              {cachedCount} Tiles
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              Pre-load Map
            </>
          )}
        </button>

        {/* Download progress bar */}
        {downloading && (
          <div className="w-28 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-300"
              style={{ width: `${Math.round((dlProgress.done / dlProgress.total) * 100)}%` }}
            />
          </div>
        )}

        {/* Live location button */}
        <button
          onClick={liveTracking ? stopLiveLocation : startLiveLocation}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg border ${
            liveStatus === 'active'
              ? 'bg-blue-600 text-white border-blue-500 shadow-blue-200'
              : liveStatus === 'waiting'
              ? 'bg-blue-100 text-blue-700 border-blue-200'
              : liveStatus === 'error'
              ? 'bg-rose-50 text-rose-600 border-rose-200'
              : 'bg-white text-slate-700 border-slate-100 hover:bg-slate-50'
          }`}
        >
          {liveStatus === 'waiting' ? (
            <><div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />Mencari...</>
          ) : liveStatus === 'active' ? (
            <><LocateFixed className="w-3.5 h-3.5 animate-pulse" />Live On</>
          ) : (
            <><Locate className="w-3.5 h-3.5" />Live Loc</>
          )}
        </button>
      </div>

      {/* ── Bottom-left label ── */}
      <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-slate-600 shadow-sm border border-slate-100 z-[1000]">
        LIVE TRACKING MAP
      </div>

      {/* ── Bottom-right fullscreen toggle ── */}
      <button
        onClick={() => setIsFullscreen(v => !v)}
        className="absolute bottom-3 right-3 z-[1000] w-8 h-8 bg-slate-900/80 backdrop-blur text-white rounded-xl flex items-center justify-center shadow-lg border border-white/10 hover:bg-slate-900 transition-colors active:scale-95"
        title={isFullscreen ? 'Keluar Fullscreen' : 'Fullscreen'}
      >
        {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
