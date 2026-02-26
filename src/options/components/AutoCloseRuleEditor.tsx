/**
 * AutoCloseRuleEditor Component
 * Modal/form for adding or editing auto-close rules
 */

import { useState, useMemo } from 'preact/hooks';
import type { AutoCloseRule, PatternType } from '../../shared/types';
import { validatePattern } from '../../shared/utils/pattern-matcher';
import {
  parseDurationFromValue,
  formatDurationToObject,
  type DurationUnit,
} from '../../shared/utils/duration-utils';
import { DURATION_PRESETS } from '../../shared/constants';

interface AutoCloseRuleEditorProps {
  /** Existing rule to edit, or undefined for add mode */
  rule?: AutoCloseRule;
  /** Initial URL to populate pattern field (AC3 - auto-populate from active tab) */
  initialUrl?: string;
  /** Callback when rule is saved */
  onSave: (rule: { pattern: string; patternType: PatternType; maxAge: number; enabled: boolean }) => void;
  /** Callback when editor is cancelled/closed */
  onCancel: () => void;
}

/** Max duration: 365 days in milliseconds */
const MAX_DURATION_MS = 365 * 24 * 60 * 60 * 1000;

export function AutoCloseRuleEditor({ rule, initialUrl, onSave, onCancel }: AutoCloseRuleEditorProps) {
  const [pattern, setPattern] = useState(rule?.pattern ?? initialUrl ?? '');
  const [patternType, setPatternType] = useState<PatternType>(rule?.patternType ?? 'glob');
  
  // Parse existing maxAge or default to 2 hours
  const [durationValue, setDurationValue] = useState(() => {
    if (rule) {
      const { value } = formatDurationToObject(rule.maxAge);
      return value;
    }
    return 2; // Default: 2 hours
  });
  
  const [durationUnit, setDurationUnit] = useState<DurationUnit>(() => {
    if (rule) {
      const { unit } = formatDurationToObject(rule.maxAge);
      return unit;
    }
    return 'hours';
  });

  const [enabled, setEnabled] = useState(rule?.enabled ?? true);

  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!rule;

  /** Real-time validity — keeps Save button disabled until all fields are valid */
  const isFormValid = useMemo(() => {
    if (!pattern.trim()) return false;
    if (!validatePattern(pattern, patternType).valid) return false;
    if (!durationValue || durationValue <= 0) return false;
    return parseDurationFromValue(durationValue, durationUnit) <= MAX_DURATION_MS;
  }, [pattern, patternType, durationValue, durationUnit]);

  const handleSave = () => {
    // Clear any previous error
    setError(null);

    // Validate pattern
    const validation = validatePattern(pattern, patternType);
    if (!validation.valid) {
      setError(validation.error ?? 'Invalid pattern');
      return;
    }

    // Validate duration
    if (!durationValue || durationValue <= 0) {
      setError('Duration must be a positive number');
      return;
    }

    const maxAge = parseDurationFromValue(durationValue, durationUnit);

    // Validate max duration (365 days)
    if (maxAge > MAX_DURATION_MS) {
      setError('Duration cannot exceed 365 days');
      return;
    }

    onSave({ pattern, patternType, maxAge, enabled });
  };

  const handlePatternTypeChange = (newType: PatternType) => {
    setPatternType(newType);
    // Clear error when switching types - pattern might be valid in new type
    setError(null);
  };

  const handlePresetSelect = (presetValue: number) => {
    const { value, unit } = formatDurationToObject(presetValue);
    setDurationValue(value);
    setDurationUnit(unit);
  };

  return (
    <div class="rule-editor-overlay" onClick={onCancel}>
      <div class="rule-editor-modal" onClick={(e) => e.stopPropagation()}>
        <h3 class="rule-editor-title">
          {isEditMode ? 'Edit Auto-Close Rule' : 'Add Auto-Close Rule'}
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

          {/* Duration Input with Unit Selector */}
          <div class="form-group">
            <label class="form-label" for="duration-value">Max Age (Close after inactive for)</label>
            <div class="duration-input-group">
              <input
                id="duration-value"
                type="number"
                class={`form-input duration-value-input ${error && error.toLowerCase().includes('duration') ? 'error' : ''}`}
                value={durationValue}
                onInput={(e) => {
                  const val = parseFloat((e.target as HTMLInputElement).value);
                  setDurationValue(val);
                  setError(null);
                }}
                min="0"
                step="1"
              />
              <select
                class="form-select duration-unit-select"
                value={durationUnit}
                onChange={(e) => {
                  setDurationUnit((e.target as HTMLSelectElement).value as DurationUnit);
                }}
                aria-label="Duration unit"
              >
                <option value="minutes">minutes</option>
                <option value="hours">hours</option>
                <option value="days">days</option>
              </select>
            </div>
          </div>

          {/* Duration Presets */}
          <div class="form-group">
            <label class="form-label">Presets</label>
            <div class="duration-presets">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  class="preset-button"
                  onClick={() => handlePresetSelect(preset.value)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
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
