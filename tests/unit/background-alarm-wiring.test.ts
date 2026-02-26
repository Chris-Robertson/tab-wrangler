/**
 * Tests for background/index.ts alarm event wiring.
 * Verifies that ALARM_AUTO_CLOSE_CHECK triggers AutoCloseScheduler.runCheck()
 * and that unrelated alarms are ignored.
 *
 * Each test file runs in an isolated Vitest worker with its own module cache,
 * so the background module is fresh here and independent of background-tab-wiring.test.ts.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { ALARM_AUTO_CLOSE_CHECK } from '../../src/shared/constants';

// ── Shared mock instances ────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  scheduler: {
    runCheck: vi.fn().mockResolvedValue({ closedCount: 0, errors: [] }),
  },
  storage: {
    initializeDefaults: vi.fn().mockResolvedValue(undefined),
    getSettings: vi.fn().mockResolvedValue({ autoCloseEnabled: false, autoGroupEnabled: false }),
    getLocalStorage: vi.fn().mockResolvedValue({ tabActivity: {}, recentlyClosed: [], tabActivityByUrl: {} }),
    updateLocalStorage: vi.fn().mockResolvedValue(undefined),
    getAutoCloseRules: vi.fn().mockResolvedValue([]),
    getWhitelistRules: vi.fn().mockResolvedValue([]),
  },
  tracker: {
    recordTabCreated: vi.fn().mockResolvedValue(undefined),
    recordTabActivated: vi.fn().mockResolvedValue(undefined),
    recordTabUrlUpdated: vi.fn().mockResolvedValue(undefined),
    recordTabRemoved: vi.fn().mockResolvedValue(undefined),
    getActivity: vi.fn().mockResolvedValue(null),
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

// ── Module mocks ──────────────────────────────────────────────────────────

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

vi.mock('../../src/background/modules/auto-close-scheduler', () => ({
  AutoCloseScheduler: vi.fn(function () { return mocks.scheduler; }),
}));

vi.mock('../../src/shared/messaging', () => ({
  isMessage: vi.fn().mockReturnValue(false),
}));

// ── Alarm listener capture ─────────────────────────────────────────────────

type AlarmListener = (alarm: chrome.alarms.Alarm) => Promise<void>;
let onAlarmListener: AlarmListener | undefined;

// ── Setup ─────────────────────────────────────────────────────────────────

beforeAll(async () => {
  global.chrome = {
    tabs: {
      onCreated: { addListener: vi.fn() },
      onActivated: { addListener: vi.fn() },
      onUpdated: { addListener: vi.fn() },
      onRemoved: { addListener: vi.fn() },
      get: vi.fn().mockResolvedValue({ id: 1, url: 'https://example.com', windowId: 1 }),
      query: vi.fn().mockResolvedValue([]),
    },
    runtime: {
      onInstalled: { addListener: vi.fn() },
      onStartup: { addListener: vi.fn() },
      onMessage: { addListener: vi.fn() },
    },
    alarms: {
      onAlarm: {
        addListener: vi.fn((cb: AlarmListener) => {
          onAlarmListener = cb;
        }),
      },
      create: vi.fn(),
      clear: vi.fn(),
    },
    tabGroups: {
      query: vi.fn().mockResolvedValue([]),
    },
  } as unknown as typeof chrome;

  await import('../../src/background/index');
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.scheduler.runCheck.mockResolvedValue({ closedCount: 0, errors: [] });
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Background alarm event wiring', () => {
  it('calls autoCloseScheduler.runCheck() when ALARM_AUTO_CLOSE_CHECK fires', async () => {
    await onAlarmListener!({ name: ALARM_AUTO_CLOSE_CHECK } as chrome.alarms.Alarm);

    expect(mocks.scheduler.runCheck).toHaveBeenCalledOnce();
  });

  it('does NOT call runCheck() for an unrelated alarm name', async () => {
    await onAlarmListener!({ name: 'cleanup-recently-closed' } as chrome.alarms.Alarm);
    await onAlarmListener!({ name: 'some-unknown-alarm' } as chrome.alarms.Alarm);

    expect(mocks.scheduler.runCheck).not.toHaveBeenCalled();
  });

  it('logs the closed count when runCheck returns closedCount > 0', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mocks.scheduler.runCheck.mockResolvedValue({ closedCount: 3, errors: [] });

    await onAlarmListener!({ name: ALARM_AUTO_CLOSE_CHECK } as chrome.alarms.Alarm);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('3'));
    consoleSpy.mockRestore();
  });

  it('does NOT log anything when runCheck returns closedCount of 0', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mocks.scheduler.runCheck.mockResolvedValue({ closedCount: 0, errors: [] });

    await onAlarmListener!({ name: ALARM_AUTO_CLOSE_CHECK } as chrome.alarms.Alarm);

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('handles runCheck() throwing without propagating the error to the caller', async () => {
    mocks.scheduler.runCheck.mockRejectedValueOnce(new Error('Unexpected storage failure'));

    await expect(
      onAlarmListener!({ name: ALARM_AUTO_CLOSE_CHECK } as chrome.alarms.Alarm),
    ).resolves.toBeUndefined();
  });
});
