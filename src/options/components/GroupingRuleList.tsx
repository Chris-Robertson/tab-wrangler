/**
 * GroupingRuleList Component
 * Displays list of grouping rules with edit/delete/reorder functionality
 */

import { useState, useEffect, useRef } from 'preact/hooks';
import type { GroupingRule } from '../../shared/types';
import { TAB_GROUP_COLOR_VALUES } from '../../shared/constants';

interface GroupingRuleListProps {
  /** Array of rules to display */
  rules: GroupingRule[];
  /** Callback when edit button is clicked */
  onEdit: (rule: GroupingRule) => void;
  /** Callback when delete button is clicked */
  onDelete: (id: string) => void;
  /** Callback when rule is moved (fromIndex, toIndex) */
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export function GroupingRuleList({ rules, onEdit, onDelete, onReorder }: GroupingRuleListProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const ruleToDelete = pendingDeleteId ? rules.find((r) => r.id === pendingDeleteId) : null;

  // Focus cancel button when modal opens and handle Escape key
  useEffect(() => {
    if (ruleToDelete && cancelButtonRef.current) {
      cancelButtonRef.current.focus();
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && ruleToDelete) {
        handleDeleteCancel();
      }
    };

    if (ruleToDelete) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [ruleToDelete]);

  if (rules.length === 0) {
    return (
      <div class="empty-state">
        <div class="empty-state-icon">📁</div>
        <h3>No grouping rules yet</h3>
        <p>Add your first rule to automatically organize tabs by URL patterns.</p>
      </div>
    );
  }

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      onReorder(index, index - 1);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < rules.length - 1) {
      onReorder(index, index + 1);
    }
  };

  const handleDeleteClick = (id: string) => {
    setPendingDeleteId(id);
  };

  const handleDeleteConfirm = () => {
    if (pendingDeleteId) {
      onDelete(pendingDeleteId);
      setPendingDeleteId(null);
    }
  };

  const handleDeleteCancel = () => {
    setPendingDeleteId(null);
  };

  return (
    <div class="rule-list">
      {/* Delete confirmation modal */}
      {ruleToDelete && (
        <div class="modal-overlay" onClick={handleDeleteCancel}>
          <div
            class="modal delete-confirm-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            aria-describedby="delete-modal-description"
          >
            <h3 id="delete-modal-title">Delete Rule</h3>
            <p id="delete-modal-description">
              Are you sure you want to delete the rule "{ruleToDelete.groupName}"?
            </p>
            <div class="modal-actions">
              <button 
                type="button" 
                class="btn btn-secondary" 
                onClick={handleDeleteCancel}
                ref={cancelButtonRef}
              >
                Cancel
              </button>
              <button type="button" class="btn btn-danger" onClick={handleDeleteConfirm}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {rules.map((rule, index) => (
        <div key={rule.id} class="rule-card">
          {/* Reorder buttons */}
          <div class="rule-reorder">
            <button
              type="button"
              class="reorder-btn"
              onClick={() => handleMoveUp(index)}
              disabled={index === 0}
              title="Move up"
              aria-label="Move rule up"
            >
              ▲
            </button>
            <button
              type="button"
              class="reorder-btn"
              onClick={() => handleMoveDown(index)}
              disabled={index === rules.length - 1}
              title="Move down"
              aria-label="Move rule down"
            >
              ▼
            </button>
          </div>

          {/* Rule info */}
          <div class="rule-info">
            <div class="rule-header">
              <span
                class="rule-color-badge"
                style={{ backgroundColor: TAB_GROUP_COLOR_VALUES[rule.groupColor] }}
                title={rule.groupColor}
              />
              <span class="rule-group-name">{rule.groupName}</span>
              <span class="rule-pattern-type">{rule.patternType}</span>
            </div>
            <div class="rule-pattern" title={rule.pattern}>
              {rule.pattern}
            </div>
          </div>

          {/* Action buttons */}
          <div class="rule-actions">
            <button
              type="button"
              class="action-btn edit-btn"
              onClick={() => onEdit(rule)}
              title="Edit rule"
              aria-label="Edit rule"
            >
              ✏️
            </button>
            <button
              type="button"
              class="action-btn delete-btn"
              onClick={() => handleDeleteClick(rule.id)}
              title="Delete rule"
              aria-label="Delete rule"
            >
              🗑️
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

