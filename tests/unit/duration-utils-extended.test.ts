/**
 * Tests for extended duration utility functions (AC7)
 */

import { describe, it, expect } from 'vitest';
import { 
  parseDurationFromValue, 
  formatDurationToObject,
  formatDurationDisplay 
} from '../../src/shared/utils/duration-utils';

describe('parseDurationFromValue', () => {
  it('should convert minutes to milliseconds', () => {
    expect(parseDurationFromValue(30, 'minutes')).toBe(30 * 60 * 1000);
    expect(parseDurationFromValue(1, 'minutes')).toBe(60 * 1000);
    expect(parseDurationFromValue(120, 'minutes')).toBe(120 * 60 * 1000);
  });

  it('should convert hours to milliseconds', () => {
    expect(parseDurationFromValue(1, 'hours')).toBe(60 * 60 * 1000);
    expect(parseDurationFromValue(2, 'hours')).toBe(2 * 60 * 60 * 1000);
    expect(parseDurationFromValue(24, 'hours')).toBe(24 * 60 * 60 * 1000);
  });

  it('should convert days to milliseconds', () => {
    expect(parseDurationFromValue(1, 'days')).toBe(24 * 60 * 60 * 1000);
    expect(parseDurationFromValue(7, 'days')).toBe(7 * 24 * 60 * 60 * 1000);
    expect(parseDurationFromValue(30, 'days')).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('should handle decimal values', () => {
    expect(parseDurationFromValue(0.5, 'hours')).toBe(0.5 * 60 * 60 * 1000);
    expect(parseDurationFromValue(1.5, 'days')).toBe(1.5 * 24 * 60 * 60 * 1000);
  });
});

describe('formatDurationToObject', () => {
  it('should format minutes correctly', () => {
    expect(formatDurationToObject(30 * 60 * 1000)).toEqual({ value: 30, unit: 'minutes' });
    expect(formatDurationToObject(1 * 60 * 1000)).toEqual({ value: 1, unit: 'minutes' });
    expect(formatDurationToObject(45 * 60 * 1000)).toEqual({ value: 45, unit: 'minutes' });
  });

  it('should format hours correctly', () => {
    expect(formatDurationToObject(1 * 60 * 60 * 1000)).toEqual({ value: 1, unit: 'hours' });
    expect(formatDurationToObject(2 * 60 * 60 * 1000)).toEqual({ value: 2, unit: 'hours' });
    expect(formatDurationToObject(8 * 60 * 60 * 1000)).toEqual({ value: 8, unit: 'hours' });
  });

  it('should format days correctly', () => {
    expect(formatDurationToObject(24 * 60 * 60 * 1000)).toEqual({ value: 1, unit: 'days' });
    expect(formatDurationToObject(7 * 24 * 60 * 60 * 1000)).toEqual({ value: 7, unit: 'days' });
  });

  it('should prefer hours over fractional days', () => {
    expect(formatDurationToObject(36 * 60 * 60 * 1000)).toEqual({ value: 36, unit: 'hours' });
  });

  it('should round fractional minutes', () => {
    expect(formatDurationToObject(90 * 1000)).toEqual({ value: 2, unit: 'minutes' });
    expect(formatDurationToObject(30 * 1000)).toEqual({ value: 1, unit: 'minutes' });
  });
});

describe('formatDurationDisplay', () => {
  it('should format minutes with correct pluralization', () => {
    expect(formatDurationDisplay(1 * 60 * 1000)).toBe('1 minute');
    expect(formatDurationDisplay(30 * 60 * 1000)).toBe('30 minutes');
    expect(formatDurationDisplay(2 * 60 * 1000)).toBe('2 minutes');
  });

  it('should format hours with correct pluralization', () => {
    expect(formatDurationDisplay(1 * 60 * 60 * 1000)).toBe('1 hour');
    expect(formatDurationDisplay(2 * 60 * 60 * 1000)).toBe('2 hours');
    expect(formatDurationDisplay(8 * 60 * 60 * 1000)).toBe('8 hours');
  });

  it('should format days with correct pluralization', () => {
    expect(formatDurationDisplay(1 * 24 * 60 * 60 * 1000)).toBe('1 day');
    expect(formatDurationDisplay(7 * 24 * 60 * 60 * 1000)).toBe('7 days');
  });

  it('should handle edge cases', () => {
    expect(formatDurationDisplay(0)).toBe('0 minutes');
    expect(formatDurationDisplay(59 * 1000)).toBe('1 minute'); // Rounds to 1 minute
  });
});
