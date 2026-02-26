/**
 * Unit tests for ActivityTracker module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActivityTracker } from '../../src/background/modules/activity-tracker';
import type { StorageService } from '../../src/background/modules/storage-service';
import type { LocalStorage } from '../../src/shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLocalStorage(overrides: Partial<LocalStorage> = {}): LocalStorage {
  return {
    tabActivity: {},
    recentlyClosed: [],
    tabActivityByUrl: {},
    ...overrides,
  };
}

function makeMockStorage(initial?: Partial<LocalStorage>) {
  let state = makeLocalStorage(initial);

  const mockStorage = {
    getLocalStorage: vi.fn(async () => ({ ...state })),
    updateLocalStorage: vi.fn(async (data: Partial<LocalStorage>) => {
      state = { ...state, ...data };
    }),
  } as unknown as StorageService;

  return { mockStorage, getState: () => state };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ActivityTracker', () => {
  const FIXED_NOW = 1_700_000_000_000;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
  });

  // ── recordTabCreated ──────────────────────────────────────────────────────

  describe('recordTabCreated', () => {
    it('sets both createdAt and lastActiveAt to Date.now() (AC4)', async () => {
      const { mockStorage, getState } = makeMockStorage();
      const tracker = new ActivityTracker(mockStorage);

      await tracker.recordTabCreated(1, 'https://example.com');

      const activity = getState().tabActivity[1];
      expect(activity).toBeDefined();
      expect(activity.createdAt).toBe(FIXED_NOW);
      expect(activity.lastActiveAt).toBe(FIXED_NOW);
      expect(activity.tabId).toBe(1);
      expect(activity.url).toBe('https://example.com');
    });

    it('updates tabActivityByUrl with the timestamp (AC5)', async () => {
      const { mockStorage, getState } = makeMockStorage();
      const tracker = new ActivityTracker(mockStorage);

      await tracker.recordTabCreated(1, 'https://example.com');

      expect(getState().tabActivityByUrl['https://example.com']).toBe(FIXED_NOW);
    });

    it('skips tabs with an empty URL (AC4)', async () => {
      const { mockStorage } = makeMockStorage();
      const tracker = new ActivityTracker(mockStorage);

      await tracker.recordTabCreated(1, '');

      expect(mockStorage.updateLocalStorage).not.toHaveBeenCalled();
    });

    it('skips tabs with an undefined URL (AC4)', async () => {
      const { mockStorage } = makeMockStorage();
      const tracker = new ActivityTracker(mockStorage);

      await tracker.recordTabCreated(1, undefined as unknown as string);

      expect(mockStorage.updateLocalStorage).not.toHaveBeenCalled();
    });
  });

  // ── recordTabActivated ────────────────────────────────────────────────────

  describe('recordTabActivated', () => {
    it('updates lastActiveAt but preserves createdAt on existing entry (AC1, AC3)', async () => {
      const existingCreatedAt = FIXED_NOW - 10_000;
      const { mockStorage, getState } = makeMockStorage({
        tabActivity: {
          42: {
            tabId: 42,
            url: 'https://example.com',
            createdAt: existingCreatedAt,
            lastActiveAt: existingCreatedAt,
          },
        },
      });
      const tracker = new ActivityTracker(mockStorage);

      await tracker.recordTabActivated(42, 'https://example.com');

      const activity = getState().tabActivity[42];
      expect(activity.lastActiveAt).toBe(FIXED_NOW);
      expect(activity.createdAt).toBe(existingCreatedAt);
    });

    it('creates a new entry if none exists (AC1)', async () => {
      const { mockStorage, getState } = makeMockStorage();
      const tracker = new ActivityTracker(mockStorage);

      await tracker.recordTabActivated(5, 'https://newsite.com');

      const activity = getState().tabActivity[5];
      expect(activity).toBeDefined();
      expect(activity.lastActiveAt).toBe(FIXED_NOW);
    });

    it('updates tabActivityByUrl[url] with the new timestamp (AC5)', async () => {
      const { mockStorage, getState } = makeMockStorage();
      const tracker = new ActivityTracker(mockStorage);

      await tracker.recordTabActivated(7, 'https://reddit.com');

      expect(getState().tabActivityByUrl['https://reddit.com']).toBe(FIXED_NOW);
    });

    it('does not add an entry to tabActivityByUrl when url is empty', async () => {
      const { mockStorage, getState } = makeMockStorage();
      const tracker = new ActivityTracker(mockStorage);

      await tracker.recordTabActivated(8, '');

      expect(Object.keys(getState().tabActivityByUrl)).toHaveLength(0);
    });
  });

  // ── recordTabRemoved ──────────────────────────────────────────────────────

  describe('recordTabRemoved', () => {
    it('deletes tabActivity entry for the removed tab (AC6)', async () => {
      const { mockStorage, getState } = makeMockStorage({
        tabActivity: {
          99: { tabId: 99, url: 'https://foo.com', createdAt: FIXED_NOW, lastActiveAt: FIXED_NOW },
        },
      });
      const tracker = new ActivityTracker(mockStorage);

      await tracker.recordTabRemoved(99);

      expect(getState().tabActivity[99]).toBeUndefined();
    });

    it('preserves tabActivityByUrl entry after tab removal (AC6)', async () => {
      const { mockStorage, getState } = makeMockStorage({
        tabActivity: {
          99: { tabId: 99, url: 'https://foo.com', createdAt: FIXED_NOW, lastActiveAt: FIXED_NOW },
        },
        tabActivityByUrl: { 'https://foo.com': FIXED_NOW },
      });
      const tracker = new ActivityTracker(mockStorage);

      await tracker.recordTabRemoved(99);

      expect(getState().tabActivityByUrl['https://foo.com']).toBe(FIXED_NOW);
    });

    it('does nothing if there is no entry for the tabId (no-op)', async () => {
      const { mockStorage } = makeMockStorage();
      const tracker = new ActivityTracker(mockStorage);

      await tracker.recordTabRemoved(404);

      expect(mockStorage.updateLocalStorage).not.toHaveBeenCalled();
    });
  });

  // ── recordTabUrlUpdated ───────────────────────────────────────────────────

  describe('recordTabUrlUpdated', () => {
    it('updates URL on existing record without changing timestamps', async () => {
      const { mockStorage, getState } = makeMockStorage({
        tabActivity: {
          3: { tabId: 3, url: 'https://old.com', createdAt: FIXED_NOW - 5000, lastActiveAt: FIXED_NOW - 2000 },
        },
      });
      const tracker = new ActivityTracker(mockStorage);

      await tracker.recordTabUrlUpdated(3, 'https://new.com');

      const activity = getState().tabActivity[3];
      expect(activity.url).toBe('https://new.com');
      expect(activity.createdAt).toBe(FIXED_NOW - 5000);
      expect(activity.lastActiveAt).toBe(FIXED_NOW - 2000);
    });

    it('creates a new record if none exists for the tabId', async () => {
      const { mockStorage, getState } = makeMockStorage();
      const tracker = new ActivityTracker(mockStorage);

      await tracker.recordTabUrlUpdated(10, 'https://brand-new.com');

      expect(getState().tabActivity[10]).toBeDefined();
      expect(getState().tabActivity[10].url).toBe('https://brand-new.com');
    });

    it('skips empty URL', async () => {
      const { mockStorage } = makeMockStorage();
      const tracker = new ActivityTracker(mockStorage);

      await tracker.recordTabUrlUpdated(10, '');

      expect(mockStorage.updateLocalStorage).not.toHaveBeenCalled();
    });
  });

  // ── getActivity ───────────────────────────────────────────────────────────

  describe('getActivity', () => {
    it('returns null for an unknown tabId (AC7)', async () => {
      const { mockStorage } = makeMockStorage();
      const tracker = new ActivityTracker(mockStorage);

      const result = await tracker.getActivity(999);

      expect(result).toBeNull();
    });

    it('returns the TabActivity for a known tabId (AC7)', async () => {
      const entry = { tabId: 1, url: 'https://x.com', createdAt: FIXED_NOW, lastActiveAt: FIXED_NOW };
      const { mockStorage } = makeMockStorage({ tabActivity: { 1: entry } });
      const tracker = new ActivityTracker(mockStorage);

      const result = await tracker.getActivity(1);

      expect(result).toEqual(entry);
    });
  });

  // ── getAllActivity ────────────────────────────────────────────────────────

  describe('getAllActivity', () => {
    it('returns the full tabActivity map (AC7)', async () => {
      const entries = {
        1: { tabId: 1, url: 'https://a.com', createdAt: FIXED_NOW, lastActiveAt: FIXED_NOW },
        2: { tabId: 2, url: 'https://b.com', createdAt: FIXED_NOW, lastActiveAt: FIXED_NOW },
      };
      const { mockStorage } = makeMockStorage({ tabActivity: entries });
      const tracker = new ActivityTracker(mockStorage);

      const result = await tracker.getAllActivity();

      expect(result).toEqual(entries);
    });
  });

  // ── getTabAge ─────────────────────────────────────────────────────────────

  describe('getTabAge', () => {
    it('returns null for an unknown tabId (AC7)', async () => {
      const { mockStorage } = makeMockStorage();
      const tracker = new ActivityTracker(mockStorage);

      expect(await tracker.getTabAge(77)).toBeNull();
    });

    it('returns a positive number of milliseconds for a recently created tab (AC7)', async () => {
      const lastActiveAt = FIXED_NOW - 30_000; // 30 seconds ago
      const { mockStorage } = makeMockStorage({
        tabActivity: {
          5: { tabId: 5, url: 'https://example.com', createdAt: lastActiveAt, lastActiveAt },
        },
      });
      const tracker = new ActivityTracker(mockStorage);

      const age = await tracker.getTabAge(5);

      expect(age).toBe(30_000);
    });
  });

  // ── error handling ────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('logs and rethrows when storage fails on recordTabActivated', async () => {
      const mockStorage = {
        getLocalStorage: vi.fn().mockRejectedValue(new Error('storage error')),
        updateLocalStorage: vi.fn(),
      } as unknown as StorageService;

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const tracker = new ActivityTracker(mockStorage);

      await expect(tracker.recordTabActivated(1, 'https://x.com')).rejects.toThrow('storage error');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ActivityTracker]'),
        expect.any(Error),
      );
    });
  });
});
