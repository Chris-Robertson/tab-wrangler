/**
 * AutoCloseRuleList Component
 * Displays list of auto-close rules with edit/delete/toggle actions
 */

import { useState } from 'preact/hooks';
import type { AutoCloseRule } from '../../shared/types';
import { formatDurationDisplay } from '../../shared/utils/duration-utils';

interface AutoCloseRuleListProps {
  rules: AutoCloseRule[];
  onEdit: (rule: AutoCloseRule) => void;
  onDelete: (id: string) => void;
  onToggleEnabled: (id: string) => void;
}

export function AutoCloseRuleList({ rules, onEdit, onDelete, onToggleEnabled }: AutoCloseRuleListProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteClick = (rule: AutoCloseRule) => {
    setDeleteConfirmId(rule.id);
  };

  const handleDeleteConfirm = (id: string) => {
    onDelete(id);
    setDeleteConfirmId(null);
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmId(null);
  };

  if (rules.length === 0) {
    return (
      <div class="empty-state">
        <p>No auto-close rules defined. Add your first rule to start automatically closing stale tabs.</p>
      </div>
    );
  }

  return (
    <div class="rule-list">
      {rules.map((rule) => (
        <div
          key={rule.id}
          class={`rule-item ${!rule.enabled ? 'disabled' : ''}`}
        >
          {/* Rule Info */}
          <div class="rule-info">
            <div class="rule-pattern">
              <span class="pattern-text">{rule.pattern}</span>
              <span class={`pattern-badge ${rule.patternType}`}>
                {rule.patternType}
              </span>
            </div>
            <div class="rule-details">
              <span class="rule-duration">
                Close after {formatDurationDisplay(rule.maxAge)} inactive
              </span>
            </div>
          </div>

          {/* Actions */}
          <div class="rule-actions">
            {/* Enabled Toggle */}
            <label class="toggle-switch" title={rule.enabled ? 'Disable rule' : 'Enable rule'}>
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={() => onToggleEnabled(rule.id)}
              />
              <span class="toggle-slider"></span>
            </label>

            {/* Edit Button */}
            <button
              type="button"
              class="icon-button edit-button"
              onClick={() => onEdit(rule)}
              title="Edit rule"
            >
              ✏️
            </button>

            {/* Delete Button */}
            <button
              type="button"
              class="icon-button delete-button"
              onClick={() => handleDeleteClick(rule)}
              title="Delete rule"
            >
              🗑️
            </button>
          </div>

          {/* Delete Confirmation Dialog */}
          {deleteConfirmId === rule.id && (
            <div class="delete-confirm-overlay" onClick={handleDeleteCancel}>
              <div class="delete-confirm-dialog" onClick={(e) => e.stopPropagation()}>
                <h4>Delete Rule?</h4>
                <p>
                  Are you sure you want to delete this rule?
                </p>
                <div class="rule-preview">
                  <strong>{rule.pattern}</strong>
                  <span> ({formatDurationDisplay(rule.maxAge)})</span>
                </div>
                <div class="delete-confirm-actions">
                  <button
                    type="button"
                    class="secondary-button"
                    onClick={handleDeleteCancel}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    class="danger-button"
                    onClick={() => handleDeleteConfirm(rule.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
