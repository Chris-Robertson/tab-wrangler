/**
 * Constants for Tab Wrangler
 */

import type { Settings } from './types';

/** Default settings */
export const DEFAULT_SETTINGS: Settings = {
  autoGroupEnabled: true,
  autoCloseEnabled: false, // Off by default for safety
  duplicateDetectionMode: 'ignoreParams',
  autoCloseCheckInterval: 5 * 60 * 1000, // 5 minutes
  autoCloseProtectPinned: true,
  archiveEnabled: true,
  archiveBookmarkFolderId: null,
  defaultSortOrder: 'domain',
  sortPreserveGroups: true,
};

/** Recently closed tabs limits */
export const RECENTLY_CLOSED_MAX_ENTRIES = 100;
export const RECENTLY_CLOSED_MAX_AGE = 24 * 60 * 60 * 1000; // 1 day

/** Alarm names */
export const ALARM_AUTO_CLOSE_CHECK = 'auto-close-check';
export const ALARM_CLEANUP_RECENTLY_CLOSED = 'cleanup-recently-closed';

/** Archive folder name */
export const ARCHIVE_FOLDER_NAME = 'Tab Wrangler Archive';

/** Storage keys */
export const STORAGE_KEYS = {
  sync: {
    GROUPING_RULES: 'groupingRules',
    AUTO_CLOSE_RULES: 'autoCloseRules',
    WHITELIST_RULES: 'whitelistRules',
    ARCHIVE_EXCLUSION_RULES: 'archiveExclusionRules',
    SETTINGS: 'settings',
  },
  local: {
    TAB_ACTIVITY: 'tabActivity',
    RECENTLY_CLOSED: 'recentlyClosed',
    TAB_ACTIVITY_BY_URL: 'tabActivityByUrl',
  },
} as const;

/** Chrome tab group colors with display names */
export const TAB_GROUP_COLORS = [
  { value: 'grey', label: 'Grey' },
  { value: 'blue', label: 'Blue' },
  { value: 'red', label: 'Red' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'green', label: 'Green' },
  { value: 'pink', label: 'Pink' },
  { value: 'purple', label: 'Purple' },
  { value: 'cyan', label: 'Cyan' },
  { value: 'orange', label: 'Orange' },
] as const;

/** Duration presets for auto-close rules */
export const DURATION_PRESETS = [
  { value: 30 * 60 * 1000, label: '30 minutes' },
  { value: 60 * 60 * 1000, label: '1 hour' },
  { value: 2 * 60 * 60 * 1000, label: '2 hours' },
  { value: 4 * 60 * 60 * 1000, label: '4 hours' },
  { value: 8 * 60 * 60 * 1000, label: '8 hours' },
  { value: 24 * 60 * 60 * 1000, label: '1 day' },
  { value: 7 * 24 * 60 * 60 * 1000, label: '1 week' },
] as const;

