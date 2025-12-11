/**
 * Duration formatting and parsing utilities
 */

/** Time unit multipliers in milliseconds */
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

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

