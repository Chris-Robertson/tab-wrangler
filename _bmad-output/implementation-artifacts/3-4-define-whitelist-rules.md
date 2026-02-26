# Story 3.4: Define Whitelist Rules

Status: done

## Story

As a user who wants to protect important tabs,
I want to whitelist certain URL patterns from auto-close,
so that they're never automatically closed.

## Acceptance Criteria

1. **AC1: Options page has a "Whitelist" tab/section** — A dedicated "Whitelist" section is added to the options page. It is clearly labeled and visually distinct. An empty state shows a helpful message when no rules exist.
2. **AC2: Rule list display** — All whitelist rules are displayed in a list. Each rule shows: URL pattern, pattern type badge (glob/regex), enabled status toggle. Supports up/down reordering (consistent with Auto-Close Rules).
3. **AC3: Add Rule UI** — "Add Rule" button is prominently displayed. Clicking opens a rule editor form. The URL pattern input is **auto-populated** with the current active tab's URL (same UX as Story 3.1 AC3).
4. **AC4: Rule editor form fields** — Pattern text input, pattern type toggle (glob/regex, default: glob), enabled checkbox (default: checked). **No duration field** — whitelist rules protect indefinitely.
5. **AC5: Edit Rule UI** — Each rule has an Edit action. Clicking opens pre-filled editor. Changes saved on submit. Cancel discards changes.
6. **AC6: Delete Rule UI** — Each rule has a Delete action. Deletion requires confirmation showing the rule pattern. Deleted rules removed immediately from UI and storage.
7. **AC7: URL Pattern support** — Both glob and regex supported (same validation as Story 3.1). Pattern validation on save; invalid patterns show inline error.
8. **AC8: Rule persistence** — Rules stored in `chrome.storage.sync` using key `STORAGE_KEYS.sync.WHITELIST_RULES`. Syncs across browser instances. Each rule has unique UUID. Schema matches `WhitelistRule` type.
9. **AC9: Enabled/Disabled Toggle** — Each rule has an enabled/disabled toggle. Disabled rules are stored but skipped during auto-close evaluation. Visual distinction for disabled rules.
10. **AC10: Whitelist rules evaluated first in auto-close** — The `AutoCloseScheduler` (Story 3.3) already reads whitelist rules from storage; this story ensures those rules are populated via the UI. No change to scheduler logic required.

## Tasks / Subtasks

- [x] **Task 1: Create `useWhitelistRules` hook** (AC: 1, 8, 9)
  - [x] Create `src/options/hooks/useWhitelistRules.ts`
  - [x] Model exactly after `useAutoCloseRules.ts` — same structure, same optimistic update pattern, same `chrome.storage.onChanged` listener
  - [x] Replace `AUTO_CLOSE_RULES` key references with `WHITELIST_RULES`
  - [x] Input type: `NewWhitelistRuleInput = { pattern: string; patternType: PatternType; enabled?: boolean }` — **no `maxAge`**
  - [x] Methods: `addRule`, `updateRule`, `deleteRule`, `toggleEnabled`, `reorderRules`
  - [x] Normalize `enabled` to `true` if missing (same defensive pattern)

- [x] **Task 2: Create `WhitelistRuleEditor` component** (AC: 3, 4, 5, 7)
  - [x] Create `src/options/components/WhitelistRuleEditor.tsx`
  - [x] Props: `rule?: WhitelistRule`, `initialUrl?: string`, `onSave: (rule: { pattern: string; patternType: PatternType; enabled: boolean }) => void`, `onCancel: () => void`
  - [x] Form fields: pattern input + glob/regex toggle, enabled checkbox
  - [x] **No duration fields** — whitelist rules have no maxAge
  - [x] Validation: pattern cannot be empty; regex validated via `validatePattern`
  - [x] Save button disabled when `isFormValid` is false (computed with `useMemo`)
  - [x] Display inline error message when validation fails
  - [x] Initialize `pattern` from `rule?.pattern ?? initialUrl ?? ''`
  - [x] Reuse `validatePattern` from `@shared/utils/pattern-matcher`

- [x] **Task 3: Create `WhitelistRuleList` component** (AC: 2, 5, 6, 9)
  - [x] Create `src/options/components/WhitelistRuleList.tsx`
  - [x] Model after `AutoCloseRuleList.tsx` — same structure
  - [x] Props: `rules: WhitelistRule[]`, `onEdit`, `onDelete`, `onToggleEnabled`, `onReorder?`
  - [x] Each rule item shows: pattern text, pattern type badge (glob/regex), enabled toggle, Edit button, Delete button, reorder up/down buttons
  - [x] Delete confirmation dialog (set `deleteConfirmId` state, show inline confirm/cancel)
  - [x] Empty state: `"No whitelist rules defined. Add rules to protect tabs from being auto-closed."`
  - [x] Apply `disabled` CSS class to rule items when `!rule.enabled` (opacity/strikethrough visual)
  - [x] **No duration column** — whitelist rules have no maxAge to display

