/**
 * Tests for background/index.ts tab event wiring.
 * Verifies that Chrome tab events invoke the correct ActivityTracker methods.
 *
 * Uses vi.hoisted() to share mock instances between vi.mock factories and test
 * assertions, and vi.fn(function(){}) to satisfy Vitest 4.x constructor mocking.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── Shared mock instances ────────────────────────────────────────────────
// vi.hoisted runs before vi.mock (which itself runs before imports), so these
// instances are available inside every mock factory below.

const mocks = vi.hoisted(() => ({
  tracker: {
    recordTabCreated: vi.fn().mockResolvedValue(undefined),
    recordTabActivated: vi.fn().mockResolvedValue(undefined),
    recordTabUrlUpdated: vi.fn().mockResolvedValue(undefined),
    recordTabRemoved: vi.fn().mockResolvedValue(undefined),
  },
  storage: {
    initializeDefaults: vi.fn().mockResolvedValue(undefined),
    getSettings: vi.fn().mockResolvedValue({ autoCloseEnabled: false, autoGroupEnabled: false }),
    getLocalStorage: vi.fn().mockResolvedValue({ tabActivity: {}, recentlyClosed: [], tabActivityByUrl: {} }),
    updateLocalStorage: vi.fn().mockResolvedValue(undefined),
  },
  detector: {
    getDuplicateCount: vi.fn().mockResolvedValue(0),
    removeDuplicates: vi.fn().mockResolvedValue({ removed: [] }),
  },
  grouper: {
    autoGroupTab: vi.fn().mockResolvedValue(undefined),
    organizeAllTabs: vi.fn().mockResolvedValue({ tabsOrganized: 0, groupsCreated: 0, errors: [] }),
  },
}));

// ── Module mocks (hoisted before all imports) ─────────────────────────────
// Vitest 4.x: constructor mocks MUST use `vi.fn(function(){})` — arrow
// functions cannot be called with `new`. Return the shared mock objects so
// test assertions always reference the same instances.

vi.mock('../../src/background/modules/storage-service', () => ({
  StorageService: vi.fn(function () { return mocks.storage; }),
}));

vi.mock('../../src/background/modules/duplicate-detector', () => ({
  DuplicateDetector: vi.fn(function () { return mocks.detector; }),
}));

vi.mock('../../src/background/modules/auto-group-manager', () => ({
  AutoGroupManager: vi.fn(function () { return mocks.grouper; }),
}));

vi.mock('../../src/background/modules/activity-tracker', () => ({
  ActivityTracker: vi.fn(function () { return mocks.tracker; }),
}));

vi.mock('../../src/shared/messaging', () => ({
  isMessage: vi.fn().mockReturnValue(false),
}));

// ── Chrome event listener capture ─────────────────────────────────────────

type TabCreatedListener = (tab: chrome.tabs.Tab) => Promise<void>;
type TabActivatedListener = (activeInfo: { tabId: number; windowId: number }) => Promise<void>;
type TabUpdatedListener = (tabId: number, changeInfo: { url?: string; status?: string }, tab: chrome.tabs.Tab) => Promise<void>;
type TabRemovedListener = (tabId: number, removeInfo: { windowId: number; isWindowClosing: boolean }) => Promise<void>;

const listeners: {
  onCreated?: TabCreatedListener;
  onActivated?: TabActivatedListener;
  onUpdated?: TabUpdatedListener;
  onRemoved?: TabRemovedListener;
} = {};

// ── Setup ─────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Set up chrome global BEFORE loading background module
  global.chrome = {
    tabs: {
      onCreated: { addListener: vi.fn((cb: TabCreatedListener) => { listeners.onCreated = cb; }) },
      onActivated: { addListener: vi.fn((cb: TabActivatedListener) => { listeners.onActivated = cb; }) },
      onUpdated: { addListener: vi.fn((cb: TabUpdatedListener) => { listeners.onUpdated = cb; }) },
      onRemoved: { addListener: vi.fn((cb: TabRemovedListener) => { listeners.onRemoved = cb; }) },
      get: vi.fn().mockResolvedValue({ id: 42, url: 'https://example.com', windowId: 1 }),
      query: vi.fn().mockResolvedValue([]),
    },
    runtime: {
      onInstalled: { addListener: vi.fn() },
      onStartup: { addListener: vi.fn() },
      onMessage: { addListener: vi.fn() },
    },
    alarms: {
      onAlarm: { addListener: vi.fn() },
      create: vi.fn(),
      clear: vi.fn(),
    },
    tabGroups: {
      query: vi.fn().mockResolvedValue([]),
    },
  } as unknown as typeof chrome;

  // Load background module — registers all event listeners as side effect
  await import('../../src/background/index');
});

beforeEach(() => {
  vi.clearAllMocks();
  // Reset default resolved value cleared by clearAllMocks
  vi.mocked(chrome.tabs.get).mockResolvedValue({ id: 42, url: 'https://example.com', windowId: 1 } as chrome.tabs.Tab);
  // Re-apply default resolved values for storage (needed by background init helpers)
  mocks.storage.initializeDefaults.mockResolvedValue(undefined);
  mocks.storage.getSettings.mockResolvedValue({ autoCloseEnabled: false, autoGroupEnabled: false });
  mocks.storage.getLocalStorage.mockResolvedValue({ tabActivity: {}, recentlyClosed: [], tabActivityByUrl: {} });
  mocks.storage.updateLocalStorage.mockResolvedValue(undefined);
  mocks.tracker.recordTabCreated.mockResolvedValue(undefined);
  mocks.tracker.recordTabActivated.mockResolvedValue(undefined);
  mocks.tracker.recordTabUrlUpdated.mockResolvedValue(undefined);
  mocks.tracker.recordTabRemoved.mockResolvedValue(undefined);
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Background tab event wiring', () => {
  it('onCreated calls recordTabCreated with tabId and url', async () => {
    const mockTab = { id: 1, url: 'https://reddit.com', windowId: 1 } as chrome.tabs.Tab;

    await listeners.onCreated!(mockTab);

    expect(mocks.tracker.recordTabCreated).toHaveBeenCalledWith(1, 'https://reddit.com');
  });

  it('onCreated passes empty string for tab with no URL', async () => {
    const mockTab = { id: 2, url: undefined, windowId: 1 } as unknown as chrome.tabs.Tab;

    await listeners.onCreated!(mockTab);

    expect(mocks.tracker.recordTabCreated).toHaveBeenCalledWith(2, '');
  });

  it('onActivated fetches the tab then calls recordTabActivated with url', async () => {
    await listeners.onActivated!({ tabId: 42, windowId: 1 });

    expect(chrome.tabs.get).toHaveBeenCalledWith(42);
    expect(mocks.tracker.recordTabActivated).toHaveBeenCalledWith(42, 'https://example.com');
  });

  it('onActivated handles missing tab gracefully (tab closed between event and get)', async () => {
    vi.mocked(chrome.tabs.get).mockRejectedValueOnce(new Error('No tab with id: 99'));

    await expect(listeners.onActivated!({ tabId: 99, windowId: 1 })).resolves.toBeUndefined();
    expect(mocks.tracker.recordTabActivated).not.toHaveBeenCalled();
  });

  it('onUpdated calls recordTabUrlUpdated when URL changes', async () => {
    const mockTab = { id: 5, url: 'https://new-url.com', windowId: 1 } as chrome.tabs.Tab;

    await listeners.onUpdated!(5, { url: 'https://new-url.com' }, mockTab);

    expect(mocks.tracker.recordTabUrlUpdated).toHaveBeenCalledWith(5, 'https://new-url.com');
  });

  it('onUpdated does NOT call recordTabUrlUpdated when URL has not changed', async () => {
    const mockTab = { id: 5, url: 'https://same.com', windowId: 1 } as chrome.tabs.Tab;

    await listeners.onUpdated!(5, { status: 'complete' }, mockTab);

    expect(mocks.tracker.recordTabUrlUpdated).not.toHaveBeenCalled();
  });

  it('onRemoved calls recordTabRemoved with the tabId', async () => {
    await listeners.onRemoved!(77, { windowId: 1, isWindowClosing: false });

    expect(mocks.tracker.recordTabRemoved).toHaveBeenCalledWith(77);
  });
});
