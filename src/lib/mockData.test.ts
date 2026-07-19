import { describe, expect, it } from 'vitest';
import { calculateETA, MOUNTAIN_POS } from './mockData';

// calculateETA: horizontalTime = distance * 30 min/km,
// verticalTime = (elevGain / 100) * 15 min per 100m of climb.
describe('calculateETA', () => {
  it('accounts for horizontal distance on flat terrain', () => {
    // 2 km flat → 60 min
    expect(calculateETA(2, 1000, 1000)).toEqual({ hours: 1, minutes: 0 });
  });

  it('adds vertical climbing time on top of horizontal time', () => {
    // 1 km (30 min) + 200 m climb (2 * 15 = 30 min) = 60 min
    expect(calculateETA(1, 1000, 1200)).toEqual({ hours: 1, minutes: 0 });
  });

  it('rounds partial minutes and handles sub-hour results', () => {
    // 0.5 km flat → 15 min
    expect(calculateETA(0.5, 1000, 1000)).toEqual({ hours: 0, minutes: 15 });
  });

  it('uses absolute value so a net-negative estimate never goes below zero', () => {
    // No horizontal distance, descending 200 m → -30 min → abs → 30 min
    expect(calculateETA(0, 1200, 1000)).toEqual({ hours: 0, minutes: 30 });
  });
});

describe('MOUNTAIN_POS fixture', () => {
  it('has contiguous ids from 0 (basecamp) to the summit', () => {
    MOUNTAIN_POS.forEach((pos, index) => {
      expect(pos.id).toBe(index);
    });
    expect(MOUNTAIN_POS[0].name).toContain('Basecamp');
    expect(MOUNTAIN_POS.at(-1)?.name).toContain('Puncak');
  });

  it('increases in elevation and distance monotonically along the trail', () => {
    for (let i = 1; i < MOUNTAIN_POS.length; i++) {
      expect(MOUNTAIN_POS[i].elevation).toBeGreaterThan(MOUNTAIN_POS[i - 1].elevation);
      expect(MOUNTAIN_POS[i].distanceFromBase).toBeGreaterThan(MOUNTAIN_POS[i - 1].distanceFromBase);
    }
  });
});
