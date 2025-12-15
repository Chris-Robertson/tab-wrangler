/**
 * Unit tests for useSettings hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/preact';
import { useSettings } from '../../src/options/hooks/useSettings';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../../src/shared/constants';
import type { Settings } from '../../src/shared/types';

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

describe('useSettings', () => {
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
      const { result } = renderHook(() => useSettings());

      expect(result.current.loading).toBe(true);
      expect(result.current.settings).toBeNull();
    });

    it('should return default settings when storage is empty', async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    });

    it('should return stored settings when available', async () => {
      const storedSettings: Settings = {
        ...DEFAULT_SETTINGS,
        duplicateDetectionMode: 'exact',
      };
      mockStorage[STORAGE_KEYS.sync.SETTINGS] = storedSettings;

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.settings).toEqual(storedSettings);
      expect(result.current.settings?.duplicateDetectionMode).toBe('exact');
    });

    it('should merge partial stored settings with defaults', async () => {
      // Store only partial settings (missing some fields)
      const partialSettings = {
        duplicateDetectionMode: 'exact',
        autoGroupEnabled: false,
      };
      mockStorage[STORAGE_KEYS.sync.SETTINGS] = partialSettings;

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have the stored values
      expect(result.current.settings?.duplicateDetectionMode).toBe('exact');
      expect(result.current.settings?.autoGroupEnabled).toBe(false);
      // Should have defaults for missing fields
      expect(result.current.settings?.autoCloseEnabled).toBe(DEFAULT_SETTINGS.autoCloseEnabled);
      expect(result.current.settings?.autoCloseCheckInterval).toBe(DEFAULT_SETTINGS.autoCloseCheckInterval);
    });
  });

  describe('updateSettings', () => {
    it('should persist settings changes to chrome.storage.sync', async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateSettings({ duplicateDetectionMode: 'ignoreBoth' });
      });

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.sync.SETTINGS]: expect.objectContaining({
          duplicateDetectionMode: 'ignoreBoth',
        }),
      });
    });

    it('should update local state immediately (optimistic update)', async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Start the update but don't wait for storage
      act(() => {
        result.current.updateSettings({ duplicateDetectionMode: 'ignoreAnchors' });
      });

      // State should be updated immediately (optimistic)
      expect(result.current.settings?.duplicateDetectionMode).toBe('ignoreAnchors');
    });

    it('should merge partial updates with existing settings', async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateSettings({ duplicateDetectionMode: 'exact' });
      });

      // Other settings should remain unchanged
      expect(result.current.settings?.autoGroupEnabled).toBe(DEFAULT_SETTINGS.autoGroupEnabled);
      expect(result.current.settings?.autoCloseEnabled).toBe(DEFAULT_SETTINGS.autoCloseEnabled);
    });
  });

  describe('storage change listener', () => {
    it('should update local state when storage changes externally', async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simulate external storage change (e.g., from another tab/popup)
      const updatedSettings: Settings = {
        ...DEFAULT_SETTINGS,
        duplicateDetectionMode: 'ignoreBoth',
      };

      act(() => {
        storageChangeListeners.forEach((listener) => {
          listener(
            { [STORAGE_KEYS.sync.SETTINGS]: { newValue: updatedSettings } },
            'sync'
          );
        });
      });

      expect(result.current.settings?.duplicateDetectionMode).toBe('ignoreBoth');
    });

    it('should ignore changes from non-sync storage areas', async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const originalMode = result.current.settings?.duplicateDetectionMode;

      // Simulate change from 'local' storage (should be ignored)
      act(() => {
        storageChangeListeners.forEach((listener) => {
          listener(
            { [STORAGE_KEYS.sync.SETTINGS]: { newValue: { ...DEFAULT_SETTINGS, duplicateDetectionMode: 'exact' } } },
            'local' // Different area - should be ignored
          );
        });
      });

      // Should remain unchanged
      expect(result.current.settings?.duplicateDetectionMode).toBe(originalMode);
    });

    it('should fall back to defaults if storage is cleared', async () => {
      mockStorage[STORAGE_KEYS.sync.SETTINGS] = {
        ...DEFAULT_SETTINGS,
        duplicateDetectionMode: 'exact',
      };

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.settings?.duplicateDetectionMode).toBe('exact');

      // Simulate storage being cleared
      act(() => {
        storageChangeListeners.forEach((listener) => {
          listener(
            { [STORAGE_KEYS.sync.SETTINGS]: { newValue: undefined } },
            'sync'
          );
        });
      });

      expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    });

    it('should merge partial external changes with defaults', async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simulate external change with partial settings
      const partialSettings = { duplicateDetectionMode: 'exact' as const };

      act(() => {
        storageChangeListeners.forEach((listener) => {
          listener(
            { [STORAGE_KEYS.sync.SETTINGS]: { newValue: partialSettings } },
            'sync'
          );
        });
      });

      // Should have the new value merged with defaults
      expect(result.current.settings?.duplicateDetectionMode).toBe('exact');
      expect(result.current.settings?.autoGroupEnabled).toBe(DEFAULT_SETTINGS.autoGroupEnabled);
    });

    it('should remove listener on unmount', async () => {
      const { result, unmount } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(chrome.storage.onChanged.addListener).toHaveBeenCalled();

      unmount();

      expect(chrome.storage.onChanged.removeListener).toHaveBeenCalled();
    });
  });

  describe('fallback to defaults', () => {
    it('should use default duplicateDetectionMode when not set', async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.settings?.duplicateDetectionMode).toBe('ignoreParams');
    });
  });

  describe('error handling', () => {
    it('should fall back to defaults on storage read error', async () => {
      // Make storage.get reject
      vi.mocked(chrome.storage.sync.get).mockRejectedValueOnce(new Error('Storage error'));

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should fall back to defaults
      expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    });
  });
});
