/**
 * Unit tests for useGroupingRules hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/preact';
import { useGroupingRules } from '../../src/options/hooks/useGroupingRules';
import { STORAGE_KEYS } from '../../src/shared/constants';
import type { GroupingRule } from '../../src/shared/types';

// Track storage change listeners (uses chrome.storage.onChanged with areaName)
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
        // Simulate storage change event with areaName
        const changes: { [key: string]: chrome.storage.StorageChange } = {};
        for (const [key, value] of Object.entries(items)) {
          changes[key] = { newValue: value };
        }
        storageChangeListeners.forEach((listener) => listener(changes, 'sync'));
        return Promise.resolve();
      }),
    },
    // Global onChanged listener (receives areaName as second argument)
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

describe('useGroupingRules', () => {
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
      const { result } = renderHook(() => useGroupingRules());

      expect(result.current.loading).toBe(true);
      expect(result.current.rules).toEqual([]);
    });

    it('should return empty array when storage is empty', async () => {
      const { result } = renderHook(() => useGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.rules).toEqual([]);
    });

    it('should return stored rules when available', async () => {
      const storedRules: GroupingRule[] = [
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
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = storedRules;

      const { result } = renderHook(() => useGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.rules).toEqual(storedRules);
      expect(result.current.rules[0].groupName).toBe('GitHub');
    });
  });

  describe('addRule', () => {
    it('should add a new rule with generated id and order', async () => {
      const { result } = renderHook(() => useGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.addRule({
          pattern: '*.github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
        });
      });

      expect(result.current.rules).toHaveLength(1);
      expect(result.current.rules[0]).toMatchObject({
        pattern: '*.github.com/*',
        patternType: 'glob',
        groupName: 'GitHub',
        groupColor: 'blue',
        enabled: true,
        order: 0,
      });
      expect(result.current.rules[0].id).toBeDefined();
    });

    it('should persist new rule to chrome.storage.sync', async () => {
      const { result } = renderHook(() => useGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.addRule({
          pattern: '*.example.com/*',
          patternType: 'glob',
          groupName: 'Example',
          groupColor: 'green',
        });
      });

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.sync.GROUPING_RULES]: expect.arrayContaining([
          expect.objectContaining({
            pattern: '*.example.com/*',
            groupName: 'Example',
          }),
        ]),
      });
    });

    it('should assign correct order to new rules', async () => {
      const existingRules: GroupingRule[] = [
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
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = existingRules;

      const { result } = renderHook(() => useGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.addRule({
          pattern: '*.gitlab.com/*',
          patternType: 'glob',
          groupName: 'GitLab',
          groupColor: 'orange',
        });
      });

      expect(result.current.rules).toHaveLength(2);
      expect(result.current.rules[1].order).toBe(1);
    });
  });

  describe('updateRule', () => {
    it('should update an existing rule', async () => {
      const existingRules: GroupingRule[] = [
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
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = existingRules;

      const { result } = renderHook(() => useGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateRule('rule-1', { groupName: 'GitHub Updated' });
      });

      expect(result.current.rules[0].groupName).toBe('GitHub Updated');
      expect(result.current.rules[0].pattern).toBe('*.github.com/*'); // Other fields unchanged
    });

    it('should persist updated rule to storage', async () => {
      const existingRules: GroupingRule[] = [
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
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = existingRules;

      const { result } = renderHook(() => useGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateRule('rule-1', { groupColor: 'green' });
      });

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.sync.GROUPING_RULES]: expect.arrayContaining([
          expect.objectContaining({
            id: 'rule-1',
            groupColor: 'green',
          }),
        ]),
      });
    });
  });

  describe('deleteRule', () => {
    it('should remove a rule', async () => {
      const existingRules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*.github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
        {
          id: 'rule-2',
          pattern: '*.gitlab.com/*',
          patternType: 'glob',
          groupName: 'GitLab',
          groupColor: 'orange',
          enabled: true,
          order: 1,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = existingRules;

      const { result } = renderHook(() => useGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.deleteRule('rule-1');
      });

      expect(result.current.rules).toHaveLength(1);
      expect(result.current.rules[0].id).toBe('rule-2');
    });

    it('should recalculate order indices after deletion', async () => {
      const existingRules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*.github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
        {
          id: 'rule-2',
          pattern: '*.gitlab.com/*',
          patternType: 'glob',
          groupName: 'GitLab',
          groupColor: 'orange',
          enabled: true,
          order: 1,
        },
        {
          id: 'rule-3',
          pattern: '*.bitbucket.org/*',
          patternType: 'glob',
          groupName: 'Bitbucket',
          groupColor: 'cyan',
          enabled: true,
          order: 2,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = existingRules;

      const { result } = renderHook(() => useGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.deleteRule('rule-1');
      });

      expect(result.current.rules[0].order).toBe(0);
      expect(result.current.rules[1].order).toBe(1);
    });
  });

  describe('reorderRules', () => {
    it('should move a rule from one position to another', async () => {
      const existingRules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*.github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
        {
          id: 'rule-2',
          pattern: '*.gitlab.com/*',
          patternType: 'glob',
          groupName: 'GitLab',
          groupColor: 'orange',
          enabled: true,
          order: 1,
        },
        {
          id: 'rule-3',
          pattern: '*.bitbucket.org/*',
          patternType: 'glob',
          groupName: 'Bitbucket',
          groupColor: 'cyan',
          enabled: true,
          order: 2,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = existingRules;

      const { result } = renderHook(() => useGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Move rule-3 to the first position
      await act(async () => {
        await result.current.reorderRules(2, 0);
      });

      expect(result.current.rules[0].id).toBe('rule-3');
      expect(result.current.rules[1].id).toBe('rule-1');
      expect(result.current.rules[2].id).toBe('rule-2');
    });

    it('should update order properties after reorder', async () => {
      const existingRules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*.github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
        {
          id: 'rule-2',
          pattern: '*.gitlab.com/*',
          patternType: 'glob',
          groupName: 'GitLab',
          groupColor: 'orange',
          enabled: true,
          order: 1,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = existingRules;

      const { result } = renderHook(() => useGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Swap positions
      await act(async () => {
        await result.current.reorderRules(1, 0);
      });

      expect(result.current.rules[0].order).toBe(0);
      expect(result.current.rules[1].order).toBe(1);
    });
  });

  describe('storage change listener', () => {
    it('should update local state when storage changes externally', async () => {
      const { result } = renderHook(() => useGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simulate external storage change (e.g., from popup toggle)
      const newRules: GroupingRule[] = [
        {
          id: 'external-rule',
          pattern: '*.external.com/*',
          patternType: 'glob',
          groupName: 'External',
          groupColor: 'purple',
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

      expect(result.current.rules).toEqual(newRules);
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

      const { result } = renderHook(() => useGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

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
      expect(result.current.rules).toEqual(initialRules);
    });

    it('should remove listener on unmount', async () => {
      const { result, unmount } = renderHook(() => useGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(chrome.storage.onChanged.addListener).toHaveBeenCalled();

      unmount();

      expect(chrome.storage.onChanged.removeListener).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should fall back to empty array on storage read error', async () => {
      // Make storage.get reject
      vi.mocked(chrome.storage.sync.get).mockRejectedValueOnce(new Error('Storage error'));

      const { result } = renderHook(() => useGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should fall back to empty array
      expect(result.current.rules).toEqual([]);
    });

    it('should rollback optimistic update when addRule fails', async () => {
      const existingRules: GroupingRule[] = [
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
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = existingRules;

      const { result } = renderHook(() => useGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Make storage.set fail
      vi.mocked(chrome.storage.sync.set).mockRejectedValueOnce(new Error('Storage write error'));

      await act(async () => {
        try {
          await result.current.addRule({
            pattern: '*.example.com/*',
            patternType: 'glob',
            groupName: 'Example',
            groupColor: 'green',
          });
        } catch {
          // Expected to throw
        }
      });

      // Should rollback to original state
      expect(result.current.rules).toHaveLength(1);
      expect(result.current.rules[0].id).toBe('rule-1');
    });

    it('should use previous state when rollback re-read also fails', async () => {
      const existingRules: GroupingRule[] = [
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
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = existingRules;

      const { result } = renderHook(() => useGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // First get (in try block) succeeds, set fails, second get (in rollback catch) fails
      vi.mocked(chrome.storage.sync.get)
        .mockResolvedValueOnce({ [STORAGE_KEYS.sync.GROUPING_RULES]: existingRules }) // First get in try block
        .mockRejectedValueOnce(new Error('Storage read error')); // Second get in rollback catch
      vi.mocked(chrome.storage.sync.set).mockRejectedValueOnce(new Error('Storage write error'));

      await act(async () => {
        try {
          await result.current.addRule({
            pattern: '*.example.com/*',
            patternType: 'glob',
            groupName: 'Example',
            groupColor: 'green',
          });
        } catch {
          // Expected to throw
        }
      });

      // Should use previous state as fallback
      expect(result.current.rules).toHaveLength(1);
      expect(result.current.rules[0].id).toBe('rule-1');
    });

    it('should preserve original error when rollback fails', async () => {
      const existingRules: GroupingRule[] = [
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
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = existingRules;

      const { result } = renderHook(() => useGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const originalError = new Error('Original storage write error');
      // First get (in try block) succeeds, set fails, second get (in rollback catch) fails
      vi.mocked(chrome.storage.sync.get)
        .mockResolvedValueOnce({ [STORAGE_KEYS.sync.GROUPING_RULES]: existingRules }) // First get in try block
        .mockRejectedValueOnce(new Error('Rollback error')); // Second get in rollback catch
      vi.mocked(chrome.storage.sync.set).mockRejectedValueOnce(originalError);

      await act(async () => {
        try {
          await result.current.addRule({
            pattern: '*.example.com/*',
            patternType: 'glob',
            groupName: 'Example',
            groupColor: 'green',
          });
          throw new Error('Should have thrown');
        } catch (error) {
          // Should throw the original error, not the rollback error
          expect(error).toBe(originalError);
        }
      });
    });
  });

  describe('normalizeRules stability', () => {
    it('should have deterministic ordering when order values are tied', async () => {
      // Rules with duplicate order values - should be sorted by ID as tie-breaker
      const rulesWithDuplicateOrder: GroupingRule[] = [
        {
          id: 'rule-c',
          pattern: '*.c.com/*',
          patternType: 'glob',
          groupName: 'C',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
        {
          id: 'rule-a',
          pattern: '*.a.com/*',
          patternType: 'glob',
          groupName: 'A',
          groupColor: 'green',
          enabled: true,
          order: 0,
        },
        {
          id: 'rule-b',
          pattern: '*.b.com/*',
          patternType: 'glob',
          groupName: 'B',
          groupColor: 'red',
          enabled: true,
          order: 0,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = rulesWithDuplicateOrder;

      const { result } = renderHook(() => useGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should be sorted deterministically by ID when order is tied
      expect(result.current.rules[0].id).toBe('rule-a');
      expect(result.current.rules[1].id).toBe('rule-b');
      expect(result.current.rules[2].id).toBe('rule-c');
      
      // Order should be recalculated sequentially
      expect(result.current.rules[0].order).toBe(0);
      expect(result.current.rules[1].order).toBe(1);
      expect(result.current.rules[2].order).toBe(2);
    });

    it('should handle missing order property with deterministic fallback', async () => {
      const rulesWithMissingOrder: GroupingRule[] = [
        {
          id: 'rule-z',
          pattern: '*.z.com/*',
          patternType: 'glob',
          groupName: 'Z',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
        {
          id: 'rule-a',
          pattern: '*.a.com/*',
          patternType: 'glob',
          groupName: 'A',
          groupColor: 'green',
          enabled: true,
          order: undefined as unknown as number, // Missing order
        },
        {
          id: 'rule-b',
          pattern: '*.b.com/*',
          patternType: 'glob',
          groupName: 'B',
          groupColor: 'red',
          enabled: true,
          order: undefined as unknown as number, // Missing order
        },
      ];
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = rulesWithMissingOrder;

      const { result } = renderHook(() => useGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Valid order should come first
      expect(result.current.rules[0].id).toBe('rule-z');
      // Missing orders should be sorted by ID
      expect(result.current.rules[1].id).toBe('rule-a');
      expect(result.current.rules[2].id).toBe('rule-b');
    });
  });

  describe('ID-based reorder correctness', () => {
    it('should reorder by ID even when storage changes before operation completes', async () => {
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
        {
          id: 'rule-2',
          pattern: '*.gitlab.com/*',
          patternType: 'glob',
          groupName: 'GitLab',
          groupColor: 'orange',
          enabled: true,
          order: 1,
        },
        {
          id: 'rule-3',
          pattern: '*.bitbucket.org/*',
          patternType: 'glob',
          groupName: 'Bitbucket',
          groupColor: 'cyan',
          enabled: true,
          order: 2,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = initialRules;

      const { result } = renderHook(() => useGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Capture the rule at index 2 that we want to move
      const ruleToMove = result.current.rules[2];
      expect(ruleToMove.id).toBe('rule-3');

      // Simulate external storage update that changes order before our reorder completes
      // This modifies storage directly to simulate a concurrent update
      const modifiedRules: GroupingRule[] = [
        initialRules[0],
        {
          id: 'rule-new',
          pattern: '*.new.com/*',
          patternType: 'glob',
          groupName: 'New',
          groupColor: 'pink',
          enabled: true,
          order: 1,
        },
        initialRules[1],
        initialRules[2],
      ];

      // Update storage before our reorder operation reads it
      vi.mocked(chrome.storage.sync.get).mockResolvedValueOnce({
        [STORAGE_KEYS.sync.GROUPING_RULES]: modifiedRules,
      });

      // Try to move rule-3 from index 2 to index 0
      await act(async () => {
        await result.current.reorderRules(2, 0);
      });

      // Should have moved rule-3 (by ID), not whatever was at index 2 in the modified storage
      const finalRules = mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] as GroupingRule[];
      expect(finalRules[0].id).toBe('rule-3'); // rule-3 should be at the front
      expect(finalRules.find((r) => r.id === 'rule-3')).toBeDefined();
    });

    it('should handle reorder when rule is not found in storage', async () => {
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
        {
          id: 'rule-2',
          pattern: '*.gitlab.com/*',
          patternType: 'glob',
          groupName: 'GitLab',
          groupColor: 'orange',
          enabled: true,
          order: 1,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = initialRules;

      const { result } = renderHook(() => useGroupingRules());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simulate storage changing to remove the rule we're trying to move
      vi.mocked(chrome.storage.sync.get).mockResolvedValueOnce({
        [STORAGE_KEYS.sync.GROUPING_RULES]: [initialRules[0]], // rule-2 removed
      });

      // Try to move rule-2 (index 1) which will be missing in storage
      await act(async () => {
        try {
          await result.current.reorderRules(1, 0);
          throw new Error('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain('not found');
        }
      });
    });
  });
});


