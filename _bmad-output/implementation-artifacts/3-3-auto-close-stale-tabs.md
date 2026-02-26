# Story 3.3: Auto-Close Stale Tabs

Status: done

## Story

As a user with auto-close rules defined,
I want matching tabs to close automatically when stale,
so that my browser stays clean without manual effort.

## Acceptance Criteria

1. **AC1: Periodic stale-tab check** — A background alarm fires on the configured interval (`settings.autoCloseCheckInterval`, default 5 min) and triggers a full stale-tab evaluation.
2. **AC2: Rules evaluated against tab URL** — For each open tab, all enabled `autoCloseRules` are evaluated via the shared `findFirstMatchingRule` utility. The first matching enabled rule applies.
3. **AC3: Tab age compared against rule maxAge** — If a matching rule is found, the tab's age (`Date.now() - lastActiveAt` from `ActivityTracker`) is compared to `rule.maxAge`. If age > maxAge the tab is eligible for closing.
4. **AC4: Whitelist rules take precedence** — Before checking auto-close rules, enabled `whitelistRules` are evaluated. If any whitelist rule matches the URL, the tab is **skipped** entirely.
5. **AC5: Pinned tabs are protected** — If `settings.autoCloseProtectPinned` is `true` (the default), pinned tabs are never auto-closed regardless of rules.
6. **AC6: Non-http(s) tabs are skipped** — Tabs with internal URLs (`chrome://`, `chrome-extension://`, empty URLs, `about:blank`) are never auto-closed.
7. **AC7: Closed tabs are added to `recentlyClosed`** — Before closing a tab, a `ClosedTabEntry` (`closedBy: 'auto'`) is appended to `recentlyClosed` in `chrome.storage.local`. This enables the undo feature in Story 3.6.
8. **AC8: `recentlyClosed` is capped** — After any auto-close batch, the list is trimmed to the last `RECENTLY_CLOSED_MAX_ENTRIES` (100) items.
9. **AC9: Auto-close respects the global toggle** — If `settings.autoCloseEnabled` is `false`, the alarm handler exits immediately without closing any tabs.
10. **AC10: Tabs with no activity record use `createdAt` as fallback** — If `ActivityTracker` has no record for a tab ID, the tab's age is considered 0 (i.e., just created) and it is skipped. This prevents closing tabs that haven't been tracked yet.

## Tasks / Subtasks

- [x] **Task 1: Create `AutoCloseScheduler` module** (AC: 1–10)
  - [x] Create `src/background/modules/auto-close-scheduler.ts`
  - [x] Class constructor: `constructor(private storage: StorageService, private activityTracker: ActivityTracker)`
  - [x] Implement `runCheck(): Promise<AutoCloseResult>` — main entry point called by the alarm handler
    - [x] Load settings; if `!settings.autoCloseEnabled`, return early with `{ closedCount: 0, errors: [] }`
    - [x] Load all open tabs: `chrome.tabs.query({})`
    - [x] Load `autoCloseRules` and `whitelistRules` from storage; filter both to `enabled === true`
    - [x] For each tab:
      - [x] Skip if `tab.id` is undefined
      - [x] Skip if `tab.pinned && settings.autoCloseProtectPinned` (AC5)
      - [x] Skip if URL doesn't start with `http://` or `https://` (AC6)
      - [x] Skip if any enabled whitelist rule matches `tab.url` (AC4)
      - [x] Find first enabled auto-close rule matching `tab.url` (AC2)
      - [x] If no rule matches, skip
      - [x] Get activity: `await this.activityTracker.getActivity(tab.id)` (AC10)
      - [x] If no activity record, skip (treat as age 0)
      - [x] Compare `Date.now() - activity.lastActiveAt > rule.maxAge` (AC3)
      - [x] If stale: add `ClosedTabEntry` to `newlyClosed[]`, call `chrome.tabs.remove(tab.id!)`
      - [x] Wrap `chrome.tabs.remove` in `try/catch` — tab may have been closed between query and remove
    - [x] After processing all tabs, if `newlyClosed.length > 0`:
      - [x] Load current `recentlyClosed` from storage
      - [x] Prepend `newlyClosed` to the list (newest first)
      - [x] Trim to `RECENTLY_CLOSED_MAX_ENTRIES` (AC8)
      - [x] Save back via `storage.updateLocalStorage({ recentlyClosed: trimmed })`
    - [x] Return `{ closedCount: newlyClosed.length, errors }`
  - [x] Export type `AutoCloseResult = { closedCount: number; errors: string[] }`

