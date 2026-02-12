/**
 * AutoGroupManager - Automatically groups tabs based on matching rules
 * 
 * Handles tab grouping logic when new tabs are created or URLs change.
 * Integrates with StorageService for rules/settings and PatternMatcher for URL matching.
 */

import type { StorageService } from './storage-service';
import type { TabGroupColor } from '@shared/types';
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
   * Organize all existing tabs across all windows based on grouping rules (Story 2-3)
   * 
   * @returns Summary with tabsOrganized, groupsCreated, and optional errors array
   */
  async organizeAllTabs(): Promise<{ tabsOrganized: number; groupsCreated: number; groupsAffected: number; tabsFailed?: number; errors?: string[] }> {
    try {
      // 1. Load rules and query all tabs (AC2)
      const rules = await this.storageService.getGroupingRules();
      const allTabs = await chrome.tabs.query({});

      // 2. Filter enabled rules and sort by order (AC2)
      const enabledRules = rules
        .filter((r) => r.enabled === true)
        .sort((a, b) => a.order - b.order);

      if (enabledRules.length === 0) {
        return { tabsOrganized: 0, groupsCreated: 0, groupsAffected: 0 };
      }

      // 3. Match each tab to a rule and group by window + target group
      const tabGroupAssignments = new Map<string, chrome.tabs.Tab[]>(); // key: "windowId-groupName"
      const groupColors = new Map<string, TabGroupColor>();
      const tabsToUngroup: number[] = []; // AC4: tabs in groups that don't match any rules
      const groupsToUngroup = new Set<number>(); // Track groupIds being ungrouped for groupsAffected

      for (const tab of allTabs) {
        // Skip tabs without URL or ID
        if (!tab.url || !tab.id || tab.windowId === undefined) continue;

        // AC7: Skip pinned tabs (Chrome API restriction - pinned tabs can't be grouped)
        if (tab.pinned) continue;

        // Only process http(s) URLs
        if (!(tab.url.startsWith('http://') || tab.url.startsWith('https://'))) continue;

        // Find first matching rule (AC2)
        const matchingRule = findFirstMatchingRule(tab.url, enabledRules);
        
        if (matchingRule) {
          // Tab matches a rule - assign to group
          const key = `${tab.windowId}-${matchingRule.groupName}`;
          if (!tabGroupAssignments.has(key)) {
            tabGroupAssignments.set(key, []);
            groupColors.set(key, matchingRule.groupColor);
          }
          tabGroupAssignments.get(key)!.push(tab);
        } else if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
          // AC4: Tab doesn't match any rules AND is currently grouped - ungroup it
          tabsToUngroup.push(tab.id);
          groupsToUngroup.add(tab.groupId); // Track which groups are being modified
        }
        // Else: tab doesn't match and is already ungrouped - leave it
      }

      // 4. Build cache of existing groups across all windows for performance
      const groupCache = new Map<string, chrome.tabGroups.TabGroup>(); // key: "windowId-groupName"
      const allGroups = await chrome.tabGroups.query({});
      for (const group of allGroups) {
        const cacheKey = `${group.windowId}-${group.title}`;
        groupCache.set(cacheKey, group);
      }

      // 5. Ungroup tabs that don't match any rules (AC4 strict enforcement)
      const errors: string[] = [];
      let tabsFailed = 0;
      if (tabsToUngroup.length > 0) {
        try {
          await chrome.tabs.ungroup(tabsToUngroup as [number, ...number[]]);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error('[AutoGroupManager] Failed to ungroup tabs:', error);
          errors.push(this.mapErrorToUserMessage(errorMsg, 'ungrouping'));
          tabsFailed += tabsToUngroup.length; // Count failed ungroup operations
        }
      }

      // 6. Group tabs (window-aware) and track results
      let tabsOrganized = 0;
      let groupsCreated = 0;
      const groupsAffectedSet = new Set<string>(); // Track unique groups affected (AC5)
      
      // Add ungrouped groups to affected set (AC5 - groups impacted by ungrouping)
      for (const groupId of groupsToUngroup) {
        const group = allGroups.find(g => g.id === groupId);
        if (group) {
          const key = `${group.windowId}-${group.title}`;
          groupsAffectedSet.add(key);
        }
      }

      for (const [key, tabs] of tabGroupAssignments) {
        // Parse key: "windowId-groupName" (but groupName might contain hyphens)
        const firstHyphenIndex = key.indexOf('-');
        const groupName = key.substring(firstHyphenIndex + 1);
        const tabIds = tabs.map((t) => t.id!).filter((id): id is number => id !== undefined);

        // Skip if no valid tab IDs
        if (tabIds.length === 0) continue;

        try {
          // Check cache for existing group (AC3)
          const existingGroup = groupCache.get(key);

          if (existingGroup) {
            // AC5: Filter out tabs already in the correct group
            const tabsToMove = tabs.filter(t => t.groupId !== existingGroup.id);
            const tabIdsToMove = tabsToMove.map(t => t.id!).filter((id): id is number => id !== undefined);
            
            if (tabIdsToMove.length > 0) {
              // Add to existing group (AC3)
              await chrome.tabs.group({ tabIds: tabIdsToMove as [number, ...number[]], groupId: existingGroup.id });
              tabsOrganized += tabIdsToMove.length;
              groupsAffectedSet.add(key); // Track affected group
            }
          } else {
            // Create new group (AC3)
            const groupId = await chrome.tabs.group({ tabIds: tabIds as [number, ...number[]] });
            await chrome.tabGroups.update(groupId, {
              title: groupName,
              color: groupColors.get(key)!,
            });
            groupsCreated++;
            tabsOrganized += tabIds.length;
            groupsAffectedSet.add(key); // Track affected group
            
            // Update cache with newly created group
            const newGroup = await chrome.tabGroups.get(groupId);
            groupCache.set(key, newGroup);
          }
        } catch (error) {
          // AC6: Partial success - log error and continue
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`[AutoGroupManager] Failed to group tabs for ${groupName}:`, error);
          errors.push(this.mapErrorToUserMessage(errorMsg, 'grouping', groupName));
          tabsFailed += tabIds.length; // Count failed tabs
        }
      }

      return {
        tabsOrganized,
        groupsCreated,
        groupsAffected: groupsAffectedSet.size,
        tabsFailed: tabsFailed > 0 ? tabsFailed : undefined,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      // Top-level error - return zero counts with error
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[AutoGroupManager] organizeAllTabs failed:', error);
      return {
        tabsOrganized: 0,
        groupsCreated: 0,
        groupsAffected: 0,
        tabsFailed: 0,
        errors: [this.mapErrorToUserMessage(errorMsg, 'organizing')],
      };
    }
  }

  /**
   * Map Chrome API errors to user-friendly, actionable messages (AC6)
   */
  private mapErrorToUserMessage(error: string, operation: string, groupName?: string): string {
    const errorLower = error.toLowerCase();
    
    // Map common Chrome API errors to user-friendly messages
    if (errorLower.includes('no tab') || errorLower.includes('not found')) {
      return 'Some tabs were closed before they could be organized. Please try again.';
    }
    if (errorLower.includes('permission')) {
      return 'Permission denied. Please check extension permissions and try again.';
    }
    if (errorLower.includes('group') && errorLower.includes('closed')) {
      return groupName 
        ? `Group "${groupName}" was closed during organization. Please try again.`
        : 'A group was closed during organization. Please try again.';
    }
    if (errorLower.includes('pinned')) {
      return 'Some tabs are pinned and cannot be grouped. Pinned tabs were skipped.';
    }
    
    // Generic fallback for unknown errors
    const context = groupName ? `"${groupName}"` : operation;
    return `Unable to complete ${context}. Please try again or check browser console for details.`;
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
