# Story 6.1: Sort Tabs by Domain

Status: done

## Story

As a user with many tabs open,
I want to sort all tabs by domain,
so that tabs from the same website are grouped together.

## Acceptance Criteria

1. **AC1: "Sort by Domain" triggers correctly** — When the popup's "Sort Tabs → By Domain" button is clicked, the `SORT_TABS` message is sent with `sortOrder: 'domain'`. The background handler fully implements this case (currently a `TODO` stub returning `{ success: true }`).
2. **AC2: Same-domain tabs are adjacent** — After sorting, tabs sharing the same base domain appear in consecutive positions (e.g. all `github.com` tabs together, all `reddit.com` tabs together).
3. **AC3: Sort is alphabetical by base domain** — Groups are ordered alphabetically by base domain, case-insensitively (e.g. `github.com` before `reddit.com`).
4. **AC4: Subdomains grouped with parent domain** — `docs.github.com` and `github.com` are treated as the same domain key (`github.com`) for grouping purposes. Within a domain group, full hostname is used as a secondary sort key (alphabetical) to keep subdomains consistently ordered.
5. **AC5: Non-http(s) tabs sorted to the end** — Tabs with `chrome://`, `chrome-extension://`, `about:`, extension pages, and empty URLs cannot be parsed as domains and are moved to the end of the window, preserving their relative order among themselves.
6. **AC6: Sort operates on current window only** — Only tabs in the current (focused) window are sorted. Tabs in other windows are unaffected.
7. **AC7: `chrome.tabs.move()` used for reordering** — Positions are updated via `chrome.tabs.move()`. Pinned tabs are moved to the start of window position for their domain sort position and not skipped (Chrome will prevent pinned tabs from moving past unpinned tabs — handle gracefully).
8. **AC8: Result indicates success** — The message handler returns `{ success: true }`. On failure, returns `{ success: false, message: string }`. The popup currently ignores the toast for sort actions; no UI change needed in this story.
9. **AC9: `settings.defaultSortOrder` is NOT changed** — The sort is a one-shot action, not a persistent preference change. `settings.defaultSortOrder` is a display hint for the UI default, not altered by this operation.

## Tasks / Subtasks

- [x] **Task 1: Create `TabSorter` module** (AC: 2–7)
  - [x] Create `src/background/modules/tab-sorter.ts`
  - [x] Class constructor: `constructor()` — no dependencies needed for this story (no storage, no activity tracker)
  - [x] Implement `sortByDomain(windowId: number): Promise<SortTabsResult>`
    - [x] Query all tabs in the window: `chrome.tabs.query({ windowId })`
    - [x] Separate pinned from unpinned tabs — pinned tabs cannot be moved past each other by Chrome, so process them together but expect Chrome to enforce pin order constraints
    - [x] For each tab build a sort key using `getDomainSortKey(tab)` (private helper):
      - [x] If `!tab.url || !isValidUrl(tab.url)` → sort key = `'\uFFFF'` (sorts to end, preserving relative order among non-http tabs)
      - [x] Otherwise: `extractBaseDomain(tab.url).toLowerCase()`
      - [x] Secondary key: `extractDomain(tab.url).toLowerCase()` (full hostname, for consistent subdomain ordering within a group)
      - [x] Tertiary key: `tab.url.toLowerCase()` (full URL for deterministic tie-breaking)
    - [x] Sort tabs using: `tabs.sort((a, b) => getSortKey(a).localeCompare(getSortKey(b)))`
      - [x] Sort key is `[baseDomain, hostname, fullUrl].join('\0')` — join with null byte separator
    - [x] Move tabs to sorted positions:
      ```typescript
      for (let i = 0; i < sortedTabs.length; i++) {
        const tab = sortedTabs[i];
        if (tab.index !== i) {
          try {
            await chrome.tabs.move(tab.id!, { index: i });
          } catch (error) {
            // Tab may have been closed; record error and continue
            errors.push(`Failed to move tab ${tab.id}: ${String(error)}`);
          }
        }
      }
      ```
    - [x] Return `{ success: errors.length === 0, tabCount: sortedTabs.length, errors }`
  - [x] Export `TabSorter` and `SortTabsResult` type

