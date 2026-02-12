/**
 * Hook to check if grouping rules exist (for popup UI)
 * Lighter-weight than full useGroupingRules hook
 */

import { useState, useEffect } from 'preact/hooks';
import { STORAGE_KEYS } from '@shared/constants';
import type { GroupingRule } from '@shared/types';

interface UseHasGroupingRulesReturn {
  hasRules: boolean;
  loading: boolean;
}

/**
 * Check if any enabled grouping rules exist
 * Used to enable/disable Organize All Tabs button
 */
export function useHasGroupingRules(): UseHasGroupingRulesReturn {
  const [hasRules, setHasRules] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load rules on mount
    const loadRules = async () => {
      try {
        const result = await chrome.storage.sync.get(STORAGE_KEYS.sync.GROUPING_RULES);
        const rules = (result[STORAGE_KEYS.sync.GROUPING_RULES] as GroupingRule[] | undefined) ?? [];
        const enabledRules = rules.filter((r) => r.enabled !== false);
        setHasRules(enabledRules.length > 0);
      } catch (error) {
        console.error('[useHasGroupingRules] Failed to load rules:', error);
        setHasRules(false);
      } finally {
        setLoading(false);
      }
    };

    loadRules();

    // Listen for storage changes
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName !== 'sync') return;
      if (changes[STORAGE_KEYS.sync.GROUPING_RULES]) {
        const newValue = changes[STORAGE_KEYS.sync.GROUPING_RULES].newValue as GroupingRule[] | undefined;
        const rules = newValue ?? [];
        const enabledRules = rules.filter((r) => r.enabled !== false);
        setHasRules(enabledRules.length > 0);
      }
    };

    chrome.storage.onChanged.addListener(listener);

    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);

  return { hasRules, loading };
}
