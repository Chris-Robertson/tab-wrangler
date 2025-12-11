# Story 1.1: Remove Duplicate Tabs

**Status:** ready-for-dev  
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

- [ ] **Task 1: Create DuplicateDetector Module** (AC: 1, 2)
  - [ ] Create `src/background/modules/duplicate-detector.ts`
  - [ ] Implement `findDuplicates()` function that queries all tabs
  - [ ] Use `normalizeUrl()` from `url-utils.ts` for comparison
  - [ ] Return grouped duplicates with metadata (tabId, url, title, windowId)

- [ ] **Task 2: Implement Remove Duplicates Logic** (AC: 3, 4, 6)
  - [ ] Implement `removeDuplicates(keepStrategy: 'oldest' | 'newest')` function
  - [ ] Sort duplicates by tab ID or creation order (oldest = lower ID approximation)
  - [ ] Keep one tab per group, close others via `chrome.tabs.remove()`
  - [ ] Store closed tabs in `recentlyClosed` with `closedBy: 'duplicate'`

- [ ] **Task 3: Wire Up Message Handler** (AC: 5)
  - [ ] Update `REMOVE_DUPLICATES` case in `handleMessage()` in `background/index.ts`
  - [ ] Call `DuplicateDetector.removeDuplicates()`
  - [ ] Return `{ success: true, count: removedCount }`

- [ ] **Task 4: Update Popup UI Feedback** (AC: 3, 6)
  - [ ] Update `QuickActions.tsx` to display result count to user
  - [ ] Consider adding toast/notification for removal confirmation

- [ ] **Task 5: Add Duplicate Count to Stats** (AC: 1)
  - [ ] Implement `getDuplicateCount()` in DuplicateDetector
  - [ ] Update `getStats()` in background to return real `duplicateCount`
  - [ ] Stats component already displays this field

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

### Completion Notes List

- Boilerplate project already set up with Vite + CRXJS
- URL normalization utilities already implemented
- Message handler stub exists, needs implementation
- Popup button exists, needs result feedback

### File List

Files to create:
- `src/background/modules/duplicate-detector.ts`

Files to modify:
- `src/background/index.ts`
- `src/popup/components/QuickActions.tsx`

Files to verify work correctly:
- `src/popup/components/Stats.tsx`
- `src/shared/utils/url-utils.ts`