- [x] **Task 2: Wire `AutoCloseScheduler` into `background/index.ts`** (AC: 1, 9)
  - [x] Import `AutoCloseScheduler` and `ActivityTracker` (from Story 3.2)
  - [x] Instantiate after existing service instances:
    ```typescript
    const activityTracker = new ActivityTracker(storage);
    const autoCloseScheduler = new AutoCloseScheduler(storage, activityTracker);
    ```
  - [x] Replace `// TODO: Implement auto-close check` in the `chrome.alarms.onAlarm` handler:
    ```typescript
    if (alarm.name === ALARM_AUTO_CLOSE_CHECK) {
      try {
        const result = await autoCloseScheduler.runCheck();
        if (result.closedCount > 0) {
          console.log(`[Background] Auto-closed ${result.closedCount} stale tab(s)`);
        }
      } catch (error) {
        console.error('[Background] Auto-close check failed:', error);
      }
    }
    ```
  - [x] Pass `activityTracker` to the existing event handlers for Story 3.2 wiring (this file touch is shared with Story 3.2 — coordinate if both stories are developed in sequence)

- [x] **Task 3: Unit Tests** (AC: 1–10)
  - [x] Create `tests/unit/auto-close-scheduler.test.ts`
  - [x] Mock setup:
    ```typescript
    const mockStorage = {
      getSettings: vi.fn(),
      getAutoCloseRules: vi.fn(),
      getWhitelistRules: vi.fn(),
      getLocalStorage: vi.fn(),
      updateLocalStorage: vi.fn(),
    } as unknown as StorageService;

    const mockActivityTracker = {
      getActivity: vi.fn(),
    } as unknown as ActivityTracker;
    ```
  - [x] Mock `chrome.tabs.query` and `chrome.tabs.remove` on `globalThis.chrome`
  - [x] **Test cases:**
    - [x] `runCheck` returns early when `autoCloseEnabled = false` — no tabs queried
    - [x] Tab matching rule with age > maxAge is closed
    - [x] Tab matching rule but age <= maxAge is NOT closed
    - [x] Whitelisted tab is NOT closed even when matching auto-close rule
    - [x] Pinned tab is NOT closed when `autoCloseProtectPinned = true`
    - [x] Pinned tab IS closed when `autoCloseProtectPinned = false`
    - [x] Tab with `chrome://` URL is skipped
    - [x] Tab with no activity record is skipped (AC10)
    - [x] Closed tab is added to `recentlyClosed` with `closedBy: 'auto'`
    - [x] `recentlyClosed` is capped at RECENTLY_CLOSED_MAX_ENTRIES after overflow
    - [x] `chrome.tabs.remove` failure is caught; other tabs continue to be processed; error count increments
    - [x] Multiple matching tabs are all closed in one `runCheck` pass

  ### Review Follow-ups (AI) - 2026-02-26 Code Review
  - [x] [AI-Review][High] Ensure undo durability when persisting `recentlyClosed`: handle `updateLocalStorage` failure in `runCheck()` and avoid closing tabs without a recorded undo entry. [src/background/modules/auto-close-scheduler.ts:110]
  - [x] [AI-Review][Medium] Add overlap/reentrancy guard for alarm-triggered auto-close runs to prevent concurrent `runCheck()` executions from racing. [src/background/index.ts:63]
  - [x] [AI-Review][Medium] Add alarm wiring tests verifying `ALARM_AUTO_CLOSE_CHECK` triggers scheduler execution and non-target alarms are ignored. [tests/unit/background-tab-wiring.test.ts:96]

  ### Review Follow-ups (AI) - 2026-02-26 Re-Review
  - [x] [AI-Review][High] Ensure `recentlyClosed` only contains tabs actually closed; remove/avoid undo entries for failed `chrome.tabs.remove` attempts to preserve AC7 semantics. [src/background/modules/auto-close-scheduler.ts:142]
  - [x] [AI-Review][Medium] Align persisted `recentlyClosed` contents with reported `closedCount` in partial-failure scenarios (no storage/result mismatch). [src/background/modules/auto-close-scheduler.ts:147]
  - [x] [AI-Review][Medium] Update unit tests that currently expect failed-removal entries to remain in undo history; assert only successfully closed tabs are persisted. [tests/unit/auto-close-scheduler.test.ts:361]

