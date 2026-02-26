# Story 1.1: Remove Duplicate Tabs

**Status:** Done  
**Epic:** 1 - Duplicate Tab Management  
**Created:** 2025-12-11

---

## Story

**As a** power user with many tabs open  
**I want to** identify and remove duplicate tabs  
**So that** I reduce clutter and browser memory usage

---

## Acceptance Criteria

1. **AC1: Scan All Tabs**
   - Extension can scan all open tabs across all windows
   - Uses `chrome.tabs.query({})` to get complete tab list

2. **AC2: Identify Duplicates by Normalized URL**
   - Duplicates are identified by URL excluding query parameters (default mode: `ignoreParams`)
   - URL normalization uses `duplicateDetectionMode` from settings
   - Example: `https://example.com/page?ref=123` and `https://example.com/page` ARE duplicates

3. **AC3: Display Duplicates Before Removal**
   - User sees a list/count of detected duplicates before removal
   - Confirmation shows count of tabs that will be removed

4. **AC4: Configurable Keep Strategy**
   - User can choose which duplicate to keep: newest OR oldest
   - Default: keep oldest (first opened)

5. **AC5: Manual Trigger via Popup**
   - Removal is triggered manually via "Remove Duplicates" button in popup
   - Button already exists in `QuickActions.tsx`

6. **AC6: Confirmation of Results**
   - After removal, show count of tabs removed
   - Track closed tabs in `recentlyClosed` for undo capability

---

## Tasks / Subtasks

- [x] **Task 1: Create DuplicateDetector Module** (AC: 1, 2)
  - [x] Create `src/background/modules/duplicate-detector.ts`
  - [x] Implement `findDuplicates()` function that queries all tabs
  - [x] Use `normalizeUrl()` from `url-utils.ts` for comparison
  - [x] Return grouped duplicates with metadata (tabId, url, title, windowId)

- [x] **Task 2: Implement Remove Duplicates Logic** (AC: 3, 4, 6)
  - [x] Implement `removeDuplicates(keepStrategy: 'oldest' | 'newest')` function
  - [x] Sort duplicates by tab ID or creation order (oldest = lower ID approximation)
  - [x] Keep one tab per group, close others via `chrome.tabs.remove()`
  - [x] Store closed tabs in `recentlyClosed` with `closedBy: 'duplicate'`

- [x] **Task 3: Wire Up Message Handler** (AC: 5)
  - [x] Update `REMOVE_DUPLICATES` case in `handleMessage()` in `background/index.ts`
  - [x] Call `DuplicateDetector.removeDuplicates()`
  - [x] Return `{ success: true, count: removedCount }`

- [x] **Task 4: Update Popup UI Feedback** (AC: 3, 6)
  - [x] Update `QuickActions.tsx` to display result count to user
  - [x] Consider adding toast/notification for removal confirmation

- [x] **Task 5: Add Duplicate Count to Stats** (AC: 1)
  - [x] Implement `getDuplicateCount()` in DuplicateDetector
  - [x] Update `getStats()` in background to return real `duplicateCount`
  - [x] Stats component already displays this field

### Review Follow-ups (AI)

- [x] [AI-Review][High] Implement AC3 "display duplicates before removal": add a pre-scan + confirmation UX before calling removal. [`src/popup/components/QuickActions.tsx:30-40`]
- [x] [AI-Review][High] Implement AC4 keep strategy selection end-to-end (UI + message payload + background handler; default keep oldest). [`src/background/index.ts:136-143`]
- [x] [AI-Review][High] Implement real undo for recently closed entries (service worker `UNDO_CLOSE` should reopen tab + update `recentlyClosed`). [`src/background/index.ts:153-156`]
- [x] [AI-Review][Medium] Align `recentlyClosed` cap with constants (avoid duplicate hard-coded 50 vs `RECENTLY_CLOSED_MAX_ENTRIES=100`). [`src/background/modules/duplicate-detector.ts:146-150`, `src/shared/constants.ts:20-22`]
- [x] [AI-Review][Medium] Update story Dev Agent Record → File List to include git-changed files not currently listed (story/sprint-status + shared edits). [`docs/sprint-artifacts/1-1-remove-duplicate-tabs.md:257-267`]
- [x] [AI-Review][Medium] Revisit "oldest tab" heuristic: tab ID ordering is only a proxy for creation order; decide on stronger semantics or document limitation. [`src/background/modules/duplicate-detector.ts:98-104`]
- [x] [AI-Review][Low] Reconcile test count claim ("17 unit tests") with actual tests present. [`docs/sprint-artifacts/1-1-remove-duplicate-tabs.md:249-255`, `tests/unit/duplicate-detector.test.ts:50-296`]
- [x] [AI-Review][Low] Clean up unused test mocks/fixtures (e.g., `getSettings` unused in detector tests) to reduce noise. [`tests/unit/duplicate-detector.test.ts:18-22`]

