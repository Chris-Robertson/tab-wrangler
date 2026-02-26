import { useState } from 'preact/hooks';
import { useSettings } from './hooks/useSettings';
import { useGroupingRules, type NewRuleInput } from './hooks/useGroupingRules';
import { useAutoCloseRules, type NewAutoCloseRuleInput } from './hooks/useAutoCloseRules';
import { useWhitelistRules, type NewWhitelistRuleInput } from './hooks/useWhitelistRules';
import { GroupingRuleList } from './components/GroupingRuleList';
import { RuleEditor } from './components/RuleEditor';
import { AutoCloseRuleEditor } from './components/AutoCloseRuleEditor';
import { AutoCloseRuleList } from './components/AutoCloseRuleList';
import { WhitelistRuleEditor } from './components/WhitelistRuleEditor';
import { WhitelistRuleList } from './components/WhitelistRuleList';
import type { DuplicateDetectionMode, SortOrder, GroupingRule, AutoCloseRule, WhitelistRule } from '../shared/types/rules';

type Tab = 'grouping' | 'autoclose' | 'whitelist' | 'settings';

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
          class={`tab ${activeTab === 'whitelist' ? 'active' : ''}`}
          onClick={() => setActiveTab('whitelist')}
        >
          Whitelist
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
        {activeTab === 'whitelist' && <WhitelistRulesTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>

      <footer class="footer">
        <p>Tab Wrangler v1.0.0</p>
      </footer>
    </div>
  );
}

