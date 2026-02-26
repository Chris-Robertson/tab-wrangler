/**
 * ArchiveManager - Archives tabs to bookmarks before auto-close.
 *
 * Called by AutoCloseScheduler before each chrome.tabs.remove(). If archiving
 * is disabled or the tab URL matches an exclusion rule, the tab is skipped
 * (but still closed). Archive failures are caught and logged — they must never
 * prevent tab closure.
 */

import type { StorageService } from './storage-service';
import { matchPattern } from '@shared/utils/pattern-matcher';
import { ARCHIVE_FOLDER_NAME } from '@shared/constants';

export class ArchiveManager {
  constructor(private storage: StorageService) {}

  /**
   * Archive a tab to the "Tab Wrangler Archive" bookmark folder.
   *
   * AC1: Called by AutoCloseScheduler before chrome.tabs.remove().
   * AC6: Returns immediately if archiveEnabled is false.
   * AC5: Returns without archiving if URL matches any exclusion rule.
   * All errors are caught and logged — callers must still close the tab.
   */
  async archiveTab(tab: chrome.tabs.Tab): Promise<void> {
    try {
      // AC6: Respect the archiveEnabled toggle
      const settings = await this.storage.getSettings();
      if (!settings.archiveEnabled) return;

      // Guard: skip tabs without a valid http(s) URL
      if (!tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) return;

      // AC5: Check exclusion rules — any match → skip archiving
      const exclusionRules = await this.storage.getArchiveExclusionRules();
      const isExcluded = exclusionRules.some((rule) =>
        matchPattern(tab.url!, rule.pattern, rule.patternType),
      );
      if (isExcluded) return;

      // AC2, AC3: Resolve (or create) the archive bookmark folder
      const folderId = await this.findOrCreateArchiveFolder();

      // AC4: Build bookmark title: [YYYY-MM-DD] {title} – {hostname}
      const dateStr = new Date().toISOString().slice(0, 10);
      const hostname = new URL(tab.url).hostname;
      const titleText = tab.title?.trim() || hostname;
      const bookmarkTitle = `[${dateStr}] ${titleText} \u2013 ${hostname}`;

      // Create the bookmark
      await chrome.bookmarks.create({
        parentId: folderId,
        title: bookmarkTitle,
        url: tab.url,
      });
    } catch (error) {
      // AC1: Archive failure must NOT prevent tab closure — log and swallow
      console.error('[ArchiveManager] Failed to archive tab:', tab.url, error);
    }
  }

  /**
   * Locate the "Tab Wrangler Archive" bookmark folder, creating it if needed.
   * Caches the folder ID in settings to avoid repeated searches (AC3).
   *
   * AC2: The folder must be a true top-level folder — a direct child of one of
   * Chrome's root containers (Bookmarks Bar: "1", Other Bookmarks: "2",
   * Mobile Bookmarks: "3"). Nested folders that happen to share the same name
   * are ignored to prevent accidental collisions.
   */
  private async findOrCreateArchiveFolder(): Promise<string> {
    const settings = await this.storage.getSettings();

    // Chrome bookmark root parent IDs: 1=Bookmarks Bar, 2=Other Bookmarks, 3=Mobile Bookmarks
    const TOP_LEVEL_PARENT_IDS = new Set(['1', '2', '3']);

    // 1. Try cached ID first (fast path) — re-verify it is still a top-level folder
    if (settings.archiveBookmarkFolderId) {
      try {
        const [folder] = await chrome.bookmarks.get(settings.archiveBookmarkFolderId);
        if (folder && !folder.url && folder.parentId && TOP_LEVEL_PARENT_IDS.has(folder.parentId)) {
          return folder.id;
        }
      } catch {
        // Folder was deleted — fall through to re-create
      }
    }

    // 2. Search by title — constrain to true top-level folders only (AC2)
    const results = await chrome.bookmarks.search({ title: ARCHIVE_FOLDER_NAME });
    const existing = results.find(
      (b) => !b.url && b.parentId != null && TOP_LEVEL_PARENT_IDS.has(b.parentId),
    );
    if (existing) {
      await this.storage.updateSettings({ archiveBookmarkFolderId: existing.id });
      return existing.id;
    }

    // 3. Create new folder as a direct child of "Other Bookmarks" (parentId "2") (AC2)
    const newFolder = await chrome.bookmarks.create({ parentId: '2', title: ARCHIVE_FOLDER_NAME });
    await this.storage.updateSettings({ archiveBookmarkFolderId: newFolder.id });
    return newFolder.id;
  }
}
