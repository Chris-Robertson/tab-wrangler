/**
 * Unit tests for ArchiveExclusionRuleList component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { ArchiveExclusionRuleList } from '../../src/options/components/ArchiveExclusionRuleList';
import type { ArchiveExclusionRule } from '../../src/shared/types';

describe('ArchiveExclusionRuleList', () => {
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnReorder = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show empty state message when no rules exist (AC7)', () => {
    const { getByText } = render(
      <ArchiveExclusionRuleList rules={[]} onEdit={mockOnEdit} onDelete={mockOnDelete} />,
    );

    expect(getByText(/no exclusion rules defined/i)).toBeDefined();
  });

  it('should display rule with pattern and pattern type badge (AC7)', () => {
    const rules: ArchiveExclusionRule[] = [
      { id: 'rule-1', pattern: '*.reddit.com/*', patternType: 'glob' },
    ];

    const { getByText } = render(
      <ArchiveExclusionRuleList rules={rules} onEdit={mockOnEdit} onDelete={mockOnDelete} />,
    );

    expect(getByText('*.reddit.com/*')).toBeDefined();
    expect(getByText('glob')).toBeDefined();
  });

  it('should NOT render an enabled toggle for any rule (AC5)', () => {
    const rules: ArchiveExclusionRule[] = [
      { id: 'rule-1', pattern: '*.reddit.com/*', patternType: 'glob' },
    ];

    const { container } = render(
      <ArchiveExclusionRuleList rules={rules} onEdit={mockOnEdit} onDelete={mockOnDelete} />,
    );

    const toggleSwitches = container.querySelectorAll('.toggle-switch');
    expect(toggleSwitches.length).toBe(0);
  });

  it('should call onEdit when Edit button clicked', () => {
    const rules: ArchiveExclusionRule[] = [
      { id: 'rule-1', pattern: '*.reddit.com/*', patternType: 'glob' },
    ];

    const { container } = render(
      <ArchiveExclusionRuleList rules={rules} onEdit={mockOnEdit} onDelete={mockOnDelete} />,
    );

    const editButton = container.querySelector('.edit-button') as HTMLButtonElement;
    fireEvent.click(editButton);

    expect(mockOnEdit).toHaveBeenCalledWith(rules[0]);
  });

  it('should show delete confirmation before deletion (AC7)', () => {
    const rules: ArchiveExclusionRule[] = [
      { id: 'rule-1', pattern: '*.reddit.com/*', patternType: 'glob' },
    ];

    const { container, getByText } = render(
      <ArchiveExclusionRuleList rules={rules} onEdit={mockOnEdit} onDelete={mockOnDelete} />,
    );

    const deleteButton = container.querySelector('.delete-button') as HTMLButtonElement;
    fireEvent.click(deleteButton);

    expect(getByText('Delete Rule?')).toBeDefined();
    expect(mockOnDelete).not.toHaveBeenCalled();
  });

  it('should call onDelete after confirmation (AC7)', () => {
    const rules: ArchiveExclusionRule[] = [
      { id: 'rule-1', pattern: '*.reddit.com/*', patternType: 'glob' },
    ];

    const { container, getByText } = render(
      <ArchiveExclusionRuleList rules={rules} onEdit={mockOnEdit} onDelete={mockOnDelete} />,
    );

    const deleteButton = container.querySelector('.delete-button') as HTMLButtonElement;
    fireEvent.click(deleteButton);

    const confirmButton = getByText('Delete');
    fireEvent.click(confirmButton);

    expect(mockOnDelete).toHaveBeenCalledWith('rule-1');
  });

  it('should not call onDelete when Cancel clicked in confirmation', () => {
    const rules: ArchiveExclusionRule[] = [
      { id: 'rule-1', pattern: '*.reddit.com/*', patternType: 'glob' },
    ];

    const { container, getByText } = render(
      <ArchiveExclusionRuleList rules={rules} onEdit={mockOnEdit} onDelete={mockOnDelete} />,
    );

    const deleteButton = container.querySelector('.delete-button') as HTMLButtonElement;
    fireEvent.click(deleteButton);

    const cancelButton = getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnDelete).not.toHaveBeenCalled();
  });

  it('should render reorder buttons when onReorder provided', () => {
    const rules: ArchiveExclusionRule[] = [
      { id: 'rule-1', pattern: '*.reddit.com/*', patternType: 'glob' },
      { id: 'rule-2', pattern: '*.twitter.com/*', patternType: 'glob' },
    ];

    const { container } = render(
      <ArchiveExclusionRuleList
        rules={rules}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onReorder={mockOnReorder}
      />,
    );

    const reorderUpButtons = container.querySelectorAll('.reorder-up-btn');
    expect(reorderUpButtons.length).toBe(2);
  });

  it('should display multiple rules', () => {
    const rules: ArchiveExclusionRule[] = [
      { id: 'rule-1', pattern: '*.reddit.com/*', patternType: 'glob' },
      { id: 'rule-2', pattern: '^https://twitter\\.com/.*', patternType: 'regex' },
    ];

    const { getByText } = render(
      <ArchiveExclusionRuleList rules={rules} onEdit={mockOnEdit} onDelete={mockOnDelete} />,
    );

    expect(getByText('*.reddit.com/*')).toBeDefined();
    expect(getByText('^https://twitter\\.com/.*')).toBeDefined();
    expect(getByText('glob')).toBeDefined();
    expect(getByText('regex')).toBeDefined();
  });
});
