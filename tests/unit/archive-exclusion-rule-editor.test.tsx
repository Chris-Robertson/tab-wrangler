/**
 * Unit tests for ArchiveExclusionRuleEditor component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { ArchiveExclusionRuleEditor } from '../../src/options/components/ArchiveExclusionRuleEditor';
import type { ArchiveExclusionRule } from '../../src/shared/types';

describe('ArchiveExclusionRuleEditor', () => {
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with empty form in add mode', () => {
    const { getByLabelText, getByText } = render(
      <ArchiveExclusionRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />,
    );

    expect(getByLabelText('URL Pattern')).toBeDefined();
    expect(getByText('Pattern Type')).toBeDefined();
  });

  it('should disable Save button when pattern is empty (AC7)', () => {
    const { getByText } = render(
      <ArchiveExclusionRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />,
    );

    const saveButton = getByText('Add Rule') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it('should enable Save button when valid glob pattern entered (AC7)', () => {
    const { getByLabelText, getByText } = render(
      <ArchiveExclusionRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />,
    );

    const patternInput = getByLabelText('URL Pattern') as HTMLInputElement;
    fireEvent.input(patternInput, { target: { value: '*.reddit.com/*' } });

    const saveButton = getByText('Add Rule') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);
  });

  it('should show error for invalid regex pattern (AC7)', () => {
    const { getByLabelText, getByText } = render(
      <ArchiveExclusionRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />,
    );

    const patternInput = getByLabelText('URL Pattern') as HTMLInputElement;
    fireEvent.input(patternInput, { target: { value: 'invalid[regex' } });

    const regexButton = getByText('Regex');
    fireEvent.click(regexButton);

    const saveButton = getByText('Add Rule');
    fireEvent.click(saveButton);

    const errorText = document.body.textContent || '';
    expect(errorText.toLowerCase()).toContain('invalid');
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('should auto-populate pattern with initialUrl (AC7)', () => {
    const { getByLabelText } = render(
      <ArchiveExclusionRuleEditor
        initialUrl="https://example.com/path"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />,
    );

    const patternInput = getByLabelText('URL Pattern') as HTMLInputElement;
    expect(patternInput.value).toBe('https://example.com/path');
  });

  it('should pre-fill form when editing existing rule', () => {
    const existingRule: ArchiveExclusionRule = {
      id: 'rule-1',
      pattern: '*.reddit.com/*',
      patternType: 'glob',
    };

    const { getByLabelText, getByText } = render(
      <ArchiveExclusionRuleEditor rule={existingRule} onSave={mockOnSave} onCancel={mockOnCancel} />,
    );

    const patternInput = getByLabelText('URL Pattern') as HTMLInputElement;
    expect(patternInput.value).toBe('*.reddit.com/*');
    expect(getByText('Edit Exclusion Rule')).toBeDefined();
  });

  it('should NOT render an enabled checkbox (AC5, AC8)', () => {
    const { container } = render(
      <ArchiveExclusionRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />,
    );

    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(0);
  });

  it('should call onSave with { pattern, patternType } on valid submit (AC7, AC8)', () => {
    const { getByLabelText, getByText } = render(
      <ArchiveExclusionRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />,
    );

    const patternInput = getByLabelText('URL Pattern') as HTMLInputElement;
    fireEvent.input(patternInput, { target: { value: '*.reddit.com/*' } });

    const saveButton = getByText('Add Rule');
    fireEvent.click(saveButton);

    expect(mockOnSave).toHaveBeenCalledWith({
      pattern: '*.reddit.com/*',
      patternType: 'glob',
    });
  });

  it('should call onCancel when Cancel clicked', () => {
    const { getByText } = render(
      <ArchiveExclusionRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />,
    );

    const cancelButton = getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('should switch between glob and regex pattern types', () => {
    const { getByText } = render(
      <ArchiveExclusionRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />,
    );

    const regexButton = getByText('Regex');
    fireEvent.click(regexButton);

    expect(regexButton.classList.contains('active')).toBe(true);
  });

  it('should not have duration or number inputs (AC7)', () => {
    const { container } = render(
      <ArchiveExclusionRuleEditor onSave={mockOnSave} onCancel={mockOnCancel} />,
    );

    const numberInputs = container.querySelectorAll('input[type="number"]');
    expect(numberInputs.length).toBe(0);
  });
});
