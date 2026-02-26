# Story 3.2: Track Tab Activity

Status: done

## Story

As the extension,
I need to track when tabs were last active,
so that I can determine tab age for auto-close rules.

## Acceptance Criteria

1. **AC1: Track "last active" timestamp** — Each tab has a `lastActiveAt` timestamp updated whenever it becomes the active/focused tab.
2. **AC2: "Active" = tab was selected/viewed** — A tab is considered active when the user switches focus to it (`chrome.tabs.onActivated` event fires).
3. **AC3: Timestamp updates on activation** — `lastActiveAt` is set to `Date.now()` each time `onActivated` fires for a tab.
4. **AC4: New tabs start with current timestamp** — When a new tab is created (`chrome.tabs.onCreated`), both `createdAt` and `lastActiveAt` are initialized to `Date.now()`. Tabs with an empty or undefined URL (e.g., new-tab pages, extension pages) are **exempt from tracking** — they will never match a URL-pattern-based auto-close rule, so storing a record for them provides no value.
5. **AC5: Activity data persists across browser restarts** — All tab activity is stored in `chrome.storage.local` (the `tabActivity` and `tabActivityByUrl` keys) so it survives service worker termination and browser restarts.
6. **AC6: Stale entries cleaned up** — When a tab is removed (`chrome.tabs.onRemoved`), its entry in `tabActivity` is deleted to prevent unbounded growth. The `tabActivityByUrl` entry is preserved (it contains the last-known timestamp by URL for cross-restart persistence).
7. **AC7: ActivityTracker exposes a public API** — `getActivity(tabId)` returns the `TabActivity` for a given tab; `getAllActivity()` returns the full map; `getTabAge(tabId)` returns milliseconds since `lastActiveAt`.

## Tasks / Subtasks

- [x] **Task 1: Create `ActivityTracker` module** (AC: 1–7)
  - [x] Create `src/background/modules/activity-tracker.ts`
  - [x] Class constructor: `constructor(private storage: StorageService)`
  - [x] `recordTabActivated(tabId: number, url: string): Promise<void>` — sets `lastActiveAt = Date.now()` for the tab; creates entry if missing; updates `tabActivityByUrl[url]`
  - [x] `recordTabCreated(tabId: number, url: string): Promise<void>` — sets both `createdAt` and `lastActiveAt` to `Date.now()`; skips if URL is empty/undefined
  - [x] `recordTabRemoved(tabId: number): Promise<void>` — removes the `tabActivity[tabId]` entry; preserves `tabActivityByUrl`
  - [x] `getActivity(tabId: number): Promise<TabActivity | null>` — returns the stored `TabActivity` or `null`
  - [x] `getAllActivity(): Promise<Record<number, TabActivity>>` — returns the full `tabActivity` map
  - [x] `getTabAge(tabId: number): Promise<number | null>` — returns `Date.now() - lastActiveAt` or `null` if no entry
  - [x] Handle tabs where URL is empty string or undefined (extension pages, new tab pages begin with no URL)
  - [x] Use `STORAGE_KEYS.local.TAB_ACTIVITY` and `STORAGE_KEYS.local.TAB_ACTIVITY_BY_URL` constants

- [x] **Task 2: Wire `ActivityTracker` into `background/index.ts`** (AC: 1–6)
  - [x] Import and instantiate `ActivityTracker` alongside existing services
  - [x] Replace `// TODO: Update tab activity timestamp` in `chrome.tabs.onActivated` handler with `activityTracker.recordTabActivated(activeInfo.tabId, tab.url ?? '')`
    - [x] Must `await chrome.tabs.get(activeInfo.tabId)` to get the tab URL before calling
    - [x] Wrap in `try/catch` to handle race condition where tab has already been removed
  - [x] In `chrome.tabs.onCreated`, call `activityTracker.recordTabCreated(tab.id!, tab.url ?? '')`
  - [x] Replace `// TODO: Clean up tab activity data` in `chrome.tabs.onRemoved` with `activityTracker.recordTabRemoved(tabId)`
  - [x] In `chrome.tabs.onUpdated`, call `activityTracker.recordTabCreated(tabId, changeInfo.url)` when `changeInfo.url` is defined AND no existing entry exists for `tabId` (handle navigations to new URLs while preserving the existing `lastActiveAt`)
    - [x] Alternative approach: on `onUpdated` URL change, only update the `url` field on the existing `TabActivity` record without touching timestamps

