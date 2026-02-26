/**
 * Unit tests for useWhitelistRules hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/preact';
import { useWhitelistRules } from '../../src/options/hooks/useWhitelistRules';
import { STORAGE_KEYS } from '../../src/shared/constants';
import type { WhitelistRule } from '../../src/shared/types';

// Track storage change listeners
let storageChangeListeners: ((
  changes: { [key: string]: chrome.storage.StorageChange },
  areaName: string
) => void)[] = [];

// Mock chrome.storage
const mockStorage: Record<string, unknown> = {};

vi.stubGlobal('chrome', {
  storage: {
    sync: {
      get: vi.fn().mockImplementation((keys: string | string[]) => {
        const keyArray = typeof keys === 'string' ? [keys] : keys;
        const result: Record<string, unknown> = {};
        for (const key of keyArray) {
          if (mockStorage[key] !== undefined) {
            result[key] = mockStorage[key];
          }
        }
        return Promise.resolve(result);
      }),
      set: vi.fn().mockImplementation((items: Record<string, unknown>) => {
        Object.assign(mockStorage, items);
        const changes: { [key: string]: chrome.storage.StorageChange } = {};
        for (const [key, value] of Object.entries(items)) {
          changes[key] = { newValue: value };
        }
        storageChangeListeners.forEach((listener) => listener(changes, 'sync'));
        return Promise.resolve();
      }),
    },
    onChanged: {
      addListener: vi.fn().mockImplementation((listener) => {
        storageChangeListeners.push(listener);
      }),
      removeListener: vi.fn().mockImplementation((listener) => {
        storageChangeListeners = storageChangeListeners.filter((l) => l !== listener);
      }),
    },
  },
});

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-' + Math.random().toString(36).slice(2, 11)),
}));

describe('useWhitelistRules', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    storageChangeListeners = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    storageChangeListeners = [];
  });

  describe('initial loading', () => {
    it('should return loading=true initially', () => {
      const { result } = renderHook(() => useWhitelistRules());

      expect(result.current.loading).toBe(true);
      expect(result.current.rules).toEqual([]);
    });

    it('should return empty array when storage is empty', async () => {
      const { result } = renderHook(() => useWhitelistRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.rules).toEqual([]);
    });

    it('should load rules from chrome.storage.sync on mount (AC8)', async () => {
      const storedRules: WhitelistRule[] = [
        {
          id: 'rule-1',
          pattern: '*.reddit.com/*',
          patternType: 'glob',
          enabled: true,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.WHITELIST_RULES] = storedRules;

      const { result } = renderHook(() => useWhitelistRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.rules).toEqual(storedRules);
      expect(result.current.rules[0].pattern).toBe('*.reddit.com/*');
    });

    it('should normalize missing enabled field to true (AC9)', async () => {
      const storedRules: Partial<WhitelistRule>[] = [
        {
          id: 'rule-1',
          pattern: '*.reddit.com/*',
          patternType: 'glob',
          // enabled field missing
        },
      ];
      mockStorage[STORAGE_KEYS.sync.WHITELIST_RULES] = storedRules;

      const { result } = renderHook(() => useWhitelistRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.rules[0].enabled).toBe(true);
    });
  });

  describe('addRule', () => {
    it('should add a new rule with generated id and enabled=true (AC8)', async () => {
      const { result } = renderHook(() => useWhitelistRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.addRule({
          pattern: '*.reddit.com/*',
          patternType: 'glob',
        });
      });

      expect(result.current.rules).toHaveLength(1);
      expect(result.current.rules[0]).toMatchObject({
        pattern: '*.reddit.com/*',
        patternType: 'glob',
        enabled: true,
      });
      expect(result.current.rules[0].id).toBeDefined();
    });

    it('should optimistically update state and persist to storage (AC8)', async () => {
      const { result } = renderHook(() => useWhitelistRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.addRule({
          pattern: '*.reddit.com/*',
          patternType: 'glob',
        });
      });

      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({
          [STORAGE_KEYS.sync.WHITELIST_RULES]: expect.arrayContaining([
            expect.objectContaining({
              pattern: '*.reddit.com/*',
            }),
          ]),
        })
      );
    });
  });

  describe('deleteRule', () => {
    it('should remove rule by ID (AC6)', async () => {
      const storedRules: WhitelistRule[] = [
        {
          id: 'rule-1',
          pattern: '*.reddit.com/*',
          patternType: 'glob',
          enabled: true,
        },
        {
          id: 'rule-2',
          pattern: '*.twitter.com/*',
          patternType: 'glob',
          enabled: true,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.WHITELIST_RULES] = storedRules;

      const { result } = renderHook(() => useWhitelistRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.rules).toHaveLength(2);

      await act(async () => {
        await result.current.deleteRule('rule-1');
      });

      expect(result.current.rules).toHaveLength(1);
      expect(result.current.rules[0].id).toBe('rule-2');
    });
  });

  describe('toggleEnabled', () => {
    it('should flip enabled state (AC9)', async () => {
      const storedRules: WhitelistRule[] = [
        {
          id: 'rule-1',
          pattern: '*.reddit.com/*',
          patternType: 'glob',
          enabled: true,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.WHITELIST_RULES] = storedRules;

      const { result } = renderHook(() => useWhitelistRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.rules[0].enabled).toBe(true);

      await act(async () => {
        await result.current.toggleEnabled('rule-1');
      });

      expect(result.current.rules[0].enabled).toBe(false);

      await act(async () => {
        await result.current.toggleEnabled('rule-1');
      });

      expect(result.current.rules[0].enabled).toBe(true);
    });
  });

  describe('reorderRules', () => {
    it('should swap two rules by index (AC2)', async () => {
      const storedRules: WhitelistRule[] = [
        { id: 'rule-1', pattern: '*.reddit.com/*', patternType: 'glob', enabled: true },
        { id: 'rule-2', pattern: '*.twitter.com/*', patternType: 'glob', enabled: true },
        { id: 'rule-3', pattern: '*.github.com/*', patternType: 'glob', enabled: true },
      ];
      mockStorage[STORAGE_KEYS.sync.WHITELIST_RULES] = storedRules;

      const { result } = renderHook(() => useWhitelistRules());
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.reorderRules(0, 2);
      });

      expect(result.current.rules[0].id).toBe('rule-2');
      expect(result.current.rules[1].id).toBe('rule-3');
      expect(result.current.rules[2].id).toBe('rule-1');
    });

    it('should persist reordered rules to storage (AC2)', async () => {
      const storedRules: WhitelistRule[] = [
        { id: 'rule-1', pattern: '*.reddit.com/*', patternType: 'glob', enabled: true },
        { id: 'rule-2', pattern: '*.twitter.com/*', patternType: 'glob', enabled: true },
      ];
      mockStorage[STORAGE_KEYS.sync.WHITELIST_RULES] = storedRules;

      const { result } = renderHook(() => useWhitelistRules());
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.reorderRules(0, 1);
      });

      expect(chrome.storage.sync.set).toHaveBeenLastCalledWith(
        expect.objectContaining({
          [STORAGE_KEYS.sync.WHITELIST_RULES]: [
            expect.objectContaining({ id: 'rule-2' }),
            expect.objectContaining({ id: 'rule-1' }),
          ],
        })
      );
    });
  });

  describe('chrome.storage.onChanged listener', () => {
    it('should update state from external storage changes (AC8)', async () => {
      const { result } = renderHook(() => useWhitelistRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.rules).toHaveLength(0);

      const newRules: WhitelistRule[] = [
        { id: 'rule-ext', pattern: '*.external.com/*', patternType: 'glob', enabled: true },
      ];

      act(() => {
        storageChangeListeners.forEach((listener) =>
          listener(
            { [STORAGE_KEYS.sync.WHITELIST_RULES]: { newValue: newRules } },
            'sync'
          )
        );
      });

      await waitFor(() => {
        expect(result.current.rules).toHaveLength(1);
      });

      expect(result.current.rules[0].pattern).toBe('*.external.com/*');
    });

    it('should ignore changes from non-sync areas', async () => {
      const { result } = renderHook(() => useWhitelistRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const newRules: WhitelistRule[] = [
        { id: 'rule-local', pattern: '*.local.com/*', patternType: 'glob', enabled: true },
      ];

      act(() => {
        storageChangeListeners.forEach((listener) =>
          listener(
            { [STORAGE_KEYS.sync.WHITELIST_RULES]: { newValue: newRules } },
            'local'
          )
        );
      });

      expect(result.current.rules).toHaveLength(0);
    });
  });

  describe('addRule with custom enabled', () => {
    it('should add a rule with enabled=false when specified (AC9)', async () => {
      const { result } = renderHook(() => useWhitelistRules());
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.addRule({
          pattern: '*.reddit.com/*',
          patternType: 'glob',
          enabled: false,
        });
      });

      expect(result.current.rules[0].enabled).toBe(false);
    });
  });
});
