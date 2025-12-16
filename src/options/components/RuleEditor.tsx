/**
 * RuleEditor Component
 * Modal/form for adding or editing grouping rules
 */

import { useState } from 'preact/hooks';
import type { GroupingRule, PatternType, TabGroupColor } from '../../shared/types';
import { validatePattern } from '../../shared/utils/pattern-matcher';
import { ColorPicker } from './ColorPicker';

interface RuleEditorProps {
  /** Existing rule to edit, or undefined for add mode */
  rule?: GroupingRule;
  /** Callback when rule is saved */
  onSave: (rule: { pattern: string; patternType: PatternType; groupName: string; groupColor: TabGroupColor }) => void;
  /** Callback when editor is cancelled/closed */
  onCancel: () => void;
}

export function RuleEditor({ rule, onSave, onCancel }: RuleEditorProps) {
  const [pattern, setPattern] = useState(rule?.pattern ?? '');
  const [patternType, setPatternType] = useState<PatternType>(rule?.patternType ?? 'glob');
  const [groupName, setGroupName] = useState(rule?.groupName ?? '');
  const [groupColor, setGroupColor] = useState<TabGroupColor>(rule?.groupColor ?? 'blue');
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!rule;

  const handleSave = () => {
    // Clear any previous error
    setError(null);

    // Validate pattern
    const validation = validatePattern(pattern, patternType);
    if (!validation.valid) {
      setError(validation.error ?? 'Invalid pattern');
      return;
    }

    // Validate group name
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }

    onSave({ pattern, patternType, groupName: groupName.trim(), groupColor });
  };

  const handlePatternTypeChange = (newType: PatternType) => {
    setPatternType(newType);
    // Clear error when switching types - pattern might be valid in new type
    setError(null);
  };

  return (
    <div class="rule-editor-overlay" onClick={onCancel}>
      <div class="rule-editor-modal" onClick={(e) => e.stopPropagation()}>
        <h3 class="rule-editor-title">
          {isEditMode ? 'Edit Grouping Rule' : 'Add Grouping Rule'}
        </h3>

        <div class="rule-editor-form">
          {/* Pattern Input */}
          <div class="form-group">
            <label class="form-label">URL Pattern</label>
            <input
              type="text"
              class={`form-input ${error && error.toLowerCase().includes('pattern') ? 'error' : ''}`}
              value={pattern}
              onInput={(e) => {
                setPattern((e.target as HTMLInputElement).value);
                setError(null);
              }}
              placeholder={patternType === 'glob' ? '*.github.com/*' : '^https://github\\.com/.*'}
            />
          </div>

          {/* Pattern Type Toggle */}
          <div class="form-group">
            <label class="form-label">Pattern Type</label>
            <div class="pattern-type-toggle">
              <button
                type="button"
                class={`pattern-type-btn ${patternType === 'glob' ? 'active' : ''}`}
                onClick={() => handlePatternTypeChange('glob')}
              >
                Glob
              </button>
              <button
                type="button"
                class={`pattern-type-btn ${patternType === 'regex' ? 'active' : ''}`}
                onClick={() => handlePatternTypeChange('regex')}
              >
                Regex
              </button>
            </div>
            <span class="form-hint">
              {patternType === 'glob'
                ? 'Use * for wildcards (e.g., *.github.com/*)'
                : 'Use JavaScript regex syntax (e.g., ^https://github\\.com/.*)'}
            </span>
          </div>

          {/* Group Name Input */}
          <div class="form-group">
            <label class="form-label">Group Name</label>
            <input
              type="text"
              class={`form-input ${error && error.toLowerCase().includes('name') ? 'error' : ''}`}
              value={groupName}
              onInput={(e) => {
                setGroupName((e.target as HTMLInputElement).value);
                setError(null);
              }}
              placeholder="GitHub"
            />
          </div>

          {/* Color Picker */}
          <div class="form-group">
            <label class="form-label">Group Color</label>
            <ColorPicker
              selectedColor={groupColor}
              onColorSelect={setGroupColor}
            />
          </div>

          {/* Error Display */}
          {error && (
            <div class="form-error">
              {error}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div class="rule-editor-actions">
          <button type="button" class="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" class="primary-button" onClick={handleSave}>
            {isEditMode ? 'Save Changes' : 'Add Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}

