import { Pos, Ticket } from '../types';

export const MOUNTAIN_POS: Pos[] = [
  { id: 0, name: 'Basecamp Bambangan', elevation: 1502, distanceFromBase: 0, coords: [-7.2721, 109.2481], desc: 'Titik awal registrasi, verifikasi berkas, dan pemeriksaan perlengkapan.' },
  { id: 1, name: 'Pos 1: Pondok Gembirung', elevation: 1937, distanceFromBase: 2.1, coords: [-7.2680, 109.2440], desc: 'Waktu tempuh 1-3 jam. Tersedia layanan ojek yang dapat memangkas waktu.' },
  { id: 2, name: 'Pos 2: Pondok walang', elevation: 2256, distanceFromBase: 3.8, coords: [-7.2640, 109.2410], desc: 'Waktu tempuh 1-1,5 jam.' },
  { id: 3, name: 'Pos 3: Pondok Cemara', elevation: 2510, distanceFromBase: 5.2, coords: [-7.2590, 109.2360], desc: 'Waktu tempuh 1-2,5 jam.' },
  { id: 4, name: 'Pos 4: Samaranthu', elevation: 2688, distanceFromBase: 6.1, coords: [-7.2550, 109.2310], desc: 'Waktu tempuh sekitar 45 menit.' },
  { id: 5, name: 'Pos 5: Samyang Rangkah', elevation: 2795, distanceFromBase: 6.9, coords: [-7.2510, 109.2270], desc: 'Waktu tempuh sekitar 40 menit. Area ini merupakan tempat camping favorit karena lebih luas dan dekat dengan warung warga.' },
  { id: 6, name: 'Pos 6: Samyang Ketebonan', elevation: 2909, distanceFromBase: 7.7, coords: [-7.2480, 109.2240], desc: 'Waktu tempuh sekitar 30 menit dengan trek yang cukup terjal.' },
  { id: 7, name: 'Pos 7: Samyang kendit', elevation: 3040, distanceFromBase: 8.3, coords: [-7.2460, 109.2215], desc: 'Waktu tempuh sekitar 20 menit.' },
  { id: 8, name: 'Pos 8: Samyang Jampang', elevation: 3092, distanceFromBase: 8.8, coords: [-7.2445, 109.2200], desc: 'Waktu tempuh sekitar 10 menit.' },
  { id: 9, name: 'Pos 9: Pelawangan', elevation: 3172, distanceFromBase: 9.3, coords: [-7.2435, 109.2190], desc: 'Waktu tempuh sekitar 15-25 menit. Pos ini merupakan batas vegetasi di ketinggian 3.172 mdpl.' },
  { id: 10, name: 'Puncak Slamet', elevation: 3428, distanceFromBase: 10.5, coords: [-7.2427, 109.2185], desc: 'Waktu tempuh 1-1,5 jam, melewati jalur bebatuan merah terjal khas Gunung Slamet.' }
];

export const MOCK_TICKETS: Ticket[] = [
  {
    id: 'TICK-9942',
    userId: 'user-1',
    mountainName: 'Gn. Slamet',
    date: '2026-06-01',
    endDate: '2026-06-03',
    status: 'ACTIVE',
    qrCode: 'SUMMITY-USER-1-TICK-9942',
  },
];

// Simple trekking time estimation logic (approx 1km = 45-60 mins depending on elevation)
export function calculateETA(distanceRemaining: number, currentElevation: number, targetElevation: number) {
  const elevGain = targetElevation - currentElevation;
  const horizontalTime = distanceRemaining * 30; // 30 mins per km flat
  const verticalTime = (elevGain / 100) * 15; // 15 mins per 100m climb
  
  const totalMins = horizontalTime + verticalTime;
  const hours = Math.floor(Math.abs(totalMins) / 60);
  const minutes = Math.round(Math.abs(totalMins) % 60);
  
  return { hours, minutes };
}