## Dev Notes

### Dependencies

> ⚠️ **This story depends on Story 3.2 (`ActivityTracker`) being implemented first.** The `AutoCloseScheduler` constructor takes an `ActivityTracker` instance. Story 3.2 must be done and its `activity-tracker.ts` file committed before starting this story.

### Architecture Context

This story implements the `AutoCloseScheduler` module from the architecture doc. The full auto-close flow:

```
chrome.alarms.onAlarm (ALARM_AUTO_CLOSE_CHECK fires every N minutes)
        │
        ▼
  AutoCloseScheduler.runCheck()
        │
        ├── chrome.tabs.query({})          ← get all open tabs
        ├── StorageService.getSettings()   ← check autoCloseEnabled, protectPinned
        ├── StorageService.getAutoCloseRules()
        ├── StorageService.getWhitelistRules()
        │
        ├── for each tab:
        │     ActivityTracker.getActivity(tabId) ← get lastActiveAt
        │     findFirstMatchingRule(url, enabledWhitelist) → skip if match
        │     findFirstMatchingRule(url, enabledAutoClose) → get maxAge
        │     if (Date.now() - lastActiveAt) > maxAge → close
        │
        └── StorageService.updateLocalStorage({ recentlyClosed })
```

The `chrome.alarms` infrastructure is **already in place** in `background/index.ts`. The alarm is created/cleared in `setupAlarms()` based on `settings.autoCloseEnabled` and `settings.autoCloseCheckInterval`. All that's missing is the `runCheck()` call in the handler.

### Project Structure Notes

- **New file to create:** `src/background/modules/auto-close-scheduler.ts`
- **File to modify:** `src/background/index.ts` — instantiate `AutoCloseScheduler`, call `runCheck()` in alarm handler
- **New test file:** `tests/unit/auto-close-scheduler.test.ts`
- **No UI changes in this story** — the auto-close toggle already exists in the options page from Story 3.1

### Naming & Code Patterns

Follow `auto-group-manager.ts` conventions:

```typescript
import type { StorageService } from './storage-service';
import type { ActivityTracker } from './activity-tracker';
import { findFirstMatchingRule, matchPattern } from '@shared/utils/pattern-matcher';
import { generateId } from '@shared/utils/id-utils';
import { RECENTLY_CLOSED_MAX_ENTRIES } from '@shared/constants';
import type { ClosedTabEntry } from '@shared/types';

export interface AutoCloseResult {
  closedCount: number;
  errors: string[];
}

export class AutoCloseScheduler {
  constructor(
    private storage: StorageService,
    private activityTracker: ActivityTracker,
  ) {}

  async runCheck(): Promise<AutoCloseResult> {
    // ...
  }
}
```

### Building a `ClosedTabEntry`

```typescript
// Before calling chrome.tabs.remove(tab.id!)
const entry: ClosedTabEntry = {
  id: generateId(),
  url: tab.url!,
  title: tab.title ?? tab.url ?? 'Unknown',
  favicon: tab.favIconUrl ?? null,
  closedAt: Date.now(),
  closedBy: 'auto',
};
newlyClosed.push(entry);
```

### Pattern Matching — Use Shared Utilities

Do **NOT** re-implement pattern matching. Use the existing shared utilities:

```typescript
import { findFirstMatchingRule, matchPattern } from '@shared/utils/pattern-matcher';

// Whitelist check (any match → skip)
const isWhitelisted = enabledWhitelistRules.some(
  (rule) => matchPattern(tab.url!, rule.pattern, rule.patternType)
);

// Auto-close rule (first match wins)
const matchingRule = findFirstMatchingRule(tab.url!, enabledAutoCloseRules);
```

