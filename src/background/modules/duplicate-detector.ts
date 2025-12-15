/**
 * DuplicateDetector - Module for finding and removing duplicate tabs
 */

import { normalizeUrl, isChromeInternalUrl } from '@shared/utils/url-utils';
import { generateId } from '@shared/utils/id-utils';
import { RECENTLY_CLOSED_MAX_ENTRIES } from '@shared/constants';
import type { DuplicateDetectionMode, ClosedTabEntry } from '@shared/types';

/**
 * Group of tabs that share the same normalized URL
 */
export interface DuplicateGroup {
  normalizedUrl: string;
  tabs: chrome.tabs.Tab[];
}

/**
 * Result of a remove duplicates operation
 */
export interface RemoveDuplicatesResult {
  removed: chrome.tabs.Tab[];
  kept: chrome.tabs.Tab[];
}

/**
 * Minimal storage interface for dependency injection
 */
interface StorageServiceLike {
  getLocalStorage(): Promise<{ recentlyClosed: ClosedTabEntry[] }>;
  updateLocalStorage(data: { recentlyClosed: ClosedTabEntry[] }): Promise<void>;
}

/**
 * Service for detecting and managing duplicate tabs
 */
export class DuplicateDetector {
  private storage: StorageServiceLike;

  constructor(storage: StorageServiceLike) {
    this.storage = storage;
  }
  /**
   * Find all duplicate tabs across all windows
   * 
   * @param mode - How to compare URLs for duplicate detection
   * @returns Array of duplicate groups (only groups with 2+ tabs)
   */
  async findDuplicates(mode: DuplicateDetectionMode): Promise<DuplicateGroup[]> {
    const tabs = await chrome.tabs.query({});
    const urlMap = new Map<string, chrome.tabs.Tab[]>();

    for (const tab of tabs) {
      // Skip tabs without URLs (new tabs, etc.)
      if (!tab.url) continue;

      // Skip Chrome/browser internal pages
      if (isChromeInternalUrl(tab.url)) continue;

      const normalized = normalizeUrl(tab.url, mode);
      const existing = urlMap.get(normalized) || [];
      existing.push(tab);
      urlMap.set(normalized, existing);
    }

    // Return only groups with duplicates (2+ tabs)
    return Array.from(urlMap.entries())
      .filter(([, tabs]) => tabs.length > 1)
      .map(([url, tabs]) => ({ normalizedUrl: url, tabs }));
  }

  /**
   * Get count of duplicate tabs that would be removed
   * 
   * @param mode - How to compare URLs for duplicate detection
   * @returns Number of tabs that would be removed (all but one per group)
   */
  async getDuplicateCount(mode: DuplicateDetectionMode): Promise<number> {
    const groups = await this.findDuplicates(mode);
    // Count tabs that WOULD be removed (all but one per group)
    return groups.reduce((sum, group) => sum + group.tabs.length - 1, 0);
  }

  /**
   * Remove duplicate tabs, keeping one per duplicate group
   * 
   * @param mode - How to compare URLs for duplicate detection
   * @param keepStrategy - Which duplicate to keep: 'oldest' (first opened) or 'newest' (last opened)
   * @returns Object with arrays of removed and kept tabs
   */
  async removeDuplicates(
    mode: DuplicateDetectionMode,
    keepStrategy: 'oldest' | 'newest' = 'oldest'
  ): Promise<RemoveDuplicatesResult> {
    const groups = await this.findDuplicates(mode);
    const removed: chrome.tabs.Tab[] = [];
    const kept: chrome.tabs.Tab[] = [];

    for (const group of groups) {
      // Sort by tab ID as a proxy for creation order (lower ID = older tab).
      // LIMITATION: Tab IDs are assigned incrementally per browser session but are
      // not guaranteed to reflect true creation order across restarts or in all
      // edge cases. This heuristic works well for typical usage patterns.
      const sorted = [...group.tabs].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

      // Determine which tab to keep based on strategy
      const keepIndex = keepStrategy === 'oldest' ? 0 : sorted.length - 1;

      // Check if any tab in the group is active - if so, keep that one instead
      const activeTabIndex = sorted.findIndex(tab => tab.active);

      for (let i = 0; i < sorted.length; i++) {
        // Keep the active tab if one exists, otherwise use strategy
        const shouldKeep = activeTabIndex !== -1 
          ? i === activeTabIndex 
          : i === keepIndex;

        if (shouldKeep) {
          kept.push(sorted[i]);
        } else {
          removed.push(sorted[i]);
        }
      }
    }

    // Close duplicate tabs
    const idsToClose = removed
      .map(t => t.id)
      .filter((id): id is number => id !== undefined);

    if (idsToClose.length > 0) {
      await chrome.tabs.remove(idsToClose);

      // Store closed tabs in recentlyClosed for undo capability
      const { recentlyClosed } = await this.storage.getLocalStorage();
      const now = Date.now();

      const closedEntries: ClosedTabEntry[] = removed.map(tab => ({
        id: generateId(),
        url: tab.url ?? '',
        title: tab.title ?? '',
        favicon: tab.favIconUrl ?? null,
        closedAt: now,
        closedBy: 'duplicate',
      }));

      // Prepend new entries to the front of the list
      const updatedRecentlyClosed = [...closedEntries, ...recentlyClosed];

      // Keep only the most recent entries to avoid unbounded growth
      await this.storage.updateLocalStorage({
        recentlyClosed: updatedRecentlyClosed.slice(0, RECENTLY_CLOSED_MAX_ENTRIES),
      });
    }

    return { removed, kept };
  }
}