- [x] **Task 3: Export `ActivityTracker` from background module** (AC: 7)
  - [x] No changes needed to `src/shared/types/storage.ts` — `TabActivity`, `LocalStorage` interfaces are already correct
  - [x] No changes needed to `StorageService` — `getLocalStorage()` and `updateLocalStorage()` already handle `tabActivity` and `tabActivityByUrl`
  - [x] Verify `STORAGE_KEYS.local.TAB_ACTIVITY` and `STORAGE_KEYS.local.TAB_ACTIVITY_BY_URL` are present in `src/shared/constants.ts` ✓ (confirmed)

- [x] **Task 4: Unit Tests** (AC: 1–7)
  - [x] Create `tests/unit/activity-tracker.test.ts`
  - [x] Test: `recordTabCreated` sets both `createdAt` and `lastActiveAt`
  - [x] Test: `recordTabActivated` updates `lastActiveAt` but not `createdAt`
  - [x] Test: `recordTabActivated` updates `tabActivityByUrl[url]`
  - [x] Test: `recordTabRemoved` deletes `tabActivity[tabId]` entry
  - [x] Test: `recordTabRemoved` preserves `tabActivityByUrl` entry
  - [x] Test: `getActivity` returns `null` for unknown tabId
  - [x] Test: `getTabAge` returns a positive number for a recently created tab
  - [x] Test: handles empty/undefined URL gracefully (no crash)
  - [x] Mock `StorageService` — use the existing `vi.fn()` / `vi.mock()` pattern seen in `tests/unit/storage-service.test.ts`
  - [x] Mock `Date.now()` using `vi.spyOn(Date, 'now')` for deterministic timestamp assertions

### Review Follow-ups (AI) - 2026-02-26 Code Review
- [x] [AI-Review][High] Align AC4 behavior and implementation for new tabs with empty URL: either initialize `tabActivity` timestamps on create regardless of URL, or update AC/task wording to explicitly exempt empty/undefined URLs. [src/background/modules/activity-tracker.ts:55]
- [x] [AI-Review][Medium] Reduce lost-update risk in ActivityTracker read-modify-write flows during concurrent tab events (activation/update/remove). [src/background/modules/activity-tracker.ts:21]
- [x] [AI-Review][Medium] Add unit/integration coverage for `background/index.ts` tab event wiring (`onCreated`, `onActivated`, `onUpdated`, `onRemoved`) to verify ActivityTracker methods are invoked as intended. [src/background/index.ts:70]

## Dev Notes

### Architecture Context

This story implements the `ActivityTracker` module described in the architecture (`src/background/modules/activity-tracker.ts`). It is a **pure background service worker module** — there are no UI components or options page changes in this story.

The module sits in the storage pipeline:
```
chrome.tabs.onActivated
        │
        ▼
  background/index.ts  (wiring)
        │
        ▼
  ActivityTracker      (business logic)
        │
        ▼
  StorageService       (persistence)
        │
        ▼
  chrome.storage.local (tabActivity + tabActivityByUrl)
```

### Project Structure Notes

- **New file to create:** `src/background/modules/activity-tracker.ts`
- **File to modify:** `src/background/index.ts` — wire up the tracker to 3 event handlers
- **New test file:** `tests/unit/activity-tracker.test.ts`
- **No changes required** to: shared types, StorageService, constants, UI components

#### Naming & pattern conventions (from existing modules):

```typescript
// Class pattern (follow auto-group-manager.ts, duplicate-detector.ts)
export class ActivityTracker {
  constructor(private storage: StorageService) {}

  async recordTabActivated(tabId: number, url: string): Promise<void> {
    try {
      // ...
    } catch (error) {
      console.error('[ActivityTracker] Failed to record tab activation:', error);
      throw error;
    }
  }
}
```

- Use `console.error('[ActivityTracker] ...')` prefix for error logging
- Methods are `async` and return `Promise<void>` or `Promise<T>`
- Import types from `@shared/types` (path alias configured in `tsconfig.json`)
- Import constants from `@shared/constants`

### Key Data Structures (already defined — do NOT redefine)