Note: `findFirstMatchingRule` does NOT filter by `enabled` — filter before passing:
```typescript
const enabledAutoCloseRules = autoCloseRules.filter((r) => r.enabled);
const enabledWhitelistRules = whitelistRules.filter((r) => r.enabled);
```

### Storage — `recentlyClosed` Update Pattern

```typescript
// Efficient prepend + trim
const { recentlyClosed: existing } = await this.storage.getLocalStorage();
const updated = [...newlyClosed, ...existing].slice(0, RECENTLY_CLOSED_MAX_ENTRIES);
await this.storage.updateLocalStorage({ recentlyClosed: updated });
```

### Important: Archive is OUT OF SCOPE

Story 3.5 (Archive Tabs to Bookmarks) is a separate story. In this story, **do not** call any archive/bookmarks API. The `recentlyClosed` entry is the only pre-close action required here.

### Chrome API Details

```typescript
// tabs.query returns tabs with optional fields — always guard with ?. or ??
const tabs = await chrome.tabs.query({});
// tab.id, tab.url, tab.title, tab.favIconUrl may be undefined

// Safe tab close — tab may have closed between query and remove
try {
  await chrome.tabs.remove(tab.id!);
} catch (error) {
  errors.push(`Failed to close tab ${tab.id}: ${String(error)}`);
  // Continue processing remaining tabs — do NOT rethrow
}
```

### `background/index.ts` Instantiation Order

The final instantiation order in `background/index.ts` should be:
```typescript
const storage = new StorageService();
const duplicateDetector = new DuplicateDetector(storage);
const autoGroupManager = new AutoGroupManager(storage);
const activityTracker = new ActivityTracker(storage);          // Story 3.2
const autoCloseScheduler = new AutoCloseScheduler(storage, activityTracker); // This story
```

### Testing Setup Pattern (from `storage-service.test.ts`)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

global.chrome = {
  tabs: {
    query: vi.fn(),
    remove: vi.fn(),
  },
  storage: { /* ... */ },
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, 'now').mockReturnValue(1000000); // control timestamps
});
```

### References

- User stories: [_bmad-output/planning-artifacts/user-stories.md](_bmad-output/planning-artifacts/user-stories.md) — Story 3.3
- Architecture: [_bmad-output/planning-artifacts/architecture.md](_bmad-output/planning-artifacts/architecture.md) — "Flow 2: Auto-Close Stale Tab", "AutoCloseScheduler" module
- Background entry point: [src/background/index.ts](src/background/index.ts) — see `setupAlarms()` and `ALARM_AUTO_CLOSE_CHECK` handler
- Storage service: [src/background/modules/storage-service.ts](src/background/modules/storage-service.ts)
- Pattern matcher: [src/shared/utils/pattern-matcher.ts](src/shared/utils/pattern-matcher.ts)
- ID utils: [src/shared/utils/id-utils.ts](src/shared/utils/id-utils.ts)
- Constants: [src/shared/constants.ts](src/shared/constants.ts) — `RECENTLY_CLOSED_MAX_ENTRIES`, `ALARM_AUTO_CLOSE_CHECK`
- Storage types: [src/shared/types/storage.ts](src/shared/types/storage.ts) — `ClosedTabEntry`, `TabActivity`
- Rules types: [src/shared/types/rules.ts](src/shared/types/rules.ts) — `AutoCloseRule`, `WhitelistRule`
- ActivityTracker: [src/background/modules/activity-tracker.ts](src/background/modules/activity-tracker.ts) — **must exist from Story 3.2**
- AutoGroupManager (pattern reference): [src/background/modules/auto-group-manager.ts](src/background/modules/auto-group-manager.ts)
- Previous story (3.2): [_bmad-output/implementation-artifacts/3-2-track-tab-activity.md](_bmad-output/implementation-artifacts/3-2-track-tab-activity.md)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

None.

### Completion Notes List

✅ **Task 1 Complete:** Created `src/background/modules/auto-close-scheduler.ts` with `AutoCloseScheduler` class:
- `runCheck()` fetches settings, tabs, and rules in parallel (Promise.all)
- Enforces all skip conditions: global toggle (AC9), pinned protection (AC5), non-http(s) URL guard (AC6), whitelist precedence (AC4)
- Uses `findFirstMatchingRule` + `matchPattern` from shared utilities; filters enabled rules before passing
- Age check: `Date.now() - activity.lastActiveAt > rule.maxAge` (AC3)
- No activity record → skip (AC10)
- Builds `ClosedTabEntry` with `closedBy: 'auto'` before each remove (AC7)
- `chrome.tabs.remove` wrapped in try/catch; failed entry removed from newlyClosed; error pushed to result
- Prepends newlyClosed to existing, trims to `RECENTLY_CLOSED_MAX_ENTRIES` (AC8)
- Exports `AutoCloseResult` interface

✅ **Task 2 Complete:** Wired `AutoCloseScheduler` into `src/background/index.ts`:
- Imported and instantiated `autoCloseScheduler = new AutoCloseScheduler(storage, activityTracker)` after ActivityTracker
- Replaced `// TODO: Implement auto-close check` in `chrome.alarms.onAlarm` handler with full `runCheck()` invocation + logging

