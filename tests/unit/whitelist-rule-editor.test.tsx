/**
 * Unit tests for WhitelistRuleEditor component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { WhitelistRuleEditor } from '../../src/options/components/WhitelistRuleEditor';
import type { WhitelistRule } from '../../src/shared/types';

describe('WhitelistRuleEditor', () => {
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with empty form in add mode (AC3)', () => {
    const { getByLabelText, getByText } = render(
      <WhitelistRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    expect(getByLabelText('URL Pattern')).toBeDefined();
    expect(getByText('Pattern Type')).toBeDefined();
  });

  it('should auto-populate pattern with initialUrl (AC3)', () => {
    const { getByLabelText } = render(
      <WhitelistRuleEditor
        initialUrl="https://reddit.com/r/test"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const patternInput = getByLabelText('URL Pattern') as HTMLInputElement;
    expect(patternInput.value).toBe('https://reddit.com/r/test');
  });

  it('should pre-fill form when editing existing rule (AC5)', () => {
    const existingRule: WhitelistRule = {
      id: 'rule-1',
      pattern: '*.reddit.com/*',
      patternType: 'glob',
      enabled: true,
    };

    const { getByLabelText, getByText } = render(
      <WhitelistRuleEditor rule={existingRule} onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    const patternInput = getByLabelText('URL Pattern') as HTMLInputElement;
    expect(patternInput.value).toBe('*.reddit.com/*');
    expect(getByText('Edit Whitelist Rule')).toBeDefined();
  });

  it('should have save button disabled when pattern is empty (AC7)', () => {
    const { getByText } = render(
      <WhitelistRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    const saveButton = getByText('Add Rule') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it('should enable save button once a valid glob pattern is entered (AC7)', () => {
    const { getByLabelText, getByText } = render(
      <WhitelistRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    const patternInput = getByLabelText('URL Pattern') as HTMLInputElement;
    fireEvent.input(patternInput, { target: { value: '*.reddit.com/*' } });

    const saveButton = getByText('Add Rule') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);
  });

  it('should show error and disable Save for empty pattern on submit (AC7)', () => {
    const { getByText } = render(
      <WhitelistRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    const saveButton = getByText('Add Rule');
    fireEvent.click(saveButton);

    expect(getByText('Pattern cannot be empty')).toBeDefined();
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('should show error for invalid regex pattern (AC7)', () => {
    const { getByLabelText, getByText } = render(
      <WhitelistRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    const patternInput = getByLabelText('URL Pattern') as HTMLInputElement;
    fireEvent.input(patternInput, { target: { value: 'invalid[regex' } });

    // Switch to regex mode
    const regexButton = getByText('Regex');
    fireEvent.click(regexButton);

    const saveButton = getByText('Add Rule');
    fireEvent.click(saveButton);

    const errorText = document.body.textContent || '';
    expect(errorText.toLowerCase()).toContain('invalid');
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('should call onSave with correct data for valid glob pattern (AC7, AC8)', () => {
    const { getByLabelText, getByText } = render(
      <WhitelistRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    const patternInput = getByLabelText('URL Pattern') as HTMLInputElement;
    fireEvent.input(patternInput, { target: { value: '*.reddit.com/*' } });

    const saveButton = getByText('Add Rule');
    fireEvent.click(saveButton);

    expect(mockOnSave).toHaveBeenCalledWith({
      pattern: '*.reddit.com/*',
      patternType: 'glob',
      enabled: true,
    });
  });

  it('should default enabled checkbox to checked (AC4)', () => {
    const { getByLabelText } = render(
      <WhitelistRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    const enabledCheckbox = getByLabelText(/enabled/i) as HTMLInputElement;
    expect(enabledCheckbox.checked).toBe(true);
  });

  it('should call onSave with enabled=false when checkbox unchecked (AC9)', () => {
    const { getByLabelText, getByText } = render(
      <WhitelistRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    const patternInput = getByLabelText('URL Pattern') as HTMLInputElement;
    fireEvent.input(patternInput, { target: { value: '*.test.com/*' } });

    const enabledCheckbox = getByLabelText(/enabled/i) as HTMLInputElement;
    fireEvent.change(enabledCheckbox, { target: { checked: false } });

    const saveButton = getByText('Add Rule');
    fireEvent.click(saveButton);

    expect(mockOnSave).toHaveBeenCalledWith({
      pattern: '*.test.com/*',
      patternType: 'glob',
      enabled: false,
    });
  });

  it('should call onCancel when Cancel button clicked', () => {
    const { getByText } = render(
      <WhitelistRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    const cancelButton = getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('should switch between glob and regex pattern types (AC7)', () => {
    const { getByText } = render(
      <WhitelistRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    const regexButton = getByText('Regex');
    fireEvent.click(regexButton);

    expect(regexButton.classList.contains('active')).toBe(true);
  });

  it('should not have duration fields (AC4)', () => {
    const { container } = render(
      <WhitelistRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    // No number input for duration
    const numberInputs = container.querySelectorAll('input[type="number"]');
    expect(numberInputs.length).toBe(0);
  });
});