```typescript
// From src/shared/types/storage.ts
interface TabActivity {
  tabId: number;
  url: string;
  lastActiveAt: number;  // Unix timestamp (ms)
  createdAt: number;     // Unix timestamp (ms)
}

interface LocalStorage {
  tabActivity: Record<number, TabActivity>;       // keyed by tabId
  recentlyClosed: ClosedTabEntry[];
  tabActivityByUrl: Record<string, number>;       // url -> lastActiveTimestamp
}
```

### Storage Access Pattern

Follow the same pattern as `StorageService`:

```typescript
// READ
const { tabActivity, tabActivityByUrl } = await this.storage.getLocalStorage();

// WRITE (partial update)
await this.storage.updateLocalStorage({
  tabActivity: updatedTabActivity,
  tabActivityByUrl: updatedTabActivityByUrl,
});
```

**Important:** `storage.local` quota is generous (5MB minimum), but `tabActivity` entries should still be cleaned up when tabs are removed to avoid unbounded growth.

### Handling the `onUpdated` URL Change Case

When a tab navigates to a new URL, `onUpdated` fires with `changeInfo.url`. Strategy for updating `tabActivity`:

1. If no existing record exists for `tabId` → create a new one (same as `recordTabCreated`)
2. If a record **does** exist → update the `url` field only; preserve `lastActiveAt` and `createdAt`

This avoids resetting the age clock just because a tab navigated — only actual user focus should reset `lastActiveAt`.

### Chrome API Details

```typescript
// onActivated provides tabId but NOT url — must fetch tab separately
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    await activityTracker.recordTabActivated(activeInfo.tabId, tab.url ?? '');
  } catch (error) {
    // Tab may have been closed between event and get() — ignore
    console.warn('[Background] Tab not found during activation:', error);
  }
});
```

### Testing Standards

- Testing framework: **Vitest** (`import { describe, it, expect, vi, beforeEach } from 'vitest'`)
- Chrome API mock: `globalThis.chrome` is already mocked in the test setup (see existing test files)
- `StorageService` should be mocked with `vi.fn()`:

```typescript
const mockStorage = {
  getLocalStorage: vi.fn(),
  updateLocalStorage: vi.fn(),
} as unknown as StorageService;
```

- Use `vi.spyOn(Date, 'now').mockReturnValue(1234567890)` for timestamp control

### Previously Established Patterns (from Story 3.1)

- Tests live in `tests/unit/` with `.test.ts` (non-UI) or `.test.tsx` (UI components) extension
- `vi.fn().mockResolvedValue(...)` for async mock returns
- `beforeEach(() => { vi.clearAllMocks(); })` to reset between tests
- Error cases: test that `console.error` is called (use `vi.spyOn(console, 'error')`)

### References

- Storage types: [src/shared/types/storage.ts](src/shared/types/storage.ts)
- Storage keys: [src/shared/constants.ts](src/shared/constants.ts)
- StorageService: [src/background/modules/storage-service.ts](src/background/modules/storage-service.ts)
- Background wiring: [src/background/index.ts](src/background/index.ts)
- Architecture: [_bmad-output/planning-artifacts/architecture.md](_bmad-output/planning-artifacts/architecture.md) — "ActivityTracker" section
- User stories: [_bmad-output/planning-artifacts/user-stories.md](_bmad-output/planning-artifacts/user-stories.md) — Story 3.2
- Previous story (3.1) context: [_bmad-output/implementation-artifacts/3-1-define-auto-close-rules.md](_bmad-output/implementation-artifacts/3-1-define-auto-close-rules.md)
- Architecture design note: Service Worker (`Decision 1`) — must persist all state to storage; no global variables that survive SW termination

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

None.

### Completion Notes List

✅ **Task 1 Complete:** Created `src/background/modules/activity-tracker.ts` with the full `ActivityTracker` class:
- `recordTabCreated` — initialises both `createdAt` and `lastActiveAt`; skips empty/undefined URL
- `recordTabActivated` — updates `lastActiveAt` + `tabActivityByUrl[url]`; creates entry if missing
- `recordTabRemoved` — deletes `tabActivity[tabId]`; preserves `tabActivityByUrl`; no-op if entry absent
- `recordTabUrlUpdated` — updates URL on existing record without resetting timestamps; creates entry if none exists
- `getActivity`, `getAllActivity`, `getTabAge` public API methods (AC7)
- All methods use `try/catch` with `[ActivityTracker]`-prefixed `console.error` logging

