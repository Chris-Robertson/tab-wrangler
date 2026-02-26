/**
 * WhitelistRuleEditor Component
 * Modal/form for adding or editing whitelist rules
 * No duration field — whitelist rules protect indefinitely.
 */

import { useState, useMemo } from 'preact/hooks';
import type { WhitelistRule, PatternType } from '../../shared/types';
import { validatePattern } from '../../shared/utils/pattern-matcher';

interface WhitelistRuleEditorProps {
  /** Existing rule to edit, or undefined for add mode */
  rule?: WhitelistRule;
  /** Initial URL to populate pattern field (AC3 - auto-populate from active tab) */
  initialUrl?: string;
  /** Callback when rule is saved */
  onSave: (rule: { pattern: string; patternType: PatternType; enabled: boolean }) => void;
  /** Callback when editor is cancelled/closed */
  onCancel: () => void;
}

export function WhitelistRuleEditor({ rule, initialUrl, onSave, onCancel }: WhitelistRuleEditorProps) {
  const [pattern, setPattern] = useState(rule?.pattern ?? initialUrl ?? '');
  const [patternType, setPatternType] = useState<PatternType>(rule?.patternType ?? 'glob');
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!rule;

  /** Real-time validity — keeps Save button disabled until all fields are valid */
  const isFormValid = useMemo(() => {
    if (!pattern.trim()) return false;
    if (!validatePattern(pattern, patternType).valid) return false;
    return true;
  }, [pattern, patternType]);

  const handleSave = () => {
    // Clear any previous error
    setError(null);

    // Validate pattern
    const validation = validatePattern(pattern, patternType);
    if (!validation.valid) {
      setError(validation.error ?? 'Invalid pattern');
      return;
    }

    onSave({ pattern, patternType, enabled });
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
          {isEditMode ? 'Edit Whitelist Rule' : 'Add Whitelist Rule'}
        </h3>

        <div class="rule-editor-form">
          {/* Pattern Input */}
          <div class="form-group">
            <label class="form-label" for="pattern-input">URL Pattern</label>
            <input
              id="pattern-input"
              type="text"
              class={`form-input ${error && error.toLowerCase().includes('pattern') ? 'error' : ''}`}
              value={pattern}
              onInput={(e) => {
                setPattern((e.target as HTMLInputElement).value);
                setError(null);
              }}
              placeholder={patternType === 'glob' ? '*.reddit.com/*' : '^https://reddit\\.com/.*'}
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
                ? 'Use * for wildcards (e.g., *.reddit.com/*)'
                : 'Use JavaScript regex syntax (e.g., ^https://reddit\\.com/.*)'}
            </span>
          </div>

          {/* Enabled Toggle */}
          <div class="form-group">
            <label class="form-label form-label--inline" for="enabled-checkbox">
              <input
                id="enabled-checkbox"
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled((e.target as HTMLInputElement).checked)}
              />
              {' '}Enabled
            </label>
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
          <button type="button" class="primary-button" onClick={handleSave} disabled={!isFormValid}>
            {isEditMode ? 'Save Changes' : 'Add Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}
