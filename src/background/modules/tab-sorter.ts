/**
 * TabSorter — Sorts tabs in the current window by various criteria.
 *
 * Story 6.1 implements sortByDomain(). Future stories add sortByUrl,
 * sortByTitle, sortByAge, etc.
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
   * AC2: Same-domain tabs are adjacent.
   * AC3: Groups ordered alphabetically by base domain (case-insensitive).
   * AC4: Subdomains grouped with parent; hostname is secondary sort key.
   * AC5: Non-http(s) tabs sorted to the end, preserving their relative order.
   * AC6: Operates on current (focused) window only.
   * AC7: chrome.tabs.move() used for reordering; errors caught per-tab.
   */
  async sortByDomain(): Promise<SortTabsResult> {
    const errors: string[] = [];
    const tabs = await chrome.tabs.query({ currentWindow: true });

    if (tabs.length === 0) {
      return { success: true, tabCount: 0, errors: [] };
    }

    const sorted = [...tabs].sort((a, b) => {
      const keyA = this.getDomainSortKey(a.url ?? '');
      const keyB = this.getDomainSortKey(b.url ?? '');
      return keyA.localeCompare(keyB);
    });

    for (let i = 0; i < sorted.length; i++) {
      const tab = sorted[i];
      if (tab.index !== i) {
        try {
          await chrome.tabs.move(tab.id!, { index: i });
          // Update the cached index so subsequent iterations use the correct position
          tab.index = i;
        } catch (error) {
          // Tab may have been closed, or Chrome rejected a pinned-tab move — continue
          errors.push(`Failed to move tab ${tab.id}: ${String(error)}`);
        }
      }
    }

    return { success: errors.length === 0, tabCount: sorted.length, errors };
  }

  /**
   * Build a composite sort key for a tab URL.
   *
   * Key structure: `baseDomain\x00hostname\x00fullUrl`
   *   - baseDomain: groups subdomains with parent (AC4)
   *   - hostname:   secondary key for consistent subdomain ordering within a group
   *   - fullUrl:    tertiary key for deterministic tie-breaking
   *
   * Non-http(s) or unparseable URLs use '\uFFFF' so they sort to the end (AC5).
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
