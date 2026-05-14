# Story 3.7: Time-of-Day Scheduled Auto-Close

Status: ready-for-dev

## Story

As a user who wants to maintain a clean workspace at predictable times,
I want to define rules that automatically close tabs at a specific time of day,
so that my browser is cleaned up at the start (or end) of my workday without any manual effort.

## Acceptance Criteria

1. **AC1: Options page Scheduled Close section** — Options page gains a new "Scheduled Close" tab between "Archive" and "Settings". The tab renders a rule list and "Add Rule" button.
2. **AC2: `ScheduledCloseRule` data model** — Each rule has: `id` (UUID), `name` (string, user-facing label), `time` (string `"HH:MM"`, 24-hour), `days` (`DayOfWeek[]`), `pattern` (`string | null` — null means all tabs), `patternType` (`PatternType | null`), `enabled` (boolean).
3. **AC3: Day-of-week presets in editor** — Editor provides quick-select buttons: "Every Day", "Weekdays (Mon–Fri)", "Weekends (Sat–Sun)", plus individual day toggles. Selecting a preset updates the `days` array.
4. **AC4: Alarm-based scheduling** — Each enabled rule registers a dedicated `chrome.alarms` entry named `scheduled-close-{ruleId}` with `when` = the next calculated fire time. Alarms fire within ~1 minute of the configured time.
5. **AC5: Skip-if-missed semantics** — If the browser was closed when a rule's time passed, the rule does NOT fire retroactively on next startup. The `when` calculation skips past times.
6. **AC6: Alarm re-registration on startup** — On `chrome.runtime.onStartup` and `chrome.runtime.onInstalled`, `ScheduledCloseManager.registerAllAlarms()` is called to re-register alarms for all enabled rules.
7. **AC7: Alarm-driven tab close execution** — When a `scheduled-close-*` alarm fires, the matching rule is loaded, tabs are closed per the rule's URL pattern (or all non-pinned http(s) tabs if no pattern), and the alarm is re-registered for the next occurrence.
8. **AC8: Whitelist respected** — Whitelist rules (Story 3.4) take precedence. Whitelisted tabs are never closed by scheduled rules.
9. **AC9: Archive on scheduled close** — Archive behavior (Story 3.5) applies to tabs closed by scheduled rules (respects `settings.archiveEnabled` and `archiveExclusionRules`).
10. **AC10: Undo window captures scheduled closes** — Tabs closed by scheduled rules are prepended to `recentlyClosed` in local storage (same undo durability protocol as `AutoCloseScheduler`).
11. **AC11: Pinned tabs protected** — Pinned tabs are never closed by scheduled rules (consistent with `autoCloseProtectPinned` behavior in Story 3.3).
12. **AC12: Rules persisted in `chrome.storage.sync`** — Rules stored under key `scheduledCloseRules`. Schema matches `ScheduledCloseRule[]`.
13. **AC13: Enabled/disabled toggle** — Toggling a rule's `enabled` flag registers or clears its alarm immediately (no page reload required).
14. **AC14: Multiple rules at same time** — Multiple rules with the same fire time are all evaluated independently.

## Tasks / Subtasks
****
- [ ] **Task 1: Extend type system** (AC: 2)
  - [ ] Add `DayOfWeek` type to `src/shared/types/rules.ts`
  - [ ] Add `ScheduledCloseRule` interface to `src/shared/types/rules.ts`
  - [ ] Export both from `src/shared/types/index.ts`

- [ ] **Task 2: Extend storage schema** (AC: 12)
  - [ ] Add `scheduledCloseRules: ScheduledCloseRule[]` to `SyncStorage` interface in `src/shared/types/storage.ts`
  - [ ] Add `STORAGE_KEYS.sync.SCHEDULED_CLOSE_RULES = 'scheduledCloseRules'` to `src/shared/constants.ts`
  - [ ] Add `ALARM_SCHEDULED_CLOSE_PREFIX = 'scheduled-close-'` constant to `src/shared/constants.ts`
  - [ ] Update `StorageService.initializeDefaults()` to initialize `scheduledCloseRules: []`
  - [ ] Add `getScheduledCloseRules()` method to `StorageService`
  - [ ] Add `saveScheduledCloseRules()` method to `StorageService`
  - [ ] Update `getSyncStorage()` to include `scheduledCloseRules`

