# Story 6.5: Preserve Tab Groups When Sorting

Status: done

## Story

As a user who uses tab groups,
I want sorting to respect my existing groups,
so that groups stay intact after sorting.

## Acceptance Criteria

1. **AC1: Tabs within groups are sorted together** — When `sortPreserveGroups = true`, each tab group's tabs are sorted by domain internally but the group's tabs remain contiguous (as a block) in the window.
2. **AC2: Groups themselves are sorted** — After sorting within groups, the groups are ordered relative to each other by the sort key of each group's first tab (post-internal-sort).
3. **AC3: Ungrouped tabs are sorted separately** — Ungrouped tabs (`groupId === -1`) are sorted by domain among themselves and placed as a sorted block before grouped tabs in the window.
4. **AC4: Flat sort unchanged** — When `settings.sortPreserveGroups = false`, `sortByDomain()` behaves exactly as before (Story 6.1) — all tabs sorted flat regardless of groupId.
5. **AC5: `settings.sortPreserveGroups` drives the behaviour** — The `SORT_TABS` handler in `background/index.ts` reads `settings.sortPreserveGroups` and passes it to `tabSorter.sortByDomain(preserveGroups)`. No UI changes needed — the Settings page already has the "Preserve tab groups when sorting" checkbox wired to this setting.
6. **AC6: `chrome.tabGroups` permission already present** — Verified in `src/manifest.json`. No manifest changes needed.
7. **AC7: Move errors handled per-tab** — If any `chrome.tabs.move()` call fails (e.g. Chrome rejects a move due to group constraints), the error is captured and remaining tabs continue to be processed. The result reports `success: false` if any errors occurred.

## Tasks / Subtasks

- [x] **Task 1: Extend `TabSorter.sortByDomain()` to accept `preserveGroups` parameter** (AC: 1–4)
  - [x] Open `src/background/modules/tab-sorter.ts`
  - [x] Change signature: `async sortByDomain(preserveGroups = false): Promise<SortTabsResult>`
  - [x] When `preserveGroups = false` → existing flat sort logic unchanged (extract into private `flatSortTabs(tabs)` helper)
  - [x] When `preserveGroups = true` → call new private `groupAwareSortTabs(tabs)` helper
  - [x] Implement `private async groupAwareSortTabs(tabs: chrome.tabs.Tab[]): Promise<SortTabsResult>`
  - [x] Implement `private async applyTabMoves(orderedTabs)` shared helper

- [x] **Task 2: Update `SORT_TABS` handler in `background/index.ts`** (AC: 5)
  - [x] Read `settings.sortPreserveGroups` before the inner switch and pass to `sortByDomain()`

- [x] **Task 3: Update unit tests** (AC: 1–4, 7)
  - [x] Existing flat-sort tests remain passing
  - [x] Added `describe('sortByDomain(preserveGroups = true)')` block with 6 new tests:
    - [x] Ungrouped tabs appear before grouped tabs
    - [x] Ungrouped tabs sorted by domain and placed at beginning
    - [x] Tabs within a group sorted internally by domain
    - [x] Groups sorted relative to each other by first tab domain key
    - [x] Move error does not abort remaining moves
    - [x] `preserveGroups = false` still does flat sort

## Dev Notes

### What's Already In Place

| Component | Status |
|---|---|
| `settings.sortPreserveGroups` | ✅ Defined in `Settings` type, default `true` in `DEFAULT_SETTINGS` |
| Settings UI checkbox | ✅ "Preserve tab groups when sorting" in `src/options/App.tsx` `SettingsTab` |
| `tabGroups` permission | ✅ In `src/manifest.json` |
| `TabSorter` class | ✅ `src/background/modules/tab-sorter.ts` — add `preserveGroups` param |
| `SORT_TABS` handler | ✅ `background/index.ts` — just needs `storage.getSettings()` call added |
| `makeTab` test helper | ✅ `tests/unit/tab-sorter.test.ts` already has it with `groupId: -1` default |

**No new files needed.** This is a targeted extension of existing code.

### Chrome Tab Group Contiguity

Chrome enforces that all tabs in a group must remain contiguous. When applying `chrome.tabs.move()` calls sequentially in the order of `finalOrder`, the moves will naturally maintain contiguity **as long as all tabs of a group are placed in consecutive target indices** — which `groupAwareSortTabs()` guarantees by using `sortedGroups.flat()`.

If Chrome rejects a move (e.g. due to a transient constraint), the error is caught, logged, and the sort continues. The result will have `success: false` in that case, but partial sorting is acceptable.