- [x] **Task 2: Wire `TabSorter` into `background/index.ts`** (AC: 1, 6, 8)
  - [x] Import and instantiate `TabSorter`:
    ```typescript
    const tabSorter = new TabSorter();
    ```
  - [x] Replace the `SORT_TABS` stub in `handleMessage`:
    ```typescript
    case 'SORT_TABS': {
      const [currentWindow] = await chrome.windows.getAll({ populate: false });
      const focused = await chrome.windows.getCurrent();
      switch (message.sortOrder) {
        case 'domain': {
          const result = await tabSorter.sortByDomain(focused.id!);
          return { success: result.success, count: result.tabCount };
        }
        default:
          // Other sort orders implemented in future stories
          return { success: false, message: `Sort order '${message.sortOrder}' not yet implemented` };
      }
    }
    ```
  - [x] Add `chrome.windows` permission check — `windows` permission is NOT currently in the manifest; use `chrome.windows.getCurrent()` which works without the `windows` permission for the service worker's current context, OR just query tabs with `{ currentWindow: true }` instead (see note below)
  - [x] ⚠️ **Preferred approach**: pass `currentWindow: true` to `chrome.tabs.query` inside `sortByDomain` instead of a windowId parameter — avoids needing the `windows` permission entirely:
    ```typescript
    async sortByDomain(): Promise<SortTabsResult> {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      // ...
    }
    ```
    Update the method signature accordingly.

- [x] **Task 3: Verify `windows` permission is not needed** (AC: 6)
  - [x] Confirm `chrome.tabs.query({ currentWindow: true })` works from a service worker context without `windows` permission — it does, because `currentWindow` in this context means the last focused window (`chrome.windows.WINDOW_ID_CURRENT`), which is sufficient
  - [x] No manifest changes needed

- [x] **Task 4: Unit Tests** (AC: 1–8)
  - [x] Create `tests/unit/tab-sorter.test.ts`
  - [x] Mock `chrome.tabs.query` and `chrome.tabs.move` on `globalThis.chrome`
  - [x] Test cases:
    - [x] Tabs sorted alphabetically by base domain
    - [x] Subdomains grouped with parent: `docs.github.com` and `github.com` both appear before `reddit.com`
    - [x] Within same base domain, `docs.github.com` tabs appear before `github.com` tabs (secondary hostname sort: d < g)
    - [x] Non-http tabs (e.g. `chrome://newtab/`) sorted to end
    - [x] `chrome.tabs.move` called with correct new index for each tab
    - [x] Tabs already in sorted order result in no `move` calls (optimization: skip if `tab.index === i`)
    - [x] Error on `chrome.tabs.move` for one tab does not prevent others from sorting
    - [x] Empty tab list returns `{ success: true, tabCount: 0, errors: [] }`

  ### Review Follow-ups (AI) - 2026-02-27 Code Review
  - [x] [AI-Review][Medium] Align `SORT_TABS` failure response with AC8 by returning `{ success: false, message: string }` when `sortByDomain()` reports errors (instead of only `{ success: false, count }`). [src/background/index.ts]

## Dev Notes

### What's Already In Place

The sort feature is **further along than it might appear**:

| Component | Status |
|---|---|
| `SORT_TABS` message type | ✅ Defined in `src/shared/messaging.ts` |
| Popup sort menu UI | ✅ Fully implemented in `src/popup/components/QuickActions.tsx` |
| `SortOrder` type | ✅ Defined in `src/shared/types/rules.ts` |
| `extractDomain()` | ✅ In `src/shared/utils/url-utils.ts` |
| `extractBaseDomain()` | ✅ In `src/shared/utils/url-utils.ts` — handles subdomains |
| `isValidUrl()` | ✅ In `src/shared/utils/url-utils.ts` |
| Background stub | ⚠️ `case 'SORT_TABS': return { success: true }` in `background/index.ts` — needs replacing |

**This story is purely a background implementation** — no UI changes required.

### `TabSorter` Class Structure

