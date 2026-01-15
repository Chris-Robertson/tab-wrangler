/**
 * AutoGroupManager - Automatically groups tabs based on matching rules
 * 
 * Handles tab grouping logic when new tabs are created or URLs change.
 * Integrates with StorageService for rules/settings and PatternMatcher for URL matching.
 */

import type { StorageService } from './storage-service';
import { findFirstMatchingRule } from '@shared/utils/pattern-matcher';

const groupOperationQueue = new Map<string, Promise<void>>();

async function enqueueGroupOperation<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = groupOperationQueue.get(key) ?? Promise.resolve();
  const run = previous.then(task);
  const tail = run
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => {
      if (groupOperationQueue.get(key) === tail) {
        groupOperationQueue.delete(key);
      }
    });
  groupOperationQueue.set(key, tail);
  return run;
}

export class AutoGroupManager {
  constructor(private storageService: StorageService) {}

  /**
   * Automatically group a tab based on matching rules
   * 
   * @param tabId - The tab ID to group
   * @param url - The URL to match against rules
   */
  async autoGroupTab(tabId: number, url: string, windowId?: number): Promise<void> {
    try {
      // 1. Check global toggle (AC5)
      const settings = await this.storageService.getSettings();
      if (!settings.autoGroupEnabled) {
        return; // Auto-grouping disabled
      }

      // Skip invalid URLs
      if (!url || !(url.startsWith('http://') || url.startsWith('https://'))) {
        return; // Only process http(s) URLs
      }

      // 2. Load grouping rules
      const rules = await this.storageService.getGroupingRules();

      // 3. Sort rules by order (ascending) and find first match (AC1, AC6)
      const sortedRules = [...rules].sort((a, b) => a.order - b.order);

      // AC6: Only enabled rules are evaluated
      const enabledRules = sortedRules.filter((rule) => rule.enabled === true);

      const matchingRule = findFirstMatchingRule(url, enabledRules);
      
      if (!matchingRule) {
        return; // AC4: No match - leave ungrouped
      }

      // 4. Resolve windowId (prefer caller-provided to avoid extra API calls)
      let resolvedWindowId = windowId;
      if (resolvedWindowId === undefined) {
        const tab = await chrome.tabs.get(tabId);
        resolvedWindowId = tab.windowId;
      }

      const operationKey = `${resolvedWindowId}:${matchingRule.groupName}`;

      // 5. Find or create group (window-aware) with serialization to avoid duplicate groups
      await enqueueGroupOperation(operationKey, async () => {
        const existingGroup = await this.findGroupByName(matchingRule.groupName, resolvedWindowId);

        if (existingGroup) {
          // AC2: Add to existing group (inherits existing color)
          await chrome.tabs.group({ tabIds: [tabId], groupId: existingGroup.id });
          return;
        }

        // AC3: Create new group with rule's name and color
        const groupId = await chrome.tabs.group({ tabIds: [tabId] });
        try {
          await chrome.tabGroups.update(groupId, {
            title: matchingRule.groupName,
            color: matchingRule.groupColor,
          });
        } catch (createError) {
          // If the update failed, re-check for an existing group and fall back to it.
          const retryGroup = await this.findGroupByName(matchingRule.groupName, resolvedWindowId);
          if (retryGroup) {
            await chrome.tabs.group({ tabIds: [tabId], groupId: retryGroup.id });
            return;
          }
          throw createError;
        }
      });
    } catch (error) {
      // Log but don't crash service worker
      console.error('[AutoGroupManager] Failed to auto-group tab:', error);
    }
  }

  /**
   * Find an existing tab group by name within a specific window
   * 
   * @param groupName - The group title to search for
   * @param windowId - The window ID to search within
   * @returns The matching TabGroup or null if not found
   */
  private async findGroupByName(groupName: string, windowId: number): Promise<chrome.tabGroups.TabGroup | null> {
    try {
      const groups = await chrome.tabGroups.query({ title: groupName, windowId });
      return groups.length > 0 ? groups[0] : null;
    } catch (error) {
      console.error('[AutoGroupManager] Failed to query groups:', error);
      return null;
    }
  }
}
