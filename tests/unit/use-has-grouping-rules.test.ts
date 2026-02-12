/**
 * Unit tests for useHasGroupingRules hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/preact';
import { useHasGroupingRules } from '../../src/popup/hooks/useHasGroupingRules';
import { STORAGE_KEYS } from '../../src/shared/constants';
import type { GroupingRule } from '../../src/shared/types';

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

describe('useHasGroupingRules', () => {
  beforeEach(() => {
    // Clear mock storage
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    storageChangeListeners = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    storageChangeListeners = [];
  });

  describe('initial loading', () => {
    it('should return loading=true initially', () => {
      const { result } = renderHook(() => useHasGroupingRules());

      expect(result.current.loading).toBe(true);
      expect(result.current.hasRules).toBe(false);
    });

    it('should return hasRules=false when storage is empty', async () => {
      const { result } = renderHook(() => useHasGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasRules).toBe(false);
    });

    it('should return hasRules=true when enabled rules exist', async () => {
      const enabledRules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*.github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = enabledRules;

      const { result } = renderHook(() => useHasGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasRules).toBe(true);
    });

    it('should return hasRules=false when only disabled rules exist', async () => {
      const disabledRules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*.github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: false,
          order: 0,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = disabledRules;

      const { result } = renderHook(() => useHasGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasRules).toBe(false);
    });

    it('should treat missing enabled field as true (enabled by default)', async () => {
      const rulesWithMissingEnabled: Partial<GroupingRule>[] = [
        {
          id: 'rule-1',
          pattern: '*.github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          order: 0,
          // enabled field missing - should default to true
        } as GroupingRule,
      ];
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = rulesWithMissingEnabled;

      const { result } = renderHook(() => useHasGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasRules).toBe(true);
    });
  });

  describe('storage change listener', () => {
    it('should update hasRules when rules are added', async () => {
      const { result } = renderHook(() => useHasGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasRules).toBe(false);

      // Add rules via storage change
      const newRules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*.github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
      ];

      act(() => {
        storageChangeListeners.forEach((listener) => {
          listener(
            { [STORAGE_KEYS.sync.GROUPING_RULES]: { newValue: newRules } },
            'sync'
          );
        });
      });

      expect(result.current.hasRules).toBe(true);
    });

    it('should update hasRules when rules are removed', async () => {
      const initialRules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*.github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = initialRules;

      const { result } = renderHook(() => useHasGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasRules).toBe(true);

      // Remove all rules
      act(() => {
        storageChangeListeners.forEach((listener) => {
          listener(
            { [STORAGE_KEYS.sync.GROUPING_RULES]: { newValue: [] } },
            'sync'
          );
        });
      });

      expect(result.current.hasRules).toBe(false);
    });

    it('should update hasRules when all rules are disabled', async () => {
      const initialRules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*.github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = initialRules;

      const { result } = renderHook(() => useHasGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasRules).toBe(true);

      // Disable the rule
      const disabledRules: GroupingRule[] = [
        {
          ...initialRules[0],
          enabled: false,
        },
      ];

      act(() => {
        storageChangeListeners.forEach((listener) => {
          listener(
            { [STORAGE_KEYS.sync.GROUPING_RULES]: { newValue: disabledRules } },
            'sync'
          );
        });
      });

      expect(result.current.hasRules).toBe(false);
    });

    it('should ignore changes from non-sync storage areas', async () => {
      const initialRules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*.github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = initialRules;

      const { result } = renderHook(() => useHasGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasRules).toBe(true);

      // Simulate change from 'local' storage (should be ignored)
      act(() => {
        storageChangeListeners.forEach((listener) => {
          listener(
            { [STORAGE_KEYS.sync.GROUPING_RULES]: { newValue: [] } },
            'local' // Different area - should be ignored
          );
        });
      });

      // Should remain unchanged
      expect(result.current.hasRules).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should fall back to hasRules=false on storage read error', async () => {
      // Make storage.get reject
      vi.mocked(chrome.storage.sync.get).mockRejectedValueOnce(new Error('Storage error'));

      const { result } = renderHook(() => useHasGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should fall back to false
      expect(result.current.hasRules).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should remove listener on unmount', async () => {
      const { result, unmount } = renderHook(() => useHasGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(chrome.storage.onChanged.addListener).toHaveBeenCalled();

      unmount();

      expect(chrome.storage.onChanged.removeListener).toHaveBeenCalled();
    });
  });
});
