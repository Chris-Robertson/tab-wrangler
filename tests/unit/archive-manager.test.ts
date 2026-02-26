/**
 * Unit tests for ArchiveManager
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArchiveManager } from '../../src/background/modules/archive-manager';
import type { StorageService } from '../../src/background/modules/storage-service';
import type { Settings, ArchiveExclusionRule } from '../../src/shared/types';
import { ARCHIVE_FOLDER_NAME } from '../../src/shared/constants';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    autoGroupEnabled: false,
    autoCloseEnabled: false,
    duplicateDetectionMode: 'ignoreParams',
    autoCloseCheckInterval: 300000,
    autoCloseProtectPinned: true,
    archiveEnabled: true,
    archiveBookmarkFolderId: null,
    defaultSortOrder: 'domain',
    sortPreserveGroups: true,
    ...overrides,
  };
}

function makeTab(overrides: Partial<chrome.tabs.Tab> = {}): chrome.tabs.Tab {
  return {
    id: 1,
    url: 'https://example.com/page',
    title: 'Example Page',
    favIconUrl: undefined,
    pinned: false,
    windowId: 1,
    index: 0,
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

const mockBookmarks = {
  get: vi.fn(),
  search: vi.fn(),
  create: vi.fn(),
};

vi.stubGlobal('chrome', {
  bookmarks: mockBookmarks,
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ArchiveManager', () => {
  let archiveManager: ArchiveManager;
  let mockStorage: Partial<StorageService>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-02-26T00:00:00.000Z');

    mockStorage = {
      getSettings: vi.fn().mockResolvedValue(makeSettings()),
      updateSettings: vi.fn().mockResolvedValue(undefined),
      getArchiveExclusionRules: vi.fn().mockResolvedValue([]),
    };

    // Default: no cached folder, search returns nothing, create returns new folder
    mockBookmarks.get.mockRejectedValue(new Error('Not found'));
    mockBookmarks.search.mockResolvedValue([]);
    mockBookmarks.create.mockResolvedValue({ id: 'folder-1', title: ARCHIVE_FOLDER_NAME });

    archiveManager = new ArchiveManager(mockStorage as StorageService);
  });

  describe('archiveEnabled toggle (AC6)', () => {
    it('returns early without creating bookmark when archiveEnabled is false', async () => {
      vi.mocked(mockStorage.getSettings!).mockResolvedValue(
        makeSettings({ archiveEnabled: false }),
      );

      await archiveManager.archiveTab(makeTab());

      expect(mockBookmarks.create).not.toHaveBeenCalled();
    });
  });

  describe('exclusion rules (AC5)', () => {
    it('skips archiving when tab URL matches an exclusion rule', async () => {
      const exclusionRule: ArchiveExclusionRule = {
        id: 'ex-1',
        pattern: 'https://example.com/*',
        patternType: 'glob',
      };
      vi.mocked(mockStorage.getArchiveExclusionRules!).mockResolvedValue([exclusionRule]);

      await archiveManager.archiveTab(makeTab({ url: 'https://example.com/page' }));

      expect(mockBookmarks.create).not.toHaveBeenCalled();
    });

    it('archives tab when URL does not match any exclusion rule', async () => {
      const exclusionRule: ArchiveExclusionRule = {
        id: 'ex-1',
        pattern: 'https://reddit.com/*',
        patternType: 'glob',
      };
      vi.mocked(mockStorage.getArchiveExclusionRules!).mockResolvedValue([exclusionRule]);
      mockBookmarks.create
        .mockResolvedValueOnce({ id: 'folder-1', title: ARCHIVE_FOLDER_NAME })
        .mockResolvedValueOnce({ id: 'bm-1', title: 'bookmark' });

      await archiveManager.archiveTab(makeTab({ url: 'https://example.com/page' }));

      // Should have created both the folder and the bookmark
      expect(mockBookmarks.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('bookmark title format (AC4)', () => {
    it('creates bookmark with title [YYYY-MM-DD] title – hostname', async () => {
      mockBookmarks.create
        .mockResolvedValueOnce({ id: 'folder-1', title: ARCHIVE_FOLDER_NAME })
        .mockResolvedValueOnce({ id: 'bm-1', title: 'created' });

      await archiveManager.archiveTab(
        makeTab({ url: 'https://github.com/user/repo', title: 'GitHub' }),
      );

      expect(mockBookmarks.create).toHaveBeenLastCalledWith({
        parentId: 'folder-1',
        title: '[2026-02-26] GitHub \u2013 github.com',
        url: 'https://github.com/user/repo',
      });
    });

    it('uses hostname as title fallback when tab.title is empty (AC4)', async () => {
      mockBookmarks.create
        .mockResolvedValueOnce({ id: 'folder-1', title: ARCHIVE_FOLDER_NAME })
        .mockResolvedValueOnce({ id: 'bm-1', title: 'created' });

      await archiveManager.archiveTab(makeTab({ url: 'https://github.com/user/repo', title: '' }));

      expect(mockBookmarks.create).toHaveBeenLastCalledWith({
        parentId: 'folder-1',
        title: '[2026-02-26] github.com \u2013 github.com',
        url: 'https://github.com/user/repo',
      });
    });
  });

  describe('archive folder caching (AC3)', () => {
    it('uses cached archiveBookmarkFolderId when available', async () => {
      vi.mocked(mockStorage.getSettings!).mockResolvedValue(
        makeSettings({ archiveBookmarkFolderId: 'cached-folder-id' }),
      );
      // Must include parentId in a top-level root so the cache hit is accepted
      mockBookmarks.get.mockResolvedValue([
        { id: 'cached-folder-id', title: ARCHIVE_FOLDER_NAME, parentId: '2' },
      ]);
      mockBookmarks.create.mockResolvedValueOnce({ id: 'bm-1', title: 'created' });

      await archiveManager.archiveTab(makeTab());

      expect(mockBookmarks.get).toHaveBeenCalledWith('cached-folder-id');
      expect(mockBookmarks.search).not.toHaveBeenCalled();
      expect(mockBookmarks.create).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: 'cached-folder-id' }),
      );
    });

    it('searches for folder when archiveBookmarkFolderId is null', async () => {
      vi.mocked(mockStorage.getSettings!).mockResolvedValue(
        makeSettings({ archiveBookmarkFolderId: null }),
      );
      mockBookmarks.search.mockResolvedValue([]);
      mockBookmarks.create
        .mockResolvedValueOnce({ id: 'new-folder', title: ARCHIVE_FOLDER_NAME })
        .mockResolvedValueOnce({ id: 'bm-1', title: 'created' });

      await archiveManager.archiveTab(makeTab());

      expect(mockBookmarks.search).toHaveBeenCalledWith({ title: ARCHIVE_FOLDER_NAME });
    });

    it('creates folder when none found using explicit top-level parentId (AC2)', async () => {
      mockBookmarks.create
        .mockResolvedValueOnce({ id: 'new-folder', title: ARCHIVE_FOLDER_NAME })
        .mockResolvedValueOnce({ id: 'bm-1', title: 'created' });

      await archiveManager.archiveTab(makeTab());

      // Must pass parentId '2' (Other Bookmarks) to place folder at top level
      expect(mockBookmarks.create).toHaveBeenCalledWith({ parentId: '2', title: ARCHIVE_FOLDER_NAME });
      expect(mockStorage.updateSettings).toHaveBeenCalledWith({ archiveBookmarkFolderId: 'new-folder' });
    });

    it('re-uses existing top-level folder found by search and saves its ID to settings', async () => {
      mockBookmarks.search.mockResolvedValue([
        { id: 'found-folder', title: ARCHIVE_FOLDER_NAME, parentId: '2' }, // top-level, no url = folder
      ]);
      mockBookmarks.create.mockResolvedValueOnce({ id: 'bm-1', title: 'created' });

      await archiveManager.archiveTab(makeTab());

      expect(mockStorage.updateSettings).toHaveBeenCalledWith({ archiveBookmarkFolderId: 'found-folder' });
      expect(mockBookmarks.create).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: 'found-folder' }),
      );
    });

    it('ignores nested folder with matching title and creates a top-level folder instead (AC2)', async () => {
      // Search returns a folder at parentId '42' which is NOT a root container — must be ignored
      mockBookmarks.search.mockResolvedValue([
        { id: 'nested-folder', title: ARCHIVE_FOLDER_NAME, parentId: '42' },
      ]);
      mockBookmarks.create
        .mockResolvedValueOnce({ id: 'new-top-folder', title: ARCHIVE_FOLDER_NAME })
        .mockResolvedValueOnce({ id: 'bm-1', title: 'created' });

      await archiveManager.archiveTab(makeTab());

      // Should NOT reuse the nested folder
      expect(mockStorage.updateSettings).not.toHaveBeenCalledWith({
        archiveBookmarkFolderId: 'nested-folder',
      });
      // Should create a new top-level folder
      expect(mockBookmarks.create).toHaveBeenCalledWith({ parentId: '2', title: ARCHIVE_FOLDER_NAME });
      expect(mockStorage.updateSettings).toHaveBeenCalledWith({
        archiveBookmarkFolderId: 'new-top-folder',
      });
    });

    it('ignores cached folder ID when it resolves to a non-top-level folder (AC2)', async () => {
      vi.mocked(mockStorage.getSettings!).mockResolvedValue(
        makeSettings({ archiveBookmarkFolderId: 'moved-folder-id' }),
      );
      // Cached folder exists but has been moved to a nested location
      mockBookmarks.get.mockResolvedValue([
        { id: 'moved-folder-id', title: ARCHIVE_FOLDER_NAME, parentId: '99' }, // not top-level
      ]);
      mockBookmarks.search.mockResolvedValue([]);
      mockBookmarks.create
        .mockResolvedValueOnce({ id: 'new-top-folder', title: ARCHIVE_FOLDER_NAME })
        .mockResolvedValueOnce({ id: 'bm-1', title: 'created' });

      await archiveManager.archiveTab(makeTab());

      // Should bypass the cache and create a fresh top-level folder
      expect(mockBookmarks.create).toHaveBeenCalledWith({ parentId: '2', title: ARCHIVE_FOLDER_NAME });
    });
  });

  describe('error handling (AC1)', () => {
    it('does NOT rethrow when chrome.bookmarks.create fails', async () => {
      mockBookmarks.create
        .mockResolvedValueOnce({ id: 'folder-1', title: ARCHIVE_FOLDER_NAME })
        .mockRejectedValueOnce(new Error('Bookmarks quota exceeded'));

      // Should not throw
      await expect(archiveManager.archiveTab(makeTab())).resolves.toBeUndefined();
    });

    it('does NOT throw when chrome.bookmarks.search fails', async () => {
      mockBookmarks.search.mockRejectedValue(new Error('Search error'));

      await expect(archiveManager.archiveTab(makeTab())).resolves.toBeUndefined();
    });
  });

  describe('non-http URL guard', () => {
    it('skips archiving for non-http(s) URLs', async () => {
      await archiveManager.archiveTab(makeTab({ url: 'chrome://newtab/' }));

      expect(mockBookmarks.create).not.toHaveBeenCalled();
    });

    it('skips archiving when tab has no URL', async () => {
      await archiveManager.archiveTab(makeTab({ url: undefined }));

      expect(mockBookmarks.create).not.toHaveBeenCalled();
    });
  });
});
