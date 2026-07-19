# Panduan Unit Testing — SUMMITY

Project ini memakai **Vitest** (test runner yang menyatu dengan Vite) + **React Testing Library**
untuk komponen, dan **fake-indexeddb** untuk menguji lapisan penyimpanan lokal (IndexedDB) tanpa
browser sungguhan.

## ⚠️ Syarat Wajib: Node.js 18+ (disarankan 20 LTS)

Vitest 3 dan Vite 6 **tidak bisa jalan di Node.js < 18**. Cek versi Anda:

```bash
node --version   # harus v18.x atau lebih baru
```

> Catatan environment developer awal: mesin ini memakai nvm-windows yang default-nya masih
> **Node v10** dan npm bawaannya rusak, sehingga test **tidak bisa dijalankan di sana**.
> Jalankan di device lain / setelah `nvm use 20`.

## Cara Menjalankan (di device dengan Node 18+)

```bash
# 1. Pastikan Node versi benar (kalau pakai nvm)
nvm use 20            # atau: nvm install 20 && nvm use 20

# 2. Install semua dependency (termasuk devDependencies test)
npm install

# 3. Jalankan seluruh test sekali (mode CI)
npm test

# Mode lain:
npm run test:watch      # re-run otomatis saat file berubah
npm run test:coverage   # laporan coverage (folder ./coverage)
npm run test:ui         # dashboard visual Vitest (butuh @vitest/ui)
```

Kalau `nvm use` gagal karena npm bawaannya rusak, install ulang npm untuk versi itu:
`nvm use 20 && npm install -g npm@latest`, atau pakai **corepack**: `corepack enable`.

## Struktur Test

| File | Jenis | Yang diuji |
|------|-------|-----------|
| `src/lib/formatters.test.ts` | Unit murni | Format tanggal Indonesia (`formatDateRange`, `formatSingleDate`) |
| `src/lib/mockData.test.ts` | Unit murni | Estimasi waktu tempuh `calculateETA` + integritas data `MOUNTAIN_POS` |
| `src/lib/db.helpers.test.ts` | Unit murni | Helper `db.ts`: `isValidUUID`, `generateUUID`, `toSnakeCase*`, `getPosIndexByUUID`, `getValidUUID` |
| `src/lib/db.integration.test.ts` | Integrasi | CRUD IndexedDB (registrasi, scan queue, simaksi) dengan `fake-indexeddb`, mode offline (tanpa Supabase) |
| `src/lib/db.sync.test.ts` | Integrasi | Jalur **sync online** (`trySyncRegistration`, `syncAllUnsyncedData`) dengan `@supabase/supabase-js` di-mock (`vi.mock`) — sukses/gagal/offline, tanpa Supabase asli |
| `src/lib/db.simaksi.test.ts` | Integrasi | Alur **SIMAKSI online+offline** (`trySyncSimaksi`, `getActiveSimaksiCount`, `getPendingSimaksi`, `getUserActiveSimaksi`, `approveSimaksi`, `rejectSimaksi`, `completeSimaksi`) via **router mock** Supabase (resolver per-tabel) |
| `src/lib/tileCache.test.ts` | Unit + Integrasi | Geometri `countTilesInArea`, cache tile IndexedDB, dan `preloadTiles` dengan `fetch` di-mock (fetch/cache/progress/abort) |
| `src/context/AuthContext.test.tsx` | Hook/Context | `login`/`logout`/`updateUser`, normalisasi id legacy, rehydrate dari localStorage |
| `src/components/ProtectedRoute.test.tsx` | Komponen | Guard rute: redirect ke `/login`, cek `allowedRole`, render konten terproteksi |

## Konfigurasi

- `vitest.config.ts` — konfigurasi test (environment `jsdom`, alias `@`, setup file, coverage).
  Sengaja **terpisah** dari `vite.config.ts` agar plugin PWA/Tailwind tidak ikut termuat saat test.
- `src/test/setup.ts` — setup global: matcher `@testing-library/jest-dom`, bersihkan DOM &
  `localStorage` setiap selesai test, polyfill `crypto.randomUUID`.

## Catatan untuk pengembangan test selanjutnya

- Fungsi yang bergantung **Supabase** (`trySyncRegistration`, `syncAllUnsyncedData`, dll.) diuji
  dalam mode offline karena variabel env `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` tidak diset
  saat test → `getSupabaseClient()` mengembalikan `null`. Untuk menguji jalur online, mock modul
  `@supabase/supabase-js` dengan `vi.mock(...)`.
- Komponen peta (`GPSMap.tsx`, Leaflet) sengaja belum dites karena butuh mock DOM peta yang berat.
- Helper privat di `db.ts` sekarang di-`export` agar bisa diuji langsung.