### `TAB_GROUP_ID_NONE` is `-1`

Chrome's [`chrome.tabGroups.TAB_GROUP_ID_NONE`](https://developer.chrome.com/docs/extensions/reference/tabGroups/) constant equals `-1`. In the implementation, compare directly to `-1` (or use the constant if available in the type definitions):
```typescript
const ungrouped = tabs.filter(t => t.groupId === -1);
```

### Refactoring `sortByDomain` into helpers

Extract the existing sort+move loop into a reusable private helper to avoid duplication:

```typescript
private async applyTabMoves(
  orderedTabs: chrome.tabs.Tab[],
): Promise<{ errors: string[] }> {
  const errors: string[] = [];
  for (let i = 0; i < orderedTabs.length; i++) {
    const tab = orderedTabs[i];
    if (tab.index !== i) {
      try {
        await chrome.tabs.move(tab.id!, { index: i });
        tab.index = i;
      } catch (error) {
        errors.push(`Failed to move tab ${tab.id}: ${String(error)}`);
      }
    }
  }
  return { errors };
}
```

Then both `flatSortTabs` and `groupAwareSortTabs` call `applyTabMoves(sortedTabs)`.

### Final shape of `TabSorter` after this story

```typescript
export class TabSorter {
  async sortByDomain(preserveGroups = false): Promise<SortTabsResult> {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    if (tabs.length === 0) return { success: true, tabCount: 0, errors: [] };
    return preserveGroups
      ? this.groupAwareSortTabs(tabs)
      : this.flatSortTabs(tabs);
  }

  private async flatSortTabs(tabs: chrome.tabs.Tab[]): Promise<SortTabsResult> { ... }
  private async groupAwareSortTabs(tabs: chrome.tabs.Tab[]): Promise<SortTabsResult> { ... }
  private async applyTabMoves(orderedTabs: chrome.tabs.Tab[]): Promise<{ errors: string[] }> { ... }
  private getDomainSortKey(url: string): string { ... }  // unchanged
}
```

### `background/index.ts` — Minimal Change

Only the `case 'domain':` branch needs touching — add `storage.getSettings()` before the switch and thread `settings.sortPreserveGroups` into the call:

```typescript
case 'SORT_TABS': {
  const settings = await storage.getSettings();
  switch (message.sortOrder) {
    case 'domain': {
      const result = await tabSorter.sortByDomain(settings.sortPreserveGroups);
      if (!result.success) {
        return { success: false, message: result.errors.join('; ') };
      }
      return { success: true, count: result.tabCount };
    }
    default:
      return { success: false, message: `Sort order '${message.sortOrder}' not yet implemented` };
  }
}
```

### References

- User stories: [_bmad-output/planning-artifacts/user-stories.md](_bmad-output/planning-artifacts/user-stories.md) — Story 6.5
- Architecture: [_bmad-output/planning-artifacts/architecture.md](_bmad-output/planning-artifacts/architecture.md) — "Flow 3: Sort Tabs by Domain", `sortPreserveGroups` setting
- `TabSorter`: [src/background/modules/tab-sorter.ts](src/background/modules/tab-sorter.ts) — **primary file to modify**
- Background entry: [src/background/index.ts](src/background/index.ts) — **modify** `SORT_TABS` handler (`case 'domain':`)
- Storage types: [src/shared/types/storage.ts](src/shared/types/storage.ts) — `Settings.sortPreserveGroups`
- Constants: [src/shared/constants.ts](src/shared/constants.ts) — `DEFAULT_SETTINGS.sortPreserveGroups = true`
- Settings UI: [src/options/App.tsx](src/options/App.tsx) — `SettingsTab` "Preserve tab groups when sorting" checkbox (no changes)
- Existing tests: [tests/unit/tab-sorter.test.ts](tests/unit/tab-sorter.test.ts) — **extend** with group-aware test cases
- Previous story: [_bmad-output/implementation-artifacts/6-1-sort-tabs-by-domain.md](_bmad-output/implementation-artifacts/6-1-sort-tabs-by-domain.md)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

### Completion Notes List

### File List

- `src/background/modules/tab-sorter.ts` ← **modify** (add `preserveGroups` param + `groupAwareSortTabs` + `applyTabMoves` helpers)
- `src/background/index.ts` ← **modify** (read `settings.sortPreserveGroups`, pass to `sortByDomain`)
- `tests/unit/tab-sorter.test.ts` ← **modify** (add group-aware test cases)
