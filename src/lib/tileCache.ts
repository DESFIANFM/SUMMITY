import { openDB } from 'idb';

const TILE_DB = 'summity-tiles';
const TILE_STORE = 'tiles';

async function initTileDB() {
  return openDB(TILE_DB, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(TILE_STORE)) {
        db.createObjectStore(TILE_STORE);
      }
    },
  });
}

export async function getCachedTile(key: string): Promise<Blob | undefined> {
  try {
    const db = await initTileDB();
    return db.get(TILE_STORE, key);
  } catch {
    return undefined;
  }
}

export async function cacheTile(key: string, blob: Blob): Promise<void> {
  try {
    const db = await initTileDB();
    await db.put(TILE_STORE, blob, key);
  } catch {}
}

export async function getCachedTileCount(): Promise<number> {
  try {
    const db = await initTileDB();
    return db.count(TILE_STORE);
  } catch {
    return 0;
  }
}

function lngToTileX(lng: number, zoom: number): number {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
}

function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
}

export function countTilesInArea(
  bounds: { north: number; south: number; east: number; west: number },
  zooms: number[]
): number {
  let total = 0;
  for (const z of zooms) {
    const minX = lngToTileX(bounds.west, z);
    const maxX = lngToTileX(bounds.east, z);
    const minY = latToTileY(bounds.north, z);
    const maxY = latToTileY(bounds.south, z);
    total += (maxX - minX + 1) * (maxY - minY + 1);
  }
  return total;
}

export async function preloadTiles(
  bounds: { north: number; south: number; east: number; west: number },
  zooms: number[],
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal
): Promise<void> {
  const tiles: { z: number; x: number; y: number }[] = [];

  for (const z of zooms) {
    const minX = lngToTileX(bounds.west, z);
    const maxX = lngToTileX(bounds.east, z);
    const minY = latToTileY(bounds.north, z); // north = smaller Y
    const maxY = latToTileY(bounds.south, z); // south = larger Y

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        tiles.push({ z, x, y });
      }
    }
  }

  let done = 0;
  onProgress(0, tiles.length);

  const fetchOne = async ({ z, x, y }: { z: number; x: number; y: number }) => {
    if (signal?.aborted) return;
    const key = `osm/${z}/${x}/${y}`;
    const cached = await getCachedTile(key);
    if (!cached) {
      const s = ['a', 'b', 'c'][(x + y) % 3];
      try {
        const resp = await fetch(
          `https://${s}.tile.openstreetmap.org/${z}/${x}/${y}.png`,
          { signal }
        );
        if (resp.ok) await cacheTile(key, await resp.blob());
      } catch {}
    }
    done++;
    onProgress(done, tiles.length);
  };

  // 4 concurrent requests — polite to OSM servers
  const CONCURRENCY = 4;
  for (let i = 0; i < tiles.length; i += CONCURRENCY) {
    if (signal?.aborted) break;
    await Promise.all(tiles.slice(i, i + CONCURRENCY).map(fetchOne));
  }
}
