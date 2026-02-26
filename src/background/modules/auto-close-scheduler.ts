/**
 * AutoCloseScheduler - Evaluates open tabs against auto-close rules and closes stale ones.
 *
 * Called periodically via the ALARM_AUTO_CLOSE_CHECK alarm. For each open tab,
 * it checks:
 *   1. Global toggle (autoCloseEnabled)
 *   2. Pinned protection
 *   3. Non-http(s) URL guard
 *   4. Whitelist rules (any match → skip)
 *   5. Auto-close rules (first match → compare age vs. maxAge)
 *
 * Closed tabs are prepended to `recentlyClosed` (capped at RECENTLY_CLOSED_MAX_ENTRIES)
 * to support the undo feature in Story 3.6.
 *
 * Undo durability guarantee: undo entries are written to storage BEFORE any
 * `chrome.tabs.remove` call. If storage fails, no tabs are closed.
 */

import type { StorageService } from './storage-service';
import type { ActivityTracker } from './activity-tracker';
import { findFirstMatchingRule, matchPattern } from '@shared/utils/pattern-matcher';
import { generateId } from '@shared/utils/id-utils';
import { RECENTLY_CLOSED_MAX_ENTRIES } from '@shared/constants';
import type { ClosedTabEntry } from '@shared/types';

export interface AutoCloseResult {
  closedCount: number;
  errors: string[];
}

export class AutoCloseScheduler {
  constructor(
    private storage: StorageService,
    private activityTracker: ActivityTracker,
  ) {}

  /**
   * Guards against concurrent invocations. Chrome alarm events can arrive
   * faster than a single check completes when storage or tab enumeration is
   * slow; a second overlapping run would race on the same `recentlyClosed`
   * snapshot.
   */
  private isRunning = false;

  /**
   * Main entry point — evaluate every open tab against enabled auto-close rules
   * and remove stale ones. Returns a summary of the operation.
   *
   * Two-phase close protocol (undo durability):
   *   Phase 1 — evaluate all tabs, build the list of entries to close
   *   Phase 2 — persist undo entries to storage BEFORE removing any tab
   *   Phase 3 — remove tabs (best-effort; individual failures are non-fatal)
   */
  async runCheck(): Promise<AutoCloseResult> {
    if (this.isRunning) {
      console.warn('[AutoCloseScheduler] runCheck() already in progress — skipping overlapping invocation.');
      return { closedCount: 0, errors: [] };
    }

    this.isRunning = true;
    try {
      return await this._runCheck();
    } finally {
      this.isRunning = false;
    }
  }

  private async _runCheck(): Promise<AutoCloseResult> {
    const errors: string[] = [];

    // AC9: Respect the global toggle
    const settings = await this.storage.getSettings();
    if (!settings.autoCloseEnabled) {
      return { closedCount: 0, errors };
    }

    // Fetch everything we need up-front (tab list + rules run in parallel)
    const [tabs, rawAutoCloseRules, rawWhitelistRules] = await Promise.all([
      chrome.tabs.query({}),
      this.storage.getAutoCloseRules(),
      this.storage.getWhitelistRules(),
    ]);

    const enabledAutoCloseRules = rawAutoCloseRules.filter((r) => r.enabled);
    const enabledWhitelistRules = rawWhitelistRules.filter((r) => r.enabled);

    const now = Date.now();

    // ── Phase 1: Identify stale tabs ────────────────────────────────────────
    // Build the full list of (entry, tabId) pairs before any side-effects.
    const planned: Array<{ entry: ClosedTabEntry; tabId: number }> = [];

    for (const tab of tabs) {
      // Skip tabs whose id chrome hasn't assigned yet
      if (tab.id === undefined) continue;

      // AC5: Protect pinned tabs
      if (tab.pinned && settings.autoCloseProtectPinned) continue;

      // AC6: Only evaluate http(s) tabs
      if (!tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) continue;

      // AC4: Whitelist takes precedence
      const isWhitelisted = enabledWhitelistRules.some((rule) =>
        matchPattern(tab.url!, rule.pattern, rule.patternType),
      );
      if (isWhitelisted) continue;

      // AC2: Find the first matching auto-close rule
      const matchingRule = findFirstMatchingRule(tab.url, enabledAutoCloseRules);
      if (!matchingRule) continue;

      // AC10: No activity record → skip (treat as age 0 / just created)
      const activity = await this.activityTracker.getActivity(tab.id);
      if (!activity) continue;

      // AC3: Compare tab age against rule maxAge
      const age = now - activity.lastActiveAt;
      if (age <= matchingRule.maxAge) continue;

      planned.push({
        tabId: tab.id,
        entry: {
          id: generateId(),
          url: tab.url,
          title: tab.title ?? tab.url,
          favicon: tab.favIconUrl ?? null,
          closedAt: now,
          closedBy: 'auto',
        },
      });
    }

    if (planned.length === 0) {
      return { closedCount: 0, errors };
    }

    // ── Phase 2: Persist undo entries BEFORE closing (AC7 — undo durability) ──
    // If this write fails, we have not yet removed any tab, so no undo data
    // is lost. Allow the error to propagate — the caller logs it.
    const { recentlyClosed: existing } = await this.storage.getLocalStorage();
    const newEntries = planned.map((p) => p.entry);
    const updated = [...newEntries, ...existing].slice(0, RECENTLY_CLOSED_MAX_ENTRIES);
    await this.storage.updateLocalStorage({ recentlyClosed: updated });

    // ── Phase 3: Remove tabs (best-effort) ─────────────────────────────────
    let closedCount = 0;
    const failedEntryIds = new Set<string>();
    for (const { tabId, entry } of planned) {
      try {
        await chrome.tabs.remove(tabId);
        closedCount++;
      } catch (error) {
        // Tab may have closed between the query and remove — non-fatal
        errors.push(`Failed to close tab ${tabId} (${entry.url}): ${String(error)}`);
        failedEntryIds.add(entry.id);
      }
    }

    // ── Phase 4: Corrective write — strip undo entries for tabs NOT closed ──
    // AC7 semantics: recentlyClosed must only contain tabs that were actually
    // removed. If some chrome.tabs.remove calls failed, pull those entries back
    // out of storage. A failure here is non-fatal (tabs were already closed);
    // we log and continue so the caller still gets an accurate result.
    if (failedEntryIds.size > 0) {
      try {
        const { recentlyClosed: current } = await this.storage.getLocalStorage();
        const corrected = current.filter((e) => !failedEntryIds.has(e.id));
        await this.storage.updateLocalStorage({ recentlyClosed: corrected });
      } catch (correctionError) {
        console.error(
          '[AutoCloseScheduler] Failed to remove phantom undo entries from recentlyClosed:',
          correctionError,
        );
      }
    }

    return { closedCount, errors };
  }
}
