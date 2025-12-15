/**
 * Unit tests for DuplicateDetector module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DuplicateDetector } from '../../src/background/modules/duplicate-detector';
import type { ClosedTabEntry } from '../../src/shared/types/storage';

// Mock uuid module
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-' + Math.random().toString(36).substring(7),
}));

// Mock chrome.tabs API
const mockTabs: chrome.tabs.Tab[] = [];
const mockRecentlyClosed: ClosedTabEntry[] = [];

const mockStorageService = {
  getLocalStorage: vi.fn().mockImplementation(() => Promise.resolve({ recentlyClosed: mockRecentlyClosed })),
  updateLocalStorage: vi.fn().mockImplementation(() => Promise.resolve()),
};

vi.stubGlobal('chrome', {
  tabs: {
    query: vi.fn().mockImplementation(() => Promise.resolve(mockTabs)),
    remove: vi.fn().mockImplementation(() => Promise.resolve()),
  },
});

function createMockTab(overrides: Partial<chrome.tabs.Tab>): chrome.tabs.Tab {
  return {
    id: 1,
    index: 0,
    pinned: false,
    highlighted: false,
    windowId: 1,
    active: false,
    incognito: false,
    selected: false,
    discarded: false,
    autoDiscardable: true,
    groupId: -1,
    url: 'https://example.com',
    title: 'Example',
    ...overrides,
  };
}

describe('DuplicateDetector', () => {
  let detector: DuplicateDetector;

  beforeEach(() => {
    detector = new DuplicateDetector(mockStorageService as any);
    mockTabs.length = 0; // Clear array
    mockRecentlyClosed.length = 0; // Clear array
    vi.clearAllMocks();
  });

  describe('findDuplicates', () => {
    it('should detect tabs with same exact URL as duplicates', async () => {
      mockTabs.push(
        createMockTab({ id: 1, url: 'https://example.com/page' }),
        createMockTab({ id: 2, url: 'https://example.com/page' }),
      );

      const duplicates = await detector.findDuplicates('exact');

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].tabs).toHaveLength(2);
      expect(duplicates[0].normalizedUrl).toBe('https://example.com/page');
    });

    it('should detect tabs with different query params as duplicates when mode is ignoreParams', async () => {
      mockTabs.push(
        createMockTab({ id: 1, url: 'https://example.com/page?ref=123' }),
        createMockTab({ id: 2, url: 'https://example.com/page' }),
      );

      const duplicates = await detector.findDuplicates('ignoreParams');

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].tabs).toHaveLength(2);
    });

    it('should detect tabs with different anchors as duplicates when mode is ignoreAnchors', async () => {
      mockTabs.push(
        createMockTab({ id: 1, url: 'https://example.com/page#section1' }),
        createMockTab({ id: 2, url: 'https://example.com/page#section2' }),
      );

      const duplicates = await detector.findDuplicates('ignoreAnchors');

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].tabs).toHaveLength(2);
    });

    it('should not flag single tabs as duplicates', async () => {
      mockTabs.push(
        createMockTab({ id: 1, url: 'https://example.com/page1' }),
        createMockTab({ id: 2, url: 'https://example.com/page2' }),
        createMockTab({ id: 3, url: 'https://other.com' }),
      );

      const duplicates = await detector.findDuplicates('exact');

      expect(duplicates).toHaveLength(0);
    });

    it('should skip chrome internal URLs', async () => {
      mockTabs.push(
        createMockTab({ id: 1, url: 'chrome://extensions' }),
        createMockTab({ id: 2, url: 'chrome://extensions' }),
      );

      const duplicates = await detector.findDuplicates('exact');

      expect(duplicates).toHaveLength(0);
    });

    it('should skip brave internal URLs', async () => {
      mockTabs.push(
        createMockTab({ id: 1, url: 'brave://settings' }),
        createMockTab({ id: 2, url: 'brave://settings' }),
      );

      const duplicates = await detector.findDuplicates('exact');

      expect(duplicates).toHaveLength(0);
    });

    it('should skip tabs without URLs', async () => {
      mockTabs.push(
        createMockTab({ id: 1, url: undefined }),
        createMockTab({ id: 2, url: undefined }),
      );

      const duplicates = await detector.findDuplicates('exact');

      expect(duplicates).toHaveLength(0);
    });

    it('should include tab metadata in results', async () => {
      mockTabs.push(
        createMockTab({ id: 1, url: 'https://example.com', title: 'Example 1', windowId: 1 }),
        createMockTab({ id: 2, url: 'https://example.com', title: 'Example 2', windowId: 2 }),
      );

      const duplicates = await detector.findDuplicates('exact');

      expect(duplicates[0].tabs[0]).toMatchObject({
        id: 1,
        url: 'https://example.com',
        title: 'Example 1',
        windowId: 1,
      });
      expect(duplicates[0].tabs[1]).toMatchObject({
        id: 2,
        url: 'https://example.com',
        title: 'Example 2',
        windowId: 2,
      });
    });

    it('should handle multiple duplicate groups', async () => {
      mockTabs.push(
        createMockTab({ id: 1, url: 'https://example.com' }),
        createMockTab({ id: 2, url: 'https://example.com' }),
        createMockTab({ id: 3, url: 'https://other.com' }),
        createMockTab({ id: 4, url: 'https://other.com' }),
      );

      const duplicates = await detector.findDuplicates('exact');

      expect(duplicates).toHaveLength(2);
    });
  });

  describe('getDuplicateCount', () => {
    it('should return count of tabs that would be removed', async () => {
      // 2 tabs of same URL = 1 would be removed
      mockTabs.push(
        createMockTab({ id: 1, url: 'https://example.com' }),
        createMockTab({ id: 2, url: 'https://example.com' }),
      );

      const count = await detector.getDuplicateCount('exact');

      expect(count).toBe(1);
    });

    it('should return 0 when no duplicates exist', async () => {
      mockTabs.push(
        createMockTab({ id: 1, url: 'https://example.com/page1' }),
        createMockTab({ id: 2, url: 'https://example.com/page2' }),
      );

      const count = await detector.getDuplicateCount('exact');

      expect(count).toBe(0);
    });

    it('should count correctly with multiple duplicate groups', async () => {
      // Group 1: 3 tabs (2 would be removed)
      // Group 2: 2 tabs (1 would be removed)
      // Total: 3 would be removed
      mockTabs.push(
        createMockTab({ id: 1, url: 'https://example.com' }),
        createMockTab({ id: 2, url: 'https://example.com' }),
        createMockTab({ id: 3, url: 'https://example.com' }),
        createMockTab({ id: 4, url: 'https://other.com' }),
        createMockTab({ id: 5, url: 'https://other.com' }),
      );

      const count = await detector.getDuplicateCount('exact');

      expect(count).toBe(3);
    });
  });

  describe('removeDuplicates', () => {
    it('should keep oldest tab when keepStrategy is oldest', async () => {
      mockTabs.push(
        createMockTab({ id: 1, url: 'https://example.com', title: 'First' }),
        createMockTab({ id: 2, url: 'https://example.com', title: 'Second' }),
        createMockTab({ id: 3, url: 'https://example.com', title: 'Third' }),
      );

      const result = await detector.removeDuplicates('exact', 'oldest');

      expect(result.kept).toHaveLength(1);
      expect(result.kept[0].id).toBe(1); // Oldest (lowest ID) kept
      expect(result.removed).toHaveLength(2);
      expect(chrome.tabs.remove).toHaveBeenCalledWith([2, 3]);
    });

    it('should keep newest tab when keepStrategy is newest', async () => {
      mockTabs.push(
        createMockTab({ id: 1, url: 'https://example.com', title: 'First' }),
        createMockTab({ id: 2, url: 'https://example.com', title: 'Second' }),
        createMockTab({ id: 3, url: 'https://example.com', title: 'Third' }),
      );

      const result = await detector.removeDuplicates('exact', 'newest');

      expect(result.kept).toHaveLength(1);
      expect(result.kept[0].id).toBe(3); // Newest (highest ID) kept
      expect(result.removed).toHaveLength(2);
      expect(chrome.tabs.remove).toHaveBeenCalledWith([1, 2]);
    });

    it('should keep active tab even if not oldest/newest', async () => {
      mockTabs.push(
        createMockTab({ id: 1, url: 'https://example.com', active: false }),
        createMockTab({ id: 2, url: 'https://example.com', active: true }), // Active tab
        createMockTab({ id: 3, url: 'https://example.com', active: false }),
      );

      const result = await detector.removeDuplicates('exact', 'oldest');

      expect(result.kept).toHaveLength(1);
      expect(result.kept[0].id).toBe(2); // Active tab kept
      expect(result.removed).toHaveLength(2);
    });

    it('should store closed tabs in recentlyClosed', async () => {
      mockTabs.push(
        createMockTab({ id: 1, url: 'https://example.com', title: 'Tab 1', favIconUrl: 'https://example.com/favicon.ico' }),
        createMockTab({ id: 2, url: 'https://example.com', title: 'Tab 2' }),
      );

      await detector.removeDuplicates('exact', 'oldest');

      expect(mockStorageService.updateLocalStorage).toHaveBeenCalled();
      const updateCall = mockStorageService.updateLocalStorage.mock.calls[0][0];
      expect(updateCall.recentlyClosed).toHaveLength(1);
      expect(updateCall.recentlyClosed[0]).toMatchObject({
        url: 'https://example.com',
        title: 'Tab 2',
        closedBy: 'duplicate',
      });
    });

    it('should not call chrome.tabs.remove when no duplicates exist', async () => {
      mockTabs.push(
        createMockTab({ id: 1, url: 'https://example.com/page1' }),
        createMockTab({ id: 2, url: 'https://example.com/page2' }),
      );

      const result = await detector.removeDuplicates('exact', 'oldest');

      expect(result.removed).toHaveLength(0);
      expect(result.kept).toHaveLength(0);
      expect(chrome.tabs.remove).not.toHaveBeenCalled();
    });
  });
});

