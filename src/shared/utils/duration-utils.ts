/**
 * Duration formatting and parsing utilities
 */

/** Time unit multipliers in milliseconds */
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** Duration units for form inputs (AC7) */
export type DurationUnit = 'minutes' | 'hours' | 'days';

/** Parsed duration object (AC7) */
export interface ParsedDuration {
  value: number;
  unit: DurationUnit;
}

/**
 * Format a duration in milliseconds to a human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < MINUTE) {
    return `${Math.round(ms / 1000)}s`;
  }
  if (ms < HOUR) {
    const minutes = Math.round(ms / MINUTE);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  if (ms < DAY) {
    const hours = Math.round(ms / HOUR);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  if (ms < WEEK) {
    const days = Math.round(ms / DAY);
    return `${days} day${days !== 1 ? 's' : ''}`;
  }
  const weeks = Math.round(ms / WEEK);
  return `${weeks} week${weeks !== 1 ? 's' : ''}`;
}

/**
 * Format a duration to a short string (e.g., "2h", "1d")
 */
export function formatDurationShort(ms: number): string {
  if (ms < MINUTE) {
    return `${Math.round(ms / 1000)}s`;
  }
  if (ms < HOUR) {
    return `${Math.round(ms / MINUTE)}m`;
  }
  if (ms < DAY) {
    return `${Math.round(ms / HOUR)}h`;
  }
  if (ms < WEEK) {
    return `${Math.round(ms / DAY)}d`;
  }
  return `${Math.round(ms / WEEK)}w`;
}

/**
 * Parse a duration string to milliseconds
 * Supports: "30m", "2h", "1d", "1w"
 */
export function parseDuration(str: string): number | null {
  const match = str.trim().match(/^(\d+)\s*(s|m|h|d|w)$/i);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * MINUTE;
    case 'h':
      return value * HOUR;
    case 'd':
      return value * DAY;
    case 'w':
      return value * WEEK;
    default:
      return null;
  }
}

/**
 * Format a timestamp as relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  
  if (diff < MINUTE) {
    return 'just now';
  }
  if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE);
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  }
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  }
  const days = Math.floor(diff / DAY);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

/**
 * Parse duration from value and unit to milliseconds (AC7)
 * Used in rule editor forms where user enters numeric value + unit selector
 */
export function parseDurationFromValue(value: number, unit: DurationUnit): number {
  switch (unit) {
    case 'minutes':
      return value * MINUTE;
    case 'hours':
      return value * HOUR;
    case 'days':
      return value * DAY;
  }
}

/**
 * Format milliseconds to structured duration object with value and unit (AC7)
 * Chooses most appropriate unit for display
 */
export function formatDurationToObject(milliseconds: number): ParsedDuration {
  const minutes = milliseconds / MINUTE;
  const hours = milliseconds / HOUR;
  const days = milliseconds / DAY;

  // Choose most appropriate unit (prefer whole numbers)
  if (days >= 1 && Number.isInteger(days)) {
    return { value: days, unit: 'days' };
  } else if (hours >= 1 && Number.isInteger(hours)) {
    return { value: hours, unit: 'hours' };
  } else {
    return { value: Math.round(minutes), unit: 'minutes' };
  }
}

/**
 * Format milliseconds to display string with unit (AC7)
 * Example: 7200000 → "2 hours"
 */
export function formatDurationDisplay(milliseconds: number): string {
  const { value, unit } = formatDurationToObject(milliseconds);
  const unitLabel = value === 1 ? unit.slice(0, -1) : unit; // Remove 's' for singular
  return `${value} ${unitLabel}`;
}

