import { extractBaseDomain, extractDomain, isValidUrl } from '@shared/utils/url-utils';
import type { ActivityTracker } from './activity-tracker';
import type { TabActivity } from '@shared/types';

export interface SortTabsResult {
  success: boolean;
  tabCount: number;
  errors: string[];
}

type TabComparator = (a: chrome.tabs.Tab, b: chrome.tabs.Tab) => number;
type TabWithLastAccessed = chrome.tabs.Tab & { lastAccessed?: number };

interface AgeSortKey {
  known: boolean;
  timestamp: number;
  originalIndex: number;
}

export class TabSorter {
  constructor(private activityTracker?: ActivityTracker) {}

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

    const unpinnedTabs = tabs.filter((t) => !t.pinned);

    return preserveGroups
      ? this.groupAwareSortTabs(unpinnedTabs, this.compareByDomain)
      : this.flatSortTabs(unpinnedTabs, this.compareByDomain);
  }

  /**
   * Sort all tabs in the current window by when they were opened.
   *
   * @param order — 'oldest' puts oldest tabs first; 'newest' puts newest first.
   * @param preserveGroups — Same group-preservation semantics as sortByDomain.
   */
  async sortByAge(order: 'oldest' | 'newest', preserveGroups = false): Promise<SortTabsResult> {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const unpinnedTabs = tabs.filter((t) => !t.pinned);
    const activityByTabId = this.activityTracker
      ? await this.activityTracker.getAllActivity()
      : {};
    const compareTabs = this.createAgeComparator(activityByTabId, order);

    return preserveGroups
      ? this.groupAwareSortTabs(unpinnedTabs, compareTabs)
      : this.flatSortTabs(unpinnedTabs, compareTabs);
  }

  /**
   * Flat sort — all tabs sorted by comparator regardless of groupId.
   */
  private async flatSortTabs(
    tabs: chrome.tabs.Tab[],
    compareTabs: TabComparator,
  ): Promise<SortTabsResult> {
    const sorted = [...tabs].sort(compareTabs);
    const { errors } = await this.applyTabMoves(sorted);
    return { success: errors.length === 0, tabCount: sorted.length, errors };
  }

  /**
   * Group-aware sort — ungrouped tabs first, then groups sorted relative to
   * each other; tabs within each group sorted internally.
   */
  private async groupAwareSortTabs(
    tabs: chrome.tabs.Tab[],
    compareTabs: TabComparator,
  ): Promise<SortTabsResult> {
    const ungrouped = tabs.filter((t) => t.groupId === -1);
    const grouped = tabs.filter((t) => t.groupId !== -1);

    const sortedUngrouped = [...ungrouped].sort(compareTabs);

    const groupIds = [...new Set(grouped.map((t) => t.groupId))];

    const sortedGroups = groupIds.map((groupId) => {
      const groupTabs = grouped.filter((t) => t.groupId === groupId);
      return [...groupTabs].sort(compareTabs);
    });

    sortedGroups.sort((a, b) => compareTabs(a[0], b[0]));

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
    let targetStartIndex = this.getTargetStartIndex(orderedTabs);

    for (let i = 0; i < orderedTabs.length; i++) {
      const tab = orderedTabs[i];
      const targetIndex = targetStartIndex + i;
      if (tab.index !== targetIndex) {
        try {
          await chrome.tabs.move(tab.id!, { index: targetIndex });
          tab.index = targetIndex;
        } catch (error) {
          errors.push(`Failed to move tab ${tab.id}: ${String(error)}`);
          try {
            await this.refreshTabIndexes(orderedTabs);
            targetStartIndex = this.getTargetStartIndex(orderedTabs);
          } catch (refreshError) {
            errors.push(`Failed to refresh tab indexes: ${String(refreshError)}`);
            break;
          }
        }
      }
    }
    return { errors };
  }

  private getTargetStartIndex(tabs: chrome.tabs.Tab[]): number {
    return tabs.length > 0 ? Math.min(...tabs.map((tab) => tab.index)) : 0;
  }

  private async refreshTabIndexes(tabs: chrome.tabs.Tab[]): Promise<void> {
    const liveTabs = await chrome.tabs.query({ currentWindow: true });
    const indexById = new Map<number, number>();

    for (const tab of liveTabs) {
      if (tab.id !== undefined) {
        indexById.set(tab.id, tab.index);
      }
    }

    for (const tab of tabs) {
      if (tab.id === undefined) continue;
      const liveIndex = indexById.get(tab.id);
      if (liveIndex !== undefined) {
        tab.index = liveIndex;
      }
    }
  }

  private compareByDomain = (a: chrome.tabs.Tab, b: chrome.tabs.Tab): number =>
    this.getDomainSortKey(a.url ?? '').localeCompare(this.getDomainSortKey(b.url ?? ''));

  private createAgeComparator(
    activityByTabId: Record<number, TabActivity>,
    order: 'oldest' | 'newest',
  ): TabComparator {
    return (a, b) => {
      const keyA = this.buildAgeSortKey(a, activityByTabId);
      const keyB = this.buildAgeSortKey(b, activityByTabId);

      // Known timestamps always sort before unknown
      if (keyA.known !== keyB.known) return keyA.known ? -1 : 1;

      // Unknown: preserve original relative order
      if (!keyA.known) return keyA.originalIndex - keyB.originalIndex;

      // Known: sort by timestamp, tie-break with original index
      const diff =
        order === 'oldest'
          ? keyA.timestamp - keyB.timestamp
          : keyB.timestamp - keyA.timestamp;

      return diff !== 0 ? diff : keyA.originalIndex - keyB.originalIndex;
    };
  }

  private buildAgeSortKey(
    tab: chrome.tabs.Tab,
    activityByTabId: Record<number, TabActivity>,
  ): AgeSortKey {
    const activity = tab.id !== undefined ? activityByTabId[tab.id] : undefined;

    if (activity?.createdAt !== undefined) {
      return { known: true, timestamp: activity.createdAt, originalIndex: tab.index };
    }

    const lastAccessed = (tab as TabWithLastAccessed).lastAccessed;
    if (lastAccessed !== undefined) {
      return { known: true, timestamp: lastAccessed, originalIndex: tab.index };
    }

    return { known: false, timestamp: 0, originalIndex: tab.index };
  }

  /**
   * Build a composite sort key for a tab URL.
   *
   * Key structure: `baseDomain\x00hostname\x00fullUrl`
   *   - baseDomain: groups subdomains with parent (Story 6.1 AC4)
   *   - hostname:   secondary key for consistent subdomain ordering
   *   - fullUrl:    tertiary key for deterministic tie-breaking
   *
   * Non-http(s) or unparseable URLs use '￿' so they sort to the end.
   */
  private getDomainSortKey(url: string): string {
    if (!url || !isValidUrl(url)) {
      return '￿';
    }
    const base = extractBaseDomain(url).toLowerCase();
    const host = extractDomain(url).toLowerCase();
    return `${base}\x00${host}\x00${url.toLowerCase()}`;
  }
}
