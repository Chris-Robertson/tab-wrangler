import { useState } from 'preact/hooks';
import { useSettings } from './hooks/useSettings';
import { useGroupingRules, type NewRuleInput } from './hooks/useGroupingRules';
import { GroupingRuleList } from './components/GroupingRuleList';
import { RuleEditor } from './components/RuleEditor';
import type { DuplicateDetectionMode, SortOrder, GroupingRule } from '../shared/types/rules';

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

