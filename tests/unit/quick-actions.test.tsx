/**
 * Unit tests for QuickActions component
 * Tests AC1 (disabled state), AC5 (toast dismissal), AC6 (error display)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/preact';
import { QuickActions } from '../../src/popup/components/QuickActions';
import { STORAGE_KEYS } from '../../src/shared/constants';
import type { GroupingRule } from '../../src/shared/types';
import type { ActionResponse } from '../../src/shared/messaging';

// Track storage change listeners
let storageChangeListeners: ((
  changes: { [key: string]: chrome.storage.StorageChange },
  areaName: string
) => void)[] = [];

// Mock chrome.storage
const mockStorage: Record<string, unknown> = {};

// Mock chrome.runtime.sendMessage
let sendMessageHandler: ((message: unknown) => Promise<ActionResponse>) | null = null;

vi.stubGlobal('chrome', {
  storage: {
    sync: {
      get: vi.fn().mockImplementation((keys: string | string[]) => {
        const keyArray = typeof keys === 'string' ? [keys] : keys;
        const result: Record<string, unknown> = {};
        for (const key of keyArray) {
          if (mockStorage[key] !== undefined) {
            result[key] = mockStorage[key];
          }
        }
        return Promise.resolve(result);
      }),
      set: vi.fn().mockImplementation((items: Record<string, unknown>) => {
        Object.assign(mockStorage, items);
        const changes: { [key: string]: chrome.storage.StorageChange } = {};
        for (const [key, value] of Object.entries(items)) {
          changes[key] = { newValue: value };
        }
        storageChangeListeners.forEach((listener) => listener(changes, 'sync'));
        return Promise.resolve();
      }),
    },
    onChanged: {
      addListener: vi.fn().mockImplementation((listener) => {
        storageChangeListeners.push(listener);
      }),
      removeListener: vi.fn().mockImplementation((listener) => {
        storageChangeListeners = storageChangeListeners.filter((l) => l !== listener);
      }),
    },
  },
  runtime: {
    sendMessage: vi.fn().mockImplementation((message: unknown) => {
      if (sendMessageHandler) {
        return sendMessageHandler(message);
      }
      return Promise.resolve({});
    }),
  },
});

describe('QuickActions Component', () => {
  const mockOnAction = vi.fn().mockImplementation((action: () => Promise<void>) => action());

  beforeEach(() => {
    // Clear mock storage
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    storageChangeListeners = [];
    sendMessageHandler = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    storageChangeListeners = [];
  });

  describe('AC1: Button Disabled State', () => {
    it('should disable Organize All Tabs button when no grouping rules exist', async () => {
      // No rules in storage
      const { container } = render(<QuickActions onAction={mockOnAction} />);

      // Wait for loading to complete
      await waitFor(() => {
        const button = container.querySelector('button:nth-child(2)') as HTMLButtonElement;
        expect(button.disabled).toBe(true);
      });

      const button = container.querySelector('button:nth-child(2)') as HTMLButtonElement;
      expect(button.textContent).toContain('Organize All Tabs');
      expect(button.title).toContain('No grouping rules defined');
    });

    it('should disable button when all rules are disabled', async () => {
      // Rules exist but all are disabled
      const disabledRules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*.github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: false,
          order: 0,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = disabledRules;

      const { container } = render(<QuickActions onAction={mockOnAction} />);

      await waitFor(() => {
        const button = container.querySelector('button:nth-child(2)') as HTMLButtonElement;
        expect(button.disabled).toBe(true);
      });
    });

    it('should enable button when at least one rule is enabled', async () => {
      const enabledRules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*.github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = enabledRules;

      const { container } = render(<QuickActions onAction={mockOnAction} />);

      await waitFor(() => {
        const button = container.querySelector('button:nth-child(2)') as HTMLButtonElement;
        expect(button.disabled).toBe(false);
      });
    });

    it('should update button state when rules are added via storage change', async () => {
      // Start with no rules
      const { container } = render(<QuickActions onAction={mockOnAction} />);

      await waitFor(() => {
        const button = container.querySelector('button:nth-child(2)') as HTMLButtonElement;
        expect(button.disabled).toBe(true);
      });

      // Add a rule via storage change
      const newRules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*.github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
      ];

      // Simulate storage change
      storageChangeListeners.forEach((listener) => {
        listener(
          { [STORAGE_KEYS.sync.GROUPING_RULES]: { newValue: newRules } },
          'sync'
        );
      });

      // Button should now be enabled
      await waitFor(() => {
        const button = container.querySelector('button:nth-child(2)') as HTMLButtonElement;
        expect(button.disabled).toBe(false);
      });
    });
  });

  describe('AC5: Toast Manual Dismiss', () => {
    it('should allow user to manually dismiss success toast', async () => {
      const enabledRules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*.github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = enabledRules;

      sendMessageHandler = vi.fn().mockResolvedValue({
        tabsOrganized: 5,
        groupsCreated: 2,
        errors: [],
      });

      const { container } = render(<QuickActions onAction={mockOnAction} />);

      // Wait for button to be enabled
      await waitFor(() => {
        const button = container.querySelector('button:nth-child(2)') as HTMLButtonElement;
        expect(button.disabled).toBe(false);
      });

      // Click organize button
      const button = container.querySelector('button:nth-child(2)') as HTMLButtonElement;
      await fireEvent.click(button);

      // Toast should appear
      await waitFor(() => {
        const toast = container.querySelector('.toast');
        expect(toast).not.toBeNull();
      });

      // Find and click close button
      const closeButton = container.querySelector('.toast-close') as HTMLButtonElement;
      expect(closeButton).not.toBeNull();
      await fireEvent.click(closeButton);

      // Toast should be dismissed
      await waitFor(() => {
        const toast = container.querySelector('.toast');
        expect(toast).toBeNull();
      });
    });
  });

  describe('AC6: Error Display', () => {
    it('should display errors with error toast style when operation fails', async () => {
      const enabledRules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*.github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = enabledRules;

      sendMessageHandler = vi.fn().mockResolvedValue({
        tabsOrganized: 0,
        groupsCreated: 0,
        errors: ['Chrome API error: Permission denied'],
      });

      const { container } = render(<QuickActions onAction={mockOnAction} />);

      // Wait for button to be enabled
      await waitFor(() => {
        const button = container.querySelector('button:nth-child(2)') as HTMLButtonElement;
        expect(button.disabled).toBe(false);
      });

      // Click organize button
      const button = container.querySelector('button:nth-child(2)') as HTMLButtonElement;
      await fireEvent.click(button);

      // Error toast should appear with error styling
      await waitFor(() => {
        const toast = container.querySelector('.toast-error');
        expect(toast).not.toBeNull();
        expect(toast?.textContent).toContain('Permission denied');
      });
    });

    it('should display first error when multiple errors occur', async () => {
      const enabledRules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*.github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = enabledRules;

      sendMessageHandler = vi.fn().mockResolvedValue({
        tabsOrganized: 0,
        groupsCreated: 0,
        errors: ['First error', 'Second error', 'Third error'],
      });

      const { container } = render(<QuickActions onAction={mockOnAction} />);

      await waitFor(() => {
        const button = container.querySelector('button:nth-child(2)') as HTMLButtonElement;
        expect(button.disabled).toBe(false);
      });

      const button = container.querySelector('button:nth-child(2)') as HTMLButtonElement;
      await fireEvent.click(button);

      // Should show first error
      await waitFor(() => {
        const toast = container.querySelector('.toast-error');
        expect(toast).not.toBeNull();
        expect(toast?.textContent).toContain('First error');
        expect(toast?.textContent).not.toContain('Second error');
      });
    });

    it('should show info toast when no tabs are organized (not an error)', async () => {
      const enabledRules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*.github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = enabledRules;

      sendMessageHandler = vi.fn().mockResolvedValue({
        tabsOrganized: 0,
        groupsCreated: 0,
        errors: [],
      });

      const { container } = render(<QuickActions onAction={mockOnAction} />);

      await waitFor(() => {
        const button = container.querySelector('button:nth-child(2)') as HTMLButtonElement;
        expect(button.disabled).toBe(false);
      });

      const button = container.querySelector('button:nth-child(2)') as HTMLButtonElement;
      await fireEvent.click(button);

      // Should show info toast (not error)
      await waitFor(() => {
        const toast = container.querySelector('.toast-info');
        expect(toast).not.toBeNull();
        expect(toast?.textContent).toContain('No tabs organized');
      });
    });
  });

  describe('Success scenarios', () => {
    it('should display success toast with correct counts', async () => {
      const enabledRules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*.github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = enabledRules;

      sendMessageHandler = vi.fn().mockResolvedValue({
        tabsOrganized: 42,
        groupsCreated: 5,
        groupsAffected: 5,
        errors: [],
      });

      const { container } = render(<QuickActions onAction={mockOnAction} />);

      await waitFor(() => {
        const button = container.querySelector('button:nth-child(2)') as HTMLButtonElement;
        expect(button.disabled).toBe(false);
      });

      const button = container.querySelector('button:nth-child(2)') as HTMLButtonElement;
      await fireEvent.click(button);

      // Should show success toast with counts
      await waitFor(() => {
        const toast = container.querySelector('.toast-success');
        expect(toast).not.toBeNull();
        expect(toast?.textContent).toContain('42 tabs organized into 5 groups');
      });
    });

    it('should use singular "group" when only 1 group created', async () => {
      const enabledRules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*.github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = enabledRules;

      sendMessageHandler = vi.fn().mockResolvedValue({
        tabsOrganized: 3,
        groupsCreated: 1,
        groupsAffected: 1,
        errors: [],
      });

      const { container } = render(<QuickActions onAction={mockOnAction} />);

      await waitFor(() => {
        const button = container.querySelector('button:nth-child(2)') as HTMLButtonElement;
        expect(button.disabled).toBe(false);
      });

      const button = container.querySelector('button:nth-child(2)') as HTMLButtonElement;
      await fireEvent.click(button);

      await waitFor(() => {
        const toast = container.querySelector('.toast-success');
        expect(toast).not.toBeNull();
        expect(toast?.textContent).toContain('3 tabs organized into 1 group');
        expect(toast?.textContent).not.toContain('groups');
      });
    });

    it('should display "X tabs organized, Y failed" format when tabsFailed is present (AC5)', async () => {
      const enabledRules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*.github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = enabledRules;

      sendMessageHandler = vi.fn().mockResolvedValue({
        tabsOrganized: 10,
        groupsCreated: 1,
        groupsAffected: 1,
        tabsFailed: 3,
        errors: ['Some tabs were closed before they could be organized. Please try again.'],
      });

      const { container } = render(<QuickActions onAction={mockOnAction} />);

      await waitFor(() => {
        const button = container.querySelector('button:nth-child(2)') as HTMLButtonElement;
        expect(button.disabled).toBe(false);
      });

      const button = container.querySelector('button:nth-child(2)') as HTMLButtonElement;
      await fireEvent.click(button);

      await waitFor(() => {
        const toast = container.querySelector('.toast-error');
        expect(toast).not.toBeNull();
        expect(toast?.textContent).toContain('10 tabs organized, 3 failed');
        expect(toast?.textContent).toContain('Some tabs were closed');
      });
    });

    it('should handle partial success with only errors (no tabsFailed count)', async () => {
      const enabledRules: GroupingRule[] = [
        {
          id: 'rule-1',
          pattern: '*.github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          enabled: true,
          order: 0,
        },
      ];
      mockStorage[STORAGE_KEYS.sync.GROUPING_RULES] = enabledRules;

      sendMessageHandler = vi.fn().mockResolvedValue({
        tabsOrganized: 5,
        groupsCreated: 1,
        groupsAffected: 1,
        errors: ['Permission denied. Please check extension permissions and try again.'],
      });

      const { container } = render(<QuickActions onAction={mockOnAction} />);

      await waitFor(() => {
        const button = container.querySelector('button:nth-child(2)') as HTMLButtonElement;
        expect(button.disabled).toBe(false);
      });

      const button = container.querySelector('button:nth-child(2)') as HTMLButtonElement;
      await fireEvent.click(button);

      await waitFor(() => {
        const toast = container.querySelector('.toast-error');
        expect(toast).not.toBeNull();
        expect(toast?.textContent).toContain('5 tabs organized into 1 group');
        expect(toast?.textContent).toContain('Warning: Permission denied');
      });
    });
  });
});