✅ **Task 2 Complete:** Wired `ActivityTracker` into `src/background/index.ts`:
- Imported and instantiated `activityTracker = new ActivityTracker(storage)`
- `onCreated`: calls `recordTabCreated(tab.id!, tab.url ?? '')` before auto-group logic
- `onActivated`: `await chrome.tabs.get()` then `recordTabActivated`; race-condition guarded with `try/catch` + `console.warn`
- `onRemoved`: calls `recordTabRemoved(tabId)`; removed `_tabId` placeholder
- `onUpdated`: calls `recordTabUrlUpdated(tabId, changeInfo.url)` when URL changes (preserves timestamps)

✅ **Task 3 Complete:** Verified existing `TabActivity`/`LocalStorage` types and `STORAGE_KEYS.local` constants — no changes required.

✅ **Task 4 Complete:** Created `tests/unit/activity-tracker.test.ts` (20 tests, all passing):
- `recordTabCreated`: 4 tests (timestamps, tabActivityByUrl, empty URL, undefined URL)
- `recordTabActivated`: 4 tests (lastActiveAt updated, createdAt preserved, URL index updated, empty URL skipped)
- `recordTabRemoved`: 3 tests (entry deleted, tabActivityByUrl preserved, no-op for unknown tabId)
- `recordTabUrlUpdated`: 3 tests (URL updated, timestamps preserved, creates entry if missing, empty URL skipped)
- `getActivity`: 2 tests (null for unknown, returns record for known)
- `getAllActivity`: 1 test (returns full map)
- `getTabAge`: 2 tests (null for unknown, positive ms for known)
- Error handling: 1 test (logs + rethrows on storage failure)

**Total tests: 190/190 passing (20 new)**

✅ **Review Item 1 [High]:** AC4 wording updated to explicitly state that tabs with empty/undefined URL are exempt from tracking and will never match a URL-pattern-based auto-close rule.

✅ **Review Item 2 [Medium]:** Added `writeQueue: Promise<void>` and `private enqueue<T>(task)` to `ActivityTracker`. All four write methods (`recordTabActivated`, `recordTabCreated`, `recordTabRemoved`, `recordTabUrlUpdated`) now chain through the queue, serialising concurrent storage read-modify-write operations.

✅ **Review Item 3 [Medium]:** Created `tests/unit/background-tab-wiring.test.ts` (7 tests). Uses `vi.hoisted` + `vi.fn(function(){})` constructor mocks (Vitest 4.x compatible). Captures real event listener callbacks via `addListener` spies in `beforeAll`, then exercises each handler and asserts correct `ActivityTracker` method calls.

**Total tests: 197/197 passing (7 new)**

### File List

**Files Created:**
- `src/background/modules/activity-tracker.ts`
- `tests/unit/activity-tracker.test.ts`

**Files Created:**
- `tests/unit/background-tab-wiring.test.ts`

**Files Modified:**
- `src/background/modules/activity-tracker.ts` — added `writeQueue`/`enqueue` serialization to prevent lost updates from concurrent tab events
- `src/background/index.ts` — imported/instantiated `ActivityTracker`; wired into `onCreated`, `onActivated`, `onUpdated`, `onRemoved` handlers

---

## Change Log

**2026-02-26** — Re-review completed (approved)
- ✅ Verified all prior High/Medium findings are resolved
- ✅ Verified Story 3.2 targeted tests pass (37/37)
- ✅ Verified full suite passes (197/197)
- ✅ Story approved and moved to done

**2026-02-26** — Story 3.2 implementation complete
- Created `ActivityTracker` module with full public API (AC1–7)
- Wired `ActivityTracker` into all four relevant tab event handlers in `background/index.ts`
- 20 unit tests added; 190 total passing

**2026-02-26** — Story 3.2 review follow-ups addressed
- [High] Updated AC4 wording to explicitly document empty/undefined URL exemption
- [Medium] Added `writeQueue`/`enqueue` promise-chain serialization to `ActivityTracker` — prevents lost updates from concurrent tab events
- [Medium] Created `tests/unit/background-tab-wiring.test.ts` with 7 tests covering all four tab event handlers and edge cases (missing tab on activate, no URL on update)
- All 197 tests passing; 0 failures
