import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MOUNTAIN_POS } from '../lib/mockData';
import { WifiOff, Download, CheckCircle2 } from 'lucide-react';

// Component to handle map center updates
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

interface GPSMapProps {
  currentPosIndex: number;
  mountainName?: string;
  userScans?: any[];
  direction?: 'ASCENT' | 'DESCENT';
}

export default function GPSMap({ 
  currentPosIndex, 
  mountainName = 'Gn. Slamet',
  userScans = [],
  direction = 'ASCENT'
}: GPSMapProps) {
  const [downloading, setDownloading] = useState(false);
  const [cachingStatus, setCachingStatus] = useState<'idle' | 'success'>('idle');

  const currentPos = MOUNTAIN_POS[currentPosIndex];
  
  const center: [number, number] = currentPos.coords || [-7.2285, 109.2198];
  const trackPath = MOUNTAIN_POS.map(p => p.coords as [number, number]);

  const getMaxPosIdReached = () => {
    if (userScans && userScans.length > 0) {
      let maxVal = currentPosIndex;
      userScans.forEach(s => {
        if (s.posId > maxVal) {
          maxVal = s.posId;
        }
      });
      return maxVal;
    }
    return direction === 'DESCENT' ? MOUNTAIN_POS.length - 1 : currentPosIndex;
  };
  const maxPosIdReached = getMaxPosIdReached();

  const getPositionState = (posId: number): 'ASCENT' | 'DESCENT' | 'UNREACHED' => {
    if (direction === 'DESCENT') {
      if (posId <= currentPosIndex) {
        return 'ASCENT';
      }
      if (posId <= maxPosIdReached) {
        return 'DESCENT';
      }
      return 'UNREACHED';
    } else {
      if (posId <= currentPosIndex) {
        return 'ASCENT';
      }
      return 'UNREACHED';
    }
  };

  const handleDownload = () => {
    setDownloading(true);
    // Simulate pre-caching behavior
    // In a real scenario, this would trigger a series of fetch requests for tiles in its bounding box
    setTimeout(() => {
      setDownloading(false);
      setCachingStatus('success');
      setTimeout(() => setCachingStatus('idle'), 3000);
    }, 2000);
  };

  return (
    <div className="h-[250px] sm:h-[320px] md:h-[400px] w-full rounded-3xl overflow-hidden shadow-inner border-2 border-white relative group z-0">
      <MapContainer 
        center={center} 
        zoom={14} 
        scrollWheelZoom={false}
        className="h-full w-full grayscale-[0.2] contrast-[1.1]"
      >
        <ChangeView center={center} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Draw Trail Line */}
        <Polyline 
          positions={trackPath} 
          color="#10b981" 
          weight={6} 
          opacity={0.8}
        />
        
        <Polyline 
          positions={trackPath} 
          color="white" 
          weight={2} 
          dashArray="5, 10"
        />

        {/* Checkpoints */}
        {MOUNTAIN_POS.map((pos) => {
          const state = getPositionState(pos.id);
          
          let htmlContent = '';
          let iconWidth = 24;
          let iconHeight = 24;

          if (state === 'DESCENT') {
            htmlContent = `
              <div class="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center bg-rose-500 shadow-lg transition-all duration-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
              </div>
            `;
          } else if (state === 'ASCENT') {
            htmlContent = `
              <div class="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center bg-blue-500 shadow-lg transition-all duration-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
              </div>
            `;
          } else {
            iconWidth = 20;
            iconHeight = 20;
            htmlContent = `
              <div class="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center bg-slate-400 shadow-lg transition-all duration-500">
              </div>
            `;
          }

          return (
            <Marker 
              key={pos.id} 
              position={pos.coords || [0, 0]}
              icon={L.divIcon({
                className: 'custom-div-icon',
                html: htmlContent,
                iconSize: [iconWidth, iconHeight],
                iconAnchor: [iconWidth / 2, iconHeight / 2],
              })}
            >
              <Popup>
                <div className="font-bold">{pos.name}</div>
                <div className="text-[10px] text-slate-500">{pos.elevation} MDPL</div>
              </Popup>
            </Marker>
          );
        })}

        {/* Current Location Indicator */}
        <Marker 
          position={center}
          zIndexOffset={1000}
          icon={L.divIcon({
            className: 'current-location-icon',
            html: `
              <div class="relative flex items-center justify-center">
                <div class="absolute w-8 h-8 bg-emerald-500/30 rounded-full animate-ping"></div>
                <div class="w-4 h-4 bg-emerald-600 rounded-full border-2 border-white shadow-xl"></div>
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          })}
        />
      </MapContainer>

      <div className="absolute top-4 left-4 z-[1000] flex gap-2">
        <div className="bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-emerald-400 shadow-sm border border-white/10 flex items-center gap-2">
          <WifiOff className="w-3 h-3" />
          OFFLINE CACHE ACTIVE
        </div>
      </div>

      <div className="absolute top-4 right-4 z-[1000]">
        <button 
          onClick={handleDownload}
          disabled={downloading}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg ${
            cachingStatus === 'success' 
              ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
              : 'bg-white text-slate-700 border-slate-100 hover:bg-slate-50'
          } border`}
        >
          {downloading ? (
            <>
              <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              Caching...
            </>
          ) : cachingStatus === 'success' ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Offline Ready
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Pre-load Map
            </>
          )}
        </button>
      </div>

      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-600 shadow-sm border border-slate-100 z-[1000]">
        LIVE TRACKING MAP
      </div>
    </div>
  );
}