✅ **Task 3 Complete:** Created `tests/unit/auto-close-scheduler.test.ts` (14 tests, all passing):
- AC9: global toggle returns early without querying tabs
- AC3: age > maxAge → closed; age ≤ maxAge → NOT closed
- AC4: whitelisted tab NOT closed
- AC5: pinned protected when flag true; closed when flag false
- AC6: `chrome://` URL skipped; empty URL skipped
- AC10: no activity record → skipped
- AC7: `ClosedTabEntry` with correct fields added to recentlyClosed
- AC8: recentlyClosed trimmed to RECENTLY_CLOSED_MAX_ENTRIES
- Error resilience: remove failure caught, error counted, other tabs continue
- Batch: multiple stale tabs all closed in one pass
- No-rule: tab with no matching rule not closed

**Total tests: 211/211 passing (14 new)**

### File List

**Files Created:**
- `src/background/modules/auto-close-scheduler.ts`
- `tests/unit/auto-close-scheduler.test.ts`
- `tests/unit/background-alarm-wiring.test.ts`

**Files Modified:**
- `src/background/index.ts` — imported/instantiated `AutoCloseScheduler`; replaced TODO in alarm handler with `runCheck()` invocation

---

## Change Log

**2026-02-26** — Story 3.3 implementation complete
- Created `AutoCloseScheduler` module covering all 10 ACs
- Wired into background alarm handler (replaces TODO placeholder)
- 14 unit tests added; 211 total passing

**2026-02-26** — Story 3.3 review follow-ups wave 1 addressed
- [High] Restructured `runCheck()` into three phases: (1) evaluate + collect stale tabs, (2) persist all undo entries to storage, (3) remove tabs. Storage write guaranteed before any `chrome.tabs.remove` call; throws cleanly if storage fails.
- [Medium] Added `private isRunning` reentrancy guard. Concurrent alarm invocation logs a warning and returns `{ closedCount: 0, errors: [] }` immediately.
- [Medium] Created `tests/unit/background-alarm-wiring.test.ts` (5 tests) and added 3 more to `auto-close-scheduler.test.ts`.
- **Total tests: 219/219 passing (8 new)**

**2026-02-26** — Story 3.3 review follow-ups wave 2 addressed
- [High] Added Phase 4 corrective write to `runCheck()`: after Phase 3 removes, any `chrome.tabs.remove` failure causes the corresponding undo entry to be stripped back out of `recentlyClosed` via a second `updateLocalStorage` call. Corrective-write failures are logged but non-fatal (tabs were already closed).
- [Medium] `closedCount` now exactly reflects tabs actually removed; `recentlyClosed` storage is guaranteed to match after Phase 4. Partial-failure scenarios are fully consistent.
- [Medium] Updated error-resilience test to verify Phase 4 corrective write; added two new tests: corrective-write removes failed entry (with simulated real-storage mock), corrective-write failure is caught and logged.
- **Total tests: 221/221 passing (2 new)**

**2026-02-26** — Story 3.3 re-review complete (approved)
- ✅ Verified all review follow-ups are addressed in implementation and tests
- ✅ Re-ran Story 3.3 focused tests: 31 passing, 0 failing
- ✅ Re-ran full suite: 221 passing, 0 failing
- ✅ Story approved and moved to done
