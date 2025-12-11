/**
 * Storage schema definitions for Tab Wrangler
 */

import type {
  GroupingRule,
  AutoCloseRule,
  WhitelistRule,
  ArchiveExclusionRule,
  DuplicateDetectionMode,
  SortOrder,
} from './rules';

/** Settings stored in sync storage */
export interface Settings {
  // Feature toggles
  autoGroupEnabled: boolean;
  autoCloseEnabled: boolean;

  // Duplicate detection
  duplicateDetectionMode: DuplicateDetectionMode;

  // Auto-close settings
  autoCloseCheckInterval: number; // milliseconds
  autoCloseProtectPinned: boolean;

  // Archive settings
  archiveEnabled: boolean;
  archiveBookmarkFolderId: string | null;

  // Sort preferences
  defaultSortOrder: SortOrder;
  sortPreserveGroups: boolean;
}

/** Data stored in chrome.storage.sync (synced across devices) */
export interface SyncStorage {
  groupingRules: GroupingRule[];
  autoCloseRules: AutoCloseRule[];
  whitelistRules: WhitelistRule[];
  archiveExclusionRules: ArchiveExclusionRule[];
  settings: Settings;
}

/** Tab activity tracking */
export interface TabActivity {
  tabId: number;
  url: string;
  lastActiveAt: number; // timestamp
  createdAt: number; // timestamp
}

/** Entry for a closed tab (for undo functionality) */
export interface ClosedTabEntry {
  id: string;
  url: string;
  title: string;
  favicon: string | null;
  closedAt: number; // timestamp
  closedBy: 'auto' | 'duplicate' | 'manual';
}

/** Data stored in chrome.storage.local (device-local) */
export interface LocalStorage {
  // Tab activity tracking (by tab ID for fast lookup)
  tabActivity: Record<number, TabActivity>;

  // Recently closed tabs (for undo)
  recentlyClosed: ClosedTabEntry[];

  // Persistent activity by URL (survives tab ID changes)
  tabActivityByUrl: Record<string, number>; // url -> lastActiveTimestamp
}

/** Combined storage type for type-safe access */
export interface StorageAreas {
  sync: SyncStorage;
  local: LocalStorage;
}

