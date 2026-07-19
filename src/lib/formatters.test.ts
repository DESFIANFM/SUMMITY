import { describe, expect, it } from 'vitest';
import { formatDateRange, formatSingleDate } from './formatters';

// Pure functions — no mocks needed. These assert the Indonesian-locale
// date formatting rules that the UI relies on for tickets & SIMAKSI cards.
describe('formatDateRange', () => {
  it('collapses to a single date when start === end', () => {
    expect(formatDateRange('2026-07-19', '2026-07-19')).toBe('19 Jul 2026');
  });

  it('shows a day range when only the day differs', () => {
    expect(formatDateRange('2026-07-19', '2026-07-21')).toBe('19 - 21 Jul 2026');
  });

  it('shows both months when the month differs within one year', () => {
    expect(formatDateRange('2026-07-19', '2026-08-21')).toBe('19 Jul - 21 Agt 2026');
  });

  it('shows both years when the year differs', () => {
    expect(formatDateRange('2025-12-30', '2026-01-02')).toBe('30 Des 2025 - 02 Jan 2026');
  });

  it('returns "-" when both dates are empty', () => {
    expect(formatDateRange('', '')).toBe('-');
  });

  it('falls back to the non-empty side when one date is missing', () => {
    expect(formatDateRange('', '2026-07-19')).toBe('2026-07-19');
    expect(formatDateRange('2026-07-19', '')).toBe('2026-07-19');
  });

  it('returns the raw strings when the dates cannot be parsed', () => {
    expect(formatDateRange('not-a-date', 'also-bad')).toBe('not-a-date - also-bad');
  });
});

describe('formatSingleDate', () => {
  it('formats a valid ISO date in Indonesian locale', () => {
    expect(formatSingleDate('2026-07-19')).toBe('19 Jul 2026');
  });

  it('returns "-" for an empty string', () => {
    expect(formatSingleDate('')).toBe('-');
  });

  it('returns the original string when it is not a valid date', () => {
    expect(formatSingleDate('nonsense')).toBe('nonsense');
  });
});