- [x] **Task 4: Add Whitelist tab to `App.tsx`** (AC: 1, 3, 8)
  - [x] Open `src/options/App.tsx`
  - [x] Add `'whitelist'` to the `Tab` union type: `type Tab = 'grouping' | 'autoclose' | 'whitelist' | 'settings'`
  - [x] Add "Whitelist" nav tab button between Auto-Close and Settings
  - [x] Add `{activeTab === 'whitelist' && <WhitelistRulesTab />}` to the main content area
  - [x] Implement `WhitelistRulesTab` function component following the `AutoCloseRulesTab` pattern:
    - [x] Use `useWhitelistRules()` hook
    - [x] `handleAddClick` queries active tab URL via `chrome.tabs.query` and passes as `initialUrl`
    - [x] `handleSave` calls `addRule` or `updateRule` with storage error handling
    - [x] Render `WhitelistRuleList` + `WhitelistRuleEditor` (conditional on `editorOpen`)
    - [x] Storage quota error banner (same pattern as `AutoCloseRulesTab`)
  - [x] Import `WhitelistRuleList`, `WhitelistRuleEditor`, `useWhitelistRules`, `WhitelistRule`

- [x] **Task 5: Unit Tests** (AC: 1–9)
  - [x] Create `tests/unit/whitelist-rule-editor.test.tsx`
    - [x] Pattern validation: empty pattern shows error and disables Save
    - [x] Invalid regex shows error message
    - [x] Valid glob pattern enables Save
    - [x] `initialUrl` pre-populates pattern field
    - [x] Enabled checkbox defaults to checked
    - [x] `onSave` called with correct data on valid submit
    - [x] `onCancel` called when Cancel clicked
  - [x] Create `tests/unit/whitelist-rule-list.test.tsx`
    - [x] Empty state shows when `rules = []`
    - [x] Rule displays pattern and pattern type badge
    - [x] Delete confirmation appears before deletion
    - [x] `onDelete` called after confirmation
    - [x] `onToggleEnabled` called when toggle changed
    - [x] `onEdit` called when Edit clicked
  - [x] Create `tests/unit/use-whitelist-rules.test.ts`
    - [x] Rules loaded from `chrome.storage.sync` on mount
    - [x] `addRule` optimistically updates state and persists to storage
    - [x] `deleteRule` removes rule by ID
    - [x] `toggleEnabled` flips enabled state
    - [x] `reorderRules` swaps two rules by index
    - [x] `chrome.storage.onChanged` listener updates state from external changes
    - [x] Missing `enabled` field normalized to `true`

## Dev Notes

### Architecture Context

This is a **pure UI story** — no background service worker changes required. The `AutoCloseScheduler` (Story 3.3) already loads and evaluates whitelist rules from `chrome.storage.sync`. This story simply adds the UI to populate those rules.

### `WhitelistRule` Type (already defined — do NOT redefine)

```typescript
// From src/shared/types/rules.ts
export type WhitelistRule = BaseRule;

// BaseRule:
interface BaseRule {
  id: string;
  pattern: string;
  patternType: PatternType;  // 'glob' | 'regex'
  enabled: boolean;
}
```

This is simpler than `AutoCloseRule` — no `maxAge` field. The editor and list components are correspondingly simpler (no duration input).

### `StorageService` — Already Implemented

`StorageService` already has `getWhitelistRules()` and `saveWhitelistRules()`. The hook reads/writes directly to `chrome.storage.sync` (same pattern as `useAutoCloseRules`).

Storage key: `STORAGE_KEYS.sync.WHITELIST_RULES` → `'whitelistRules'` (confirmed in `src/shared/constants.ts`).

### Hook Pattern — Follow `useAutoCloseRules.ts` Exactly

The `useWhitelistRules` hook is a near copy of `useAutoCloseRules.ts` with:
1. Key changed: `STORAGE_KEYS.sync.WHITELIST_RULES`
2. Type changed: `WhitelistRule` / `NewWhitelistRuleInput`
3. `NewWhitelistRuleInput` has no `maxAge` field
4. All other logic (optimistic updates, storage listener, `rulesRef`) is identical

```typescript
export type NewWhitelistRuleInput = {
  pattern: string;
  patternType: PatternType;
  enabled?: boolean;
};
```

### Component Pattern — Follow `AutoCloseRuleList.tsx` / `AutoCloseRuleEditor.tsx`

