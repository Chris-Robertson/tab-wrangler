/**
 * Unit tests for TabSorter — Story 6.1 + Story 6.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TabSorter } from '../../src/background/modules/tab-sorter';
import type { ActivityTracker } from '../../src/background/modules/activity-tracker';
import type { TabActivity } from '../../src/shared/types';

// ── Helpers ────────────────────────────────────────────────────────────────

type TabWithLastAccessed = chrome.tabs.Tab & { lastAccessed?: number };

function makeTab(
  id: number,
  url: string,
  index: number,
  overrides: Partial<TabWithLastAccessed> = {},
): chrome.tabs.Tab {
  return {
    id,
    url,
    index,
    title: url,
    pinned: false,
    windowId: 1,
    highlighted: false,
    active: false,
    incognito: false,
    selected: false,
    discarded: false,
    autoDiscardable: true,
    groupId: -1,
    ...overrides,
  } as chrome.tabs.Tab;
}

function makeActivityTracker(
  activities: Record<number, Partial<TabActivity>>,
): ActivityTracker {
  return {
    getAllActivity: vi.fn().mockResolvedValue(
      Object.fromEntries(
        Object.entries(activities).map(([id, act]) => [
          Number(id),
          { tabId: Number(id), url: '', lastActiveAt: 0, createdAt: 0, ...act },
        ]),
      ),
    ),
  } as unknown as ActivityTracker;
}

const oldest = 1_699_999_900_000;
const older = 1_700_000_000_000;
const newer = 1_700_000_100_000;
const newest = 1_700_000_200_000;

// ── Chrome mock ────────────────────────────────────────────────────────────

const mockTabs = {
  query: vi.fn(),
  move: vi.fn(),
};

vi.stubGlobal('chrome', { tabs: mockTabs });

// ── Tests ──────────────────────────────────────────────────────────────────

describe('TabSorter', () => {
  let sorter: TabSorter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTabs.move.mockResolvedValue({});
    sorter = new TabSorter();
  });

  describe('sortByDomain() — basic alphabetical ordering (AC2, AC3)', () => {
    it('sorts tabs alphabetically by base domain', async () => {
      const tabs = [
        makeTab(1, 'https://reddit.com/r/typescript', 0),
        makeTab(2, 'https://apple.com', 1),
        makeTab(3, 'https://github.com', 2),
      ];
      mockTabs.query.mockResolvedValue(tabs);

      const result = await sorter.sortByDomain();

      // Expected sorted order: apple.com(1), github.com(2), reddit.com(0)
      // Tab apple.com (id=2) should move to index 0
      // Tab github.com (id=3) should move to index 1
      // Tab reddit.com (id=1) should move to index 2
      expect(mockTabs.move).toHaveBeenCalledWith(2, { index: 0 });
      expect(mockTabs.move).toHaveBeenCalledWith(3, { index: 1 });
      expect(mockTabs.move).toHaveBeenCalledWith(1, { index: 2 });
      expect(result.success).toBe(true);
      expect(result.tabCount).toBe(3);
      expect(result.errors).toHaveLength(0);
    });

    it('does not call move for tabs already in sorted order', async () => {
      const tabs = [
        makeTab(1, 'https://apple.com', 0),
        makeTab(2, 'https://github.com', 1),
        makeTab(3, 'https://reddit.com', 2),
      ];
      mockTabs.query.mockResolvedValue(tabs);

      await sorter.sortByDomain();

      expect(mockTabs.move).not.toHaveBeenCalled();
    });

    it('returns { success: true, tabCount: 0, errors: [] } for empty tab list', async () => {
      mockTabs.query.mockResolvedValue([]);

      const result = await sorter.sortByDomain();

      expect(result).toEqual({ success: true, tabCount: 0, errors: [] });
      expect(mockTabs.move).not.toHaveBeenCalled();
    });
  });

  describe('subdomain grouping (AC4)', () => {
    it('groups docs.github.com with github.com before reddit.com', async () => {
      const tabs = [
        makeTab(1, 'https://reddit.com/r/programming', 0),
        makeTab(2, 'https://docs.github.com/en', 1),
        makeTab(3, 'https://github.com/explore', 2),
      ];
      mockTabs.query.mockResolvedValue(tabs);

      await sorter.sortByDomain();

      // Expected sorted order:
      //   0: docs.github.com (id=2)  — base=github.com, host=docs.github.com
      //   1: github.com      (id=3)  — base=github.com, host=github.com  (docs < github alphabetically)
      //   2: reddit.com      (id=1)
      expect(mockTabs.move).toHaveBeenCalledWith(2, { index: 0 });
      expect(mockTabs.move).toHaveBeenCalledWith(3, { index: 1 });
      expect(mockTabs.move).toHaveBeenCalledWith(1, { index: 2 });
    });

    it('within same base domain, orders subdomains alphabetically (docs.github.com before github.com)', async () => {
      // github.com tab is at index 0, but alphabetically docs.github.com sorts first
      const tabs = [
        makeTab(1, 'https://github.com/user/repo', 0),
        makeTab(2, 'https://docs.github.com/en/actions', 1),
      ];
      mockTabs.query.mockResolvedValue(tabs);

      await sorter.sortByDomain();

      // docs.github.com ('d' < 'g') should move to index 0; github.com to index 1
      expect(mockTabs.move).toHaveBeenCalledWith(2, { index: 0 });
      expect(mockTabs.move).toHaveBeenCalledWith(1, { index: 1 });
    });
  });

  describe('non-http tabs sorted to end (AC5)', () => {
    it('moves chrome:// tabs to the end', async () => {
      const tabs = [
        makeTab(1, 'chrome://newtab/', 0),
        makeTab(2, 'https://apple.com', 1),
        makeTab(3, 'https://github.com', 2),
      ];
      mockTabs.query.mockResolvedValue(tabs);

      await sorter.sortByDomain();

      // Expected: apple.com(2) idx 0, github.com(3) idx 1, chrome://newtab(1) idx 2
      expect(mockTabs.move).toHaveBeenCalledWith(2, { index: 0 });
      expect(mockTabs.move).toHaveBeenCalledWith(3, { index: 1 });
      expect(mockTabs.move).toHaveBeenCalledWith(1, { index: 2 });
    });

    it('preserves relative order among multiple non-http tabs', async () => {
      const tabs = [
        makeTab(1, 'https://github.com', 0),
        makeTab(2, 'chrome://newtab/', 1),
        makeTab(3, 'about:blank', 2),
      ];
      mockTabs.query.mockResolvedValue(tabs);

      await sorter.sortByDomain();

      // github.com stays first; chrome:// and about: both use '￿' as key
      // so their relative sort is by URL, but they still both land after github.com
      expect(mockTabs.move).not.toHaveBeenCalledWith(1, expect.anything()); // github.com already at 0
    });

    it('handles tabs with empty URL', async () => {
      const tabs = [
        makeTab(1, '', 0),
        makeTab(2, 'https://github.com', 1),
      ];
      mockTabs.query.mockResolvedValue(tabs);

      await sorter.sortByDomain();

      // github.com should move to index 0; empty URL tab to index 1
      expect(mockTabs.move).toHaveBeenCalledWith(2, { index: 0 });
    });
  });

  describe('error handling (AC7, AC8)', () => {
    it('continues sorting when one chrome.tabs.move call fails', async () => {
      const tabs = [
        makeTab(1, 'https://reddit.com', 0),
        makeTab(2, 'https://apple.com', 1),
        makeTab(3, 'https://github.com', 2),
      ];
      mockTabs.query.mockResolvedValue(tabs);

      // First move call fails (tab 2 to index 0)
      mockTabs.move
        .mockRejectedValueOnce(new Error('Tab was closed'))
        .mockResolvedValue({});

      const result = await sorter.sortByDomain();

      // Should have attempted remaining moves
      expect(mockTabs.move).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to move tab 2');
    });

    it('returns success: true and empty errors when all moves succeed', async () => {
      const tabs = [
        makeTab(1, 'https://reddit.com', 0),
        makeTab(2, 'https://apple.com', 1),
      ];
      mockTabs.query.mockResolvedValue(tabs);

      const result = await sorter.sortByDomain();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('move call optimisation', () => {
    it('skips chrome.tabs.move for a tab whose index already matches sorted position', async () => {
      // Tab 1 is already at index 0 in sorted order
      const tabs = [
        makeTab(1, 'https://apple.com', 0),
        makeTab(2, 'https://reddit.com', 1), // needs to move from 1 → no, already correct
      ];
      mockTabs.query.mockResolvedValue(tabs);

      await sorter.sortByDomain();

      // Both tabs are already in sorted order — no moves needed
      expect(mockTabs.move).not.toHaveBeenCalled();
    });
  });

  describe('sortByDomain(preserveGroups = true) — group-aware (AC1–AC3, Story 6.5)', () => {
    it('ungrouped tabs appear before grouped tabs in final window order (AC3)', async () => {
      // ungrouped: reddit.com (idx 0)
      // grouped (group 42): apple.com (idx 1), github.com (idx 2)
      const tabs = [
        makeTab(1, 'https://reddit.com', 0),
        makeTab(2, 'https://apple.com', 1, { groupId: 42 }),
        makeTab(3, 'https://github.com', 2, { groupId: 42 }),
      ];
      mockTabs.query.mockResolvedValue(tabs);

      await sorter.sortByDomain(true);

      // Sorted: ungrouped(reddit) at 0, then group 42: apple(1), github(2)
      // reddit.com already at index 0 — no move
      // apple.com already at index 1 — no move
      // github.com already at index 2 — no move
      expect(mockTabs.move).not.toHaveBeenCalled();
    });

    it('ungrouped tabs are sorted by domain and placed before all grouped tabs', async () => {
      // ungrouped: reddit (idx 0), apple (idx 1)
      // grouped (group 7): github (idx 2)
      const tabs = [
        makeTab(1, 'https://reddit.com', 0),
        makeTab(2, 'https://apple.com', 1),
        makeTab(3, 'https://github.com', 2, { groupId: 7 }),
      ];
      mockTabs.query.mockResolvedValue(tabs);

      await sorter.sortByDomain(true);

      // Expected final order: apple(2) idx 0, reddit(1) idx 1, github(3) idx 2
      // apple moves from 1 → 0; reddit moves from 0 → 1; github already at 2
      expect(mockTabs.move).toHaveBeenCalledWith(2, { index: 0 });
      expect(mockTabs.move).toHaveBeenCalledWith(1, { index: 1 });
      expect(mockTabs.move).not.toHaveBeenCalledWith(3, expect.anything());
    });

    it('sorts tabs within a group internally by domain (AC1)', async () => {
      // Two ungrouped tabs already sorted; group 10 has github before apple (wrong order)
      const tabs = [
        makeTab(1, 'https://amazon.com', 0),
        makeTab(2, 'https://github.com', 1, { groupId: 10 }),
        makeTab(3, 'https://apple.com', 2, { groupId: 10 }),
      ];
      mockTabs.query.mockResolvedValue(tabs);

      await sorter.sortByDomain(true);

      // Expected: ungrouped amazon(1) at 0; group 10 sorted: apple(3) at 1, github(2) at 2
      expect(mockTabs.move).toHaveBeenCalledWith(3, { index: 1 });
      expect(mockTabs.move).toHaveBeenCalledWith(2, { index: 2 });
    });

    it('sorts groups relative to each other by first tab domain key (AC2)', async () => {
      // Group 10: reddit.com; Group 20: apple.com
      // Group 20 should come first alphabetically
      const tabs = [
        makeTab(1, 'https://reddit.com', 0, { groupId: 10 }),
        makeTab(2, 'https://apple.com', 1, { groupId: 20 }),
      ];
      mockTabs.query.mockResolvedValue(tabs);

      await sorter.sortByDomain(true);

      // Expected: apple(2) at idx 0, reddit(1) at idx 1
      expect(mockTabs.move).toHaveBeenCalledWith(2, { index: 0 });
      expect(mockTabs.move).toHaveBeenCalledWith(1, { index: 1 });
    });

    it('move error in group-aware sort does not abort remaining moves (AC7)', async () => {
      const tabs = [
        makeTab(1, 'https://reddit.com', 0, { groupId: 10 }),
        makeTab(2, 'https://apple.com', 1, { groupId: 20 }),
        makeTab(3, 'https://github.com', 2, { groupId: 20 }),
      ];
      mockTabs.query.mockResolvedValue(tabs);

      // First move call fails
      mockTabs.move
        .mockRejectedValueOnce(new Error('Group constraint'))
        .mockResolvedValue({});

      const result = await sorter.sortByDomain(true);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      // Remaining moves still attempted
      expect(mockTabs.move.mock.calls.length).toBeGreaterThan(1);
    });

    it('preserveGroups = false (default) still performs flat sort (AC4)', async () => {
      const tabs = [
        makeTab(1, 'https://reddit.com', 0, { groupId: 10 }),
        makeTab(2, 'https://apple.com', 1, { groupId: 20 }),
      ];
      mockTabs.query.mockResolvedValue(tabs);

      // Passing false explicitly — flat sort: apple before reddit regardless of groups
      await sorter.sortByDomain(false);

      expect(mockTabs.move).toHaveBeenCalledWith(2, { index: 0 });
      expect(mockTabs.move).toHaveBeenCalledWith(1, { index: 1 });
    });
  });

  // ── sortByAge tests (Story 6.4) ───────────────────────────────────────────

  describe('sortByAge() — age oldest/newest (Story 6.4)', () => {
    it('ageOldest sorts by createdAt ascending (AC2)', async () => {
      const tabs = [
        makeTab(1, 'https://reddit.com', 0),
        makeTab(2, 'https://apple.com', 1),
        makeTab(3, 'https://github.com', 2),
      ];
      const tracker = makeActivityTracker({
        1: { createdAt: newer },   // reddit — newer, should be last
        2: { createdAt: oldest },  // apple — oldest, should be first
        3: { createdAt: older },   // github — middle
      });
      mockTabs.query.mockResolvedValue(tabs);
      const sorterWithTracker = new TabSorter(tracker);

      await sorterWithTracker.sortByAge('oldest');

      // Expected order: apple(2) idx 0, github(3) idx 1, reddit(1) idx 2
      expect(mockTabs.move).toHaveBeenCalledWith(2, { index: 0 });
      expect(mockTabs.move).toHaveBeenCalledWith(3, { index: 1 });
      expect(mockTabs.move).toHaveBeenCalledWith(1, { index: 2 });
    });

    it('ageNewest sorts by createdAt descending (AC3)', async () => {
      const tabs = [
        makeTab(1, 'https://reddit.com', 0),
        makeTab(2, 'https://apple.com', 1),
        makeTab(3, 'https://github.com', 2),
      ];
      const tracker = makeActivityTracker({
        1: { createdAt: newer },   // reddit — newest, should be first
        2: { createdAt: oldest },  // apple — oldest, should be last
        3: { createdAt: older },   // github — middle
      });
      mockTabs.query.mockResolvedValue(tabs);
      const sorterWithTracker = new TabSorter(tracker);

      await sorterWithTracker.sortByAge('newest');

      // Expected order: reddit(1) stays at 0, github(3) at 1, apple(2) at 2
      expect(mockTabs.move).not.toHaveBeenCalledWith(1, expect.anything()); // already at 0
      expect(mockTabs.move).toHaveBeenCalledWith(3, { index: 1 });
      expect(mockTabs.move).toHaveBeenCalledWith(2, { index: 2 });
    });

    it('createdAt beats lastAccessed when both are present (AC4)', async () => {
      // tab 1: createdAt=older, lastAccessed=newest → should use createdAt (older)
      // tab 2: createdAt=newer, lastAccessed=oldest → should use createdAt (newer)
      const tabs = [
        makeTab(1, 'https://reddit.com', 0, { lastAccessed: newest } as Partial<TabWithLastAccessed>),
        makeTab(2, 'https://apple.com', 1, { lastAccessed: oldest } as Partial<TabWithLastAccessed>),
      ];
      const tracker = makeActivityTracker({
        1: { createdAt: older },   // tab 1 has createdAt=older
        2: { createdAt: newer },   // tab 2 has createdAt=newer
      });
      mockTabs.query.mockResolvedValue(tabs);
      const sorterWithTracker = new TabSorter(tracker);

      await sorterWithTracker.sortByAge('oldest');

      // Using createdAt: reddit(older) first, apple(newer) second
      // reddit already at 0, apple already at 1 → no moves needed
      expect(mockTabs.move).not.toHaveBeenCalled();
    });

    it('lastAccessed is used as fallback when no createdAt in activity (AC4)', async () => {
      // tab 1: no activity, lastAccessed=newer
      // tab 2: no activity, lastAccessed=older
      const tabs = [
        makeTab(1, 'https://reddit.com', 0, { lastAccessed: newer } as Partial<TabWithLastAccessed>),
        makeTab(2, 'https://apple.com', 1, { lastAccessed: older } as Partial<TabWithLastAccessed>),
      ];
      const tracker = makeActivityTracker({}); // no activity for any tab
      mockTabs.query.mockResolvedValue(tabs);
      const sorterWithTracker = new TabSorter(tracker);

      await sorterWithTracker.sortByAge('oldest');

      // Using lastAccessed: apple(older) at 0, reddit(newer) at 1
      expect(mockTabs.move).toHaveBeenCalledWith(2, { index: 0 });
      expect(mockTabs.move).toHaveBeenCalledWith(1, { index: 1 });
    });

    it('unknown-age tabs sort after known-age tabs and preserve relative order (AC4)', async () => {
      // tab 1: known (createdAt=older)
      // tab 2: unknown (no activity, no lastAccessed) — originally idx 1
      // tab 3: unknown (no activity, no lastAccessed) — originally idx 2
      const tabs = [
        makeTab(1, 'https://reddit.com', 0),
        makeTab(2, 'https://apple.com', 1),
        makeTab(3, 'https://github.com', 2),
      ];
      const tracker = makeActivityTracker({
        1: { createdAt: older },  // only tab 1 has known age
      });
      mockTabs.query.mockResolvedValue(tabs);
      const sorterWithTracker = new TabSorter(tracker);

      await sorterWithTracker.sortByAge('oldest');

      // Expected: reddit(1) at 0, apple(2) at 1, github(3) at 2
      // All already in correct order — no moves
      expect(mockTabs.move).not.toHaveBeenCalledWith(1, expect.anything()); // already at 0
      // apple and github are unknown, preserve relative order (2 then 3)
      expect(mockTabs.move).not.toHaveBeenCalledWith(2, expect.anything()); // already at 1
      expect(mockTabs.move).not.toHaveBeenCalledWith(3, expect.anything()); // already at 2
    });

    it('unknown-age tabs sort after known-age tabs (known first)', async () => {
      // tab 1: unknown (idx 0)
      // tab 2: known, newer (idx 1)
      // After oldest sort: tab 2 (known) first, tab 1 (unknown) second
      const tabs = [
        makeTab(1, 'https://reddit.com', 0),  // unknown
        makeTab(2, 'https://apple.com', 1),   // known
      ];
      const tracker = makeActivityTracker({
        2: { createdAt: newer },
      });
      mockTabs.query.mockResolvedValue(tabs);
      const sorterWithTracker = new TabSorter(tracker);

      await sorterWithTracker.sortByAge('oldest');

      // apple (known) moves to 0, reddit (unknown) moves to 1
      expect(mockTabs.move).toHaveBeenCalledWith(2, { index: 0 });
      expect(mockTabs.move).toHaveBeenCalledWith(1, { index: 1 });
    });

    it('pinned tabs are not passed to chrome.tabs.move() (AC6)', async () => {
      const tabs = [
        makeTab(1, 'https://pinned.com', 0, { pinned: true }),
        makeTab(2, 'https://reddit.com', 1),
        makeTab(3, 'https://apple.com', 2),
      ];
      const tracker = makeActivityTracker({
        2: { createdAt: newer },
        3: { createdAt: older },
      });
      mockTabs.query.mockResolvedValue(tabs);
      const sorterWithTracker = new TabSorter(tracker);

      await sorterWithTracker.sortByAge('oldest');

      // Pinned tab (id=1) must never be moved
      expect(mockTabs.move).not.toHaveBeenCalledWith(1, expect.anything());
    });

    it('starts age-sort moves after pinned tabs (AC6)', async () => {
      const tabs = [
        makeTab(1, 'https://pinned.com', 0, { pinned: true }),
        makeTab(2, 'https://reddit.com', 1),
        makeTab(3, 'https://apple.com', 2),
      ];
      const tracker = makeActivityTracker({
        2: { createdAt: newer },
        3: { createdAt: older },
      });
      mockTabs.query.mockResolvedValue(tabs);
      const sorterWithTracker = new TabSorter(tracker);

      await sorterWithTracker.sortByAge('oldest');

      expect(mockTabs.move).toHaveBeenCalledWith(3, { index: 1 });
      expect(mockTabs.move).toHaveBeenCalledWith(2, { index: 2 });
    });

    it('falls back to tab.lastAccessed when constructed without an ActivityTracker', async () => {
      const tabs = [
        makeTab(1, 'https://reddit.com', 0, { lastAccessed: newer } as Partial<TabWithLastAccessed>),
        makeTab(2, 'https://apple.com', 1, { lastAccessed: older } as Partial<TabWithLastAccessed>),
      ];
      mockTabs.query.mockResolvedValue(tabs);

      await sorter.sortByAge('oldest');

      expect(mockTabs.move).toHaveBeenCalledWith(2, { index: 0 });
      expect(mockTabs.move).toHaveBeenCalledWith(1, { index: 1 });
    });

    it('treats createdAt zero as a known timestamp before falling back to lastAccessed (AC4)', async () => {
      const tabs = [
        makeTab(1, 'https://reddit.com', 0, { lastAccessed: newest } as Partial<TabWithLastAccessed>),
        makeTab(2, 'https://apple.com', 1),
      ];
      const tracker = makeActivityTracker({
        1: { createdAt: 0 },
        2: { createdAt: older },
      });
      mockTabs.query.mockResolvedValue(tabs);
      const sorterWithTracker = new TabSorter(tracker);

      await sorterWithTracker.sortByAge('oldest');

      expect(mockTabs.move).not.toHaveBeenCalledWith(1, expect.anything());
      expect(mockTabs.move).not.toHaveBeenCalledWith(2, expect.anything());
    });

    it('move errors are collected and do not abort remaining moves (AC9)', async () => {
      const tabs = [
        makeTab(1, 'https://reddit.com', 0),
        makeTab(2, 'https://apple.com', 1),
        makeTab(3, 'https://github.com', 2),
      ];
      const tracker = makeActivityTracker({
        1: { createdAt: newer },
        2: { createdAt: oldest },
        3: { createdAt: older },
      });
      mockTabs.query.mockResolvedValue(tabs);
      const sorterWithTracker = new TabSorter(tracker);

      mockTabs.move.mockRejectedValueOnce(new Error('Tab closed')).mockResolvedValue({});

      const result = await sorterWithTracker.sortByAge('oldest');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(mockTabs.move.mock.calls.length).toBeGreaterThan(1);
    });

    it('group-aware age sort: tabs within groups sorted by age (AC5)', async () => {
      // ungrouped: none
      // group 10: github (idx 0, newer), apple (idx 1, older)
      // After oldest: apple first, then github within the group
      const tabs = [
        makeTab(1, 'https://github.com', 0, { groupId: 10 }),
        makeTab(2, 'https://apple.com', 1, { groupId: 10 }),
      ];
      const tracker = makeActivityTracker({
        1: { createdAt: newer },
        2: { createdAt: older },
      });
      mockTabs.query.mockResolvedValue(tabs);
      const sorterWithTracker = new TabSorter(tracker);

      await sorterWithTracker.sortByAge('oldest', true);

      // apple(2) moves to 0, github(1) moves to 1
      expect(mockTabs.move).toHaveBeenCalledWith(2, { index: 0 });
      expect(mockTabs.move).toHaveBeenCalledWith(1, { index: 1 });
    });

    it('group-aware age sort: groups ordered by first tab age after internal sort (AC5)', async () => {
      // group 10: reddit (idx 0, newer)
      // group 20: apple (idx 1, older)
      // After oldest sort: group 20 (apple=older) before group 10 (reddit=newer)
      const tabs = [
        makeTab(1, 'https://reddit.com', 0, { groupId: 10 }),
        makeTab(2, 'https://apple.com', 1, { groupId: 20 }),
      ];
      const tracker = makeActivityTracker({
        1: { createdAt: newer },
        2: { createdAt: older },
      });
      mockTabs.query.mockResolvedValue(tabs);
      const sorterWithTracker = new TabSorter(tracker);

      await sorterWithTracker.sortByAge('oldest', true);

      // apple(2) to 0, reddit(1) to 1
      expect(mockTabs.move).toHaveBeenCalledWith(2, { index: 0 });
      expect(mockTabs.move).toHaveBeenCalledWith(1, { index: 1 });
    });

    it('group-aware age sort: ungrouped tabs appear before grouped tabs (AC5)', async () => {
      // ungrouped: github (idx 0, newer)
      // group 10: apple (idx 1, older)
      // preserveGroups=true: ungrouped first, then grouped
      const tabs = [
        makeTab(1, 'https://github.com', 0),             // ungrouped
        makeTab(2, 'https://apple.com', 1, { groupId: 10 }), // grouped, older
      ];
      const tracker = makeActivityTracker({
        1: { createdAt: newer },
        2: { createdAt: older },
      });
      mockTabs.query.mockResolvedValue(tabs);
      const sorterWithTracker = new TabSorter(tracker);

      await sorterWithTracker.sortByAge('oldest', true);

      // ungrouped github stays at 0, grouped apple stays at 1 — no moves
      expect(mockTabs.move).not.toHaveBeenCalled();
    });
  });
});
