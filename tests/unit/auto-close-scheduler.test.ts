/**
 * Unit tests for AutoCloseScheduler
 *
 * Covers all ACs (1–10) defined in Story 3.3.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutoCloseScheduler } from '../../src/background/modules/auto-close-scheduler';
import type { StorageService } from '../../src/background/modules/storage-service';
import type { ActivityTracker } from '../../src/background/modules/activity-tracker';
import type { ArchiveManager } from '../../src/background/modules/archive-manager';
import type { AutoCloseRule, WhitelistRule, Settings } from '../../src/shared/types';
import type { ClosedTabEntry } from '../../src/shared/types/storage';
import { RECENTLY_CLOSED_MAX_ENTRIES } from '../../src/shared/constants';

// ── Helpers ────────────────────────────────────────────────────────────────

const FIXED_NOW = 1_000_000_000_000; // arbitrary fixed timestamp
const ONE_HOUR = 60 * 60 * 1000;

/** Build a minimal chrome tab object */
function makeTab(overrides: Partial<chrome.tabs.Tab> = {}): chrome.tabs.Tab {
  return {
    id: 1,
    url: 'https://example.com',
    title: 'Example',
    favIconUrl: 'https://example.com/favicon.ico',
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

/** Build a minimal enabled auto-close rule */
function makeAutoCloseRule(overrides: Partial<AutoCloseRule> = {}): AutoCloseRule {
  return {
    id: 'rule-1',
    name: 'Default',
    pattern: 'https://example.com*',
    patternType: 'glob',
    maxAge: ONE_HOUR,
    enabled: true,
    ...overrides,
  } as AutoCloseRule;
}

/** Build a minimal enabled whitelist rule */
function makeWhitelistRule(overrides: Partial<WhitelistRule> = {}): WhitelistRule {
  return {
    id: 'wl-1',
    name: 'Whitelist',
    pattern: 'https://example.com*',
    patternType: 'glob',
    enabled: true,
    ...overrides,
  } as unknown as WhitelistRule;
}

/** Build default settings with autoCloseEnabled = true */
function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    autoCloseEnabled: true,
    autoCloseCheckInterval: 5 * 60 * 1000,
    autoCloseProtectPinned: true,
    autoGroupEnabled: false,
    duplicateDetectionMode: 'ignoreParams',
    archiveEnabled: false,
    archiveBookmarkFolderId: null,
    defaultSortOrder: 'domain',
    sortPreserveGroups: true,
    ...overrides,
  } as Settings;
}

// ── Chrome mock ────────────────────────────────────────────────────────────

const mockChrome = {
  tabs: {
    query: vi.fn<() => Promise<chrome.tabs.Tab[]>>(),
    remove: vi.fn<() => Promise<void>>(),
  },
};

vi.stubGlobal('chrome', mockChrome);

// ── Test suite ─────────────────────────────────────────────────────────────

