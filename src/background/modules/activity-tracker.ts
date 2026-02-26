/**
 * ActivityTracker - Tracks tab activity timestamps for auto-close functionality
 *
 * Persists last-active and created timestamps to chrome.storage.local so
 * data survives service worker termination and browser restarts.
 */

import type { StorageService } from './storage-service';
import type { TabActivity } from '@shared/types';

export class ActivityTracker {
  constructor(private storage: StorageService) {}

  /**
   * Serialises all read-modify-write storage operations to prevent lost updates
   * from concurrent tab events (onCreated, onActivated, onUpdated, onRemoved).
   */
  private writeQueue: Promise<void> = Promise.resolve();

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const result = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    this.writeQueue = this.writeQueue
      .then(() => task().then(resolve, reject))
      .then(
        () => undefined,
        () => undefined,
      );
    return result;
  }

  /**
   * Record that a tab was activated (user switched focus to it).
   * Updates `lastActiveAt` for the tab and `tabActivityByUrl` index.
   * Creates a new entry if one does not already exist.
   *
   * AC1, AC2, AC3
   */
  async recordTabActivated(tabId: number, url: string): Promise<void> {
    return this.enqueue(async () => {
      try {
        const { tabActivity, tabActivityByUrl } = await this.storage.getLocalStorage();

        const now = Date.now();
        const existing = tabActivity[tabId];

        const updated: TabActivity = existing
          ? { ...existing, lastActiveAt: now, url: url || existing.url }
          : { tabId, url: url ?? '', createdAt: now, lastActiveAt: now };

        const updatedTabActivity = { ...tabActivity, [tabId]: updated };
        const updatedTabActivityByUrl = url
          ? { ...tabActivityByUrl, [url]: now }
          : tabActivityByUrl;

        await this.storage.updateLocalStorage({
          tabActivity: updatedTabActivity,
          tabActivityByUrl: updatedTabActivityByUrl,
        });
      } catch (error) {
        console.error('[ActivityTracker] Failed to record tab activation:', error);
        throw error;
      }
    });
  }

  /**
   * Record that a new tab was created.
   * Sets both `createdAt` and `lastActiveAt` to the current time.
   * Tabs with an empty or undefined URL are skipped — they can never match
   * a URL-pattern-based auto-close rule (AC4).
   */
  async recordTabCreated(tabId: number, url: string): Promise<void> {
    if (!url) return;
    return this.enqueue(async () => {
      try {
        const { tabActivity, tabActivityByUrl } = await this.storage.getLocalStorage();

        const now = Date.now();
        const newEntry: TabActivity = {
          tabId,
          url,
          createdAt: now,
          lastActiveAt: now,
        };

        await this.storage.updateLocalStorage({
          tabActivity: { ...tabActivity, [tabId]: newEntry },
          tabActivityByUrl: { ...tabActivityByUrl, [url]: now },
        });
      } catch (error) {
        console.error('[ActivityTracker] Failed to record tab creation:', error);
        throw error;
      }
    });
  }

  /**
   * Record that a tab was removed.
   * Deletes the `tabActivity` entry for the tab.
   * Intentionally preserves `tabActivityByUrl` for cross-restart persistence.
   *
   * AC6
   */
  async recordTabRemoved(tabId: number): Promise<void> {
    return this.enqueue(async () => {
      try {
        const { tabActivity } = await this.storage.getLocalStorage();

        if (!(tabId in tabActivity)) return;

        const updatedTabActivity = { ...tabActivity };
        delete updatedTabActivity[tabId];

        await this.storage.updateLocalStorage({ tabActivity: updatedTabActivity });
      } catch (error) {
        console.error('[ActivityTracker] Failed to record tab removal:', error);
        throw error;
      }
    });
  }

  /**
   * Update the URL on an existing tab activity record without resetting timestamps.
   * If no record exists, creates a new one (same as recordTabCreated).
   * Used by the `onUpdated` handler when a tab navigates to a new URL.
   */
  async recordTabUrlUpdated(tabId: number, url: string): Promise<void> {
    if (!url) return;
    return this.enqueue(async () => {
      try {
        const { tabActivity, tabActivityByUrl } = await this.storage.getLocalStorage();

        const existing = tabActivity[tabId];

        if (existing) {
          // Preserve timestamps — only update the URL
          const updated: TabActivity = { ...existing, url };
          await this.storage.updateLocalStorage({
            tabActivity: { ...tabActivity, [tabId]: updated },
            tabActivityByUrl: { ...tabActivityByUrl, [url]: existing.lastActiveAt },
          });
        } else {
          // No record yet — create one as if it were a new tab.
          // Use storage directly (already inside enqueue — cannot re-enter the queue).
          const now = Date.now();
          const newEntry: TabActivity = { tabId, url, createdAt: now, lastActiveAt: now };
          await this.storage.updateLocalStorage({
            tabActivity: { ...tabActivity, [tabId]: newEntry },
            tabActivityByUrl: { ...tabActivityByUrl, [url]: now },
          });
        }
      } catch (error) {
        console.error('[ActivityTracker] Failed to record tab URL update:', error);
        throw error;
      }
    });
  }

  /**
   * Returns the `TabActivity` for a given tab, or `null` if not found.
   *
   * AC7
   */
  async getActivity(tabId: number): Promise<TabActivity | null> {
    const { tabActivity } = await this.storage.getLocalStorage();
    return tabActivity[tabId] ?? null;
  }

  /**
   * Returns the full tab activity map (keyed by tabId).
   *
   * AC7
   */
  async getAllActivity(): Promise<Record<number, TabActivity>> {
    const { tabActivity } = await this.storage.getLocalStorage();
    return tabActivity;
  }

  /**
   * Returns milliseconds elapsed since `lastActiveAt`, or `null` if no record.
   *
   * AC7
   */
  async getTabAge(tabId: number): Promise<number | null> {
    const activity = await this.getActivity(tabId);
    if (!activity) return null;
    return Date.now() - activity.lastActiveAt;
  }
}
