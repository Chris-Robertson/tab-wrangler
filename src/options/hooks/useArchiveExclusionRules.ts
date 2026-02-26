/**
 * Hook for managing archive exclusion rules in the Options page
 * Reads from chrome.storage.sync and listens for changes.
 * No `toggleEnabled` — ArchiveExclusionRule has no enabled field.
 */

import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import type { ArchiveExclusionRule, PatternType } from '../../shared/types';
import { STORAGE_KEYS } from '../../shared/constants';
import { generateId } from '../../shared/utils/id-utils';

/** Input type for adding a new archive exclusion rule */
export type NewArchiveExclusionRuleInput = {
  pattern: string;
  patternType: PatternType;
};

interface UseArchiveExclusionRulesReturn {
  rules: ArchiveExclusionRule[];
  loading: boolean;
  addRule: (rule: NewArchiveExclusionRuleInput) => Promise<void>;
  updateRule: (id: string, updates: Partial<ArchiveExclusionRule>) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  reorderRules: (fromIndex: number, toIndex: number) => Promise<void>;
}

/**
 * Fetches the latest archive exclusion rules from storage
 */
async function getLatestRulesFromStorage(): Promise<ArchiveExclusionRule[]> {
  const result = await chrome.storage.sync.get(STORAGE_KEYS.sync.ARCHIVE_EXCLUSION_RULES);
  const stored = result[STORAGE_KEYS.sync.ARCHIVE_EXCLUSION_RULES] as
    | ArchiveExclusionRule[]
    | undefined;
  return stored ?? [];
}

export function useArchiveExclusionRules(): UseArchiveExclusionRulesReturn {
  const [rules, setRules] = useState<ArchiveExclusionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const rulesRef = useRef<ArchiveExclusionRule[]>([]);

  const setRulesWithRef = useCallback(
    (
      updater:
        | ArchiveExclusionRule[]
        | ((current: ArchiveExclusionRule[]) => ArchiveExclusionRule[]),
    ) => {
      setRules((current) => {
        const next =
          typeof updater === 'function'
            ? (updater as (c: ArchiveExclusionRule[]) => ArchiveExclusionRule[])(current)
            : updater;
        rulesRef.current = next;
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    const loadRules = async () => {
      try {
        const rules = await getLatestRulesFromStorage();
        setRulesWithRef(rules);
      } catch (error) {
        console.error('[useArchiveExclusionRules] Failed to load rules:', error);
        setRulesWithRef([]);
      } finally {
        setLoading(false);
      }
    };

    loadRules();

    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== 'sync') return;
      if (changes[STORAGE_KEYS.sync.ARCHIVE_EXCLUSION_RULES]) {
        const newValue = changes[STORAGE_KEYS.sync.ARCHIVE_EXCLUSION_RULES].newValue as
          | ArchiveExclusionRule[]
          | undefined;
        setRulesWithRef(newValue ?? []);
      }
    };

    chrome.storage.onChanged.addListener(listener);

    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }, [setRulesWithRef]);

  const addRule = useCallback(
    async (rule: NewArchiveExclusionRuleInput): Promise<void> => {
      const previousState = rulesRef.current;
      const tempRule: ArchiveExclusionRule = {
        ...rule,
        id: generateId(),
      };
      setRulesWithRef((current) => [...current, tempRule]);

      try {
        const latestRules = await getLatestRulesFromStorage();
        const newRule: ArchiveExclusionRule = { ...rule, id: tempRule.id };
        const updated = [...latestRules, newRule];
        await chrome.storage.sync.set({
          [STORAGE_KEYS.sync.ARCHIVE_EXCLUSION_RULES]: updated,
        });
      } catch (error) {
        console.error('[useArchiveExclusionRules] Failed to add rule:', error);
        try {
          const reverted = await getLatestRulesFromStorage();
          setRulesWithRef(reverted);
        } catch {
          setRulesWithRef(previousState);
        }
        throw error;
      }
    },
    [setRulesWithRef],
  );

  const updateRule = useCallback(
    async (id: string, updates: Partial<ArchiveExclusionRule>): Promise<void> => {
      const previousState = rulesRef.current;
      setRulesWithRef((current) =>
        current.map((r) => (r.id === id ? { ...r, ...updates } : r)),
      );

      try {
        const latestRules = await getLatestRulesFromStorage();
        const updated = latestRules.map((r) => (r.id === id ? { ...r, ...updates } : r));
        await chrome.storage.sync.set({
          [STORAGE_KEYS.sync.ARCHIVE_EXCLUSION_RULES]: updated,
        });
      } catch (error) {
        console.error('[useArchiveExclusionRules] Failed to update rule:', error);
        try {
          const reverted = await getLatestRulesFromStorage();
          setRulesWithRef(reverted);
        } catch {
          setRulesWithRef(previousState);
        }
        throw error;
      }
    },
    [setRulesWithRef],
  );

  const deleteRule = useCallback(
    async (id: string): Promise<void> => {
      const previousState = rulesRef.current;
      setRulesWithRef((current) => current.filter((r) => r.id !== id));

      try {
        const latestRules = await getLatestRulesFromStorage();
        const updated = latestRules.filter((r) => r.id !== id);
        await chrome.storage.sync.set({
          [STORAGE_KEYS.sync.ARCHIVE_EXCLUSION_RULES]: updated,
        });
      } catch (error) {
        console.error('[useArchiveExclusionRules] Failed to delete rule:', error);
        try {
          const reverted = await getLatestRulesFromStorage();
          setRulesWithRef(reverted);
        } catch {
          setRulesWithRef(previousState);
        }
        throw error;
      }
    },
    [setRulesWithRef],
  );

  const reorderRules = useCallback(
    async (fromIndex: number, toIndex: number): Promise<void> => {
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
        await chrome.storage.sync.set({
          [STORAGE_KEYS.sync.ARCHIVE_EXCLUSION_RULES]: next,
        });
      } catch (error) {
        console.error('[useArchiveExclusionRules] Failed to reorder rules:', error);
        try {
          const reverted = await getLatestRulesFromStorage();
          setRulesWithRef(reverted);
        } catch {
          setRulesWithRef(previousState);
        }
        throw error;
      }
    },
    [setRulesWithRef],
  );

  return { rules, loading, addRule, updateRule, deleteRule, reorderRules };
}
