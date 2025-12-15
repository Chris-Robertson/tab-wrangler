import { useState, useEffect } from 'preact/hooks';
import { sendMessage } from '@shared/messaging';
import type { Settings } from '@shared/types';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@shared/constants';

/**
 * Merges stored settings with defaults to handle partial objects.
 */
function mergeWithDefaults(stored: Partial<Settings> | undefined): Settings {
  if (!stored) {
    return { ...DEFAULT_SETTINGS };
  }
  return { ...DEFAULT_SETTINGS, ...stored };
}

export function Toggles() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load current settings using Promise API
    const loadSettings = async () => {
      try {
        const result = await chrome.storage.sync.get(STORAGE_KEYS.sync.SETTINGS);
        const stored = result[STORAGE_KEYS.sync.SETTINGS] as Partial<Settings> | undefined;
        setSettings(mergeWithDefaults(stored));
      } catch (error) {
        console.error('[Toggles] Failed to load settings:', error);
        setSettings({ ...DEFAULT_SETTINGS });
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleAutoGroupToggle = async () => {
    const newValue = !settings.autoGroupEnabled;
    // Optimistic update
    setSettings({ ...settings, autoGroupEnabled: newValue });
    try {
      await sendMessage({ type: 'TOGGLE_AUTO_GROUP', enabled: newValue });
    } catch (error) {
      // Revert on failure
      console.error('[Toggles] Failed to toggle auto-group:', error);
      setSettings({ ...settings, autoGroupEnabled: !newValue });
    }
  };

  const handleAutoCloseToggle = async () => {
    const newValue = !settings.autoCloseEnabled;
    // Optimistic update
    setSettings({ ...settings, autoCloseEnabled: newValue });
    try {
      await sendMessage({ type: 'TOGGLE_AUTO_CLOSE', enabled: newValue });
    } catch (error) {
      // Revert on failure
      console.error('[Toggles] Failed to toggle auto-close:', error);
      setSettings({ ...settings, autoCloseEnabled: !newValue });
    }
  };

  if (loading) {
    return null;
  }

  return (
    <section class="toggles">
      <h2>Automation</h2>

      <label class="toggle">
        <input
          type="checkbox"
          checked={settings.autoGroupEnabled}
          onChange={handleAutoGroupToggle}
        />
        <span class="toggle-label">Auto-Group Tabs</span>
      </label>

      <label class="toggle">
        <input
          type="checkbox"
          checked={settings.autoCloseEnabled}
          onChange={handleAutoCloseToggle}
        />
        <span class="toggle-label">Auto-Close Stale Tabs</span>
      </label>
    </section>
  );
}
