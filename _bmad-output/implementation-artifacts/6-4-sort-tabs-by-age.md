# Story 6.4: Sort Tabs by Age

Status: done

## Story

As a user who wants to find old/new tabs,
I want to sort tabs by when they were opened,
so that I can identify stale tabs or find recent ones.

## Acceptance Criteria

1. **AC1: Existing "Sort by Age" actions are wired to real sorting** - The popup already renders "By Age (Oldest)" and "By Age (Newest)" actions in `QuickActions`; clicking them sends `SORT_TABS` with `sortOrder: 'ageOldest'` or `sortOrder: 'ageNewest'`. The background handler must implement both cases instead of returning "not yet implemented".
2. **AC2: Oldest-first sort is supported** - `ageOldest` orders known-age tabs from oldest creation timestamp to newest creation timestamp.
3. **AC3: Newest-first sort is supported** - `ageNewest` orders known-age tabs from newest creation timestamp to oldest creation timestamp.
4. **AC4: Age source is deterministic** - Primary age source is `TabActivity.createdAt` from `chrome.storage.local` via the existing `ActivityTracker`. If no `createdAt` exists for a tab, fallback to Chrome's `tab.lastAccessed` when present. If neither timestamp exists, place the tab after known-age tabs and preserve its relative order with other unknown-age tabs.
5. **AC5: Existing group-preserving behavior applies to age sorting** - When `settings.sortPreserveGroups` is `true`, ungrouped tabs are sorted by age as one block before grouped tabs, tabs within each group are sorted by age, and groups are ordered by the age key of their first tab after internal sorting. When `false`, all unpinned tabs are sorted flat by age.
6. **AC6: Pinned tabs remain untouched** - Preserve the current post-`767313d` behavior: pinned tabs are excluded from sorting and `chrome.tabs.move()` is not called for pinned tabs.
7. **AC7: Current-window scope is unchanged** - Age sorting queries and reorders tabs in the current window only, matching existing `sortByDomain()` behavior.
8. **AC8: One-shot sort does not mutate settings** - Age sorting must not change `settings.defaultSortOrder` or `settings.sortPreserveGroups`; it only reads `sortPreserveGroups`.
9. **AC9: Failure response matches existing sort contract** - On success, the background handler returns `{ success: true, count: tabCount }`. On move failures, it returns `{ success: false, message: string }`, with errors joined the same way the domain branch does today.

## Tasks / Subtasks

- [x] **Task 1: Refactor `TabSorter` helpers to support comparator-based sorting** (AC: 2, 3, 5, 6, 7)
  - [x] Open `src/background/modules/tab-sorter.ts`.
  - [x] Keep `sortByDomain(preserveGroups = false)` behavior intact.
  - [x] Extract the domain-specific sorting logic into generic helpers that accept a comparator:
    - [x] `private async flatSortTabs(tabs, compareTabs): Promise<SortTabsResult>`
    - [x] `private async groupAwareSortTabs(tabs, compareTabs): Promise<SortTabsResult>`
  - [x] Keep `applyTabMoves()` as the single place that calls `chrome.tabs.move()`.
  - [x] Preserve the current `tabs.filter((t) => !t.pinned)` behavior before sorting.

- [x] **Task 2: Implement age sort in `TabSorter`** (AC: 2, 3, 4, 5, 6, 7)
  - [x] Add `sortByAge(order: 'oldest' | 'newest', preserveGroups = false): Promise<SortTabsResult>`.
  - [x] Query current-window tabs with `chrome.tabs.query({ currentWindow: true })`.
  - [x] Filter out pinned tabs before sorting.
  - [x] Read all activity once using the existing `ActivityTracker` dependency, not one storage read per tab.
  - [x] Build age keys using this precedence:
    1. `activityByTabId[tab.id]?.createdAt`
    2. `tab.lastAccessed` when available
    3. unknown timestamp marker
  - [x] For known timestamps:
    - [x] `oldest`: lower timestamp sorts first.
    - [x] `newest`: higher timestamp sorts first.
  - [x] For unknown timestamps:
    - [x] Unknown-age tabs sort after known-age tabs for both directions.
    - [x] Unknown-age tabs preserve original relative order using `tab.index`.
  - [x] Use `tab.index` as the final tie-breaker for equal timestamps to avoid unnecessary churn.

