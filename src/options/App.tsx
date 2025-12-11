import { useState } from 'preact/hooks';

type Tab = 'grouping' | 'autoclose' | 'settings';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('grouping');

  return (
    <div class="options-page">
      <header class="header">
        <h1>Tab Wrangler</h1>
        <p class="subtitle">Settings & Rule Management</p>
      </header>

      <nav class="tabs">
        <button
          class={`tab ${activeTab === 'grouping' ? 'active' : ''}`}
          onClick={() => setActiveTab('grouping')}
        >
          Grouping Rules
        </button>
        <button
          class={`tab ${activeTab === 'autoclose' ? 'active' : ''}`}
          onClick={() => setActiveTab('autoclose')}
        >
          Auto-Close Rules
        </button>
        <button
          class={`tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </nav>

      <main class="content">
        {activeTab === 'grouping' && <GroupingRulesTab />}
        {activeTab === 'autoclose' && <AutoCloseRulesTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>

      <footer class="footer">
        <p>Tab Wrangler v1.0.0</p>
      </footer>
    </div>
  );
}

function GroupingRulesTab() {
  return (
    <section class="tab-content">
      <div class="section-header">
        <h2>Grouping Rules</h2>
        <p>Define URL patterns to automatically group matching tabs.</p>
      </div>

      <div class="placeholder">
        <p>Rule editor coming soon!</p>
        <p class="hint">
          Rules will be matched in order. First matching rule wins.
        </p>
      </div>

      <button class="primary-button">Add Rule</button>
    </section>
  );
}

function AutoCloseRulesTab() {
  return (
    <section class="tab-content">
      <div class="section-header">
        <h2>Auto-Close Rules</h2>
        <p>
          Define URL patterns and durations to automatically close stale tabs.
        </p>
      </div>

      <div class="subsection">
        <h3>Close Rules</h3>
        <div class="placeholder">
          <p>Auto-close rule editor coming soon!</p>
        </div>
        <button class="primary-button">Add Close Rule</button>
      </div>

      <div class="subsection">
        <h3>Whitelist (Never Close)</h3>
        <div class="placeholder">
          <p>Whitelist rule editor coming soon!</p>
        </div>
        <button class="secondary-button">Add Whitelist Rule</button>
      </div>

      <div class="subsection">
        <h3>Archive Exclusions</h3>
        <p class="hint">
          URLs matching these patterns will NOT be bookmarked when auto-closed.
        </p>
        <div class="placeholder">
          <p>Archive exclusion editor coming soon!</p>
        </div>
        <button class="secondary-button">Add Exclusion Rule</button>
      </div>
    </section>
  );
}

function SettingsTab() {
  return (
    <section class="tab-content">
      <div class="section-header">
        <h2>Settings</h2>
        <p>Configure Tab Wrangler behavior.</p>
      </div>

      <div class="settings-group">
        <h3>Duplicate Detection</h3>
        <label class="setting">
          <span>Detection Mode</span>
          <select>
            <option value="ignoreParams">Ignore query parameters (default)</option>
            <option value="exact">Exact URL match</option>
            <option value="ignoreAnchors">Ignore anchors</option>
            <option value="ignoreBoth">Ignore params and anchors</option>
          </select>
        </label>
      </div>

      <div class="settings-group">
        <h3>Auto-Close</h3>
        <label class="setting">
          <span>Check interval</span>
          <select>
            <option value="60000">1 minute</option>
            <option value="300000">5 minutes (default)</option>
            <option value="600000">10 minutes</option>
            <option value="1800000">30 minutes</option>
          </select>
        </label>

        <label class="setting checkbox">
          <input type="checkbox" checked />
          <span>Protect pinned tabs from auto-close</span>
        </label>
      </div>

      <div class="settings-group">
        <h3>Archive</h3>
        <label class="setting checkbox">
          <input type="checkbox" checked />
          <span>Save closed tabs to bookmarks</span>
        </label>
      </div>

      <div class="settings-group">
        <h3>Sorting</h3>
        <label class="setting">
          <span>Default sort order</span>
          <select>
            <option value="domain">By Domain</option>
            <option value="url">By URL</option>
            <option value="title">By Title</option>
            <option value="ageOldest">By Age (oldest first)</option>
            <option value="ageNewest">By Age (newest first)</option>
          </select>
        </label>

        <label class="setting checkbox">
          <input type="checkbox" checked />
          <span>Preserve tab groups when sorting</span>
        </label>
      </div>

      <div class="settings-group">
        <h3>Import / Export</h3>
        <div class="button-row">
          <button class="secondary-button">Export Rules</button>
          <button class="secondary-button">Import Rules</button>
        </div>
      </div>
    </section>
  );
}