```typescript
import { extractBaseDomain, extractDomain, isValidUrl } from '@shared/utils/url-utils';

export interface SortTabsResult {
  success: boolean;
  tabCount: number;
  errors: string[];
}

export class TabSorter {
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
        } catch (error) {
          errors.push(`Failed to move tab ${tab.id}: ${String(error)}`);
        }
      }
    }

    return { success: errors.length === 0, tabCount: sorted.length, errors };
  }

  private getDomainSortKey(url: string): string {
    if (!url || !isValidUrl(url)) {
      return '\uFFFF'; // Sort non-http tabs to end
    }
    const base = extractBaseDomain(url).toLowerCase();
    const host = extractDomain(url).toLowerCase();
    return `${base}\x00${host}\x00${url.toLowerCase()}`;
  }
}
```

### `extractBaseDomain` Behaviour

Already implemented in `src/shared/utils/url-utils.ts`:
```typescript
// "docs.github.com" → "github.com"
// "github.com"      → "github.com"
// "localhost"       → "localhost"
```
Note it uses a simplified approach (last two parts). This is acceptable per the AC — no need for a full PSL (public suffix list) library.

### Handling Pinned Tabs

Chrome enforces that pinned tabs cannot be moved to positions after the last pinned tab, and unpinned tabs cannot be moved before pinned tabs. When sorting, pinned tabs sort into position as normal. If Chrome rejects a `move()` call due to pin constraints, the error is caught and logged but doesn't abort the whole sort. Future stories can refine this behaviour (e.g. Story 6.5).

### `background/index.ts` SORT_TABS Handler Pattern

```typescript
case 'SORT_TABS': {
  switch (message.sortOrder) {
    case 'domain': {
      const result = await tabSorter.sortByDomain();
      return { success: result.success, count: result.tabCount };
    }
    default:
      return { success: false, message: `Sort order '${message.sortOrder}' not yet implemented` };
  }
}
```

The `default` branch handles `'url'`, `'title'`, `'ageOldest'`, `'ageNewest'` — these will be replaced as Stories 6.2, 6.3, 6.4 are implemented.

### Test Mock Setup

```typescript
global.chrome = {
  tabs: {
    query: vi.fn(),
    move: vi.fn().mockResolvedValue(undefined),
  },
} as any;
```

For `move` to work correctly in tests, stub `query` to return tabs with the right `index` values:
```typescript
mockChrome.tabs.query.mockResolvedValue([
  { id: 1, url: 'https://reddit.com/r/programming', index: 0 },
  { id: 2, url: 'https://github.com/microsoft/vscode', index: 1 },
  { id: 3, url: 'https://docs.github.com/api', index: 2 },
]);
```

After `sortByDomain()`, assert `chrome.tabs.move` was called with `(2, { index: 0 })` (github.com first), `(3, { index: 1 })` (docs.github.com second — same base domain), `(1, { index: 2 })` (reddit.com last).

### References

- User stories: [_bmad-output/planning-artifacts/user-stories.md](_bmad-output/planning-artifacts/user-stories.md) — Story 6.1
- Architecture: [_bmad-output/planning-artifacts/architecture.md](_bmad-output/planning-artifacts/architecture.md) — "Flow 3: Sort Tabs by Domain", `TabManager` module
- Background entry: [src/background/index.ts](src/background/index.ts) — replace `SORT_TABS` stub
- Messaging types: [src/shared/messaging.ts](src/shared/messaging.ts) — `SORT_TABS` message, `SortOrder`
- URL utils: [src/shared/utils/url-utils.ts](src/shared/utils/url-utils.ts) — `extractDomain`, `extractBaseDomain`, `isValidUrl`
- QuickActions (popup): [src/popup/components/QuickActions.tsx](src/popup/components/QuickActions.tsx) — existing sort UI (no changes needed)
- Manifest: [src/manifest.json](src/manifest.json) — `tabs` permission sufficient; no new permissions needed

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

### Completion Notes List

### File List

- `src/background/modules/tab-sorter.ts` ← **create**
- `src/background/index.ts` ← **modify** (replace `SORT_TABS` stub, instantiate `TabSorter`)
- `tests/unit/tab-sorter.test.ts` ← **create**