Key differences from Auto-Close components:

| | Auto-Close | Whitelist |
|---|---|---|
| Duration input | Yes (value + unit + presets) | **No** |
| `maxAge` field | Yes | **No** |
| Empty state text | "No auto-close rules..." | "No whitelist rules..." |
| Section description | "...after inactive duration" | "...protect from auto-close" |

Everything else (pattern input, glob/regex toggle, enabled toggle, edit/delete, reorder, delete confirmation, storage error banner) is identical.

### App.tsx Navigation Order

The tab order should be:
```
Grouping Rules | Auto-Close Rules | Whitelist | Settings
```

### No Changes Required In

- `src/shared/types/` — `WhitelistRule` already defined
- `src/shared/constants.ts` — `STORAGE_KEYS.sync.WHITELIST_RULES` already defined
- `src/background/modules/storage-service.ts` — `getWhitelistRules()` / `saveWhitelistRules()` already exist
- `src/background/modules/auto-close-scheduler.ts` — already reads whitelist rules (Story 3.3)

### Testing Setup (follow existing pattern)

UI component tests use `@testing-library/preact`:
```typescript
import { render, fireEvent } from '@testing-library/preact';
```

Hook tests mock `chrome.storage.sync`:
```typescript
const mockStorageSync = {
  get: vi.fn(),
  set: vi.fn(),
};
const mockStorageOnChanged = {
  addListener: vi.fn(),
  removeListener: vi.fn(),
};
global.chrome = {
  storage: {
    sync: mockStorageSync,
    onChanged: mockStorageOnChanged,
  },
} as any;
```

See `tests/unit/use-auto-close-rules.test.ts` for the full hook test reference pattern.

### References

- User stories: [_bmad-output/planning-artifacts/user-stories.md](_bmad-output/planning-artifacts/user-stories.md) — Story 3.4
- Architecture: [_bmad-output/planning-artifacts/architecture.md](_bmad-output/planning-artifacts/architecture.md) — `WhitelistRule` type, storage schema
- Rules types: [src/shared/types/rules.ts](src/shared/types/rules.ts) — `WhitelistRule`, `BaseRule`
- Storage constants: [src/shared/constants.ts](src/shared/constants.ts) — `STORAGE_KEYS.sync.WHITELIST_RULES`
- Pattern matcher: [src/shared/utils/pattern-matcher.ts](src/shared/utils/pattern-matcher.ts) — `validatePattern`, `matchPattern`
- ID utils: [src/shared/utils/id-utils.ts](src/shared/utils/id-utils.ts) — `generateId`
- Reference hook: [src/options/hooks/useAutoCloseRules.ts](src/options/hooks/useAutoCloseRules.ts) — copy & adapt
- Reference editor: [src/options/components/AutoCloseRuleEditor.tsx](src/options/components/AutoCloseRuleEditor.tsx) — copy & adapt (remove duration)
- Reference list: [src/options/components/AutoCloseRuleList.tsx](src/options/components/AutoCloseRuleList.tsx) — copy & adapt (remove duration display)
- Options page: [src/options/App.tsx](src/options/App.tsx) — add Whitelist tab
- AutoCloseRuleEditor tests: [tests/unit/auto-close-rule-editor.test.tsx](tests/unit/auto-close-rule-editor.test.tsx) — reference for editor test pattern
- AutoCloseRuleList tests: [tests/unit/auto-close-rule-list.test.tsx](tests/unit/auto-close-rule-list.test.tsx) — reference for list test pattern
- useAutoCloseRules tests: [tests/unit/use-auto-close-rules.test.ts](tests/unit/use-auto-close-rules.test.ts) — reference for hook test pattern
- Previous story (3.1): [_bmad-output/implementation-artifacts/3-1-define-auto-close-rules.md](_bmad-output/implementation-artifacts/3-1-define-auto-close-rules.md) — established patterns

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

### Completion Notes List

- All tasks complete. Story 3.4 is a pure UI story — no background/scheduler changes required.
- `WhitelistRule = BaseRule` (no `maxAge`); all components are simpler than their Auto-Close counterparts.
- 37 new tests added (all passing). Full suite: 258/258 passing.

### File List

- `src/options/hooks/useWhitelistRules.ts` ← **create**
- `src/options/components/WhitelistRuleEditor.tsx` ← **create**
- `src/options/components/WhitelistRuleList.tsx` ← **create**
- `src/options/App.tsx` ← **modify** (add Whitelist tab)
- `tests/unit/whitelist-rule-editor.test.tsx` ← **create**
- `tests/unit/whitelist-rule-list.test.tsx` ← **create**
- `tests/unit/use-whitelist-rules.test.ts` ← **create**