function GroupingRulesTab() {
  const { rules, loading, addRule, updateRule, deleteRule, reorderRules } = useGroupingRules();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<GroupingRule | undefined>(undefined);

  const handleAddClick = () => {
    setEditingRule(undefined);
    setEditorOpen(true);
  };

  const handleEditClick = (rule: GroupingRule) => {
    setEditingRule(rule);
    setEditorOpen(true);
  };

  const handleSave = async (ruleData: NewRuleInput) => {
    if (editingRule) {
      await updateRule(editingRule.id, ruleData);
    } else {
      await addRule(ruleData);
    }
    setEditorOpen(false);
    setEditingRule(undefined);
  };

  const handleCancel = () => {
    setEditorOpen(false);
    setEditingRule(undefined);
  };

  if (loading) {
    return (
      <section class="tab-content">
        <div class="section-header">
          <h2>Grouping Rules</h2>
          <p>Define URL patterns to automatically group matching tabs.</p>
        </div>
        <div class="loading-state">
          <div class="loading-spinner" />
          <span>Loading rules...</span>
        </div>
      </section>
    );
  }

  return (
    <section class="tab-content">
      <div class="section-header">
        <h2>Grouping Rules</h2>
        <p>Define URL patterns to automatically group matching tabs.</p>
      </div>

      <GroupingRuleList
        rules={rules}
        onEdit={handleEditClick}
        onDelete={deleteRule}
        onReorder={reorderRules}
      />

      <p class="hint" style={{ marginBottom: 'var(--spacing-md)' }}>
        Rules are matched in order. First matching rule wins.
      </p>

      <button class="primary-button" onClick={handleAddClick}>
        Add Rule
      </button>

      {editorOpen && (
        <RuleEditor
          rule={editingRule}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </section>
  );
}

function AutoCloseRulesTab() {
  const { rules, loading, addRule, updateRule, deleteRule, toggleEnabled, reorderRules } = useAutoCloseRules();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutoCloseRule | undefined>(undefined);
  const [initialUrl, setInitialUrl] = useState<string | undefined>(undefined);
  const [storageError, setStorageError] = useState<string | null>(null);

  const handleAddClick = async () => {
    setEditingRule(undefined);
    
    // AC3: Query current active tab URL to auto-populate pattern
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.url) {
        setInitialUrl(activeTab.url);
      }
    } catch (error) {
      console.error('Failed to get active tab URL:', error);
      setInitialUrl(undefined);
    }
    
    setEditorOpen(true);
  };

  const handleEditClick = (rule: AutoCloseRule) => {
    setEditingRule(rule);
    setInitialUrl(undefined);
    setEditorOpen(true);
  };

  const handleSave = async (ruleData: NewAutoCloseRuleInput) => {
    setStorageError(null);
    try {
      if (editingRule) {
        await updateRule(editingRule.id, ruleData);
      } else {
        await addRule(ruleData);
      }
      setEditorOpen(false);
      setEditingRule(undefined);
      setInitialUrl(undefined);
    } catch (error) {
      console.error('[AutoCloseRulesTab] Save failed:', error);
      if (
        error instanceof Error &&
        (error.message.toLowerCase().includes('quota') ||
          error.message.toLowerCase().includes('quota_bytes'))
      ) {
        setStorageError('Storage limit reached. Delete some rules to free up space.');
      } else {
        setStorageError('Failed to save rule. Please try again.');
      }
    }
  };

  const handleCancel = () => {
    setEditorOpen(false);
    setEditingRule(undefined);
    setInitialUrl(undefined);
  };

  if (loading) {
    return (
      <section class="tab-content">
        <div class="section-header">
          <h2>Auto-Close Rules</h2>
          <p>Define URL patterns and durations to automatically close stale tabs.</p>
        </div>
        <div class="loading-state">
          <div class="loading-spinner" />
          <span>Loading rules...</span>
        </div>
      </section>
    );
  }

  return (
    <section class="tab-content">
      <div class="section-header">
        <h2>Auto-Close Rules</h2>
        <p>
          Automatically close tabs matching these patterns after they've been inactive for the specified duration.
        </p>
      </div>

      <AutoCloseRuleList
        rules={rules}
        onEdit={handleEditClick}
        onDelete={deleteRule}
        onToggleEnabled={toggleEnabled}
        onReorder={reorderRules}
      />

      {storageError && (
        <div class="storage-error-banner" role="alert">
          ⚠️ {storageError}
          <button
            type="button"
            class="dismiss-button"
            onClick={() => setStorageError(null)}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      <button class="primary-button" onClick={handleAddClick} style={{ marginTop: 'var(--spacing-md)' }}>
        Add Rule
      </button>

      {editorOpen && (
        <AutoCloseRuleEditor
          rule={editingRule}
          initialUrl={initialUrl}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}

    </section>
  );
}

function WhitelistRulesTab() {
  const { rules, loading, addRule, updateRule, deleteRule, toggleEnabled, reorderRules } =
    useWhitelistRules();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<WhitelistRule | undefined>(undefined);
  const [initialUrl, setInitialUrl] = useState<string | undefined>(undefined);
  const [storageError, setStorageError] = useState<string | null>(null);

  const handleAddClick = async () => {
    setEditingRule(undefined);

    // AC3: Query current active tab URL to auto-populate pattern
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.url) {
        setInitialUrl(activeTab.url);
      }
    } catch (error) {
      console.error('Failed to get active tab URL:', error);
      setInitialUrl(undefined);
    }

    setEditorOpen(true);
  };

  const handleEditClick = (rule: WhitelistRule) => {
    setEditingRule(rule);
    setInitialUrl(undefined);
    setEditorOpen(true);
  };

  const handleSave = async (ruleData: NewWhitelistRuleInput) => {
    setStorageError(null);
    try {
      if (editingRule) {
        await updateRule(editingRule.id, ruleData);
      } else {
        await addRule(ruleData);
      }
      setEditorOpen(false);
      setEditingRule(undefined);
      setInitialUrl(undefined);
    } catch (error) {
      console.error('[WhitelistRulesTab] Save failed:', error);
      if (
        error instanceof Error &&
        (error.message.toLowerCase().includes('quota') ||
          error.message.toLowerCase().includes('quota_bytes'))
      ) {
        setStorageError('Storage limit reached. Delete some rules to free up space.');
      } else {
        setStorageError('Failed to save rule. Please try again.');
      }
    }
  };

  const handleCancel = () => {
    setEditorOpen(false);
    setEditingRule(undefined);
    setInitialUrl(undefined);
  };

  if (loading) {
    return (
      <section class="tab-content">
        <div class="section-header">
          <h2>Whitelist</h2>
          <p>Define URL patterns to protect tabs from being auto-closed.</p>
        </div>
        <div class="loading-state">
          <div class="loading-spinner" />
          <span>Loading rules...</span>
        </div>
      </section>
    );
  }

  return (
    <section class="tab-content">
      <div class="section-header">
        <h2>Whitelist</h2>
        <p>
          Tabs matching these patterns will never be automatically closed.
        </p>
      </div>

      <WhitelistRuleList
        rules={rules}
        onEdit={handleEditClick}
        onDelete={deleteRule}
        onToggleEnabled={toggleEnabled}
        onReorder={reorderRules}
      />

      {storageError && (
        <div class="storage-error-banner" role="alert">
          ⚠️ {storageError}
          <button
            type="button"
            class="dismiss-button"
            onClick={() => setStorageError(null)}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      <button class="primary-button" onClick={handleAddClick} style={{ marginTop: 'var(--spacing-md)' }}>
        Add Rule
      </button>

      {editorOpen && (
        <WhitelistRuleEditor
          rule={editingRule}
          initialUrl={initialUrl}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </section>
  );
}

function SettingsTab() {
  const { settings, loading, updateSettings } = useSettings();

  if (loading || !settings) {
    return (
      <section class="tab-content">
        <div class="section-header">
          <h2>Settings</h2>
          <p>Loading settings...</p>
        </div>
      </section>
    );
  }

  return (
    <section class="tab-content">
      <div class="section-header">
        <h2>Settings</h2>
        <p>Configure Tab Wrangler behavior.</p>
      </div>

      <div class="settings-group">
        <h3>Auto-Grouping</h3>
        <label class="setting checkbox">
          <input
            type="checkbox"
            checked={settings.autoGroupEnabled}
            onChange={(e) =>
              updateSettings({
                autoGroupEnabled: (e.target as HTMLInputElement).checked,
              })
            }
          />
          <span>Auto-group tabs based on URL patterns</span>
        </label>
        <p class="hint">
          When enabled, new tabs will be automatically grouped according to your grouping rules.
        </p>
      </div>

      <div class="settings-group">
        <h3>Duplicate Detection</h3>
        <label class="setting">
          <span>Detection Mode</span>
          <select
            value={settings.duplicateDetectionMode}
            onChange={(e) =>
              updateSettings({
                duplicateDetectionMode: (e.target as HTMLSelectElement)
                  .value as DuplicateDetectionMode,
              })
            }
          >
            <option value="ignoreParams">
              Ignore query parameters (default)
            </option>
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
          <select
            value={settings.autoCloseCheckInterval}
            onChange={(e) =>
              updateSettings({
                autoCloseCheckInterval: Number(
                  (e.target as HTMLSelectElement).value
                ),
              })
            }
          >
            <option value="60000">1 minute</option>
            <option value="300000">5 minutes (default)</option>
            <option value="600000">10 minutes</option>
            <option value="1800000">30 minutes</option>
          </select>
        </label>

        <label class="setting checkbox">
          <input
            type="checkbox"
            checked={settings.autoCloseProtectPinned}
            onChange={(e) =>
              updateSettings({
                autoCloseProtectPinned: (e.target as HTMLInputElement).checked,
              })
            }
          />
          <span>Protect pinned tabs from auto-close</span>
        </label>
      </div>

      <div class="settings-group">
        <h3>Archive</h3>
        <label class="setting checkbox">
          <input
            type="checkbox"
            checked={settings.archiveEnabled}
            onChange={(e) =>
              updateSettings({
                archiveEnabled: (e.target as HTMLInputElement).checked,
              })
            }
          />
          <span>Save closed tabs to bookmarks</span>
        </label>
      </div>

      <div class="settings-group">
        <h3>Sorting</h3>
        <label class="setting">
          <span>Default sort order</span>
          <select
            value={settings.defaultSortOrder}
            onChange={(e) =>
              updateSettings({
                defaultSortOrder: (e.target as HTMLSelectElement).value as SortOrder,
              })
            }
          >
            <option value="domain">By Domain</option>
            <option value="url">By URL</option>
            <option value="title">By Title</option>
            <option value="ageOldest">By Age (oldest first)</option>
            <option value="ageNewest">By Age (newest first)</option>
          </select>
        </label>

        <label class="setting checkbox">
          <input
            type="checkbox"
            checked={settings.sortPreserveGroups}
            onChange={(e) =>
              updateSettings({
                sortPreserveGroups: (e.target as HTMLInputElement).checked,
              })
            }
          />
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

