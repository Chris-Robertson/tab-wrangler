/**
 * Unit tests for WhitelistRuleList component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { WhitelistRuleList } from '../../src/options/components/WhitelistRuleList';
import type { WhitelistRule } from '../../src/shared/types';

describe('WhitelistRuleList', () => {
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnToggleEnabled = vi.fn();
  const mockOnReorder = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show empty state when rules is empty (AC1)', () => {
    const { getByText } = render(
      <WhitelistRuleList
        rules={[]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleEnabled={mockOnToggleEnabled}
      />
    );

    expect(getByText(/no whitelist rules defined/i)).toBeDefined();
  });

  it('should display rule with pattern and pattern type badge (AC2)', () => {
    const rules: WhitelistRule[] = [
      {
        id: 'rule-1',
        pattern: '*.reddit.com/*',
        patternType: 'glob',
        enabled: true,
      },
    ];

    const { getByText } = render(
      <WhitelistRuleList
        rules={rules}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleEnabled={mockOnToggleEnabled}
      />
    );

    expect(getByText('*.reddit.com/*')).toBeDefined();
    expect(getByText('glob')).toBeDefined();
  });

  it('should display multiple rules (AC2)', () => {
    const rules: WhitelistRule[] = [
      {
        id: 'rule-1',
        pattern: '*.reddit.com/*',
        patternType: 'glob',
        enabled: true,
      },
      {
        id: 'rule-2',
        pattern: '^https://twitter\\.com/.*',
        patternType: 'regex',
        enabled: true,
      },
    ];

    const { getByText } = render(
      <WhitelistRuleList
        rules={rules}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleEnabled={mockOnToggleEnabled}
      />
    );

    expect(getByText('*.reddit.com/*')).toBeDefined();
    expect(getByText('^https://twitter\\.com/.*')).toBeDefined();
    expect(getByText('glob')).toBeDefined();
    expect(getByText('regex')).toBeDefined();
  });

  it('should call onEdit when Edit button clicked (AC5)', () => {
    const rules: WhitelistRule[] = [
      {
        id: 'rule-1',
        pattern: '*.reddit.com/*',
        patternType: 'glob',
        enabled: true,
      },
    ];

    const { container } = render(
      <WhitelistRuleList
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

  it('should show delete confirmation before deletion (AC6)', () => {
    const rules: WhitelistRule[] = [
      {
        id: 'rule-1',
        pattern: '*.reddit.com/*',
        patternType: 'glob',
        enabled: true,
      },
    ];

    const { container, getByText } = render(
      <WhitelistRuleList
        rules={rules}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleEnabled={mockOnToggleEnabled}
      />
    );

    const deleteButton = container.querySelector('.delete-button') as HTMLButtonElement;
    fireEvent.click(deleteButton);

    expect(getByText('Delete Rule?')).toBeDefined();
    expect(getByText(/are you sure/i)).toBeDefined();
    expect(mockOnDelete).not.toHaveBeenCalled();
  });

  it('should show rule pattern in delete confirmation dialog (AC6)', () => {
    const rules: WhitelistRule[] = [
      {
        id: 'rule-1',
        pattern: '*.reddit.com/*',
        patternType: 'glob',
        enabled: true,
      },
    ];

    const { container, getAllByText } = render(
      <WhitelistRuleList
        rules={rules}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleEnabled={mockOnToggleEnabled}
      />
    );

    const deleteButton = container.querySelector('.delete-button') as HTMLButtonElement;
    fireEvent.click(deleteButton);

    // Pattern should appear in confirmation dialog
    const patternMatches = getAllByText('*.reddit.com/*');
    expect(patternMatches.length).toBeGreaterThan(0);
  });

  it('should call onDelete after confirmation (AC6)', () => {
    const rules: WhitelistRule[] = [
      {
        id: 'rule-1',
        pattern: '*.reddit.com/*',
        patternType: 'glob',
        enabled: true,
      },
    ];

    const { container, getByText } = render(
      <WhitelistRuleList
        rules={rules}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleEnabled={mockOnToggleEnabled}
      />
    );

    const deleteButton = container.querySelector('.delete-button') as HTMLButtonElement;
    fireEvent.click(deleteButton);

    const confirmButton = getByText('Delete');
    fireEvent.click(confirmButton);

    expect(mockOnDelete).toHaveBeenCalledWith('rule-1');
  });

  it('should not call onDelete when cancel clicked in confirmation (AC6)', () => {
    const rules: WhitelistRule[] = [
      {
        id: 'rule-1',
        pattern: '*.reddit.com/*',
        patternType: 'glob',
        enabled: true,
      },
    ];

    const { container, getByText } = render(
      <WhitelistRuleList
        rules={rules}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleEnabled={mockOnToggleEnabled}
      />
    );

    const deleteButton = container.querySelector('.delete-button') as HTMLButtonElement;
    fireEvent.click(deleteButton);

    const cancelButton = getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnDelete).not.toHaveBeenCalled();
  });

  it('should call onToggleEnabled when toggle changed (AC9)', () => {
    const rules: WhitelistRule[] = [
      {
        id: 'rule-1',
        pattern: '*.reddit.com/*',
        patternType: 'glob',
        enabled: true,
      },
    ];

    const { container } = render(
      <WhitelistRuleList
        rules={rules}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleEnabled={mockOnToggleEnabled}
      />
    );

    const toggle = container.querySelector('.toggle-switch input') as HTMLInputElement;
    fireEvent.change(toggle);

    expect(mockOnToggleEnabled).toHaveBeenCalledWith('rule-1');
  });

  it('should apply disabled CSS class to disabled rules (AC9)', () => {
    const rules: WhitelistRule[] = [
      {
        id: 'rule-1',
        pattern: '*.reddit.com/*',
        patternType: 'glob',
        enabled: false,
      },
    ];

    const { container } = render(
      <WhitelistRuleList
        rules={rules}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleEnabled={mockOnToggleEnabled}
      />
    );

    const ruleItem = container.querySelector('.rule-item');
    expect(ruleItem?.classList.contains('disabled')).toBe(true);
  });

  it('should render reorder buttons when onReorder provided (AC2)', () => {
    const rules: WhitelistRule[] = [
      {
        id: 'rule-1',
        pattern: '*.reddit.com/*',
        patternType: 'glob',
        enabled: true,
      },
      {
        id: 'rule-2',
        pattern: '*.twitter.com/*',
        patternType: 'glob',
        enabled: true,
      },
    ];

    const { container } = render(
      <WhitelistRuleList
        rules={rules}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleEnabled={mockOnToggleEnabled}
        onReorder={mockOnReorder}
      />
    );

    const reorderUpButtons = container.querySelectorAll('.reorder-up-btn');
    expect(reorderUpButtons.length).toBe(2);
  });
});