- [x] **Task 3: Wire age cases in the background message handler** (AC: 1, 8, 9)
  - [x] Open `src/background/index.ts`.
  - [x] Instantiate `TabSorter` with access to the existing `activityTracker` or otherwise pass the activity map into `sortByAge()` without creating another storage service.
  - [x] Add `case 'ageOldest'` and `case 'ageNewest'` inside `SORT_TABS`.
  - [x] Pass `settings.sortPreserveGroups` to `sortByAge()`.
  - [x] Mirror the domain response pattern:
    ```typescript
    if (!result.success) {
      return { success: false, message: result.errors.join('; ') };
    }
    return { success: true, count: result.tabCount };
    ```
  - [x] Do not change the popup UI unless tests reveal the existing `QuickActions` buttons are not sending the expected messages.

- [x] **Task 4: Add focused unit coverage** (AC: 1-9)
  - [x] Update `tests/unit/tab-sorter.test.ts`.
  - [x] Extend the `makeTab()` helper or test fixtures to include `lastAccessed` where needed.
  - [x] Provide a fake activity tracker or activity map with `createdAt` timestamps.
  - [x] Add tests for:
    - [x] `ageOldest` sorts by `createdAt` ascending.
    - [x] `ageNewest` sorts by `createdAt` descending.
    - [x] `createdAt` beats `lastAccessed` when both are available.
    - [x] `lastAccessed` is used when activity is missing.
    - [x] Unknown-age tabs sort after known-age tabs and preserve relative order.
    - [x] Pinned tabs are not passed to `chrome.tabs.move()`.
    - [x] Group-aware age sorting sorts within groups and orders groups by first sorted tab age.
    - [x] Move errors are collected and do not abort remaining moves.
  - [x] Update or add background handler tests in `tests/unit/background-message-handler.test.ts` if existing test structure covers `SORT_TABS` routing.

- [x] **Task 5: Verify implementation** (AC: 1-9)
  - [x] Run `npm test -- tests/unit/tab-sorter.test.ts`.
  - [x] Run the relevant background handler test file if changed.
  - [x] Run `npm run typecheck`.
  - [x] Run `npm test -- --run` or `npm test:run` if available and practical before marking implementation complete.

### Review Findings

- [x] Review - Patch: Pinned-tab prefix offset is not handled [src/background/modules/tab-sorter.ts:112]
- [x] Review - Patch: `sortByAge()` can throw when constructed without an `ActivityTracker` [src/background/modules/tab-sorter.ts:53]
- [x] Review - Patch: Falsy `createdAt` is treated as missing [src/background/modules/tab-sorter.ts:155]

## Dev Notes

### Current State

| Component | Current state |
|---|---|
| Popup age actions | Already implemented in `src/popup/components/QuickActions.tsx`; sends `ageOldest` and `ageNewest`. |
| Sort message type | Already supports `SortOrder = 'domain' | 'url' | 'title' | 'ageOldest' | 'ageNewest'`. |
| Background handler | `SORT_TABS` only implements `'domain'`; all other sort orders return "not yet implemented". |
| Tab sorter | `src/background/modules/tab-sorter.ts` supports domain sorting, group-aware sorting, per-tab move error collection, and pinned-tab exclusion. |
| Age data | `ActivityTracker` persists `TabActivity.createdAt` and `lastActiveAt` in `chrome.storage.local`; this story should use `createdAt` for opened-age sorting. |
| Settings | `settings.sortPreserveGroups` exists and defaults to `true`; age sorting must read it but not mutate it. |

