/**
 * Unit tests for useAutoCloseRules hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/preact';
import { useAutoCloseRules } from '../../src/options/hooks/useAutoCloseRules';
import { STORAGE_KEYS } from '../../src/shared/constants';
import type { AutoCloseRule } from '../../src/shared/types';

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

describe('useAutoCloseRules', () => {
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
      const { result } = renderHook(() => useAutoCloseRules());

      expect(result.current.loading).toBe(true);
      expect(result.current.rules).toEqual([]);
    });

    it('should return empty array when storage is empty', async () => {
      const { result } = renderHook(() => useAutoCloseRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.rules).toEqual([]);
    });

    it('should return stored rules when available', async () => {
      const storedRules: AutoCloseRule[] = [
        {
          id: 'rule-1',
          pattern: '*.reddit.com/*',
          patternType: 'glob',
          maxAge: 7200000, // 2 hours
          enabled: true,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.AUTO_CLOSE_RULES] = storedRules;

      const { result } = renderHook(() => useAutoCloseRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.rules).toEqual(storedRules);
      expect(result.current.rules[0].pattern).toBe('*.reddit.com/*');
    });

    it('should normalize missing enabled field to true (AC8)', async () => {
      const storedRules: Partial<AutoCloseRule>[] = [
        {
          id: 'rule-1',
          pattern: '*.reddit.com/*',
          patternType: 'glob',
          maxAge: 7200000,
          // enabled field missing
        },
      ];
      mockStorage[STORAGE_KEYS.sync.AUTO_CLOSE_RULES] = storedRules;

      const { result } = renderHook(() => useAutoCloseRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.rules[0].enabled).toBe(true);
    });
  });

  describe('addRule', () => {
    it('should add a new rule with generated id and enabled=true', async () => {
      const { result } = renderHook(() => useAutoCloseRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.addRule({
          pattern: '*.reddit.com/*',
          patternType: 'glob',
          maxAge: 7200000, // 2 hours
        });
      });

      expect(result.current.rules).toHaveLength(1);
      expect(result.current.rules[0]).toMatchObject({
        pattern: '*.reddit.com/*',
        patternType: 'glob',
        maxAge: 7200000,
        enabled: true,
      });
      expect(result.current.rules[0].id).toBeDefined();
    });

    it('should persist new rule to chrome.storage.sync', async () => {
      const { result } = renderHook(() => useAutoCloseRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.addRule({
          pattern: '*.reddit.com/*',
          patternType: 'glob',
          maxAge: 7200000,
        });
      });

      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({
          [STORAGE_KEYS.sync.AUTO_CLOSE_RULES]: expect.arrayContaining([
            expect.objectContaining({
              pattern: '*.reddit.com/*',
            }),
          ]),
        })
      );
    });
  });

  describe('updateRule', () => {
    it('should update an existing rule', async () => {
      const storedRules: AutoCloseRule[] = [
        {
          id: 'rule-1',
          pattern: '*.reddit.com/*',
          patternType: 'glob',
          maxAge: 7200000,
          enabled: true,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.AUTO_CLOSE_RULES] = storedRules;

      const { result } = renderHook(() => useAutoCloseRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateRule('rule-1', {
          maxAge: 3600000, // Change to 1 hour
        });
      });

      expect(result.current.rules[0].maxAge).toBe(3600000);
    });
  });

  describe('deleteRule', () => {
    it('should delete a rule', async () => {
      const storedRules: AutoCloseRule[] = [
        {
          id: 'rule-1',
          pattern: '*.reddit.com/*',
          patternType: 'glob',
          maxAge: 7200000,
          enabled: true,
        },
        {
          id: 'rule-2',
          pattern: '*.twitter.com/*',
          patternType: 'glob',
          maxAge: 3600000,
          enabled: true,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.AUTO_CLOSE_RULES] = storedRules;

      const { result } = renderHook(() => useAutoCloseRules());

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
    it('should toggle enabled status (AC9)', async () => {
      const storedRules: AutoCloseRule[] = [
        {
          id: 'rule-1',
          pattern: '*.reddit.com/*',
          patternType: 'glob',
          maxAge: 7200000,
          enabled: true,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.AUTO_CLOSE_RULES] = storedRules;

      const { result } = renderHook(() => useAutoCloseRules());

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
});