---

## Dev Notes

### Architecture Compliance

Per `docs/technical/architecture.md`:

- **Service Worker Pattern**: All tab operations MUST happen in background service worker
- **Storage as Source of Truth**: Closed tabs stored in `chrome.storage.local`
- **Non-Destructive**: Track removed tabs in `recentlyClosed` for undo capability

### Key Files to Touch

| File | Action |
|------|--------|
| `src/background/modules/duplicate-detector.ts` | **CREATE** - New module |
| `src/background/index.ts` | **MODIFY** - Wire up message handler |
| `src/popup/components/QuickActions.tsx` | **MODIFY** - Add user feedback |
| `src/popup/components/Stats.tsx` | **VERIFY** - Already displays duplicateCount |

### Existing Code to Reuse

1. **URL Normalization** - Already implemented in `src/shared/utils/url-utils.ts`:

```typescript
// Use this for duplicate detection
import { normalizeUrl } from '@shared/utils/url-utils';

const normalized = normalizeUrl(tab.url, settings.duplicateDetectionMode);
```

2. **Storage Types** - Already defined in `src/shared/types/storage.ts`:
   - `ClosedTabEntry` - use for tracking removed duplicates
   - `Settings.duplicateDetectionMode` - get from settings

3. **Messaging** - Already set up in `src/shared/messaging.ts`:
   - `REMOVE_DUPLICATES` message type exists
   - Handler stub exists in `background/index.ts` (line 135-137)

### Implementation Pattern

```typescript
// src/background/modules/duplicate-detector.ts
import { normalizeUrl } from '@shared/utils/url-utils';
import type { DuplicateDetectionMode } from '@shared/types';

interface DuplicateGroup {
  normalizedUrl: string;
  tabs: chrome.tabs.Tab[];
}

export class DuplicateDetector {
  async findDuplicates(mode: DuplicateDetectionMode): Promise<DuplicateGroup[]> {
    const tabs = await chrome.tabs.query({});
    const urlMap = new Map<string, chrome.tabs.Tab[]>();
    
    for (const tab of tabs) {
      if (!tab.url) continue;
      const normalized = normalizeUrl(tab.url, mode);
      const existing = urlMap.get(normalized) || [];
      existing.push(tab);
      urlMap.set(normalized, existing);
    }
    
    // Return only groups with duplicates (2+ tabs)
    return Array.from(urlMap.entries())
      .filter(([_, tabs]) => tabs.length > 1)
      .map(([url, tabs]) => ({ normalizedUrl: url, tabs }));
  }
  
  async removeDuplicates(
    mode: DuplicateDetectionMode,
    keepStrategy: 'oldest' | 'newest' = 'oldest'
  ): Promise<{ removed: chrome.tabs.Tab[]; kept: chrome.tabs.Tab[] }> {
    const groups = await this.findDuplicates(mode);
    const removed: chrome.tabs.Tab[] = [];
    const kept: chrome.tabs.Tab[] = [];
    
    for (const group of groups) {
      // Sort by tab ID (proxy for creation order)
      const sorted = [...group.tabs].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
      
      const keepIndex = keepStrategy === 'oldest' ? 0 : sorted.length - 1;
      
      for (let i = 0; i < sorted.length; i++) {
        if (i === keepIndex) {
          kept.push(sorted[i]);
        } else {
          removed.push(sorted[i]);
        }
      }
    }
    
    // Close duplicate tabs
    const idsToClose = removed.map(t => t.id).filter((id): id is number => id !== undefined);
    if (idsToClose.length > 0) {
      await chrome.tabs.remove(idsToClose);
    }
    
    return { removed, kept };
  }
  
  async getDuplicateCount(mode: DuplicateDetectionMode): Promise<number> {
    const groups = await this.findDuplicates(mode);
    // Count tabs that WOULD be removed (all but one per group)
    return groups.reduce((sum, group) => sum + group.tabs.length - 1, 0);
  }
}
```

### Testing Requirements

Per architecture standards:
- Unit tests in `tests/unit/duplicate-detector.test.ts`
- Test cases:
  - Tabs with same URL → detected as duplicates
  - Tabs with different query params (mode: ignoreParams) → detected
  - Tabs with different anchors (mode: ignoreAnchors) → detected
  - Single tabs → not flagged as duplicates
  - Chrome internal URLs (`chrome://`) → skipped