### Required Implementation Shape

Prefer extending `TabSorter` instead of creating a new sorter module. The current module already owns sorting, group preservation, pinned exclusion, and `chrome.tabs.move()` error handling.

Use a comparator-driven refactor so domain and age sorting share the same movement and group-preservation paths:

```typescript
type TabComparator = (a: chrome.tabs.Tab, b: chrome.tabs.Tab) => number;

async sortByDomain(preserveGroups = false): Promise<SortTabsResult> {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const unpinnedTabs = tabs.filter((t) => !t.pinned);
  return preserveGroups
    ? this.groupAwareSortTabs(unpinnedTabs, this.compareByDomain)
    : this.flatSortTabs(unpinnedTabs, this.compareByDomain);
}

async sortByAge(
  order: 'oldest' | 'newest',
  preserveGroups = false,
): Promise<SortTabsResult> {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const unpinnedTabs = tabs.filter((t) => !t.pinned);
  const activityByTabId = await this.activityTracker.getAllActivity();
  const compareTabs = this.createAgeComparator(activityByTabId, order);
  return preserveGroups
    ? this.groupAwareSortTabs(unpinnedTabs, compareTabs)
    : this.flatSortTabs(unpinnedTabs, compareTabs);
}
```

The exact constructor shape is flexible, but do not instantiate a second `StorageService` inside `TabSorter`. Reuse the existing `activityTracker` from `background/index.ts` or pass activity data into `sortByAge()`.

### Age Key Rules

Use `createdAt` first because the story is about when tabs were opened. Chrome's current `tabs.Tab` includes `lastAccessed`, but it is last activation time, not creation time. It is only a fallback when Tab Wrangler has no stored creation timestamp.

Suggested key model:

```typescript
interface AgeSortKey {
  known: boolean;
  timestamp: number;
  originalIndex: number;
}
```

Comparator requirements:

- Known timestamps always sort before unknown timestamps.
- `oldest` compares `timestamp` ascending.
- `newest` compares `timestamp` descending.
- Equal timestamps compare `originalIndex` ascending.
- Unknown timestamps compare `originalIndex` ascending.

If `@types/chrome` does not expose `lastAccessed`, use a narrow local helper type instead of broad `any`:

```typescript
type TabWithLastAccessed = chrome.tabs.Tab & { lastAccessed?: number };
const lastAccessed = (tab as TabWithLastAccessed).lastAccessed;
```

### Group Preservation Details

Story 6.5's group behavior must apply to age sorting too:

- `preserveGroups = false`: flat sort all unpinned tabs by age.
- `preserveGroups = true`: sort ungrouped tabs by age, sort each group internally by age, then order groups by the first tab's age after internal sorting.
- Keep ungrouped tabs before grouped tabs to match the existing Story 6.5 behavior.

Do not add an option for oldest/newest to settings in this story. The popup already exposes two explicit one-shot commands.

### Pinned Tabs

Recent git history includes `767313d fix: don't sort pinned tabs`. Preserve that behavior for age sorting:

- Pinned tabs must be filtered before flat or group-aware sorting.
- Unit tests should prove pinned tabs are not passed to `chrome.tabs.move()`.
- Do not change existing pinned-tab behavior while refactoring helpers.

### What Must Be Preserved

- `sortByDomain(settings.sortPreserveGroups)` must keep passing all existing `tab-sorter` tests.
- Existing URL utilities and domain sort keys must remain unchanged.
- The `SORT_TABS` handler must keep returning `{ success: false, message }` on sorter errors.
- Popup loading and toast behavior can remain as-is; this story is background implementation plus tests.
- `settings.defaultSortOrder` is not a persistent "last used sort" setting.

### Testing Notes

The existing `tests/unit/tab-sorter.test.ts` stubs `global.chrome.tabs.query` and `global.chrome.tabs.move`. Extend that test file rather than adding a parallel sorter test file.