describe('AutoCloseScheduler', () => {
  let scheduler: AutoCloseScheduler;
  let mockStorage: Partial<StorageService>;
  let mockActivityTracker: Partial<ActivityTracker>;
  let mockArchiveManager: Partial<ArchiveManager>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);

    mockStorage = {
      getSettings: vi.fn(),
      getAutoCloseRules: vi.fn(),
      getWhitelistRules: vi.fn(),
      getLocalStorage: vi.fn(),
      updateLocalStorage: vi.fn(),
    };

    mockActivityTracker = {
      getActivity: vi.fn(),
    };

    mockArchiveManager = {
      archiveTab: vi.fn().mockResolvedValue(undefined),
    };

    // Default happy-path mocks
    vi.mocked(mockStorage.getSettings!).mockResolvedValue(makeSettings());
    vi.mocked(mockStorage.getAutoCloseRules!).mockResolvedValue([makeAutoCloseRule()]);
    vi.mocked(mockStorage.getWhitelistRules!).mockResolvedValue([]);
    vi.mocked(mockStorage.getLocalStorage!).mockResolvedValue({
      tabActivity: {},
      recentlyClosed: [],
      tabActivityByUrl: {},
    });
    vi.mocked(mockStorage.updateLocalStorage!).mockResolvedValue(undefined);

    mockChrome.tabs.query.mockResolvedValue([]);
    mockChrome.tabs.remove.mockResolvedValue(undefined);

    scheduler = new AutoCloseScheduler(
      mockStorage as StorageService,
      mockActivityTracker as ActivityTracker,
      mockArchiveManager as ArchiveManager,
    );
  });

  // ── AC9: Global toggle ───────────────────────────────────────────────────

  it('returns early without querying tabs when autoCloseEnabled is false (AC9)', async () => {
    vi.mocked(mockStorage.getSettings!).mockResolvedValue(makeSettings({ autoCloseEnabled: false }));

    const result = await scheduler.runCheck();

    expect(result).toEqual({ closedCount: 0, errors: [] });
    expect(mockChrome.tabs.query).not.toHaveBeenCalled();
  });

  // ── AC3: Age comparison ──────────────────────────────────────────────────

  it('closes a tab whose age exceeds the rule maxAge (AC2, AC3)', async () => {
    const tab = makeTab();
    mockChrome.tabs.query.mockResolvedValue([tab]);
    vi.mocked(mockActivityTracker.getActivity!).mockResolvedValue({
      tabId: 1,
      url: 'https://example.com',
      lastActiveAt: FIXED_NOW - ONE_HOUR - 1, // just over maxAge
      createdAt: FIXED_NOW - TWO_HOURS,
    });

    const result = await scheduler.runCheck();

    expect(mockChrome.tabs.remove).toHaveBeenCalledWith(1);
    expect(result.closedCount).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('does NOT close a tab whose age is within the rule maxAge (AC3)', async () => {
    const tab = makeTab();
    mockChrome.tabs.query.mockResolvedValue([tab]);
    vi.mocked(mockActivityTracker.getActivity!).mockResolvedValue({
      tabId: 1,
      url: 'https://example.com',
      lastActiveAt: FIXED_NOW - ONE_HOUR + 1000, // just under maxAge
      createdAt: FIXED_NOW - TWO_HOURS,
    });

    const result = await scheduler.runCheck();

    expect(mockChrome.tabs.remove).not.toHaveBeenCalled();
    expect(result.closedCount).toBe(0);
  });

  // ── AC4: Whitelist ───────────────────────────────────────────────────────

  it('skips a tab that matches a whitelist rule even when it matches an auto-close rule (AC4)', async () => {
    const tab = makeTab();
    mockChrome.tabs.query.mockResolvedValue([tab]);
    vi.mocked(mockStorage.getWhitelistRules!).mockResolvedValue([makeWhitelistRule()]);
    vi.mocked(mockActivityTracker.getActivity!).mockResolvedValue({
      tabId: 1,
      url: 'https://example.com',
      lastActiveAt: FIXED_NOW - TWO_HOURS,
      createdAt: FIXED_NOW - TWO_HOURS,
    });

    const result = await scheduler.runCheck();

    expect(mockChrome.tabs.remove).not.toHaveBeenCalled();
    expect(result.closedCount).toBe(0);
  });

  // ── AC5: Pinned tabs ─────────────────────────────────────────────────────

  it('skips a pinned tab when autoCloseProtectPinned is true (AC5)', async () => {
    const tab = makeTab({ pinned: true });
    mockChrome.tabs.query.mockResolvedValue([tab]);
    vi.mocked(mockStorage.getSettings!).mockResolvedValue(makeSettings({ autoCloseProtectPinned: true }));
    vi.mocked(mockActivityTracker.getActivity!).mockResolvedValue({
      tabId: 1,
      url: 'https://example.com',
      lastActiveAt: FIXED_NOW - TWO_HOURS,
      createdAt: FIXED_NOW - TWO_HOURS,
    });

    const result = await scheduler.runCheck();

    expect(mockChrome.tabs.remove).not.toHaveBeenCalled();
    expect(result.closedCount).toBe(0);
  });

  it('closes a pinned tab when autoCloseProtectPinned is false (AC5)', async () => {
    const tab = makeTab({ pinned: true });
    mockChrome.tabs.query.mockResolvedValue([tab]);
    vi.mocked(mockStorage.getSettings!).mockResolvedValue(makeSettings({ autoCloseProtectPinned: false }));
    vi.mocked(mockActivityTracker.getActivity!).mockResolvedValue({
      tabId: 1,
      url: 'https://example.com',
      lastActiveAt: FIXED_NOW - TWO_HOURS,
      createdAt: FIXED_NOW - TWO_HOURS,
    });

    const result = await scheduler.runCheck();

    expect(mockChrome.tabs.remove).toHaveBeenCalledWith(1);
    expect(result.closedCount).toBe(1);
  });

  // ── AC6: Non-http(s) URLs ────────────────────────────────────────────────

  it('skips a tab with a chrome:// URL (AC6)', async () => {
    const tab = makeTab({ url: 'chrome://extensions/' });
    mockChrome.tabs.query.mockResolvedValue([tab]);

    const result = await scheduler.runCheck();

    expect(mockChrome.tabs.remove).not.toHaveBeenCalled();
    expect(result.closedCount).toBe(0);
  });

  it('skips a tab with an empty URL (AC6)', async () => {
    const tab = makeTab({ url: '' });
    mockChrome.tabs.query.mockResolvedValue([tab]);

    const result = await scheduler.runCheck();

    expect(mockChrome.tabs.remove).not.toHaveBeenCalled();
    expect(result.closedCount).toBe(0);
  });

  // ── AC10: No activity record ─────────────────────────────────────────────

  it('skips a tab with no activity record (AC10)', async () => {
    const tab = makeTab();
    mockChrome.tabs.query.mockResolvedValue([tab]);
    vi.mocked(mockActivityTracker.getActivity!).mockResolvedValue(null);

    const result = await scheduler.runCheck();

    expect(mockChrome.tabs.remove).not.toHaveBeenCalled();
    expect(result.closedCount).toBe(0);
  });

  // ── AC7: recentlyClosed entry ────────────────────────────────────────────

  it('adds a ClosedTabEntry with closedBy:"auto" to recentlyClosed when closing a tab (AC7)', async () => {
    const tab = makeTab({ title: 'Example Page', favIconUrl: 'https://example.com/icon.ico' });
    mockChrome.tabs.query.mockResolvedValue([tab]);
    vi.mocked(mockActivityTracker.getActivity!).mockResolvedValue({
      tabId: 1,
      url: 'https://example.com',
      lastActiveAt: FIXED_NOW - TWO_HOURS,
      createdAt: FIXED_NOW - TWO_HOURS,
    });

    await scheduler.runCheck();

    expect(mockStorage.updateLocalStorage).toHaveBeenCalledOnce();
    const callArg = vi.mocked(mockStorage.updateLocalStorage!).mock.calls[0][0] as {
      recentlyClosed: ClosedTabEntry[];
    };
    expect(callArg.recentlyClosed).toHaveLength(1);
    const entry = callArg.recentlyClosed[0];
    expect(entry.url).toBe('https://example.com');
    expect(entry.title).toBe('Example Page');
    expect(entry.favicon).toBe('https://example.com/icon.ico');
    expect(entry.closedBy).toBe('auto');
    expect(entry.closedAt).toBe(FIXED_NOW);
    expect(typeof entry.id).toBe('string');
  });

  // ── AC8: recentlyClosed cap ──────────────────────────────────────────────

  it('trims recentlyClosed to RECENTLY_CLOSED_MAX_ENTRIES after overflow (AC8)', async () => {
    // Fill up existing list to the maximum
    const existingEntries: ClosedTabEntry[] = Array.from({ length: RECENTLY_CLOSED_MAX_ENTRIES }, (_, i) => ({
      id: `old-${i}`,
      url: `https://old-${i}.com`,
      title: `Old ${i}`,
      favicon: null,
      closedAt: FIXED_NOW - 1000,
      closedBy: 'auto' as const,
    }));
    vi.mocked(mockStorage.getLocalStorage!).mockResolvedValue({
      tabActivity: {},
      recentlyClosed: existingEntries,
      tabActivityByUrl: {},
    });

    const tab = makeTab();
    mockChrome.tabs.query.mockResolvedValue([tab]);
    vi.mocked(mockActivityTracker.getActivity!).mockResolvedValue({
      tabId: 1,
      url: 'https://example.com',
      lastActiveAt: FIXED_NOW - TWO_HOURS,
      createdAt: FIXED_NOW - TWO_HOURS,
    });

    await scheduler.runCheck();

    const callArg = vi.mocked(mockStorage.updateLocalStorage!).mock.calls[0][0] as {
      recentlyClosed: ClosedTabEntry[];
    };
    // New entry is prepended, total must remain at max
    expect(callArg.recentlyClosed).toHaveLength(RECENTLY_CLOSED_MAX_ENTRIES);
    // The newest entry should be first
    expect(callArg.recentlyClosed[0].url).toBe('https://example.com');
  });

  // ── Error resilience ─────────────────────────────────────────────────────

  it('catches chrome.tabs.remove failure, increments errors, and continues with remaining tabs', async () => {
    const tab1 = makeTab({ id: 1, url: 'https://example.com/a' });
    const tab2 = makeTab({ id: 2, url: 'https://example.com/b' });
    mockChrome.tabs.query.mockResolvedValue([tab1, tab2]);
    vi.mocked(mockActivityTracker.getActivity!).mockResolvedValue({
      tabId: 1,
      url: 'https://example.com',
      lastActiveAt: FIXED_NOW - TWO_HOURS,
      createdAt: FIXED_NOW - TWO_HOURS,
    });
    // Tab 1 remove fails; tab 2 succeeds
    mockChrome.tabs.remove
      .mockRejectedValueOnce(new Error('No tab with id 1'))
      .mockResolvedValueOnce(undefined);

    const result = await scheduler.runCheck();

    expect(mockChrome.tabs.remove).toHaveBeenCalledTimes(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/tab 1/i);
    expect(result.closedCount).toBe(1);
  });

  it('removes failed-remove entries from recentlyClosed via corrective write (AC7)', async () => {
    const tab1 = makeTab({ id: 1, url: 'https://example.com/a', title: 'Tab A' });
    const tab2 = makeTab({ id: 2, url: 'https://example.com/b', title: 'Tab B' });
    mockChrome.tabs.query.mockResolvedValue([tab1, tab2]);
    vi.mocked(mockActivityTracker.getActivity!).mockResolvedValue({
      tabId: 1,
      url: 'https://example.com',
      lastActiveAt: FIXED_NOW - TWO_HOURS,
      createdAt: FIXED_NOW - TWO_HOURS,
    });
    mockChrome.tabs.remove
      .mockRejectedValueOnce(new Error('No tab with id 1'))
      .mockResolvedValueOnce(undefined);

    // Simulate real storage: getLocalStorage returns whatever was last written
    const written: ClosedTabEntry[] = [];
    vi.mocked(mockStorage.updateLocalStorage!).mockImplementation(async (data) => {
      if ('recentlyClosed' in (data as Record<string, unknown>)) {
        written.splice(0, written.length, ...(data as { recentlyClosed: ClosedTabEntry[] }).recentlyClosed);
      }
    });
    vi.mocked(mockStorage.getLocalStorage!).mockImplementation(async () => ({
      tabActivity: {},
      recentlyClosed: [...written],
      tabActivityByUrl: {},
    }));

    await scheduler.runCheck();

    // updateLocalStorage called twice: Phase 2 (write) + Phase 4 (corrective)
    expect(mockStorage.updateLocalStorage).toHaveBeenCalledTimes(2);
    // After corrective write, only tab 2 (successfully closed) remains
    const finalEntries = vi.mocked(mockStorage.updateLocalStorage!).mock.calls[1][0] as {
      recentlyClosed: ClosedTabEntry[];
    };
    expect(finalEntries.recentlyClosed).toHaveLength(1);
    expect(finalEntries.recentlyClosed[0].url).toBe('https://example.com/b');
  });

  it('logs an error and continues if the corrective storage write fails', async () => {
    const tab = makeTab();
    mockChrome.tabs.query.mockResolvedValue([tab]);
    vi.mocked(mockActivityTracker.getActivity!).mockResolvedValue({
      tabId: 1,
      url: 'https://example.com',
      lastActiveAt: FIXED_NOW - TWO_HOURS,
      createdAt: FIXED_NOW - TWO_HOURS,
    });
    mockChrome.tabs.remove.mockRejectedValueOnce(new Error('Tab already gone'));
    // Phase 2 write succeeds, Phase 4 corrective write fails
    vi.mocked(mockStorage.updateLocalStorage!).mockResolvedValueOnce(undefined).mockRejectedValueOnce(
      new Error('Storage write failed'),
    );

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await scheduler.runCheck();

    // Should not throw; should still report the remove failure
    expect(result.errors).toHaveLength(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('phantom'),
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  // ── Multiple tabs ────────────────────────────────────────────────────────

  it('closes all matching stale tabs in a single runCheck pass', async () => {
    const tabs = [
      makeTab({ id: 1, url: 'https://example.com/a' }),
      makeTab({ id: 2, url: 'https://example.com/b' }),
      makeTab({ id: 3, url: 'https://example.com/c' }),
    ];
    mockChrome.tabs.query.mockResolvedValue(tabs);
    vi.mocked(mockStorage.getAutoCloseRules!).mockResolvedValue([
      makeAutoCloseRule({ pattern: '*://example.com/*' }),
    ]);
    vi.mocked(mockActivityTracker.getActivity!).mockResolvedValue({
      tabId: 1,
      url: 'https://example.com',
      lastActiveAt: FIXED_NOW - TWO_HOURS,
      createdAt: FIXED_NOW - TWO_HOURS,
    });

    const result = await scheduler.runCheck();

    expect(mockChrome.tabs.remove).toHaveBeenCalledTimes(3);
    expect(result.closedCount).toBe(3);
  });

  // ── No matching rule ─────────────────────────────────────────────────────

  it('does not close a tab that has no matching auto-close rule', async () => {
    const tab = makeTab({ url: 'https://other-domain.com' });
    mockChrome.tabs.query.mockResolvedValue([tab]);
    // Rule only matches example.com
    vi.mocked(mockStorage.getAutoCloseRules!).mockResolvedValue([
      makeAutoCloseRule({ pattern: '*://example.com/*' }),
    ]);
    vi.mocked(mockActivityTracker.getActivity!).mockResolvedValue({
      tabId: 1,
      url: 'https://other-domain.com',
      lastActiveAt: FIXED_NOW - TWO_HOURS,
      createdAt: FIXED_NOW - TWO_HOURS,
    });

    const result = await scheduler.runCheck();

    expect(mockChrome.tabs.remove).not.toHaveBeenCalled();
    expect(result.closedCount).toBe(0);
  });

  // ── Undo durability ──────────────────────────────────────────────────────

  it('persists undo entries to storage BEFORE calling chrome.tabs.remove', async () => {
    const tab = makeTab();
    mockChrome.tabs.query.mockResolvedValue([tab]);
    vi.mocked(mockActivityTracker.getActivity!).mockResolvedValue({
      tabId: 1,
      url: 'https://example.com',
      lastActiveAt: FIXED_NOW - TWO_HOURS,
      createdAt: FIXED_NOW - TWO_HOURS,
    });

    const callOrder: string[] = [];
    vi.mocked(mockStorage.updateLocalStorage!).mockImplementationOnce(async () => {
      callOrder.push('updateLocalStorage');
    });
    mockChrome.tabs.remove.mockImplementationOnce(async () => {
      callOrder.push('tabs.remove');
    });

    await scheduler.runCheck();

    expect(callOrder).toEqual(['updateLocalStorage', 'tabs.remove']);
  });

  it('does not remove any tab if updateLocalStorage throws (undo durability)', async () => {
    const tab = makeTab();
    mockChrome.tabs.query.mockResolvedValue([tab]);
    vi.mocked(mockActivityTracker.getActivity!).mockResolvedValue({
      tabId: 1,
      url: 'https://example.com',
      lastActiveAt: FIXED_NOW - TWO_HOURS,
      createdAt: FIXED_NOW - TWO_HOURS,
    });
    vi.mocked(mockStorage.updateLocalStorage!).mockRejectedValueOnce(
      new Error('Storage quota exceeded'),
    );

    await expect(scheduler.runCheck()).rejects.toThrow('Storage quota exceeded');
    expect(mockChrome.tabs.remove).not.toHaveBeenCalled();
  });

  // ── Reentrancy guard ─────────────────────────────────────────────────────

  it('skips a concurrent runCheck() call while one is already in progress', async () => {
    let resolveGetSettings!: (s: Settings) => void;
    vi.mocked(mockStorage.getSettings!).mockImplementationOnce(
      () =>
        new Promise<Settings>((resolve) => {
          resolveGetSettings = resolve;
        }),
    );

    // Start first check — stalls at getSettings
    const firstCheckPromise = scheduler.runCheck();

    // Second call fires while first is in-flight — should return immediately
    const secondResult = await scheduler.runCheck();
    expect(secondResult).toEqual({ closedCount: 0, errors: [] });

    // Unblock first check with autoCloseEnabled:false so it returns cleanly
    resolveGetSettings(makeSettings({ autoCloseEnabled: false }));
    await firstCheckPromise;
  });
});

// ── Helper constant ────────────────────────────────────────────────────────
const TWO_HOURS = 2 * ONE_HOUR;