- [ ] **Task 3: Create `ScheduledCloseManager` module** (AC: 4–11, 14)
  - [ ] Create `src/background/modules/scheduled-close-manager.ts`
  - [ ] Constructor: `constructor(private storage: StorageService, private archiveManager: ArchiveManager)`
  - [ ] Implement `registerAllAlarms(): Promise<void>` — loads all enabled rules and registers each
  - [ ] Implement `registerRuleAlarm(rule: ScheduledCloseRule): Promise<void>` — calculates next fire time, calls `chrome.alarms.create`
  - [ ] Implement `unregisterRuleAlarm(ruleId: string): Promise<void>` — calls `chrome.alarms.clear`
  - [ ] Implement `calculateNextFireTime(time: string, days: DayOfWeek[]): number` — returns milliseconds timestamp of next occurrence; skips past times (AC5)
  - [ ] Implement `runScheduledClose(ruleId: string): Promise<ScheduledCloseResult>` — executes close logic, re-registers alarm
  - [ ] Close logic reuses `AutoCloseScheduler` pattern: phase 1 (identify tabs), phase 2 (persist undo entries), phase 3 (archive + remove)
  - [ ] Export `ScheduledCloseManager` and `ScheduledCloseResult`

- [ ] **Task 4: Integrate into `background/index.ts`** (AC: 4, 6, 7, 13)
  - [ ] Import and instantiate `ScheduledCloseManager`
  - [ ] Call `scheduledCloseManager.registerAllAlarms()` in `onInstalled` handler
  - [ ] Call `scheduledCloseManager.registerAllAlarms()` in `onStartup` handler
  - [ ] In `chrome.alarms.onAlarm` listener, detect `alarm.name.startsWith(ALARM_SCHEDULED_CLOSE_PREFIX)` and delegate to `scheduledCloseManager.runScheduledClose(ruleId)`
  - [ ] Add `TOGGLE_SCHEDULED_RULE` message handler to enable/disable a rule and re-register/clear its alarm

- [ ] **Task 5: Create `useScheduledCloseRules` hook** (AC: 1, 12, 13)
  - [ ] Create `src/options/hooks/useScheduledCloseRules.ts`
  - [ ] Model after `useAutoCloseRules.ts` (optimistic updates, storage change listener, rollback on failure)
  - [ ] Key: `STORAGE_KEYS.sync.SCHEDULED_CLOSE_RULES`
  - [ ] On `toggleEnabled`, send `TOGGLE_SCHEDULED_RULE` message to background so alarm is immediately registered/cleared
  - [ ] Export `NewScheduledCloseRuleInput` type

- [ ] **Task 6: Create `ScheduledCloseRuleEditor` component** (AC: 2, 3)
  - [ ] Create `src/options/components/ScheduledCloseRuleEditor.tsx`
  - [ ] Fields: Name (text input), Time (time input `type="time"`), Days (preset buttons + individual toggles), URL Pattern (optional, with glob/regex toggle), Enabled checkbox
  - [ ] Day preset buttons: "Every Day", "Weekdays", "Weekends"
  - [ ] Validation: name required, time required, at least one day selected, pattern required if patternType is set

- [ ] **Task 7: Create `ScheduledCloseRuleList` component** (AC: 1, 13)
  - [ ] Create `src/options/components/ScheduledCloseRuleList.tsx`
  - [ ] Display: name, time, days summary (e.g., "Weekdays"), pattern (or "All tabs"), enabled toggle
  - [ ] Actions: Edit, Delete, reorder (up/down buttons)
  - [ ] Model after `AutoCloseRuleList.tsx`

- [ ] **Task 8: Add Scheduled Close tab to `App.tsx`** (AC: 1)
  - [ ] Add `'scheduled'` to `Tab` union type
  - [ ] Add "Scheduled Close" nav tab between "Archive" and "Settings"
  - [ ] Implement `ScheduledCloseRulesTab` component in `App.tsx`

- [ ] **Task 9: Unit Tests**
  - [ ] Create `tests/unit/scheduled-close-manager.test.ts`
    - [ ] `calculateNextFireTime` — today not in days, today in days but time passed, today in days time not passed, multiple days
    - [ ] `registerAllAlarms` — creates alarms for enabled rules only
    - [ ] `runScheduledClose` — filters pinned/non-http/whitelisted, respects pattern, archives, adds to recentlyClosed, re-registers alarm
    - [ ] `runScheduledClose` — no-op if rule not found or disabled
  - [ ] Create `tests/unit/use-scheduled-close-rules.test.ts`
  - [ ] Create `tests/unit/scheduled-close-rule-editor.test.tsx`
  - [ ] Create `tests/unit/scheduled-close-rule-list.test.tsx`

