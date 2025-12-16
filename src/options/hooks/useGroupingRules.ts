/**
 * Hook for managing grouping rules in the Options page
 * Reads from chrome.storage.sync and listens for changes
 */

import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import type { GroupingRule, PatternType, TabGroupColor } from '../../shared/types';
import { STORAGE_KEYS } from '../../shared/constants';
import { generateId } from '../../shared/utils/id-utils';

/** Input type for adding a new rule (without auto-generated fields) */
export type NewRuleInput = {
  pattern: string;
  patternType: PatternType;
  groupName: string;
  groupColor: TabGroupColor;
};

interface UseGroupingRulesReturn {
  rules: GroupingRule[];
  loading: boolean;
  addRule: (rule: NewRuleInput) => Promise<void>;
  updateRule: (id: string, updates: Partial<GroupingRule>) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  reorderRules: (fromIndex: number, toIndex: number) => Promise<void>;
}

/**
 * Normalizes rules by sorting by order property and recalculating indices.
 * This handles corrupted/migrated data where order values may be invalid.
 * Uses ID as tie-breaker for stable, deterministic ordering.
 */
function normalizeRules(rules: GroupingRule[]): GroupingRule[] {
  // Sort by order property (fallback to original index if missing/invalid)
  // Use ID as tie-breaker for deterministic ordering when order values are equal
  const sorted = [...rules].sort((a, b) => {
    const orderA = typeof a.order === 'number' ? a.order : Infinity;
    const orderB = typeof b.order === 'number' ? b.order : Infinity;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    // Stable tie-breaker: sort by ID
    return a.id.localeCompare(b.id);
  });
  // Recalculate order indices to ensure they're sequential 0, 1, 2, ...
  return sorted.map((rule, index) => ({ ...rule, order: index }));
}

/**
 * Fetches the latest rules from storage
 */
async function getLatestRulesFromStorage(): Promise<GroupingRule[]> {
  const result = await chrome.storage.sync.get(STORAGE_KEYS.sync.GROUPING_RULES);
  const stored = result[STORAGE_KEYS.sync.GROUPING_RULES] as GroupingRule[] | undefined;
  return normalizeRules(stored ?? []);
}

