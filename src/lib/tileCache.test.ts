import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cacheTile,
  countTilesInArea,
  getCachedTile,
  getCachedTileCount,
  preloadTiles,
} from './tileCache';

// Fresh in-memory IndexedDB per test so the tile store never leaks between tests.
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory() as unknown as IDBFactory;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('countTilesInArea', () => {
  const area = { north: 1, south: 0, east: 1, west: 0 };

  it('counts a single tile for the whole world at zoom 0', () => {
    // At zoom 0 the entire map is one tile, so any bounds collapse to 1.
    expect(countTilesInArea(area, [0])).toBe(1);
  });

  it('sums tiles across the requested zoom levels', () => {
    // Two z=0 passes -> 1 tile each -> 2 total.
    expect(countTilesInArea(area, [0, 0])).toBe(2);
  });

  it('never returns fewer tiles at a higher zoom', () => {
    const low = countTilesInArea(area, [1]);
    const high = countTilesInArea(area, [4]);
    expect(high).toBeGreaterThanOrEqual(low);
    expect(low).toBeGreaterThan(0);
  });
});

describe('tile cache (IndexedDB)', () => {
  it('starts empty', async () => {
    expect(await getCachedTileCount()).toBe(0);
    expect(await getCachedTile('osm/0/0/0')).toBeUndefined();
  });

  it('stores a tile and reads it back by key', async () => {
    const blob = new Blob(['tile-bytes'], { type: 'image/png' });
    await cacheTile('osm/0/0/0', blob);

    expect(await getCachedTileCount()).toBe(1);
    // The stored entry round-trips by key. (fake-indexeddb's structured clone
    // does not reconstruct a real Blob instance in Node, so we assert on
    // presence/absence by key rather than on the Blob type.)
    expect(await getCachedTile('osm/0/0/0')).toBeDefined();
    expect(await getCachedTile('osm/9/9/9')).toBeUndefined();
  });
});

describe('preloadTiles', () => {
  it('fetches, caches and reports progress for each tile in the area', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(['png'], { type: 'image/png' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const progress: Array<[number, number]> = [];
    // Whole world at zoom 0 = exactly one tile.
    await preloadTiles(
      { north: 1, south: 0, east: 1, west: 0 },
      [0],
      (done, total) => progress.push([done, total]),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await getCachedTileCount()).toBe(1);
    // First callback is the (0, total) kickoff; last is (total, total) completion.
    expect(progress[0]).toEqual([0, 1]);
    expect(progress[progress.length - 1]).toEqual([1, 1]);
  });

  it('skips the network when a tile is already cached', async () => {
    await cacheTile('osm/0/0/0', new Blob(['cached'], { type: 'image/png' }));

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await preloadTiles({ north: 1, south: 0, east: 1, west: 0 }, [0], () => {});

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stops early when the abort signal is already aborted', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const controller = new AbortController();
    controller.abort();

    await preloadTiles(
      { north: 1, south: 0, east: 1, west: 0 },
      [0],
      () => {},
      controller.signal,
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