## Dev Notes

### Architecture Context

Story 3.7 adds a parallel close mechanism alongside `AutoCloseScheduler`. Key relationship:

```
chrome.alarms.onAlarm
   │
   ├── ALARM_AUTO_CLOSE_CHECK  →  AutoCloseScheduler.runCheck()   (age-based, periodic)
   └── scheduled-close-{id}   →  ScheduledCloseManager.runScheduledClose(id)  (time-based, per-rule)
```

The `ScheduledCloseManager` shares the same dependencies and patterns as `AutoCloseScheduler`:
- Both receive `StorageService` + `ArchiveManager` in constructor
- Both use the two-phase close protocol (persist undo entries before removing tabs)
- Both respect whitelist rules and pinned tab protection

### New Type Definitions

**Add to `src/shared/types/rules.ts`:**

```typescript
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface ScheduledCloseRule {
  id: string;
  name: string;
  time: string;              // "HH:MM" 24-hour format
  days: DayOfWeek[];
  pattern: string | null;    // null = apply to all non-pinned http(s) tabs
  patternType: PatternType | null;
  enabled: boolean;
}
```

**`DayOfWeek` maps to `Date.prototype.getDay()` values:** Sunday=0, Monday=1, …, Saturday=6. Use a lookup:
```typescript
const DAY_OF_WEEK_INDEX: Record<DayOfWeek, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};
```

### Storage Schema Changes

**`src/shared/types/storage.ts` — `SyncStorage` interface:**
```typescript
interface SyncStorage {
  // ... existing fields ...
  scheduledCloseRules: ScheduledCloseRule[];
}
```

**`src/shared/constants.ts` additions:**
```typescript
export const STORAGE_KEYS = {
  sync: {
    // ... existing keys ...
    SCHEDULED_CLOSE_RULES: 'scheduledCloseRules',
  },
  // ...
} as const;

export const ALARM_SCHEDULED_CLOSE_PREFIX = 'scheduled-close-';
```

**`StorageService` new methods (model after `getAutoCloseRules` / `saveAutoCloseRules`):**
```typescript
async getScheduledCloseRules(): Promise<ScheduledCloseRule[]> {
  const result = await chrome.storage.sync.get(STORAGE_KEYS.sync.SCHEDULED_CLOSE_RULES);
  return result[STORAGE_KEYS.sync.SCHEDULED_CLOSE_RULES] ?? [];
}

async saveScheduledCloseRules(rules: ScheduledCloseRule[]): Promise<void> {
  await chrome.storage.sync.set({
    [STORAGE_KEYS.sync.SCHEDULED_CLOSE_RULES]: rules,
  });
}
```

### `calculateNextFireTime` Implementation

```typescript
private calculateNextFireTime(time: string, days: DayOfWeek[]): number {
  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();
  const dayIndices = days.map((d) => DAY_OF_WEEK_INDEX[d]);

  for (let daysAhead = 0; daysAhead < 8; daysAhead++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + daysAhead);
    candidate.setHours(hours, minutes, 0, 0);

    if (daysAhead === 0 && candidate <= now) continue; // time already passed today

    if (dayIndices.includes(candidate.getDay())) {
      return candidate.getTime();
    }
  }

  throw new Error(`No valid fire day found for rule time=${time}, days=${days}`);
}
```

Key behavior: `daysAhead === 0 && candidate <= now` skips today if the time has passed — this enforces skip-if-missed semantics (AC5).

### `runScheduledClose` Two-Phase Protocol

Follow the **exact same pattern** as `AutoCloseScheduler._runCheck()`:

