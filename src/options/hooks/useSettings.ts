/**
 * Hook for managing settings in the Options page
 * Reads from chrome.storage.sync and listens for changes
 */

import { useState, useEffect, useCallback } from 'preact/hooks';
import type { Settings } from '../../shared/types';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../../shared/constants';

interface UseSettingsReturn {
  settings: Settings | null;
  loading: boolean;
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
}

/**
 * Merges stored settings with defaults to handle partial objects.
 * This ensures all fields are present even if storage has incomplete data.
 */
function mergeWithDefaults(stored: Partial<Settings> | undefined): Settings {
  if (!stored) {
    return { ...DEFAULT_SETTINGS };
  }
  return { ...DEFAULT_SETTINGS, ...stored };
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load settings on mount
    const loadSettings = async () => {
      try {
        const result = await chrome.storage.sync.get(STORAGE_KEYS.sync.SETTINGS);
        const stored = result[STORAGE_KEYS.sync.SETTINGS] as Partial<Settings> | undefined;
        setSettings(mergeWithDefaults(stored));
      } catch (error) {
        console.error('[useSettings] Failed to load settings:', error);
        setSettings({ ...DEFAULT_SETTINGS });
      } finally {
        setLoading(false);
      }
    };

    loadSettings();

    // Listen for storage changes from other contexts (popup, background, other tabs)
    // Using chrome.storage.onChanged with areaName check for proper sync storage listening
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName !== 'sync') return;
      if (changes[STORAGE_KEYS.sync.SETTINGS]) {
        const newValue = changes[STORAGE_KEYS.sync.SETTINGS].newValue as Partial<Settings> | undefined;
        setSettings(mergeWithDefaults(newValue));
      }
    };

    chrome.storage.onChanged.addListener(listener);

    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<Settings>): Promise<void> => {
    // Optimistically update local state immediately for responsive UI
    setSettings((current) => {
      if (!current) return mergeWithDefaults(newSettings);
      return { ...current, ...newSettings };
    });

    try {
      // Get current settings from storage to ensure we have the latest
      const result = await chrome.storage.sync.get(STORAGE_KEYS.sync.SETTINGS);
      const stored = result[STORAGE_KEYS.sync.SETTINGS] as Partial<Settings> | undefined;
      const current = mergeWithDefaults(stored);
      const updated = { ...current, ...newSettings };

      await chrome.storage.sync.set({ [STORAGE_KEYS.sync.SETTINGS]: updated });
    } catch (error) {
      console.error('[useSettings] Failed to save settings:', error);
      // Revert optimistic update on failure by reloading from storage
      try {
        const result = await chrome.storage.sync.get(STORAGE_KEYS.sync.SETTINGS);
        const stored = result[STORAGE_KEYS.sync.SETTINGS] as Partial<Settings> | undefined;
        setSettings(mergeWithDefaults(stored));
      } catch {
        // If reload also fails, fall back to defaults
        setSettings({ ...DEFAULT_SETTINGS });
      }
      throw error; // Re-throw so caller knows update failed
    }
  }, []);

  return { settings, loading, updateSettings };
}
