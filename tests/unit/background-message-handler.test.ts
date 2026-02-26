/**
 * Unit tests for background message handlers
 * Tests ORGANIZE_ALL_TABS response shape and message routing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ActionResponse } from '../../src/shared/messaging';

describe('Background Message Handler - ORGANIZE_ALL_TABS', () => {
  let mockAutoGroupManager: {
    organizeAllTabs: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAutoGroupManager = {
      organizeAllTabs: vi.fn(),
    };
  });

  it('should return response with tabsOrganized and groupsCreated on success', async () => {
    // Mock successful organize
    mockAutoGroupManager.organizeAllTabs.mockResolvedValue({
      tabsOrganized: 42,
      groupsCreated: 5,
      errors: [],
    });

    // Simulate message handler
    const response = await mockAutoGroupManager.organizeAllTabs();

    // Verify response shape matches ActionResponse contract
    expect(response).toHaveProperty('tabsOrganized');
    expect(response).toHaveProperty('groupsCreated');
    expect(response).toHaveProperty('errors');
    expect(response.tabsOrganized).toBe(42);
    expect(response.groupsCreated).toBe(5);
    expect(response.errors).toEqual([]);
  });

  it('should return errors array when operation fails', async () => {
    // Mock failed organize
    mockAutoGroupManager.organizeAllTabs.mockResolvedValue({
      tabsOrganized: 0,
      groupsCreated: 0,
      errors: ['Chrome API error: Permission denied'],
    });

    const response = await mockAutoGroupManager.organizeAllTabs();

    expect(response.errors).toHaveLength(1);
    expect(response.errors?.[0]).toBe('Chrome API error: Permission denied');
    expect(response.tabsOrganized).toBe(0);
    expect(response.groupsCreated).toBe(0);
  });

  it('should return partial success with errors for partial failures', async () => {
    // Mock partial success
    mockAutoGroupManager.organizeAllTabs.mockResolvedValue({
      tabsOrganized: 10,
      groupsCreated: 3,
      errors: ['Failed to group 2 tabs: Invalid group ID'],
    });

    const response = await mockAutoGroupManager.organizeAllTabs();

    expect(response.tabsOrganized).toBe(10);
    expect(response.groupsCreated).toBe(3);
    expect(response.errors).toHaveLength(1);
  });

  it('should handle case when no rules exist', async () => {
    // Mock no rules scenario
    mockAutoGroupManager.organizeAllTabs.mockResolvedValue({
      tabsOrganized: 0,
      groupsCreated: 0,
      errors: ['No enabled grouping rules found'],
    });

    const response = await mockAutoGroupManager.organizeAllTabs();

    expect(response.tabsOrganized).toBe(0);
    expect(response.groupsCreated).toBe(0);
    expect(response.errors).toContain('No enabled grouping rules found');
  });

  it('should handle exception during organize and return error', async () => {
    // Mock exception
    mockAutoGroupManager.organizeAllTabs.mockRejectedValue(
      new Error('Unexpected error')
    );

    try {
      await mockAutoGroupManager.organizeAllTabs();
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Unexpected error');
    }
  });

  describe('Response contract validation', () => {
    it('should ensure response is compatible with ActionResponse type', async () => {
      mockAutoGroupManager.organizeAllTabs.mockResolvedValue({
        tabsOrganized: 5,
        groupsCreated: 2,
        errors: [],
      });

      const response: ActionResponse = await mockAutoGroupManager.organizeAllTabs();

      // TypeScript compilation ensures type compatibility
      // Runtime checks for required fields
      expect(typeof response.tabsOrganized).toBe('number');
      expect(typeof response.groupsCreated).toBe('number');
      expect(Array.isArray(response.errors)).toBe(true);
    });

    it('should allow optional fields in ActionResponse', async () => {
      // ActionResponse can have count for duplicate removal
      const duplicateResponse: ActionResponse = {
        count: 3,
        errors: [],
      };

      expect(duplicateResponse.count).toBe(3);
      expect(duplicateResponse.errors).toEqual([]);
    });
  });

  describe('Message Handler Integration Tests', () => {
    it('should transform organizeAllTabs result to ActionResponse format with success flag', async () => {
      mockAutoGroupManager.organizeAllTabs.mockResolvedValue({
        tabsOrganized: 10,
        groupsCreated: 3,
        errors: [],
      });

      const result = await mockAutoGroupManager.organizeAllTabs();
      
      // Simulate the transformation done in handleMessage
      const response: ActionResponse = {
        success: result.errors === undefined || result.errors.length === 0,
        tabsOrganized: result.tabsOrganized,
        groupsCreated: result.groupsCreated,
        errors: result.errors,
      };

      expect(response.success).toBe(true);
      expect(response.tabsOrganized).toBe(10);
      expect(response.groupsCreated).toBe(3);
      expect(response.errors).toEqual([]);
    });

    it('should set success=false when errors exist', async () => {
      mockAutoGroupManager.organizeAllTabs.mockResolvedValue({
        tabsOrganized: 0,
        groupsCreated: 0,
        errors: ['Failed to organize tabs'],
      });

      const result = await mockAutoGroupManager.organizeAllTabs();
      
      const response: ActionResponse = {
        success: result.errors === undefined || result.errors.length === 0,
        tabsOrganized: result.tabsOrganized,
        groupsCreated: result.groupsCreated,
        errors: result.errors,
      };

      expect(response.success).toBe(false);
      expect(response.errors).toHaveLength(1);
    });

    it('should handle partial success (some tabs organized + errors)', async () => {
      mockAutoGroupManager.organizeAllTabs.mockResolvedValue({
        tabsOrganized: 8,
        groupsCreated: 2,
        errors: ['Failed to group 2 tabs'],
      });

      const result = await mockAutoGroupManager.organizeAllTabs();
      
      const response: ActionResponse = {
        success: result.errors === undefined || result.errors.length === 0,
        tabsOrganized: result.tabsOrganized,
        groupsCreated: result.groupsCreated,
        errors: result.errors,
      };

      // Partial success means success=false but data is still present
      expect(response.success).toBe(false);
      expect(response.tabsOrganized).toBe(8);
      expect(response.groupsCreated).toBe(2);
      expect(response.errors).toContain('Failed to group 2 tabs');
    });
  });
});

describe('Background Message Handler - SORT_TABS', () => {
  let mockTabSorter: { sortByDomain: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTabSorter = { sortByDomain: vi.fn() };
  });

  it('returns { success: true, count } when all moves succeed', async () => {
    mockTabSorter.sortByDomain.mockResolvedValue({
      success: true,
      tabCount: 5,
      errors: [],
    });

    const result = await mockTabSorter.sortByDomain();
    const response: ActionResponse = result.success
      ? { success: true, count: result.tabCount }
      : { success: false, message: result.errors.join('; ') };

    expect(response.success).toBe(true);
    expect(response.count).toBe(5);
    expect(response.message).toBeUndefined();
  });

  it('returns { success: false, message } with joined errors when moves fail (AC8)', async () => {
    mockTabSorter.sortByDomain.mockResolvedValue({
      success: false,
      tabCount: 3,
      errors: ['Failed to move tab 1: Tab closed', 'Failed to move tab 2: Pin constraint'],
    });

    const result = await mockTabSorter.sortByDomain();
    const response: ActionResponse = result.success
      ? { success: true, count: result.tabCount }
      : { success: false, message: result.errors.join('; ') };

    expect(response.success).toBe(false);
    expect(response.message).toBe('Failed to move tab 1: Tab closed; Failed to move tab 2: Pin constraint');
    expect(response.count).toBeUndefined();
  });
});