```typescript
async runScheduledClose(ruleId: string): Promise<ScheduledCloseResult> {
  const rules = await this.storage.getScheduledCloseRules();
  const rule = rules.find((r) => r.id === ruleId);

  if (!rule || !rule.enabled) return { closedCount: 0, errors: [] };

  // Re-register for next occurrence FIRST (before any async tab work)
  await this.registerRuleAlarm(rule)****;

  const [tabs, whitelistRules] = await Promise.all([
    chrome.tabs.query({}),
    this.storage.getWhitelistRules(),
  ]);
  const settings = await this.storage.getSettings();
  const enabledWhitelistRules = whitelistRules.filter((r) => r.enabled);
  const now = Date.now();

  // Phase 1: Identify tabs to close
  const planned: Array<{ entry: ClosedTabEntry; tabId: number; tab: chrome.tabs.Tab }> = [];

  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    if (tab.pinned) continue;  // AC11: always protect pinned
    if (!tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) continue;

    // AC8: Whitelist takes precedence
    if (enabledWhitelistRules.some((r) => matchPattern(tab.url!, r.pattern, r.patternType))) continue;

    // AC7: Apply URL pattern if specified
    if (rule.pattern !== null && rule.patternType !== null) {
      if (!matchPattern(tab.url, rule.pattern, rule.patternType)) continue;
    }

    planned.push({ tabId: tab.id, tab, entry: { id: generateId(), url: tab.url, title: tab.title ?? tab.url, favicon: tab.favIconUrl ?? null, closedAt: now, closedBy: 'auto' } });
  }

  if (planned.length === 0) return { closedCount: 0, errors: [] };

  // Phase 2: Persist undo entries BEFORE closing (AC10 — undo durability)
  const { recentlyClosed: existing } = await this.storage.getLocalStorage();
  const updated = [...planned.map((p) => p.entry), ...existing].slice(0, RECENTLY_CLOSED_MAX_ENTRIES);
  await this.storage.updateLocalStorage({ recentlyClosed: updated });

  // Phase 3: Archive + remove (best-effort)
  let closedCount = 0;
  const failedEntryIds = new Set<string>();
  for (const { tabId, tab, entry } of planned) {
    try {
      await this.archiveManager.archiveTab(tab);  // AC9
      await chrome.tabs.remove(tabId);
      closedCount++;
    } catch (error) {
      errors.push(`...`);
      failedEntryIds.add(entry.id);
    }
  }

  // Phase 4: Corrective write (same as AutoCloseScheduler)
  // ...

  return { closedCount, errors };
}
```

### Alarm Registration in `background/index.ts`

**Startup/install:**
```typescript
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await storage.initializeDefaults();
  }
  await setupAlarms();
  await scheduledCloseManager.registerAllAlarms(); // NEW
});

chrome.runtime.onStartup.addListener(async () => {
  await setupAlarms();
  await scheduledCloseManager.registerAllAlarms(); // NEW
});
```

**Alarm handler — detect scheduled alarms:**
```typescript
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_AUTO_CLOSE_CHECK) {
    // ... existing ...
  }

  if (alarm.name.startsWith(ALARM_SCHEDULED_CLOSE_PREFIX)) {
    const ruleId = alarm.name.slice(ALARM_SCHEDULED_CLOSE_PREFIX.length);
    try {
      const result = await scheduledCloseManager.runScheduledClose(ruleId);
      if (result.closedCount > 0) {
        console.log(`[Background] Scheduled close fired for rule ${ruleId}: closed ${result.closedCount} tab(s)`);
      }
    } catch (error) {
      console.error(`[Background] Scheduled close failed for rule ${ruleId}:`, error);
    }
  }
});
```

**Message handler — `TOGGLE_SCHEDULED_RULE`:**
Add to the `handleMessage` switch:
```typescript
case 'TOGGLE_SCHEDULED_RULE': {
  const rules = await storage.getScheduledCloseRules();
  const rule = rules.find((r) => r.id === message.ruleId);
  if (!rule) return { success: false, message: 'Rule not found' };

  const updated = { ...rule, enabled: message.enabled };
  const newRules = rules.map((r) => (r.id === message.ruleId ? updated : r));
  await storage.saveScheduledCloseRules(newRules);

  if (message.enabled) {
    await scheduledCloseManager.registerRuleAlarm(updated);
  } else {
    await scheduledCloseManager.unregisterRuleAlarm(message.ruleId);
  }
  return { success: true };
}
```

You must also add `TOGGLE_SCHEDULED_RULE` to the `messaging.ts` union type.

### `messaging.ts` — New Message Type

**Check** `src/shared/messaging.ts`. Add a new message type:
```typescript
| { type: 'TOGGLE_SCHEDULED_RULE'; ruleId: string; enabled: boolean }
```
This follows the existing union pattern in that file.

