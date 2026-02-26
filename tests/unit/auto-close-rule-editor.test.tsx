/**
 * Unit tests for AutoCloseRuleEditor component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { AutoCloseRuleEditor } from '../../src/options/components/AutoCloseRuleEditor';
import type { AutoCloseRule } from '../../src/shared/types';

describe('AutoCloseRuleEditor', () => {
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with empty form in add mode (AC3)', () => {
    const { getByLabelText, getByText } = render(
      <AutoCloseRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    expect(getByLabelText('URL Pattern')).toBeDefined();
    expect(getByText('Pattern Type')).toBeDefined();
  });

  it('should auto-populate pattern with initialUrl (AC3)', () => {
    const { getByLabelText } = render(
      <AutoCloseRuleEditor
        initialUrl="https://reddit.com/r/test"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const patternInput = getByLabelText('URL Pattern') as HTMLInputElement;
    expect(patternInput.value).toBe('https://reddit.com/r/test');
  });

  it('should pre-fill form when editing existing rule (AC4)', () => {
    const existingRule: AutoCloseRule = {
      id: 'rule-1',
      pattern: '*.reddit.com/*',
      patternType: 'glob',
      maxAge: 7200000, // 2 hours
      enabled: true,
    };

    const { getByLabelText, getByText } = render(
      <AutoCloseRuleEditor
        rule={existingRule}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const patternInput = getByLabelText('URL Pattern') as HTMLInputElement;
    expect(patternInput.value).toBe('*.reddit.com/*');
    expect(getByText('Edit Auto-Close Rule')).toBeDefined();
  });

  it('should validate empty pattern and show error (AC10)', () => {
    const { getByLabelText, getByText } = render(
      <AutoCloseRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    const saveButton = getByText('Add Rule');
    fireEvent.click(saveButton);

    expect(getByText('Pattern cannot be empty')).toBeDefined();
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('should validate regex syntax and show error (AC10)', () => {
    const { getByLabelText, getByText } = render(
      <AutoCloseRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    const patternInput = getByLabelText('URL Pattern') as HTMLInputElement;
    fireEvent.input(patternInput, { target: { value: 'invalid[regex' } });

    // Switch to regex mode
    const regexButton = getByText('Regex');
    fireEvent.click(regexButton);

    const saveButton = getByText('Add Rule');
    fireEvent.click(saveButton);

    // Should show regex error
    const errorText = document.body.textContent || '';
    expect(errorText.toLowerCase()).toContain('invalid');
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('should save valid rule with pattern and duration (AC6, AC7)', () => {
    const { getByLabelText, getByText } = render(
      <AutoCloseRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    const patternInput = getByLabelText('URL Pattern') as HTMLInputElement;
    fireEvent.input(patternInput, { target: { value: '*.reddit.com/*' } });

    const saveButton = getByText('Add Rule');
    fireEvent.click(saveButton);

    expect(mockOnSave).toHaveBeenCalledWith({
      pattern: '*.reddit.com/*',
      patternType: 'glob',
      maxAge: 7200000, // Default 2 hours
    });
  });

  it('should call onCancel when cancel button clicked', () => {
    const { getByText } = render(
      <AutoCloseRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    const cancelButton = getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('should switch between glob and regex pattern types (AC6)', () => {
    const { getByText } = render(
      <AutoCloseRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    const regexButton = getByText('Regex');
    fireEvent.click(regexButton);

    // Check active state (button should have 'active' class)
    expect(regexButton.classList.contains('active')).toBe(true);
  });

  it('should validate positive duration (AC10)', () => {
    const { getByLabelText, getByText } = render(
      <AutoCloseRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    const patternInput = getByLabelText('URL Pattern') as HTMLInputElement;
    fireEvent.input(patternInput, { target: { value: '*.test.com/*' } });

    // Find duration input by looking for number input
    const durationInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.input(durationInput, { target: { value: '0' } });

    const saveButton = getByText('Add Rule');
    fireEvent.click(saveButton);

    expect(getByText('Duration must be a positive number')).toBeDefined();
    expect(mockOnSave).not.toHaveBeenCalled();
  });
});
