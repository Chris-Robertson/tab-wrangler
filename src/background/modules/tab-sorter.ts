/**
 * TabSorter — Sorts tabs in the current window by various criteria.
 *
 * Story 6.1 implements sortByDomain() (flat).
 * Story 6.5 extends it with group-aware sorting via preserveGroups param.
 */

import { extractBaseDomain, extractDomain, isValidUrl } from '@shared/utils/url-utils';

export interface SortTabsResult {
  success: boolean;
  tabCount: number;
  errors: string[];
}

export class TabSorter {
  /**
   * Sort all tabs in the current window alphabetically by base domain.
   *
   * @param preserveGroups — When true, tab groups are sorted internally and
   *   kept contiguous; ungrouped tabs appear first as a sorted block (AC1–AC3,
   *   Story 6.5). When false (default), all tabs are sorted flat (Story 6.1).
   */
  async sortByDomain(preserveGroups = false): Promise<SortTabsResult> {
    const tabs = await chrome.tabs.query({ currentWindow: true });

    if (tabs.length === 0) {
      return { success: true, tabCount: 0, errors: [] };
    }

    return preserveGroups
      ? this.groupAwareSortTabs(tabs)
      : this.flatSortTabs(tabs);
  }

  /**
   * Flat sort — all tabs sorted by domain key regardless of groupId (Story 6.1).
   * AC4: When preserveGroups = false, behaviour is unchanged from Story 6.1.
   */
  private async flatSortTabs(tabs: chrome.tabs.Tab[]): Promise<SortTabsResult> {
    const sorted = [...tabs].sort((a, b) =>
      this.getDomainSortKey(a.url ?? '').localeCompare(this.getDomainSortKey(b.url ?? '')),
    );
    const { errors } = await this.applyTabMoves(sorted);
    return { success: errors.length === 0, tabCount: sorted.length, errors };
  }

  /**
   * Group-aware sort — ungrouped tabs first, then groups sorted relative to
   * each other; tabs within each group sorted internally (Story 6.5, AC1–AC3).
   */
  private async groupAwareSortTabs(tabs: chrome.tabs.Tab[]): Promise<SortTabsResult> {
    const ungrouped = tabs.filter((t) => t.groupId === -1);
    const grouped = tabs.filter((t) => t.groupId !== -1);

    // Sort ungrouped tabs by domain key
    const sortedUngrouped = [...ungrouped].sort((a, b) =>
      this.getDomainSortKey(a.url ?? '').localeCompare(this.getDomainSortKey(b.url ?? '')),
    );

    // Collect unique group IDs in original order
    const groupIds = [...new Set(grouped.map((t) => t.groupId))];

    // Sort each group's tabs internally by domain key
    const sortedGroups = groupIds.map((groupId) => {
      const groupTabs = grouped.filter((t) => t.groupId === groupId);
      return [...groupTabs].sort((a, b) =>
        this.getDomainSortKey(a.url ?? '').localeCompare(this.getDomainSortKey(b.url ?? '')),
      );
    });

    // Sort groups relative to each other by the first tab's domain key (AC2)
    sortedGroups.sort((a, b) =>
      this.getDomainSortKey(a[0].url ?? '').localeCompare(this.getDomainSortKey(b[0].url ?? '')),
    );

    // Final order: ungrouped first, then groups (AC3)
    const finalOrder = [...sortedUngrouped, ...sortedGroups.flat()];

    const { errors } = await this.applyTabMoves(finalOrder);
    return { success: errors.length === 0, tabCount: finalOrder.length, errors };
  }

  /**
   * Apply sequential chrome.tabs.move() calls to place each tab at its target
   * index. Skips tabs already in position; captures errors without aborting.
   */
  private async applyTabMoves(
    orderedTabs: chrome.tabs.Tab[],
  ): Promise<{ errors: string[] }> {
    const errors: string[] = [];
    for (let i = 0; i < orderedTabs.length; i++) {
      const tab = orderedTabs[i];
      if (tab.index !== i) {
        try {
          await chrome.tabs.move(tab.id!, { index: i });
          // Update cached index so subsequent iterations stay accurate
          tab.index = i;
        } catch (error) {
          // Tab closed, or Chrome rejected due to group/pin constraints — continue
          errors.push(`Failed to move tab ${tab.id}: ${String(error)}`);
        }
      }
    }
    return { errors };
  }

  /**
   * Build a composite sort key for a tab URL.
   *
   * Key structure: `baseDomain\x00hostname\x00fullUrl`
   *   - baseDomain: groups subdomains with parent (Story 6.1 AC4)
   *   - hostname:   secondary key for consistent subdomain ordering
   *   - fullUrl:    tertiary key for deterministic tie-breaking
   *
   * Non-http(s) or unparseable URLs use '\uFFFF' so they sort to the end.
   */
  private getDomainSortKey(url: string): string {
    if (!url || !isValidUrl(url)) {
      return '\uFFFF';
    }
    const base = extractBaseDomain(url).toLowerCase();
    const host = extractDomain(url).toLowerCase();
    return `${base}\x00${host}\x00${url.toLowerCase()}`;
  }
}