### `useScheduledCloseRules` Hook Pattern

Model directly after `useAutoCloseRules.ts`:
- Same optimistic update / rollback pattern
- Same `chrome.storage.onChanged` listener
- `toggleEnabled` method additionally sends `TOGGLE_SCHEDULED_RULE` message:
  ```typescript
  const toggleEnabled = useCallback(async (id: string): Promise<void> => {
    // optimistic state update
    const newEnabled = !rulesRef.current.find(r => r.id === id)?.enabled;
    setRulesWithRef((current) => current.map((r) => (r.id === id ? { ...r, enabled: newEnabled } : r)));
    try {
      // storage write (via save)
      await chrome.runtime.sendMessage({ type: 'TOGGLE_SCHEDULED_RULE', ruleId: id, enabled: newEnabled });
    } catch (error) { /* rollback */ }
  }, [setRulesWithRef]);
  ```
  Note: `TOGGLE_SCHEDULED_RULE` handler in background both saves to storage and manages the alarm.

### `ScheduledCloseRuleEditor` Component

Unique fields compared to other editors:
- **Name** — `<input type="text">`, required
- **Time** — `<input type="time">` (renders native time picker, outputs `"HH:MM"`)
- **Days** — Preset buttons + individual day toggles:
  ```tsx
  const DAY_LABELS: Record<DayOfWeek, string> = {
    mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
  };
  const WEEKDAYS: DayOfWeek[] = ['mon','tue','wed','thu','fri'];
  const WEEKENDS: DayOfWeek[] = ['sat','sun'];
  const ALL_DAYS: DayOfWeek[] = ['mon','tue','wed','thu','fri','sat','sun'];
  ```
- **URL Pattern** — Optional; same `PatternInput` component used by `AutoCloseRuleEditor`
- **Enabled** checkbox — defaults to `true`

Validation requirements:
- `name` non-empty
- `time` non-empty and valid HH:MM
- `days.length >= 1`
- If `pattern` is non-null and non-empty, `patternType` must be set (and vice versa)

### Options Page Tab Order

Current `Tab` union in `App.tsx`: `'grouping' | 'autoclose' | 'whitelist' | 'archive' | 'settings'`

New: `'grouping' | 'autoclose' | 'whitelist' | 'archive' | 'scheduled' | 'settings'`

Insert "Scheduled Close" button between "Archive" and "Settings" nav tabs.

### `alarms` Permission

Already declared in `src/manifest.json` — verified from architecture. No manifest changes needed.

### Testing `ScheduledCloseManager` — Mock Chrome Alarms

```typescript
global.chrome = {
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
    clearAll: vi.fn(),
  },
  tabs: {
    query: vi.fn(),
    remove: vi.fn(),
  },
  storage: { /* ... */ },
} as any;
```

For deterministic time testing, mock `Date`:
```typescript
vi.useFakeTimers();
vi.setSystemTime(new Date('2026-02-27T08:30:00')); // Friday
```

Test `calculateNextFireTime` edge cases:
- Today is Friday, rule is `days: ['fri']`, time is `09:00` → should return same day at 09:00
- Today is Friday, rule is `days: ['fri']`, time is `08:00` (already passed) → should return next Friday at 08:00
- Rule is `days: ['sat']`, today is Friday → should return tomorrow (Saturday)
- Rule is `days: ['mon']`, today is Friday → should return next Monday

### Previous Story Intelligence (3.5)

From Story 3.5:
- `ArchiveManager` constructor: `constructor(private storage: StorageService)` — same signature, pass same instance from `background/index.ts`
- Archive failure must NEVER prevent tab closure — wrap `archiveTab` in try/catch in Phase 3 (already shown in protocol above)
- `ClosedTabEntry.closedBy` should be `'auto'` for scheduled closes (same as `AutoCloseScheduler`)
- Test for `ArchiveManager` uses `vi.spyOn(Date.prototype, 'toISOString')` for deterministic dates
- `bookmarks` permission already in manifest

### Git Intelligence (Recent Commits)

- `feat(3.5)`: bookmark auto-closed tabs — establishes `ArchiveManager`, updated `AutoCloseScheduler` constructor with `archiveManager` param, archive tab added to options
- `feat(3.3,3.4)`: auto close implementation — established `AutoCloseScheduler` and whitelist patterns; **this story follows the same architectural patterns**
- `feat(6.5)`: preserve groups when sorting — not relevant to this story

