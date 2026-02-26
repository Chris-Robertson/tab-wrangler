/**
 * Unit tests for AutoCloseRuleList component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { AutoCloseRuleList } from '../../src/options/components/AutoCloseRuleList';
import type { AutoCloseRule } from '../../src/shared/types';

describe('AutoCloseRuleList', () => {
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnToggleEnabled = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show empty state when no rules exist (AC1)', () => {
    const { getByText } = render(
      <AutoCloseRuleList
        rules={[]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleEnabled={mockOnToggleEnabled}
      />
    );

    expect(getByText(/no auto-close rules defined/i)).toBeDefined();
  });

  it('should display rules with pattern, type, and duration (AC2)', () => {
    const rules: AutoCloseRule[] = [
      {
        id: 'rule-1',
        pattern: '*.reddit.com/*',
        patternType: 'glob',
        maxAge: 7200000, // 2 hours
        enabled: true,
      },
    ];

    const { getByText } = render(
      <AutoCloseRuleList
        rules={rules}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleEnabled={mockOnToggleEnabled}
      />
    );

    expect(getByText('*.reddit.com/*')).toBeDefined();
    expect(getByText('glob')).toBeDefined();
    expect(getByText(/2 hours/i)).toBeDefined();
  });

  it('should display multiple rules (AC2)', () => {
    const rules: AutoCloseRule[] = [
      {
        id: 'rule-1',
        pattern: '*.reddit.com/*',
        patternType: 'glob',
        maxAge: 7200000,
        enabled: true,
      },
      {
        id: 'rule-2',
        pattern: '/^https:\\/\\/twitter\\.com\\/.*/i',
        patternType: 'regex',
        maxAge: 3600000, // 1 hour
        enabled: true,
      },
    ];

    const { getByText } = render(
      <AutoCloseRuleList
        rules={rules}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleEnabled={mockOnToggleEnabled}
      />
    );

    expect(getByText('*.reddit.com/*')).toBeDefined();
    expect(getByText('/^https:\\/\\/twitter\\.com\\/.*/i')).toBeDefined();
    expect(getByText(/2 hours/i)).toBeDefined();
    expect(getByText(/1 hour/i)).toBeDefined();
  });

  it('should call onEdit when edit button clicked (AC4)', () => {
    const rules: AutoCloseRule[] = [
      {
        id: 'rule-1',
        pattern: '*.reddit.com/*',
        patternType: 'glob',
        maxAge: 7200000,
        enabled: true,
      },
    ];

    const { container } = render(
      <AutoCloseRuleList
        rules={rules}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleEnabled={mockOnToggleEnabled}
      />
    );

    const editButton = container.querySelector('.edit-button') as HTMLButtonElement;
    fireEvent.click(editButton);

    expect(mockOnEdit).toHaveBeenCalledWith(rules[0]);
  });

  it('should show delete confirmation before deletion (AC5)', () => {
    const rules: AutoCloseRule[] = [
      {
        id: 'rule-1',
        pattern: '*.reddit.com/*',
        patternType: 'glob',
        maxAge: 7200000,
        enabled: true,
      },
    ];

    const { container, getByText } = render(
      <AutoCloseRuleList
        rules={rules}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleEnabled={mockOnToggleEnabled}
      />
    );

    const deleteButton = container.querySelector('.delete-button') as HTMLButtonElement;
    fireEvent.click(deleteButton);

    // Confirmation dialog should appear
    expect(getByText('Delete Rule?')).toBeDefined();
    expect(getByText(/are you sure/i)).toBeDefined();
    
    // Should not delete yet
    expect(mockOnDelete).not.toHaveBeenCalled();
  });

  it('should delete rule after confirmation (AC5)', () => {
    const rules: AutoCloseRule[] = [
      {
        id: 'rule-1',
        pattern: '*.reddit.com/*',
        patternType: 'glob',
        maxAge: 7200000,
        enabled: true,
      },
    ];

    const { container, getByText } = render(
      <AutoCloseRuleList
        rules={rules}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleEnabled={mockOnToggleEnabled}
      />
    );

    // Click delete button
    const deleteButton = container.querySelector('.delete-button') as HTMLButtonElement;
    fireEvent.click(deleteButton);

    // Click confirm in dialog
    const confirmButton = getByText('Delete');
    fireEvent.click(confirmButton);

    expect(mockOnDelete).toHaveBeenCalledWith('rule-1');
  });

  it('should cancel deletion when cancel clicked (AC5)', () => {
    const rules: AutoCloseRule[] = [
      {
        id: 'rule-1',
        pattern: '*.reddit.com/*',
        patternType: 'glob',
        maxAge: 7200000,
        enabled: true,
      },
    ];

    const { container, getByText } = render(
      <AutoCloseRuleList
        rules={rules}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleEnabled={mockOnToggleEnabled}
      />
    );

    // Click delete button
    const deleteButton = container.querySelector('.delete-button') as HTMLButtonElement;
    fireEvent.click(deleteButton);

    // Click cancel in dialog
    const cancelButton = getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnDelete).not.toHaveBeenCalled();
  });

  it('should toggle enabled status when toggle clicked (AC9)', () => {
    const rules: AutoCloseRule[] = [
      {
        id: 'rule-1',
        pattern: '*.reddit.com/*',
        patternType: 'glob',
        maxAge: 7200000,
        enabled: true,
      },
    ];

    const { container } = render(
      <AutoCloseRuleList
        rules={rules}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleEnabled={mockOnToggleEnabled}
      />
    );

    const toggleSwitch = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.change(toggleSwitch);

    expect(mockOnToggleEnabled).toHaveBeenCalledWith('rule-1');
  });

  it('should show disabled style for disabled rules (AC9)', () => {
    const rules: AutoCloseRule[] = [
      {
        id: 'rule-1',
        pattern: '*.reddit.com/*',
        patternType: 'glob',
        maxAge: 7200000,
        enabled: false,
      },
    ];

    const { container } = render(
      <AutoCloseRuleList
        rules={rules}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleEnabled={mockOnToggleEnabled}
      />
    );

    const ruleItem = container.querySelector('.rule-item');
    expect(ruleItem?.classList.contains('disabled')).toBe(true);
  });
});
