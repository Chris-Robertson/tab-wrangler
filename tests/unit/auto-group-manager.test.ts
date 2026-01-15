/**
 * Unit tests for AutoGroupManager
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutoGroupManager } from '../../src/background/modules/auto-group-manager';
import type { StorageService } from '../../src/background/modules/storage-service';
import type { GroupingRule, Settings } from '../../src/shared/types';

// Mock chrome APIs
const mockChrome = {
  tabs: {
    group: vi.fn(),
    get: vi.fn(),
  },
  tabGroups: {
    query: vi.fn(),
    update: vi.fn(),
  },
};

vi.stubGlobal('chrome', mockChrome);

describe('AutoGroupManager', () => {
  let autoGroupManager: AutoGroupManager;
  let mockStorageService: Partial<StorageService>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock Chrome APIs
    mockChrome.tabs.get.mockResolvedValue({ id: 1, windowId: 1 });
    mockChrome.tabs.group = vi.fn();
    mockChrome.tabGroups.query = vi.fn();
    mockChrome.tabGroups.update = vi.fn();

    // Mock StorageService
    mockStorageService = {
      getSettings: vi.fn(),
      getGroupingRules: vi.fn(),
    };

    autoGroupManager = new AutoGroupManager(mockStorageService as StorageService);
  });

  describe('autoGroupTab', () => {
    it('should add tab to existing group when URL matches rule (AC1, AC2)', async () => {
      // Setup: Mock settings with auto-group enabled
      vi.mocked(mockStorageService.getSettings!).mockResolvedValue({
        autoGroupEnabled: true,
      } as Settings);

      // Setup: Mock existing group "GitHub"
      const existingGroup = { id: 123, title: 'GitHub', color: 'red' } as chrome.tabGroups.TabGroup;
      mockChrome.tabGroups.query.mockResolvedValue([existingGroup]);

      // Setup: Mock rule *github.com/* → "GitHub" blue
      const rules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
      ];
      vi.mocked(mockStorageService.getGroupingRules!).mockResolvedValue(rules);

      // Act: autoGroupTab with matching URL
      await autoGroupManager.autoGroupTab(1, 'https://github.com/foo/bar');

      // Assert: chrome.tabs.group called with existing groupId
      expect(mockChrome.tabs.group).toHaveBeenCalledWith({ tabIds: [1], groupId: 123 });
      expect(mockChrome.tabGroups.update).not.toHaveBeenCalled(); // Don't update existing group
    });

    it('should create new group when URL matches rule and group does not exist (AC1, AC3)', async () => {
      // Setup: Mock settings
      vi.mocked(mockStorageService.getSettings!).mockResolvedValue({
        autoGroupEnabled: true,
      } as Settings);

      // Setup: No existing groups
      mockChrome.tabGroups.query.mockResolvedValue([]);

      // Setup: Mock rule
      const rules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
      ];
      vi.mocked(mockStorageService.getGroupingRules!).mockResolvedValue(rules);

      // Mock chrome.tabs.group returns new groupId
      mockChrome.tabs.group.mockResolvedValue(456);

      // Act
      await autoGroupManager.autoGroupTab(1, 'https://github.com/foo/bar');

      // Assert: New group created
      expect(mockChrome.tabs.group).toHaveBeenCalledWith({ tabIds: [1] });
      expect(mockChrome.tabGroups.update).toHaveBeenCalledWith(456, {
        title: 'GitHub',
        color: 'blue',
      });
    });

    it('should not group tab when no rules match (AC4)', async () => {
      // Setup
      vi.mocked(mockStorageService.getSettings!).mockResolvedValue({
        autoGroupEnabled: true,
      } as Settings);

      const rules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
      ];
      vi.mocked(mockStorageService.getGroupingRules!).mockResolvedValue(rules);

      // Act: URL that doesn't match
      await autoGroupManager.autoGroupTab(1, 'https://reddit.com/r/programming');

      // Assert: chrome.tabs.group NOT called
      expect(mockChrome.tabs.group).not.toHaveBeenCalled();
      expect(mockChrome.tabGroups.query).not.toHaveBeenCalled();
    });

    it('should not group tab when autoGroupEnabled is false (AC5)', async () => {
      // Setup: Auto-group disabled
      vi.mocked(mockStorageService.getSettings!).mockResolvedValue({
        autoGroupEnabled: false,
      } as Settings);

      const rules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
      ];
      vi.mocked(mockStorageService.getGroupingRules!).mockResolvedValue(rules);

      // Act
      await autoGroupManager.autoGroupTab(1, 'https://github.com/test');

      // Assert: No grouping occurs
      expect(mockChrome.tabs.group).not.toHaveBeenCalled();
      expect(mockStorageService.getGroupingRules).not.toHaveBeenCalled(); // Short-circuit before loading rules
    });

    it('should skip disabled rules (AC6)', async () => {
      // Setup
      vi.mocked(mockStorageService.getSettings!).mockResolvedValue({
        autoGroupEnabled: true,
      } as Settings);

      // Rule 1: disabled (order: 0)
      // Rule 2: enabled (order: 1)
      const rules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*github.com/*',
          patternType: 'glob',
          groupName: 'Disabled',
          groupColor: 'red',
          enabled: false,
          order: 0,
        },
        {
          id: 'rule-2',
          pattern: '*github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 1,
        },
      ];
      vi.mocked(mockStorageService.getGroupingRules!).mockResolvedValue(rules);

      // No existing groups
      mockChrome.tabGroups.query.mockResolvedValue([]);
      mockChrome.tabs.group.mockResolvedValue(789);

      // Act
      await autoGroupManager.autoGroupTab(1, 'https://github.com/test');

      // Assert: Uses enabled rule (GitHub), not disabled rule
      expect(mockChrome.tabGroups.update).toHaveBeenCalledWith(789, {
        title: 'GitHub',
        color: 'blue',
      });
    });

    it('should use first matching rule by order (AC1)', async () => {
      // Setup
      vi.mocked(mockStorageService.getSettings!).mockResolvedValue({
        autoGroupEnabled: true,
      } as Settings);

      // Both rules match the same pattern, but different order
      const rules: GroupingRule[] = [
        {
          id: 'rule-a',
          pattern: '*github.com/*',
          patternType: 'glob',
          groupName: 'Code',
          groupColor: 'red',
          enabled: true,
          order: 0,
        },
        {
          id: 'rule-b',
          pattern: '*github.com/microsoft/*',
          patternType: 'glob',
          groupName: 'Microsoft',
          groupColor: 'blue',
          enabled: true,
          order: 1,
        },
      ];
      vi.mocked(mockStorageService.getGroupingRules!).mockResolvedValue(rules);

      mockChrome.tabGroups.query.mockResolvedValue([]);
      mockChrome.tabs.group.mockResolvedValue(999);

      // Act: URL matches both rules
      await autoGroupManager.autoGroupTab(1, 'https://github.com/microsoft/vscode');

      // Assert: First rule wins (order: 0)
      expect(mockChrome.tabGroups.update).toHaveBeenCalledWith(999, {
        title: 'Code',
        color: 'red',
      });
    });

    it('should handle invalid URLs gracefully', async () => {
      // Setup
      vi.mocked(mockStorageService.getSettings!).mockResolvedValue({
        autoGroupEnabled: true,
      } as Settings);

      // Act: Empty URL
      await autoGroupManager.autoGroupTab(1, '');

      // Assert: No error, no API calls
      expect(mockChrome.tabs.group).not.toHaveBeenCalled();

      // Act: Non-http URL
      await autoGroupManager.autoGroupTab(2, 'chrome://extensions');

      // Assert: No error, no API calls
      expect(mockChrome.tabs.group).not.toHaveBeenCalled();
    });

    it('should handle Chrome API errors gracefully', async () => {
      // Setup
      vi.mocked(mockStorageService.getSettings!).mockResolvedValue({
        autoGroupEnabled: true,
      } as Settings);

      const rules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
      ];
      vi.mocked(mockStorageService.getGroupingRules!).mockResolvedValue(rules);

      // Mock chrome.tabs.group to throw error
      mockChrome.tabGroups.query.mockResolvedValue([]);
      mockChrome.tabs.group.mockRejectedValue(new Error('Tab already closed'));

      // Act: Should not throw
      await expect(
        autoGroupManager.autoGroupTab(1, 'https://github.com/test')
      ).resolves.toBeUndefined();

      // Assert: Error logged (no crash)
      expect(mockChrome.tabs.group).toHaveBeenCalled();
    });

    it('should handle regex patterns correctly', async () => {
      // Setup
      vi.mocked(mockStorageService.getSettings!).mockResolvedValue({
        autoGroupEnabled: true,
      } as Settings);

      const rules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '^https://github\\.com/.*',
          patternType: 'regex',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
      ];
      vi.mocked(mockStorageService.getGroupingRules!).mockResolvedValue(rules);

      mockChrome.tabGroups.query.mockResolvedValue([]);
      mockChrome.tabs.group.mockResolvedValue(111);

      // Act
      await autoGroupManager.autoGroupTab(1, 'https://github.com/user/repo');

      // Assert: Regex pattern matched
      expect(mockChrome.tabs.group).toHaveBeenCalled();
      expect(mockChrome.tabGroups.update).toHaveBeenCalledWith(111, {
        title: 'GitHub',
        color: 'blue',
      });
    });

    it('should retry with existing group if tabGroups.update fails (race condition)', async () => {
      // Setup: Mock settings
      vi.mocked(mockStorageService.getSettings!).mockResolvedValue({
        autoGroupEnabled: true,
      } as Settings);

      // Setup: Mock rule
      const rules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
      ];
      vi.mocked(mockStorageService.getGroupingRules!).mockResolvedValue(rules);

      // Mock chrome.tabs.get to return windowId
      mockChrome.tabs.get.mockResolvedValue({ id: 1, windowId: 1 } as chrome.tabs.Tab);

      // Setup: First query returns no existing groups, second query returns the group created by race
      const existingGroup = { id: 999, title: 'GitHub', color: 'red' } as chrome.tabGroups.TabGroup;
      mockChrome.tabGroups.query
        .mockResolvedValueOnce([]) // First query: no existing group
        .mockResolvedValueOnce([existingGroup]); // Second query: group now exists (race condition)

      // Mock chrome.tabs.group returns new groupId first time
      mockChrome.tabs.group
        .mockResolvedValueOnce(789) // Create group call
        .mockResolvedValueOnce(999); // Retry: add to existing group
      
      // Mock tabGroups.update to fail (simulating race condition)
      mockChrome.tabGroups.update.mockRejectedValueOnce(new Error('Group not found'));

      // Act
      await autoGroupManager.autoGroupTab(1, 'https://github.com/foo/bar', 1);

      // Assert: Should have tried to create group, failed, then retried with existing group
      expect(mockChrome.tabs.group).toHaveBeenCalledTimes(2);
      expect(mockChrome.tabs.group).toHaveBeenNthCalledWith(1, { tabIds: [1] });
      expect(mockChrome.tabGroups.update).toHaveBeenCalledTimes(1);
      expect(mockChrome.tabGroups.query).toHaveBeenCalledTimes(2);
      expect(mockChrome.tabs.group).toHaveBeenNthCalledWith(2, { tabIds: [1], groupId: 999 });
    });

    it('should pass windowId to tabGroups.query for window isolation', async () => {
      // Setup: Mock settings
      vi.mocked(mockStorageService.getSettings!).mockResolvedValue({
        autoGroupEnabled: true,
      } as Settings);

      // Setup: Mock existing group in window 2
      const existingGroup = { id: 456, title: 'GitHub', color: 'blue', windowId: 2 } as chrome.tabGroups.TabGroup;
      mockChrome.tabGroups.query.mockResolvedValue([existingGroup]);

      // Setup: Mock rule
      const rules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
      ];
      vi.mocked(mockStorageService.getGroupingRules!).mockResolvedValue(rules);

      // Mock chrome.tabs.get to return tab in window 2
      mockChrome.tabs.get.mockResolvedValue({ id: 1, windowId: 2 } as chrome.tabs.Tab);

      // Act: Call without explicit windowId to test fallback
      await autoGroupManager.autoGroupTab(1, 'https://github.com/foo/bar');

      // Assert: Should query with windowId: 2
      expect(mockChrome.tabGroups.query).toHaveBeenCalledWith({ title: 'GitHub', windowId: 2 });
      expect(mockChrome.tabs.group).toHaveBeenCalledWith({ tabIds: [1], groupId: 456 });
    });

    it('should use provided windowId instead of querying tab', async () => {
      // Setup: Mock settings
      vi.mocked(mockStorageService.getSettings!).mockResolvedValue({
        autoGroupEnabled: true,
      } as Settings);

      // Setup: Mock existing group in window 3
      const existingGroup = { id: 789, title: 'GitHub', color: 'blue', windowId: 3 } as chrome.tabGroups.TabGroup;
      mockChrome.tabGroups.query.mockResolvedValue([existingGroup]);

      // Setup: Mock rule
      const rules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
      ];
      vi.mocked(mockStorageService.getGroupingRules!).mockResolvedValue(rules);

      // Act: Call WITH explicit windowId
      await autoGroupManager.autoGroupTab(1, 'https://github.com/foo/bar', 3);

      // Assert: Should NOT call tabs.get (windowId was provided)
      expect(mockChrome.tabs.get).not.toHaveBeenCalled();
      expect(mockChrome.tabGroups.query).toHaveBeenCalledWith({ title: 'GitHub', windowId: 3 });
      expect(mockChrome.tabs.group).toHaveBeenCalledWith({ tabIds: [1], groupId: 789 });
    });
  });
});
