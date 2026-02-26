/**
 * Hook for managing auto-close rules in the Options page
 * Reads from chrome.storage.sync and listens for changes
 */

import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import type { AutoCloseRule, PatternType } from '../../shared/types';
import { STORAGE_KEYS } from '../../shared/constants';
import { generateId } from '../../shared/utils/id-utils';

/** Input type for adding a new rule (without auto-generated fields) */
export type NewAutoCloseRuleInput = {
  pattern: string;
  patternType: PatternType;
  maxAge: number; // milliseconds
  enabled?: boolean; // defaults to true
};

interface UseAutoCloseRulesReturn {
  rules: AutoCloseRule[];
  loading: boolean;
  addRule: (rule: NewAutoCloseRuleInput) => Promise<void>;
  updateRule: (id: string, updates: Partial<AutoCloseRule>) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  toggleEnabled: (id: string) => Promise<void>;
  reorderRules: (fromIndex: number, toIndex: number) => Promise<void>;
}

/**
 * Fetches the latest rules from storage
 */
async function getLatestRulesFromStorage(): Promise<AutoCloseRule[]> {
  const result = await chrome.storage.sync.get(STORAGE_KEYS.sync.AUTO_CLOSE_RULES);
  const stored = result[STORAGE_KEYS.sync.AUTO_CLOSE_RULES] as AutoCloseRule[] | undefined;
  const rules = stored ?? [];
  // Normalize enabled field (default to true if missing)
  return rules.map((rule) => ({
    ...rule,
    enabled: rule.enabled ?? true,
  }));
}

export function useAutoCloseRules(): UseAutoCloseRulesReturn {
  const [rules, setRules] = useState<AutoCloseRule[]>([]);
  const [loading, setLoading] = useState(true);
  const rulesRef = useRef<AutoCloseRule[]>([]);

  const setRulesWithRef = useCallback(
    (updater: AutoCloseRule[] | ((current: AutoCloseRule[]) => AutoCloseRule[])) => {
      setRules((current) => {
        const next = typeof updater === 'function' ? (updater as (c: AutoCloseRule[]) => AutoCloseRule[])(current) : updater;
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
        const rules = await getLatestRulesFromStorage();
        setRulesWithRef(rules);
      } catch (error) {
        console.error('[useAutoCloseRules] Failed to load rules:', error);
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
      if (changes[STORAGE_KEYS.sync.AUTO_CLOSE_RULES]) {
        const newValue = changes[STORAGE_KEYS.sync.AUTO_CLOSE_RULES].newValue as AutoCloseRule[] | undefined;
        const rules = newValue ?? [];
        const normalized = rules.map((rule) => ({
          ...rule,
          enabled: rule.enabled ?? true,
        }));
        setRulesWithRef(normalized);
      }
    };

    chrome.storage.onChanged.addListener(listener);

    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }, [setRulesWithRef]);

  const addRule = useCallback(async (rule: NewAutoCloseRuleInput): Promise<void> => {
    // Optimistically update local state immediately for responsive UI
    const previousState = rulesRef.current;
    const tempRule: AutoCloseRule = {
      ...rule,
      id: generateId(),
      enabled: rule.enabled ?? true,
    };
    setRulesWithRef((current) => [...current, tempRule]);

    try {
      // Get current rules from storage to ensure we have the latest (avoid lost updates)
      const latestRules = await getLatestRulesFromStorage();
      const newRule: AutoCloseRule = {
        ...rule,
        id: tempRule.id,
        enabled: rule.enabled ?? true,
      };
      const updated = [...latestRules, newRule];
      await chrome.storage.sync.set({ [STORAGE_KEYS.sync.AUTO_CLOSE_RULES]: updated });
    } catch (error) {
      console.error('[useAutoCloseRules] Failed to add rule:', error);
      // Rollback optimistic update on failure
      try {
        const reverted = await getLatestRulesFromStorage();
        setRulesWithRef(reverted);
      } catch (rollbackError) {
        console.error('[useAutoCloseRules] Rollback failed, reverting to previous state:', rollbackError);
        setRulesWithRef(previousState);
      }
      throw error;
    }
  }, [setRulesWithRef]);

  const updateRule = useCallback(async (id: string, updates: Partial<AutoCloseRule>): Promise<void> => {
    // Optimistically update local state
    const previousState = rulesRef.current;
    setRulesWithRef((current) => current.map((r) => (r.id === id ? { ...r, ...updates } : r)));

    try {
      const latestRules = await getLatestRulesFromStorage();
      const updated = latestRules.map((r) => (r.id === id ? { ...r, ...updates } : r));
      await chrome.storage.sync.set({ [STORAGE_KEYS.sync.AUTO_CLOSE_RULES]: updated });
    } catch (error) {
      console.error('[useAutoCloseRules] Failed to update rule:', error);
      // Rollback
      try {
        const reverted = await getLatestRulesFromStorage();
        setRulesWithRef(reverted);
      } catch (rollbackError) {
        setRulesWithRef(previousState);
      }
      throw error;
    }
  }, [setRulesWithRef]);

  const deleteRule = useCallback(async (id: string): Promise<void> => {
    // Optimistically delete
    const previousState = rulesRef.current;
    setRulesWithRef((current) => current.filter((r) => r.id !== id));

    try {
      const latestRules = await getLatestRulesFromStorage();
      const updated = latestRules.filter((r) => r.id !== id);
      await chrome.storage.sync.set({ [STORAGE_KEYS.sync.AUTO_CLOSE_RULES]: updated });
    } catch (error) {
      console.error('[useAutoCloseRules] Failed to delete rule:', error);
      // Rollback
      try {
        const reverted = await getLatestRulesFromStorage();
        setRulesWithRef(reverted);
      } catch (rollbackError) {
        setRulesWithRef(previousState);
      }
      throw error;
    }
  }, [setRulesWithRef]);

  const toggleEnabled = useCallback(async (id: string): Promise<void> => {
    setRulesWithRef((current) =>
      current.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );

    try {
      const latestRules = await getLatestRulesFromStorage();
      const updated = latestRules.map((r) =>
        r.id === id ? { ...r, enabled: !r.enabled } : r
      );
      await chrome.storage.sync.set({ [STORAGE_KEYS.sync.AUTO_CLOSE_RULES]: updated });
    } catch (error) {
      console.error('[useAutoCloseRules] Failed to toggle rule:', error);
      const reverted = await getLatestRulesFromStorage();
      setRulesWithRef(reverted);
      throw error;
    }
  }, [setRulesWithRef]);

  const reorderRules = useCallback(async (fromIndex: number, toIndex: number): Promise<void> => {
    if (fromIndex === toIndex) return;

    const previousState = rulesRef.current;
    setRulesWithRef((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });

    try {
      const latestRules = await getLatestRulesFromStorage();
      const next = [...latestRules];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      await chrome.storage.sync.set({ [STORAGE_KEYS.sync.AUTO_CLOSE_RULES]: next });
    } catch (error) {
      console.error('[useAutoCloseRules] Failed to reorder rules:', error);
      try {
        const reverted = await getLatestRulesFromStorage();
        setRulesWithRef(reverted);
      } catch {
        setRulesWithRef(previousState);
      }
      throw error;
    }
  }, [setRulesWithRef]);

  return {
    rules,
    loading,
    addRule,
    updateRule,
    deleteRule,
    toggleEnabled,
    reorderRules,
  };
}