Use test timestamps that make intent obvious:

```typescript
const older = 1_700_000_000_000;
const newer = 1_700_000_100_000;
```

For group-aware tests, include `groupId: -1` for ungrouped tabs and positive `groupId` values for grouped tabs. Keep assertions focused on `chrome.tabs.move()` calls and `SortTabsResult`.

### Latest Technical Notes

- Chrome's `tabs.Tab` documentation lists `lastAccessed` as the last time the tab became active, available from Chrome 121. Use this only as fallback to stored `createdAt`, not as the primary age definition. Source: https://developer.chrome.com/docs/extensions/reference/api/tabs
- Chrome's `tabs.onCreated` event notes that URL and group membership may not be set when the tab is first created; the existing `ActivityTracker.recordTabUrlUpdated()` behavior is therefore important and should not be bypassed. Source: https://developer.chrome.com/docs/extensions/reference/api/tabs
- Chrome recommends `chrome.storage` for extension state; extension service workers cannot use Web Storage APIs. The existing `chrome.storage.local` activity model is the right storage layer for device-local tab timestamps. Source: https://developer.chrome.com/docs/extensions/reference/api/storage

### References

- Product brief: `_bmad-output/planning-artifacts/product-brief.md` - "Tab Sorting" includes age oldest/newest as MVP sort options.
- User stories: `_bmad-output/planning-artifacts/user-stories.md` - Story 6.4 and Epic 6 context.
- Architecture: `_bmad-output/planning-artifacts/architecture.md` - `TabManager`/sorting responsibilities, storage schema, Chrome APIs, and `TabActivity.createdAt`.
- Previous story: `_bmad-output/implementation-artifacts/6-1-sort-tabs-by-domain.md` - existing domain sort implementation expectations.
- Related completed story: `_bmad-output/implementation-artifacts/6-5-preserve-tab-groups-when-sorting.md` - group-preserving behavior to reuse for age sorting.
- Current sorter: `src/background/modules/tab-sorter.ts` - primary file to modify.
- Background handler: `src/background/index.ts` - wire `ageOldest` and `ageNewest`.
- Activity tracker: `src/background/modules/activity-tracker.ts` - source of stored `createdAt` timestamps.
- Messaging/types: `src/shared/messaging.ts`, `src/shared/types/rules.ts`.
- Popup action surface: `src/popup/components/QuickActions.tsx` - existing sort menu.
- Tests: `tests/unit/tab-sorter.test.ts`, plus background handler tests if routing coverage exists.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

Ultimate context engine analysis completed - comprehensive developer guide created.

Implemented age sorting in `TabSorter` via a comparator-driven refactor. `flatSortTabs` and `groupAwareSortTabs` now accept a `TabComparator` function, so `sortByDomain` and `sortByAge` share the same movement and group-preservation code paths. `sortByAge` injects `ActivityTracker` via the constructor (optional param, backward-compatible with existing no-arg test setups). Age keys use `createdAt` → `lastAccessed` → unknown precedence; unknown tabs sort last preserving original index order. Background handler wired `ageOldest` and `ageNewest` cases mirroring the domain response pattern. 28 tab-sorter tests pass; full suite 323/323 green; typecheck clean.

Code review patches applied: tab moves now preserve pinned-tab prefix indexes, `sortByAge()` falls back to `lastAccessed`/unknown behavior when no `ActivityTracker` is injected, and `createdAt: 0` is treated as a known timestamp. Added 3 regression tests. 31 tab-sorter tests pass; full suite 326/326 green; typecheck clean.

### File List

- `src/background/modules/tab-sorter.ts`
- `src/background/index.ts`
- `tests/unit/tab-sorter.test.ts`

### Change Log

- 2026-05-18: Implemented Story 6.4 — sort tabs by age (oldest/newest) with group-preservation and pinned-tab exclusion. Refactored TabSorter to comparator-based helpers. Added 10 new age-sort unit tests.