export function useGroupingRules(): UseGroupingRulesReturn {
  const [rules, setRules] = useState<GroupingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const rulesRef = useRef<GroupingRule[]>([]);

  const setRulesWithRef = useCallback(
    (updater: GroupingRule[] | ((current: GroupingRule[]) => GroupingRule[])) => {
      setRules((current) => {
        const next = typeof updater === 'function' ? (updater as (c: GroupingRule[]) => GroupingRule[])(current) : updater;
        rulesRef.current = next;
        return next;
      });
    },
    []
  );

  useEffect(() => {
    // Load rules on mount
    const loadRules = async () => {
      try {
        const normalized = await getLatestRulesFromStorage();
        setRulesWithRef(normalized);
      } catch (error) {
        console.error('[useGroupingRules] Failed to load rules:', error);
        setRulesWithRef([]);
      } finally {
        setLoading(false);
      }
    };

    loadRules();

    // Listen for storage changes from other contexts (popup, background, other tabs)
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName !== 'sync') return;
      if (changes[STORAGE_KEYS.sync.GROUPING_RULES]) {
        const newValue = changes[STORAGE_KEYS.sync.GROUPING_RULES].newValue as GroupingRule[] | undefined;
        setRulesWithRef(normalizeRules(newValue ?? []));
      }
    };

    chrome.storage.onChanged.addListener(listener);

    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }, [setRulesWithRef]);

  const addRule = useCallback(async (rule: NewRuleInput): Promise<void> => {
    // Optimistically update local state immediately for responsive UI
    const previousState = rulesRef.current;
    const tempRule: GroupingRule = {
      ...rule,
      id: generateId(),
      order: previousState.length,
      enabled: true,
    };
    setRulesWithRef((current) => [...current, tempRule]);

    try {
      // Get current rules from storage to ensure we have the latest (avoid lost updates)
      const latestRules = await getLatestRulesFromStorage();
      const newRule: GroupingRule = {
        ...rule,
        id: tempRule.id,
        order: latestRules.length,
        enabled: true,
      };
      const updated = [...latestRules, newRule];
      await chrome.storage.sync.set({ [STORAGE_KEYS.sync.GROUPING_RULES]: updated });
    } catch (error) {
      console.error('[useGroupingRules] Failed to add rule:', error);
      // Rollback optimistic update on failure
      // Try to re-read from storage, but if that fails, use previous state
      try {
        const reverted = await getLatestRulesFromStorage();
        setRulesWithRef(reverted);
      } catch (rollbackError) {
        console.error('[useGroupingRules] Rollback failed, reverting to previous state:', rollbackError);
        setRulesWithRef(previousState);
      }
      throw error; // Preserve original error
    }
  }, [setRulesWithRef]);

  const updateRule = useCallback(async (id: string, updates: Partial<GroupingRule>): Promise<void> => {
    // Optimistically update local state
    const previousState = rulesRef.current;
    setRulesWithRef((current) => current.map((r) => (r.id === id ? { ...r, ...updates } : r)));

    try {
      // Get current rules from storage to ensure we have the latest
      const latestRules = await getLatestRulesFromStorage();
      const updated = latestRules.map((r) => (r.id === id ? { ...r, ...updates } : r));
      await chrome.storage.sync.set({ [STORAGE_KEYS.sync.GROUPING_RULES]: updated });
    } catch (error) {
      console.error('[useGroupingRules] Failed to update rule:', error);
      // Rollback optimistic update on failure
      try {
        const reverted = await getLatestRulesFromStorage();
        setRulesWithRef(reverted);
      } catch (rollbackError) {
        console.error('[useGroupingRules] Rollback failed, reverting to previous state:', rollbackError);
        setRulesWithRef(previousState);
      }
      throw error; // Preserve original error
    }
  }, [setRulesWithRef]);

  const deleteRule = useCallback(async (id: string): Promise<void> => {
    // Optimistically update local state
    const previousState = rulesRef.current;
    setRulesWithRef((current) => {
      const filtered = current.filter((r) => r.id !== id);
      return filtered.map((r, i) => ({ ...r, order: i }));
    });

    try {
      // Get current rules from storage to ensure we have the latest
      const latestRules = await getLatestRulesFromStorage();
      const filtered = latestRules.filter((r) => r.id !== id);
      // Recalculate order indices
      const reordered = filtered.map((r, i) => ({ ...r, order: i }));
      await chrome.storage.sync.set({ [STORAGE_KEYS.sync.GROUPING_RULES]: reordered });
    } catch (error) {
      console.error('[useGroupingRules] Failed to delete rule:', error);
      // Rollback optimistic update on failure
      try {
        const reverted = await getLatestRulesFromStorage();
        setRulesWithRef(reverted);
      } catch (rollbackError) {
        console.error('[useGroupingRules] Rollback failed, reverting to previous state:', rollbackError);
        setRulesWithRef(previousState);
      }
      throw error; // Preserve original error
    }
  }, [setRulesWithRef]);

  const reorderRules = useCallback(async (fromIndex: number, toIndex: number): Promise<void> => {
    // Capture the ID of the rule being moved from current UI state
    const movedRuleId = rulesRef.current[fromIndex]?.id;
    if (!movedRuleId) {
      console.error('[useGroupingRules] Invalid fromIndex:', fromIndex);
      return;
    }

    // Optimistically update local state
    const previousState = rulesRef.current;
    setRulesWithRef((current) => {
      const newRules = [...current];
      const [moved] = newRules.splice(fromIndex, 1);
      newRules.splice(toIndex, 0, moved);
      return newRules.map((r, i) => ({ ...r, order: i }));
    });

    try {
      // Get current rules from storage to ensure we have the latest
      const latestRules = await getLatestRulesFromStorage();
      
      // Find the rule by ID in the latest storage state
      const currentIndex = latestRules.findIndex((r) => r.id === movedRuleId);
      if (currentIndex === -1) {
        throw new Error(`Rule with ID ${movedRuleId} not found in storage`);
      }

      // Apply the reorder by ID, not by index
      const newRules = [...latestRules];
      const [moved] = newRules.splice(currentIndex, 1);
      
      // Calculate target index (bound check)
      const boundedToIndex = Math.max(0, Math.min(toIndex, newRules.length));
      newRules.splice(boundedToIndex, 0, moved);
      
      // Update order property
      const reordered = newRules.map((r, i) => ({ ...r, order: i }));
      await chrome.storage.sync.set({ [STORAGE_KEYS.sync.GROUPING_RULES]: reordered });
    } catch (error) {
      console.error('[useGroupingRules] Failed to reorder rules:', error);
      // Rollback optimistic update on failure
      try {
        const reverted = await getLatestRulesFromStorage();
        setRulesWithRef(reverted);
      } catch (rollbackError) {
        console.error('[useGroupingRules] Rollback failed, reverting to previous state:', rollbackError);
        setRulesWithRef(previousState);
      }
      throw error; // Preserve original error
    }
  }, [setRulesWithRef]);

  return { rules, loading, addRule, updateRule, deleteRule, reorderRules };
}