### Key Anti-Patterns to Avoid

1. **DO NOT** create a single polling alarm (e.g., every 1 minute) shared across all rules — use dedicated per-rule alarms with exact `when` times for precision and efficiency
2. **DO NOT** re-register the next alarm inside `calculateNextFireTime` — `runScheduledClose` handles re-registration; `calculateNextFireTime` is pure
3. **DO NOT** skip the undo-durability protocol (Phase 2 must persist before Phase 3 removes)
4. **DO NOT** close tabs if the rule's `enabled` flag is false at fire time (re-check from storage in `runScheduledClose`)
5. **DO NOT** add `alarms` to manifest — it's already there
6. **DO NOT** store alarm state in memory — service workers are ephemeral; `chrome.alarms` persists independently

### Project Structure Notes

- New module follows the established pattern: `src/background/modules/scheduled-close-manager.ts`
- New hook: `src/options/hooks/useScheduledCloseRules.ts`
- New components: `src/options/components/ScheduledCloseRuleEditor.tsx`, `src/options/components/ScheduledCloseRuleList.tsx`
- Tests: `tests/unit/scheduled-close-manager.test.ts`, `tests/unit/use-scheduled-close-rules.test.ts`, `tests/unit/scheduled-close-rule-editor.test.tsx`, `tests/unit/scheduled-close-rule-list.test.tsx`
- No new folders needed

### References

- User stories: [_bmad-output/planning-artifacts/user-stories.md](_bmad-output/planning-artifacts/user-stories.md) — Story 3.7
- Architecture: [_bmad-output/planning-artifacts/architecture.md](_bmad-output/planning-artifacts/architecture.md) — AutoCloseScheduler module, `chrome.alarms` API usage
- Previous story (3.5): [_bmad-output/implementation-artifacts/3-5-archive-tabs-to-bookmarks-before-auto-close.md](_bmad-output/implementation-artifacts/3-5-archive-tabs-to-bookmarks-before-auto-close.md) — `ArchiveManager` usage, two-phase close protocol
- Rule types: [src/shared/types/rules.ts](src/shared/types/rules.ts) — add `DayOfWeek`, `ScheduledCloseRule`
- Storage types: [src/shared/types/storage.ts](src/shared/types/storage.ts) — add `scheduledCloseRules` to `SyncStorage`
- Constants: [src/shared/constants.ts](src/shared/constants.ts) — add `STORAGE_KEYS.sync.SCHEDULED_CLOSE_RULES`, `ALARM_SCHEDULED_CLOSE_PREFIX`
- Storage service: [src/background/modules/storage-service.ts](src/background/modules/storage-service.ts) — add `getScheduledCloseRules()`, `saveScheduledCloseRules()`
- AutoCloseScheduler: [src/background/modules/auto-close-scheduler.ts](src/background/modules/auto-close-scheduler.ts) — **reference** for two-phase close protocol
- ArchiveManager: [src/background/modules/archive-manager.ts](src/background/modules/archive-manager.ts) — **use** for archiving tabs before close
- Background index: [src/background/index.ts](src/background/index.ts) — **modify** (instantiate, alarm registration, alarm handler, message handler)
- Messaging: [src/shared/messaging.ts](src/shared/messaging.ts) — **modify** (add `TOGGLE_SCHEDULED_RULE`)
- Reference hook: [src/options/hooks/useAutoCloseRules.ts](src/options/hooks/useAutoCloseRules.ts) — copy & adapt for scheduled rules
- Reference editor: [src/options/components/AutoCloseRuleEditor.tsx](src/options/components/AutoCloseRuleEditor.tsx) — copy & adapt
- Reference list: [src/options/components/AutoCloseRuleList.tsx](src/options/components/AutoCloseRuleList.tsx) — copy & adapt
- Options App: [src/options/App.tsx](src/options/App.tsx) — **modify** (add 'scheduled' to Tab union, add nav tab, add `ScheduledCloseRulesTab`)
- Pattern matcher: [src/shared/utils/pattern-matcher.ts](src/shared/utils/pattern-matcher.ts)
- id-utils: [src/shared/utils/id-utils.ts](src/shared/utils/id-utils.ts) — `generateId()` for `ClosedTabEntry.id`

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
