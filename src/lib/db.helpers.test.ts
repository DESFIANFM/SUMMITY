import { beforeEach, describe, expect, it } from 'vitest';
import {
  generateUUID,
  getPosIndexByUUID,
  getValidUUID,
  isValidUUID,
  toSnakeCaseKey,
  toSnakeCaseObject,
} from './db';

// These are the pure, side-effect-light helpers from db.ts. Importing db.ts
// registers a background sync interval, but with no Supabase env vars the
// interval is a no-op, so these tests stay isolated.

describe('isValidUUID', () => {
  it('accepts a well-formed v4 UUID (case-insensitive)', () => {
    expect(isValidUUID('3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe(true);
    expect(isValidUUID('3F2504E0-4F89-41D3-9A0C-0305E82C3301')).toBe(true);
  });

  it('rejects display ids, empty values, and non-strings', () => {
    expect(isValidUUID('USER-1234')).toBe(false);
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID(null)).toBe(false);
    expect(isValidUUID(12345)).toBe(false);
    expect(isValidUUID('3f2504e0-4f89-41d3-9a0c')).toBe(false); // too short
  });
});

describe('generateUUID', () => {
  it('produces a value that passes isValidUUID', () => {
    expect(isValidUUID(generateUUID())).toBe(true);
  });

  it('produces distinct values on successive calls', () => {
    expect(generateUUID()).not.toBe(generateUUID());
  });
});

describe('toSnakeCaseKey', () => {
  it('converts camelCase to snake_case', () => {
    expect(toSnakeCaseKey('idPendaki')).toBe('id_pendaki');
    expect(toSnakeCaseKey('emergencyPhone')).toBe('emergency_phone');
  });

  it('leaves already-lowercase keys untouched', () => {
    expect(toSnakeCaseKey('name')).toBe('name');
    expect(toSnakeCaseKey('email')).toBe('email');
  });
});

describe('toSnakeCaseObject', () => {
  it('converts every key while preserving the values', () => {
    const input = { idPendaki: 'USER-1', emergencyPhone: '0812', name: 'Budi' };
    expect(toSnakeCaseObject(input)).toEqual({
      id_pendaki: 'USER-1',
      emergency_phone: '0812',
      name: 'Budi',
    });
  });

  it('returns an empty object for an empty input', () => {
    expect(toSnakeCaseObject({})).toEqual({});
  });
});

describe('getPosIndexByUUID', () => {
  it('passes numeric-like values straight through', () => {
    expect(getPosIndexByUUID('5')).toBe(5);
    expect(getPosIndexByUUID(5)).toBe(5);
    expect(getPosIndexByUUID(0)).toBe(0);
  });

  it('defaults to pos 0 (basecamp) for non-numeric input', () => {
    expect(getPosIndexByUUID('not-a-number')).toBe(0);
  });
});

describe('getValidUUID', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the input unchanged when it is already a UUID', () => {
    const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    expect(getValidUUID(uuid)).toBe(uuid);
  });

  it('resolves an existing display id to its stored UUID', () => {
    const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    localStorage.setItem(
      'summity_users_list',
      JSON.stringify([{ id: uuid, displayId: 'USER-1234' }]),
    );
    expect(getValidUUID('USER-1234')).toBe(uuid);
  });

  it('mints and persists a new UUID for an unknown display id', () => {
    const result = getValidUUID('USER-9999');
    expect(isValidUUID(result)).toBe(true);

    const stored = JSON.parse(localStorage.getItem('summity_users_list') ?? '[]');
    const match = stored.find((u: any) => u.displayId === 'USER-9999');
    expect(match).toBeDefined();
    expect(match.id).toBe(result);
  });
});
