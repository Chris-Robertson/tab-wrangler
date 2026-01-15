/**
 * Storage Service - Unified interface to chrome.storage
 */

import type {
  SyncStorage,
  LocalStorage,
  Settings,
  GroupingRule,
  AutoCloseRule,
  WhitelistRule,
  ArchiveExclusionRule,
} from '@shared/types';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@shared/constants';

/**
 * Service for managing chrome.storage.sync and chrome.storage.local
 */
export class StorageService {
  /**
   * Initialize default values on first install
   */
  async initializeDefaults(): Promise<void> {
    const existing = await chrome.storage.sync.get(STORAGE_KEYS.sync.SETTINGS);
    
    if (!existing[STORAGE_KEYS.sync.SETTINGS]) {
      await chrome.storage.sync.set({
        [STORAGE_KEYS.sync.GROUPING_RULES]: [],
        [STORAGE_KEYS.sync.AUTO_CLOSE_RULES]: [],
        [STORAGE_KEYS.sync.WHITELIST_RULES]: [],
        [STORAGE_KEYS.sync.ARCHIVE_EXCLUSION_RULES]: [],
        [STORAGE_KEYS.sync.SETTINGS]: DEFAULT_SETTINGS,
      });
    }

    const existingLocal = await chrome.storage.local.get(STORAGE_KEYS.local.TAB_ACTIVITY);
    
    if (!existingLocal[STORAGE_KEYS.local.TAB_ACTIVITY]) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.local.TAB_ACTIVITY]: {},
        [STORAGE_KEYS.local.RECENTLY_CLOSED]: [],
        [STORAGE_KEYS.local.TAB_ACTIVITY_BY_URL]: {},
      });
    }
  }

  // ============ Settings ============

  /**
   * Get settings, merging stored values with defaults to handle partial objects.
   * This ensures all fields are present even if storage has incomplete data.
   */
  async getSettings(): Promise<Settings> {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEYS.sync.SETTINGS) as Record<string, Partial<Settings> | undefined>;
      const stored = result[STORAGE_KEYS.sync.SETTINGS];
      if (!stored) {
        return { ...DEFAULT_SETTINGS };
      }
      return { ...DEFAULT_SETTINGS, ...stored };
    } catch (error) {
      console.error('[StorageService] Failed to get settings:', error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Update settings by merging partial updates with current settings.
   */
  async updateSettings(newSettings: Partial<Settings>): Promise<void> {
    try {
      const current = await this.getSettings();
      const updated = { ...current, ...newSettings };
      await chrome.storage.sync.set({
        [STORAGE_KEYS.sync.SETTINGS]: updated,
      });
    } catch (error) {
      console.error('[StorageService] Failed to update settings:', error);
      throw error;
    }
  }

  // ============ Grouping Rules ============

  async getGroupingRules(): Promise<GroupingRule[]> {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.sync.GROUPING_RULES) as Record<string, GroupingRule[] | undefined>;
    const rules = result[STORAGE_KEYS.sync.GROUPING_RULES] ?? [];
    return rules.map((rule) => ({
      ...rule,
      enabled: rule.enabled ?? true,
    }));
  }

  async saveGroupingRules(rules: GroupingRule[]): Promise<void> {
    await chrome.storage.sync.set({
      [STORAGE_KEYS.sync.GROUPING_RULES]: rules,
    });
  }

  // ============ Auto-Close Rules ============

  async getAutoCloseRules(): Promise<AutoCloseRule[]> {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.sync.AUTO_CLOSE_RULES) as Record<string, AutoCloseRule[] | undefined>;
    return result[STORAGE_KEYS.sync.AUTO_CLOSE_RULES] ?? [];
  }

  async saveAutoCloseRules(rules: AutoCloseRule[]): Promise<void> {
    await chrome.storage.sync.set({
      [STORAGE_KEYS.sync.AUTO_CLOSE_RULES]: rules,
    });
  }

  // ============ Whitelist Rules ============

  async getWhitelistRules(): Promise<WhitelistRule[]> {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.sync.WHITELIST_RULES) as Record<string, WhitelistRule[] | undefined>;
    return result[STORAGE_KEYS.sync.WHITELIST_RULES] ?? [];
  }

  async saveWhitelistRules(rules: WhitelistRule[]): Promise<void> {
    await chrome.storage.sync.set({
      [STORAGE_KEYS.sync.WHITELIST_RULES]: rules,
    });
  }

  // ============ Archive Exclusion Rules ============

  async getArchiveExclusionRules(): Promise<ArchiveExclusionRule[]> {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.sync.ARCHIVE_EXCLUSION_RULES) as Record<string, ArchiveExclusionRule[] | undefined>;
    return result[STORAGE_KEYS.sync.ARCHIVE_EXCLUSION_RULES] ?? [];
  }

  async saveArchiveExclusionRules(rules: ArchiveExclusionRule[]): Promise<void> {
    await chrome.storage.sync.set({
      [STORAGE_KEYS.sync.ARCHIVE_EXCLUSION_RULES]: rules,
    });
  }

  // ============ Full Sync Storage ============

  async getSyncStorage(): Promise<SyncStorage> {
    const result = await chrome.storage.sync.get(null) as Record<string, unknown>;
    return {
      groupingRules: (result[STORAGE_KEYS.sync.GROUPING_RULES] as GroupingRule[] | undefined) ?? [],
      autoCloseRules: (result[STORAGE_KEYS.sync.AUTO_CLOSE_RULES] as AutoCloseRule[] | undefined) ?? [],
      whitelistRules: (result[STORAGE_KEYS.sync.WHITELIST_RULES] as WhitelistRule[] | undefined) ?? [],
      archiveExclusionRules: (result[STORAGE_KEYS.sync.ARCHIVE_EXCLUSION_RULES] as ArchiveExclusionRule[] | undefined) ?? [],
      settings: (result[STORAGE_KEYS.sync.SETTINGS] as Settings | undefined) ?? DEFAULT_SETTINGS,
    };
  }

  // ============ Local Storage ============

  async getLocalStorage(): Promise<LocalStorage> {
    const result = await chrome.storage.local.get(null) as Record<string, unknown>;
    return {
      tabActivity: (result[STORAGE_KEYS.local.TAB_ACTIVITY] as LocalStorage['tabActivity'] | undefined) ?? {},
      recentlyClosed: (result[STORAGE_KEYS.local.RECENTLY_CLOSED] as LocalStorage['recentlyClosed'] | undefined) ?? [],
      tabActivityByUrl: (result[STORAGE_KEYS.local.TAB_ACTIVITY_BY_URL] as LocalStorage['tabActivityByUrl'] | undefined) ?? {},
    };
  }

  async updateLocalStorage(data: Partial<LocalStorage>): Promise<void> {
    const updates: Record<string, unknown> = {};
    
    if (data.tabActivity !== undefined) {
      updates[STORAGE_KEYS.local.TAB_ACTIVITY] = data.tabActivity;
    }
    if (data.recentlyClosed !== undefined) {
      updates[STORAGE_KEYS.local.RECENTLY_CLOSED] = data.recentlyClosed;
    }
    if (data.tabActivityByUrl !== undefined) {
      updates[STORAGE_KEYS.local.TAB_ACTIVITY_BY_URL] = data.tabActivityByUrl;
    }

    await chrome.storage.local.set(updates);
  }

  // ============ Import/Export ============

  async exportAllRules(): Promise<string> {
    const sync = await this.getSyncStorage();
    return JSON.stringify(sync, null, 2);
  }

  async importRules(json: string): Promise<void> {
    const data = JSON.parse(json) as Partial<SyncStorage>;
    
    if (data.groupingRules) {
      await this.saveGroupingRules(data.groupingRules);
    }
    if (data.autoCloseRules) {
      await this.saveAutoCloseRules(data.autoCloseRules);
    }
    if (data.whitelistRules) {
      await this.saveWhitelistRules(data.whitelistRules);
    }
    if (data.archiveExclusionRules) {
      await this.saveArchiveExclusionRules(data.archiveExclusionRules);
    }
    if (data.settings) {
      await this.updateSettings(data.settings);
    }
  }
}