### Edge Cases to Handle

1. **Chrome Internal Pages**: Skip `chrome://`, `chrome-extension://`, `about:`, `brave://` URLs
   - Use `isChromeInternalUrl()` from `url-utils.ts`

2. **Tabs Without URLs**: New tabs may have `undefined` url - skip these

3. **Pinned Tabs**: Consider whether to include pinned tabs in duplicate detection
   - Recommendation: Include by default (they're still duplicates)

4. **Active Tab**: Don't close the currently active tab even if duplicate
   - Keep active tab, close the other duplicate

### Project Structure Notes

- Module location follows architecture: `src/background/modules/`
- Export pattern: class-based module like `StorageService`
- Import alias: `@shared/` maps to `src/shared/`

---

## References

- [Source: docs/user-stories.md#Story 1.1]
- [Source: docs/technical/architecture.md#DuplicateDetector]
- [Source: docs/technical/architecture.md#Data Models - Settings.duplicateDetectionMode]
- [Source: docs/product-brief.md#Duplicate Tab Removal]

---

## Dev Agent Record

### Context Reference

Story prepared by SM agent using BMAD create-story workflow.

### Agent Model Used

Claude (Opus 4.5) via Cursor

### Implementation Plan

1. Created `DuplicateDetector` class with dependency injection for `StorageService`
2. Implemented `findDuplicates()` using `normalizeUrl()` and `isChromeInternalUrl()` 
3. Implemented `getDuplicateCount()` for stats display
4. Implemented `removeDuplicates()` with keep strategy (oldest/newest) and active tab protection
5. Added storage of closed tabs in `recentlyClosed` for undo capability
6. Wired up `REMOVE_DUPLICATES` message handler in background service worker
7. Updated `getStats()` to return real duplicate count
8. Added toast notification UI in `QuickActions.tsx` for user feedback

### Completion Notes List

- All 5 tasks completed with 17 unit tests passing
- `DuplicateDetector` follows architecture pattern (class-based module like `StorageService`)
- Uses existing `normalizeUrl()` and `isChromeInternalUrl()` utilities
- Closed tabs tracked in `recentlyClosed` with `closedBy: 'duplicate'` for undo
- Active tab is protected from removal even if it's a duplicate
- Toast notification displays removal count or "No duplicates found"
- Stats component now shows real-time duplicate count

### File List

Files created:
- `src/background/modules/duplicate-detector.ts`
- `tests/unit/duplicate-detector.test.ts`

Files modified:
- `src/background/index.ts`
- `src/popup/components/QuickActions.tsx`
- `src/popup/styles/popup.css`
- `src/shared/messaging.ts`
- `src/shared/types/rules.ts`
- `src/shared/utils/pattern-matcher.ts`
- `docs/sprint-artifacts/sprint-status.yaml`
- `docs/sprint-artifacts/1-1-remove-duplicate-tabs.md`

---

## Change Log

| Date | Change |
|------|--------|
| 2025-12-15 | Implemented duplicate tab detection and removal (Story 1.1) |
| 2025-12-15 | Senior Developer Review (AI): logged follow-up action items; status moved back to in-progress |
| 2025-12-15 | Addressed all 8 code review findings: AC3 pre-scan confirmation, AC4 keep strategy, UNDO_CLOSE, constants alignment, documentation |
| 2025-12-15 | Senior Developer Review (AI): re-review passed; AC3/AC4/AC6 validated against implementation; status set to done |

---

## Senior Developer Review (AI)

**Reviewer:** Chris  
**Date:** 2025-12-15  
**Outcome:** Approve ✅

### Evidence (key deltas)

- **AC3 (pre-scan + confirm)**: `GET_DUPLICATE_COUNT` + confirmation UI before removal. (`src/popup/components/QuickActions.tsx:36-124`, `src/background/index.ts:136-140`)
- **AC4 (keep strategy)**: UI selection + message payload + background handler. (`src/popup/components/QuickActions.tsx:99-124`, `src/shared/messaging.ts:7-19`, `src/background/index.ts:142-150`)
- **AC6 (undo capability)**: `UNDO_CLOSE` reopens URL and removes entry. (`src/background/index.ts:160-183`)
- **Constants alignment**: `RECENTLY_CLOSED_MAX_ENTRIES` used in duplicate close path. (`src/background/modules/duplicate-detector.ts:7-8`, `src/background/modules/duplicate-detector.ts:150-153`)

### Notes

- Unit tests: `tests/unit/duplicate-detector.test.ts` reports **17 passing tests** (re-run in this environment may log a Vitest worker shutdown EPERM warning, but exit code was 0).
