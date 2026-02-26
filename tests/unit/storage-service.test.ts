/**
 * Unit tests for StorageService
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService } from '../../src/background/modules/storage-service';
import type { GroupingRule, AutoCloseRule } from '@shared/types';

// Mock chrome.storage API
const mockStorage = {
  sync: {
    get: vi.fn(),
    set: vi.fn(),
  },
  local: {
    get: vi.fn(),
    set: vi.fn(),
  },
};

global.chrome = {
  storage: mockStorage,
} as any;

describe('StorageService', () => {
  let storageService: StorageService;

  beforeEach(() => {
    vi.clearAllMocks();
    storageService = new StorageService();
  });

  describe('getGroupingRules', () => {
    it('should normalize missing enabled field to true (AC6 semantics)', async () => {
      // Setup: Mock storage with rules missing enabled field
      const storedRules: Partial<GroupingRule>[] = [
        {
          id: '1',
          pattern: '*.github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          order: 0,
          // enabled field is missing
        },
        {
          id: '2',
          pattern: '*.google.com/*',
          patternType: 'glob',
          groupName: 'Google',
          groupColor: 'red',
          order: 1,
          enabled: false, // Explicitly disabled
        },
      ];

      mockStorage.sync.get.mockResolvedValue({
        groupingRules: storedRules,
      });

      // Act
      const rules = await storageService.getGroupingRules();

      // Assert: Missing enabled should be normalized to true
      expect(rules).toHaveLength(2);
      expect(rules[0].enabled).toBe(true); // Missing enabled → true
      expect(rules[1].enabled).toBe(false); // Explicit false preserved
    });

    it('should return empty array when no rules exist', async () => {
      mockStorage.sync.get.mockResolvedValue({});

      const rules = await storageService.getGroupingRules();

      expect(rules).toEqual([]);
    });

    it('should preserve explicitly enabled rules', async () => {
      const storedRules: GroupingRule[] = [
        {
          id: '1',
          pattern: '*.github.com/*',
          patternType: 'glob',
          groupName: 'GitHub',
          groupColor: 'blue',
          order: 0,
          enabled: true, // Explicitly enabled
        },
      ];

      mockStorage.sync.get.mockResolvedValue({
        groupingRules: storedRules,
      });

      const rules = await storageService.getGroupingRules();

      expect(rules[0].enabled).toBe(true);
    });
  });

  describe('getAutoCloseRules', () => {
    it('should normalize missing enabled field to true (AC8 - default enabled)', async () => {
      // Setup: Mock storage with rules missing enabled field
      const storedRules: Partial<AutoCloseRule>[] = [
        {
          id: '1',
          pattern: '*.reddit.com/*',
          patternType: 'glob',
          maxAge: 7200000, // 2 hours
          // enabled field is missing
        },
        {
          id: '2',
          pattern: '*.twitter.com/*',
          patternType: 'glob',
          maxAge: 3600000, // 1 hour
          enabled: false, // Explicitly disabled
        },
      ];

      mockStorage.sync.get.mockResolvedValue({
        autoCloseRules: storedRules,
      });

      // Act
      const rules = await storageService.getAutoCloseRules();

      // Assert: Missing enabled should be normalized to true
      expect(rules).toHaveLength(2);
      expect(rules[0].enabled).toBe(true); // Missing enabled → true
      expect(rules[1].enabled).toBe(false); // Explicit false preserved
    });

    it('should return empty array when no rules exist', async () => {
      mockStorage.sync.get.mockResolvedValue({});

      const rules = await storageService.getAutoCloseRules();

      expect(rules).toEqual([]);
    });

    it('should preserve explicitly enabled rules', async () => {
      const storedRules: AutoCloseRule[] = [
        {
          id: '1',
          pattern: '*.github.com/*',
          patternType: 'glob',
          maxAge: 86400000, // 1 day
          enabled: true, // Explicitly enabled
        },
      ];

      mockStorage.sync.get.mockResolvedValue({
        autoCloseRules: storedRules,
      });

      const rules = await storageService.getAutoCloseRules();

      expect(rules[0].enabled).toBe(true);
      expect(rules[0].maxAge).toBe(86400000);
    });
  });
});
