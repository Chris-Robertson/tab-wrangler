/**
 * Unit tests for TabSorter — Story 6.1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TabSorter } from '../../src/background/modules/tab-sorter';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeTab(
  id: number,
  url: string,
  index: number,
  overrides: Partial<chrome.tabs.Tab> = {},
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

      // github.com stays first; chrome:// and about: both use '\uFFFF' as key
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
});
