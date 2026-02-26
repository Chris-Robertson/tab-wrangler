/**
 * ArchiveExclusionRuleList Component
 * Displays list of archive exclusion rules with edit/delete/reorder actions.
 * No enabled toggle — all stored rules are always active.
 */

import { useState } from 'preact/hooks';
import type { ArchiveExclusionRule } from '../../shared/types';

interface ArchiveExclusionRuleListProps {
  rules: ArchiveExclusionRule[];
  onEdit: (rule: ArchiveExclusionRule) => void;
  onDelete: (id: string) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

export function ArchiveExclusionRuleList({
  rules,
  onEdit,
  onDelete,
  onReorder,
}: ArchiveExclusionRuleListProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteClick = (rule: ArchiveExclusionRule) => {
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
        <p>No exclusion rules defined. All auto-closed tabs will be archived.</p>
      </div>
    );
  }

  return (
    <div class="rule-list">
      {rules.map((rule, index) => (
        <div key={rule.id} class="rule-item">
          {/* Rule Info */}
          <div class="rule-info">
            <div class="rule-pattern">
              <span class="pattern-text">{rule.pattern}</span>
              <span class={`pattern-badge ${rule.patternType}`}>{rule.patternType}</span>
            </div>
          </div>

          {/* Actions */}
          <div class="rule-actions">
            {/* Reorder Buttons */}
            {onReorder && (
              <div class="reorder-buttons">
                <button
                  type="button"
                  class="icon-button reorder-up-btn"
                  onClick={() => onReorder(index, index - 1)}
                  disabled={index === 0}
                  title="Move rule up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  class="icon-button reorder-down-btn"
                  onClick={() => onReorder(index, index + 1)}
                  disabled={index === rules.length - 1}
                  title="Move rule down"
                >
                  ▼
                </button>
              </div>
            )}

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
                <p>Are you sure you want to delete this rule?</p>
                <div class="rule-preview">
                  <strong>{rule.pattern}</strong>
                </div>
                <div class="delete-confirm-actions">
                  <button type="button" class="secondary-button" onClick={handleDeleteCancel}>
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
