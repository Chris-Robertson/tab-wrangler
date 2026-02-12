/**
 * Unit tests for AutoGroupManager.organizeAllTabs()
 * Story 2-3: Bulk Organize Existing Tabs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutoGroupManager } from '../../src/background/modules/auto-group-manager';
import type { StorageService } from '../../src/background/modules/storage-service';
import type { GroupingRule } from '../../src/shared/types';

// Mock chrome APIs
const mockChrome = {
  tabs: {
    group: vi.fn(),
    query: vi.fn(),
    ungroup: vi.fn(),
  },
  tabGroups: {
    query: vi.fn(),
    update: vi.fn(),
    get: vi.fn(),
    TAB_GROUP_ID_NONE: -1,
  },
};

vi.stubGlobal('chrome', mockChrome);

describe('AutoGroupManager.organizeAllTabs', () => {
  let autoGroupManager: AutoGroupManager;
  let mockStorageService: Partial<StorageService>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock Chrome APIs
    mockChrome.tabs.query = vi.fn();
    mockChrome.tabs.group = vi.fn();
    mockChrome.tabs.ungroup = vi.fn();
    mockChrome.tabGroups.query = vi.fn();
    mockChrome.tabGroups.update = vi.fn();
    mockChrome.tabGroups.get = vi.fn();

    // Mock StorageService
    mockStorageService = {
      getGroupingRules: vi.fn(),
    };

    autoGroupManager = new AutoGroupManager(mockStorageService as StorageService);
  });

  it('should organize all matching tabs across all windows (AC2, AC3)', async () => {
    // Setup: 3 GitHub tabs in window 1, 2 GitHub tabs in window 2
    const tabs = [
      { id: 1, url: 'https://github.com/foo', windowId: 1 },
      { id: 2, url: 'https://github.com/bar', windowId: 1 },
      { id: 3, url: 'https://github.com/baz', windowId: 1 },
      { id: 4, url: 'https://github.com/qux', windowId: 2 },
      { id: 5, url: 'https://github.com/quux', windowId: 2 },
    ];
    mockChrome.tabs.query.mockResolvedValue(tabs);

    // Setup: No existing groups (for cache)
    mockChrome.tabGroups.query.mockResolvedValue([]);

    // Setup: Return new groupId when grouping
    mockChrome.tabs.group.mockResolvedValueOnce(100).mockResolvedValueOnce(200);

    // Setup: Mock get to return the newly created groups for cache update
    mockChrome.tabGroups.get
      .mockResolvedValueOnce({ id: 100, title: 'GitHub', windowId: 1, color: 'blue', collapsed: false })
      .mockResolvedValueOnce({ id: 200, title: 'GitHub', windowId: 2, color: 'blue', collapsed: false });

    // Setup: Rule *.github.com/* → "GitHub" blue
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
    const result = await autoGroupManager.organizeAllTabs();

    // Assert: All 5 tabs organized into 2 groups (one per window)
    expect(result.tabsOrganized).toBe(5);
    expect(result.groupsCreated).toBe(2);
    expect(result.errors).toBeUndefined();

    // Assert: chrome.tabs.group called twice (once per window)
    expect(mockChrome.tabs.group).toHaveBeenCalledTimes(2);
    expect(mockChrome.tabs.group).toHaveBeenCalledWith({ tabIds: [1, 2, 3] }); // Window 1
    expect(mockChrome.tabs.group).toHaveBeenCalledWith({ tabIds: [4, 5] }); // Window 2

    // Assert: chrome.tabGroups.update called twice with correct name/color
    expect(mockChrome.tabGroups.update).toHaveBeenCalledTimes(2);
    expect(mockChrome.tabGroups.update).toHaveBeenCalledWith(100, { title: 'GitHub', color: 'blue' });
    expect(mockChrome.tabGroups.update).toHaveBeenCalledWith(200, { title: 'GitHub', color: 'blue' });
  });

  it('should add to existing groups when available (AC3)', async () => {
    // Setup: 3 GitHub tabs in window 1
    const tabs = [
      { id: 1, url: 'https://github.com/foo', windowId: 1 },
      { id: 2, url: 'https://github.com/bar', windowId: 1 },
      { id: 3, url: 'https://github.com/baz', windowId: 1 },
    ];
    mockChrome.tabs.query.mockResolvedValue(tabs);

    // Setup: Existing group "GitHub" in window 1
    const existingGroup = { id: 123, title: 'GitHub', color: 'red', windowId: 1 } as chrome.tabGroups.TabGroup;
    mockChrome.tabGroups.query.mockResolvedValue([existingGroup]);

    // Setup: Rule
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
    const result = await autoGroupManager.organizeAllTabs();

    // Assert: All 3 tabs organized, no new groups created
    expect(result.tabsOrganized).toBe(3);
    expect(result.groupsCreated).toBe(0);

    // Assert: chrome.tabs.group called with existing groupId
    expect(mockChrome.tabs.group).toHaveBeenCalledWith({ tabIds: [1, 2, 3], groupId: 123 });

    // Assert: chrome.tabGroups.update NOT called (existing group not updated)
    expect(mockChrome.tabGroups.update).not.toHaveBeenCalled();
  });

  it('should create new groups when needed (AC3)', async () => {
    // Setup: 3 GitHub tabs
    const tabs = [
      { id: 1, url: 'https://github.com/foo', windowId: 1 },
      { id: 2, url: 'https://github.com/bar', windowId: 1 },
      { id: 3, url: 'https://github.com/baz', windowId: 1 },
    ];
    mockChrome.tabs.query.mockResolvedValue(tabs);

    // Setup: No existing groups
    mockChrome.tabGroups.query.mockResolvedValue([]);
    mockChrome.tabs.group.mockResolvedValue(100);
    mockChrome.tabGroups.get.mockResolvedValue({ id: 100, title: 'GitHub', windowId: 1, color: 'blue', collapsed: false });

    // Setup: Rule
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
    const result = await autoGroupManager.organizeAllTabs();

    // Assert: 1 new group created
    expect(result.groupsCreated).toBe(1);
    expect(mockChrome.tabGroups.update).toHaveBeenCalledWith(100, { title: 'GitHub', color: 'blue' });
  });

  it('should be window-aware (separate groups per window) (AC3)', async () => {
    // Setup: 2 GitHub tabs in window 1, 2 GitHub tabs in window 2
    const tabs = [
      { id: 1, url: 'https://github.com/foo', windowId: 1 },
      { id: 2, url: 'https://github.com/bar', windowId: 1 },
      { id: 3, url: 'https://github.com/baz', windowId: 2 },
      { id: 4, url: 'https://github.com/qux', windowId: 2 },
    ];
    mockChrome.tabs.query.mockResolvedValue(tabs);

    // Setup: No existing groups (for cache)
    mockChrome.tabGroups.query.mockResolvedValue([]);
    mockChrome.tabs.group.mockResolvedValueOnce(100).mockResolvedValueOnce(200);
    mockChrome.tabGroups.get
      .mockResolvedValueOnce({ id: 100, title: 'GitHub', windowId: 1, color: 'blue', collapsed: false })
      .mockResolvedValueOnce({ id: 200, title: 'GitHub', windowId: 2, color: 'blue', collapsed: false });

    // Setup: Rule
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
    const result = await autoGroupManager.organizeAllTabs();

    // Assert: 2 separate groups created (one per window)
    expect(result.groupsCreated).toBe(2);

    // Assert: chrome.tabGroups.query called once for initial cache (no params)
    expect(mockChrome.tabGroups.query).toHaveBeenCalledWith({});
  });

  it('should leave non-matching ungrouped tabs untouched (AC4)', async () => {
    // Setup: 3 GitHub tabs (match), 2 ungrouped Reddit tabs (no match)
    const tabs = [
      { id: 1, url: 'https://github.com/foo', windowId: 1, groupId: -1 },
      { id: 2, url: 'https://github.com/bar', windowId: 1, groupId: -1 },
      { id: 3, url: 'https://github.com/baz', windowId: 1, groupId: -1 },
      { id: 4, url: 'https://reddit.com/r/foo', windowId: 1, groupId: -1 },
      { id: 5, url: 'https://reddit.com/r/bar', windowId: 1, groupId: -1 },
    ];
    mockChrome.tabs.query.mockResolvedValue(tabs);

    // Setup: No existing groups
    mockChrome.tabGroups.query.mockResolvedValue([]);
    mockChrome.tabs.group.mockResolvedValue(100);
    mockChrome.tabGroups.get.mockResolvedValue({ id: 100, title: 'GitHub', windowId: 1, color: 'blue', collapsed: false });

    // Setup: Rule (only GitHub)
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
    const result = await autoGroupManager.organizeAllTabs();

    // Assert: Only 3 GitHub tabs organized
    expect(result.tabsOrganized).toBe(3);

    // Assert: chrome.tabs.group called only for GitHub tabs
    expect(mockChrome.tabs.group).toHaveBeenCalledWith({ tabIds: [1, 2, 3] });
    
    // Assert: chrome.tabs.ungroup NOT called (Reddit tabs already ungrouped)
    expect(mockChrome.tabs.ungroup).not.toHaveBeenCalled();
  });

  it('should ungroup non-matching grouped tabs (AC4 strict enforcement)', async () => {
    // Setup: 3 GitHub tabs (match), 2 Reddit tabs in group 200 (no match)
    const tabs = [
      { id: 1, url: 'https://github.com/foo', windowId: 1, groupId: -1 },
      { id: 2, url: 'https://github.com/bar', windowId: 1, groupId: -1 },
      { id: 3, url: 'https://github.com/baz', windowId: 1, groupId: -1 },
      { id: 4, url: 'https://reddit.com/r/foo', windowId: 1, groupId: 200 },
      { id: 5, url: 'https://reddit.com/r/bar', windowId: 1, groupId: 200 },
    ];
    mockChrome.tabs.query.mockResolvedValue(tabs);

    // Setup: Existing "Reddit" group
    mockChrome.tabGroups.query.mockResolvedValue([
      { id: 200, title: 'Reddit', windowId: 1, color: 'red', collapsed: false },
    ]);
    mockChrome.tabs.group.mockResolvedValue(100);
    mockChrome.tabGroups.get.mockResolvedValue({ id: 100, title: 'GitHub', windowId: 1, color: 'blue', collapsed: false });

    // Setup: Rule (only GitHub - Reddit doesn't match)
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
    const result = await autoGroupManager.organizeAllTabs();

    // Assert: Only 3 GitHub tabs organized
    expect(result.tabsOrganized).toBe(3);

    // Assert: GitHub tabs grouped
    expect(mockChrome.tabs.group).toHaveBeenCalledWith({ tabIds: [1, 2, 3] });

    // Assert: Reddit tabs ungrouped (strict enforcement)
    expect(mockChrome.tabs.ungroup).toHaveBeenCalledWith([4, 5]);
  });

  it('should skip pinned tabs and leave them pinned (AC7)', async () => {
    // Setup: 2 pinned GitHub tabs, 2 unpinned GitHub tabs
    const tabs = [
      { id: 1, url: 'https://github.com/foo', windowId: 1, pinned: true, groupId: -1 },
      { id: 2, url: 'https://github.com/bar', windowId: 1, pinned: true, groupId: -1 },
      { id: 3, url: 'https://github.com/baz', windowId: 1, pinned: false, groupId: -1 },
      { id: 4, url: 'https://github.com/qux', windowId: 1, pinned: false, groupId: -1 },
    ];
    mockChrome.tabs.query.mockResolvedValue(tabs);

    // Setup: No existing groups
    mockChrome.tabGroups.query.mockResolvedValue([]);
    mockChrome.tabs.group.mockResolvedValue(100);
    mockChrome.tabGroups.get.mockResolvedValue({ id: 100, title: 'GitHub', windowId: 1, color: 'blue', collapsed: false });

    // Setup: Rule (GitHub)
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
    const result = await autoGroupManager.organizeAllTabs();

    // Assert: Only unpinned tabs organized (pinned tabs excluded)
    expect(result.tabsOrganized).toBe(2);

    // Assert: chrome.tabs.group called only for unpinned tabs
    expect(mockChrome.tabs.group).toHaveBeenCalledWith({ tabIds: [3, 4] });

    // Assert: Pinned tabs not included in grouping
    const groupCall = mockChrome.tabs.group.mock.calls[0][0];
    expect(groupCall.tabIds).not.toContain(1);
    expect(groupCall.tabIds).not.toContain(2);
  });

  it('should handle errors gracefully and continue (AC6)', async () => {
    // Setup: 4 tabs - 2 GitHub, 2 Stack Overflow
    const tabs = [
      { id: 1, url: 'https://github.com/foo', windowId: 1 },
      { id: 2, url: 'https://github.com/bar', windowId: 1 },
      { id: 3, url: 'https://stackoverflow.com/q/123', windowId: 1 },
      { id: 4, url: 'https://stackoverflow.com/q/456', windowId: 1 },
    ];
    mockChrome.tabs.query.mockResolvedValue(tabs);

    // Setup: No existing groups
    mockChrome.tabGroups.query.mockResolvedValue([]);

    // Setup: First chrome.tabs.group succeeds, second fails
    mockChrome.tabs.group
      .mockResolvedValueOnce(100) // GitHub group succeeds
      .mockRejectedValueOnce(new Error('Chrome API error')); // SO group fails
    mockChrome.tabGroups.get.mockResolvedValue({ id: 100, title: 'GitHub', windowId: 1, color: 'blue', collapsed: false });

    // Setup: Rules for both
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
      {
        id: 'rule-2',
        pattern: '*stackoverflow.com/*',
        patternType: 'glob',
        groupName: 'Stack Overflow',
        groupColor: 'orange',
        enabled: true,
        order: 1,
      },
    ];
    vi.mocked(mockStorageService.getGroupingRules!).mockResolvedValue(rules);

    // Act
    const result = await autoGroupManager.organizeAllTabs();

    // Assert: Partial success - GitHub group succeeded
    expect(result.tabsOrganized).toBe(2);
    expect(result.groupsCreated).toBe(1);

    // Assert: Errors array contains failure message
    expect(result.errors).toBeDefined();
    expect(result.errors).toHaveLength(1);
    expect(result.errors![0]).toContain('Stack Overflow');
  });

  it('should return zero counts when no rules enabled (AC2)', async () => {
    // Setup: Tabs available
    const tabs = [
      { id: 1, url: 'https://github.com/foo', windowId: 1 },
    ];
    mockChrome.tabs.query.mockResolvedValue(tabs);

    // Setup: All rules disabled
    const rules: GroupingRule[] = [
      {
        id: 'rule-1',
        pattern: '*github.com/*',
        patternType: 'glob',
        groupName: 'GitHub',
        groupColor: 'blue',
        enabled: false, // Disabled!
        order: 0,
      },
    ];
    vi.mocked(mockStorageService.getGroupingRules!).mockResolvedValue(rules);

    // Act
    const result = await autoGroupManager.organizeAllTabs();

    // Assert: No tabs organized
    expect(result.tabsOrganized).toBe(0);
    expect(result.groupsCreated).toBe(0);

    // Assert: chrome.tabs.group NOT called
    expect(mockChrome.tabs.group).not.toHaveBeenCalled();
  });

  it('should respect rule order (first match wins) (AC2)', async () => {
    // Setup: One GitHub tab that matches both rules
    const tabs = [
      { id: 1, url: 'https://github.com/', windowId: 1 },
    ];
    mockChrome.tabs.query.mockResolvedValue(tabs);

    // Setup: No existing groups
    mockChrome.tabGroups.query.mockResolvedValue([]);
    mockChrome.tabs.group.mockResolvedValue(100);
    mockChrome.tabGroups.get.mockResolvedValue({ id: 100, title: 'Commercial', windowId: 1, color: 'grey', collapsed: false });

    // Setup: Rule A (order: 0) *.com/* → "Commercial"
    //        Rule B (order: 1) *github.com/* → "GitHub"
    const rules: GroupingRule[] = [
      {
        id: 'rule-1',
        pattern: '*.com/*',
        patternType: 'glob',
        groupName: 'Commercial',
        groupColor: 'grey',
        enabled: true,
        order: 0, // Lower order = higher priority
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

    // Act
    const result = await autoGroupManager.organizeAllTabs();

    // Assert: Tab grouped as "Commercial" (Rule A wins due to lower order)
    expect(result.tabsOrganized).toBe(1);
    expect(mockChrome.tabGroups.update).toHaveBeenCalledWith(100, { title: 'Commercial', color: 'grey' });
  });

  it('should track tabsFailed when grouping operations fail (AC5, AC6)', async () => {
    // Setup: 6 tabs - 3 GitHub, 3 Reddit
    const tabs = [
      { id: 1, url: 'https://github.com/foo', windowId: 1 },
      { id: 2, url: 'https://github.com/bar', windowId: 1 },
      { id: 3, url: 'https://github.com/baz', windowId: 1 },
      { id: 4, url: 'https://reddit.com/r/foo', windowId: 1 },
      { id: 5, url: 'https://reddit.com/r/bar', windowId: 1 },
      { id: 6, url: 'https://reddit.com/r/baz', windowId: 1 },
    ];
    mockChrome.tabs.query.mockResolvedValue(tabs);

    // Setup: No existing groups
    mockChrome.tabGroups.query.mockResolvedValue([]);

    // Setup: First group succeeds, second fails
    mockChrome.tabs.group.mockResolvedValueOnce(100).mockRejectedValueOnce(new Error('Permission denied'));
    mockChrome.tabGroups.get.mockResolvedValue({ id: 100, title: 'GitHub', windowId: 1, color: 'blue', collapsed: false });

    // Setup: Two rules
    const rules: GroupingRule[] = [
      { id: 'rule-1', pattern: '*github.com/*', patternType: 'glob', groupName: 'GitHub', groupColor: 'blue', enabled: true, order: 0 },
      { id: 'rule-2', pattern: '*reddit.com/*', patternType: 'glob', groupName: 'Reddit', groupColor: 'orange', enabled: true, order: 1 },
    ];
    vi.mocked(mockStorageService.getGroupingRules!).mockResolvedValue(rules);

    // Act
    const result = await autoGroupManager.organizeAllTabs();

    // Assert: 3 tabs succeeded, 3 failed
    expect(result.tabsOrganized).toBe(3);
    expect(result.tabsFailed).toBe(3);
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBe(1);
    expect(result.groupsCreated).toBe(1);
  });

  it('should include ungrouped groups in groupsAffected count (AC5)', async () => {
    // Setup: 3 tabs in existing "OldGroup", none match current rules
    const tabs = [
      { id: 1, url: 'https://example.com', windowId: 1, groupId: 50 },
      { id: 2, url: 'https://test.com', windowId: 1, groupId: 50 },
      { id: 3, url: 'https://sample.com', windowId: 1, groupId: 50 },
    ];
    mockChrome.tabs.query.mockResolvedValue(tabs);

    // Setup: Existing group that will have tabs ungrouped from it
    const existingGroups = [
      { id: 50, title: 'OldGroup', windowId: 1, color: 'grey', collapsed: false },
    ];
    mockChrome.tabGroups.query.mockResolvedValue(existingGroups);

    // Setup: No rules match these tabs, so they'll be ungrouped
    const rules: GroupingRule[] = [
      { id: 'rule-1', pattern: '*github.com/*', patternType: 'glob', groupName: 'GitHub', groupColor: 'blue', enabled: true, order: 0 },
    ];
    vi.mocked(mockStorageService.getGroupingRules!).mockResolvedValue(rules);

    // Act
    const result = await autoGroupManager.organizeAllTabs();

    // Assert: No tabs organized (they were ungrouped), but one group was affected
    expect(result.tabsOrganized).toBe(0);
    expect(result.groupsAffected).toBe(1); // OldGroup was affected by ungrouping
    expect(mockChrome.tabs.ungroup).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('should track tabsFailed when ungroup operation fails (AC5, AC6)', async () => {
    // Setup: 2 tabs in group that don't match rules
    const tabs = [
      { id: 1, url: 'https://example.com', windowId: 1, groupId: 50 },
      { id: 2, url: 'https://test.com', windowId: 1, groupId: 50 },
    ];
    mockChrome.tabs.query.mockResolvedValue(tabs);

    // Setup: Existing group
    mockChrome.tabGroups.query.mockResolvedValue([
      { id: 50, title: 'OldGroup', windowId: 1, color: 'grey', collapsed: false },
    ]);

    // Setup: Ungroup operation fails
    mockChrome.tabs.ungroup.mockRejectedValue(new Error('Tab not found'));

    // Setup: No matching rules
    const rules: GroupingRule[] = [
      { id: 'rule-1', pattern: '*github.com/*', patternType: 'glob', groupName: 'GitHub', groupColor: 'blue', enabled: true, order: 0 },
    ];
    vi.mocked(mockStorageService.getGroupingRules!).mockResolvedValue(rules);

    // Act
    const result = await autoGroupManager.organizeAllTabs();

    // Assert: Ungroup failed, tabsFailed should be 2
    expect(result.tabsOrganized).toBe(0);
    expect(result.tabsFailed).toBe(2);
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBeGreaterThan(0);
  });
});
