import { useState, useEffect } from 'preact/hooks';
import { sendMessage } from '@shared/messaging';
import type { Settings } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/constants';

export function Toggles() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load current settings
    chrome.storage.sync.get('settings', (result) => {
      if (result.settings) {
        setSettings(result.settings);
      }
      setLoading(false);
    });
  }, []);

  const handleAutoGroupToggle = async () => {
    const newValue = !settings.autoGroupEnabled;
    setSettings({ ...settings, autoGroupEnabled: newValue });
    await sendMessage({ type: 'TOGGLE_AUTO_GROUP', enabled: newValue });
  };

  const handleAutoCloseToggle = async () => {
    const newValue = !settings.autoCloseEnabled;
    setSettings({ ...settings, autoCloseEnabled: newValue });
    await sendMessage({ type: 'TOGGLE_AUTO_CLOSE', enabled: newValue });
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

