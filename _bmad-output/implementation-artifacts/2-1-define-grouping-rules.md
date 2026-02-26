# Story 2.1: Define Grouping Rules

**Status:** Done  
**Epic:** 2 - Auto-Group Tabs  
**Created:** 2025-12-16
**Completed:** 2026-01-15

---

## Story

**As a** user who wants organized tabs  
**I want to** define URL pattern → group name rules  
**So that** my tabs are automatically categorized

---

## Acceptance Criteria

1. **AC1: Rule Management UI**
   - Options page provides rule management UI in the "Grouping Rules" tab
   - UI shows list of existing rules with edit/delete options
   - Clear visual hierarchy and intuitive interaction

2. **AC2: Rule Structure**
   - Each rule has: URL pattern, pattern type, group name, group color
   - Pattern type selector: "glob" (default) or "regex"
   - Group color picker using Chrome's 9 tab group colors
   - All fields are required for a valid rule

3. **AC3: Rule Operations (CRUD)**
   - Rules can be added via "Add Rule" button + modal/form
   - Rules can be edited inline or via edit modal
   - Rules can be deleted with confirmation
   - Rules can be reordered (drag-and-drop or up/down buttons)
   - Order determines priority (lower index = higher priority)

4. **AC4: Pattern Validation**
   - Rules are validated on save
   - Invalid patterns show inline error messages
   - Regex patterns validated for syntax errors
   - Empty patterns rejected with clear message

5. **AC5: Persistence**
   - Rules persisted in `chrome.storage.sync` (Options page reads storage directly per architecture)
   - Changes sync across devices automatically
   - Rules survive browser restart

---

## Tasks / Subtasks

- [x] **Task 1: Create useGroupingRules Hook** (AC: 1, 3, 5)
  - [x] Create `src/options/hooks/useGroupingRules.ts`
  - [x] Implement hook that loads rules via `chrome.storage.sync`
  - [x] Return `{ rules, loading, addRule, updateRule, deleteRule, reorderRules }`
  - [x] Listen for storage changes to sync if rules updated elsewhere
  - [x] Merge with defaults on read (empty array if no rules)

- [x] **Task 2: Create RuleEditor Component** (AC: 2, 4)
  - [x] Create `src/options/components/RuleEditor.tsx`
  - [x] Implement modal/form for add/edit rule
  - [x] Include: PatternInput, PatternTypeToggle, GroupNameInput, ColorPicker
  - [x] Use `validatePattern()` from `pattern-matcher.ts` on save
  - [x] Show inline validation errors for invalid patterns

- [x] **Task 3: Create GroupingRuleList Component** (AC: 1, 3)
  - [x] Create `src/options/components/GroupingRuleList.tsx`
  - [x] Display rules as cards/rows with pattern, type, group name, color badge
  - [x] Add edit/delete buttons per rule
  - [x] Implement reorder via up/down buttons (drag-and-drop optional enhancement)
  - [x] Show empty state when no rules exist

- [x] **Task 4: Create ColorPicker Component** (AC: 2)
  - [x] Create `src/options/components/ColorPicker.tsx`
  - [x] Display all 9 Chrome tab group colors as clickable swatches
  - [x] Use `TAB_GROUP_COLORS` constant from `constants.ts`
  - [x] Show selected color with visual indicator

- [x] **Task 5: Wire Up GroupingRulesTab** (AC: 1, 3, 5)
  - [x] Update `GroupingRulesTab()` in `src/options/App.tsx`
  - [x] Use `useGroupingRules` hook
  - [x] Render `GroupingRuleList` component
  - [x] Wire up "Add Rule" button to open `RuleEditor`
  - [x] Show loading state while rules are fetched

- [x] **Task 6: Unit Tests** (AC: 1-5)
  - [x] Create `tests/unit/use-grouping-rules.test.ts`
  - [x] Test CRUD operations
  - [x] Test persistence to storage
  - [x] Test reorder functionality
  - [x] Test validation integration

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] Resolve AC5 mismatch: story says "via `StorageService`" but hook uses `chrome.storage.sync` directly (either update AC5 wording or route writes through StorageService) → Updated AC5 wording; direct access is correct per architecture
- [x] [AI-Review][HIGH] Add rollback/error handling for failed saves (avoid leaving UI state diverged from storage on `chrome.storage.sync.set` failure) → Added try/catch with rollback in all CRUD operations
- [x] [AI-Review][HIGH] Prevent lost updates: avoid closure-based writes of stale `rules` when multiple contexts update concurrently (prefer read-latest-then-write like settings) → Implemented read-latest-then-write pattern with `getLatestRulesFromStorage()`

- [x] [AI-Review][MED] Normalize/sort by `order` on initial load (today load path trusts stored array order; `order` can drift if corrupted/migrated) → Added `normalizeRules()` function that sorts by order and recalculates indices
- [x] [AI-Review][MED] Remove duplicate `COLOR_VALUES` maps and tighten typing in list (`Record<TabGroupColor, string>`), ideally via shared constant or reuse from ColorPicker → Added `TAB_GROUP_COLOR_VALUES` to constants.ts, used in both components

- [x] [AI-Review][LOW] Avoid `confirm()` for delete if you want consistent UI styling/accessibility; consider in-app confirmation pattern → Replaced with in-app modal dialog in GroupingRuleList
- [x] [AI-Review][LOW] Validate regex usage guidance: examples in story include `/^.../`-style strings, but engine expects raw JS regex source (no leading/trailing `/`) → Corrected example in Dev Notes section
- [x] [AI-Review][LOW] Update Dev Agent Record "File List" to include non-code changes & dependency updates → Updated File List with all modified files

### Re-Review Follow-ups (AI) (Post-Fix)

- [x] [AI-Review][HIGH] Fix reorder correctness under concurrent updates: `reorderRules(fromIndex,toIndex)` re-applies indices to the latest storage array, which can move the wrong rule if storage changed since the UI snapshot. Prefer ID-based reorder (derive moved rule `id` from current UI state, then apply reorder by `id` against latest storage). → Implemented ID-based reorder using rule ID from UI state
- [x] [AI-Review][MED] Make rollback robust to secondary failures: current catch-path rollback `await getLatestRulesFromStorage()` can itself throw, leaving UI diverged and masking the original error. Consider preserving original error, and fallback to last-known-good state if re-read fails. → Added nested try-catch in rollback with previousState fallback and original error preservation
- [x] [AI-Review][LOW/MED] Stabilize `normalizeRules` ordering when `order` is missing/duplicated: today it sorts only by `order` (Infinity fallback) which can lead to non-deterministic reshuffles on ties. Add a stable tie-breaker (e.g., `id`) before reindexing. → Added ID-based tie-breaker using `localeCompare`
- [x] [AI-Review][LOW] Improve delete modal accessibility: add `role="dialog"`, `aria-modal="true"`, keyboard Escape to close, and basic focus handling (at minimum focus first button on open). → Added ARIA attributes, Escape handler, and auto-focus on cancel button
- [x] [AI-Review][LOW] Align modal button hover styling with design tokens: `.btn-danger:hover` uses hard-coded color values. Prefer existing CSS variables / tokens instead of new hex values. → Changed to use `color-mix()` with `var(--color-error)`
- [x] [AI-Review][LOW] Add unit tests for the above: (a) reorder by ID vs index to prevent moving wrong rule after external storage update; (b) rollback behavior when storage re-read fails; (c) normalizeRules stability/tie-breaker. → Added 7 new unit tests covering all scenarios (23 tests total)

---

## Dev Notes

### Architecture Compliance

Per `docs/technical/architecture.md`:

- **Storage as Source of Truth**: Rules stored in `chrome.storage.sync`
- **Sync Storage for Rules**: User rules sync across devices
- **Options Page Reads Storage Directly**: No need to message background worker for CRUD
- **UI Framework**: Preact (via `preact/hooks`, NOT React)
- **Pattern Engine**: Unified glob/regex matching via `pattern-matcher.ts`

### Key Files to Touch

| File | Action |
|------|--------|
| `src/options/hooks/useGroupingRules.ts` | **CREATE** - Rules hook |
| `src/options/components/RuleEditor.tsx` | **CREATE** - Add/edit modal |
| `src/options/components/GroupingRuleList.tsx` | **CREATE** - Rules list |
| `src/options/components/ColorPicker.tsx` | **CREATE** - Color selection |
| `src/options/App.tsx` | **MODIFY** - Wire up GroupingRulesTab |
| `src/options/styles/options.css` | **MODIFY** - Add rule editor styles |
| `tests/unit/use-grouping-rules.test.ts` | **CREATE** - Unit tests |

### Existing Code to Reuse

1. **GroupingRule Type** - Already defined in `src/shared/types/rules.ts`:

```typescript
interface GroupingRule extends BaseRule {
  id: string;
  pattern: string;
  patternType: PatternType;  // 'glob' | 'regex'
  groupName: string;
  groupColor: TabGroupColor;
  enabled: boolean;
  order: number;  // Lower = higher priority
}
```

2. **StorageService Methods** - Already implemented in `src/background/modules/storage-service.ts`:

```typescript
// These methods already exist - use them!
storageService.getGroupingRules(): Promise<GroupingRule[]>
storageService.saveGroupingRules(rules: GroupingRule[]): Promise<void>
```

3. **Pattern Validation** - Already in `src/shared/utils/pattern-matcher.ts`:

```typescript
import { validatePattern } from '@shared/utils/pattern-matcher';

const { valid, error } = validatePattern(pattern, 'glob');
if (!valid) {
  setError(error);
}
```

4. **Constants** - Already in `src/shared/constants.ts`:

```typescript
import { TAB_GROUP_COLORS, STORAGE_KEYS } from '@shared/constants';
// TAB_GROUP_COLORS = [{ value: 'grey', label: 'Grey' }, ...]
```

5. **UUID Generation** - Already in `src/shared/utils/id-utils.ts`:

```typescript
import { generateId } from '@shared/utils/id-utils';
const newRule: GroupingRule = { id: generateId(), ... };
```

6. **useSettings Hook Pattern** - Reference implementation in `src/options/hooks/useSettings.ts`:
   - Follow same pattern for storage listener setup/cleanup
   - Same error handling and loading state patterns

### Implementation Patterns

#### Hook Pattern (follow useSettings.ts)

```typescript
// src/options/hooks/useGroupingRules.ts
import { useState, useEffect, useCallback } from 'preact/hooks';
import type { GroupingRule } from '@shared/types';
import { STORAGE_KEYS } from '@shared/constants';
import { generateId } from '@shared/utils/id-utils';

export function useGroupingRules() {
  const [rules, setRules] = useState<GroupingRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load rules on mount
    chrome.storage.sync.get(STORAGE_KEYS.sync.GROUPING_RULES)
      .then((result) => {
        setRules(result[STORAGE_KEYS.sync.GROUPING_RULES] ?? []);
        setLoading(false);
      })
      .catch((error) => {
        console.error('[useGroupingRules] Failed to load rules:', error);
        setRules([]);
        setLoading(false);
      });

    // Listen for external changes
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'sync' && changes[STORAGE_KEYS.sync.GROUPING_RULES]) {
        setRules(changes[STORAGE_KEYS.sync.GROUPING_RULES].newValue ?? []);
      }
    };
    chrome.storage.onChanged.addListener(listener);

    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const saveRules = useCallback(async (newRules: GroupingRule[]) => {
    await chrome.storage.sync.set({
      [STORAGE_KEYS.sync.GROUPING_RULES]: newRules,
    });
    setRules(newRules);  // Optimistic update
  }, []);

  const addRule = useCallback(async (
    rule: Omit<GroupingRule, 'id' | 'order' | 'enabled'>
  ) => {
    const newRule: GroupingRule = {
      ...rule,
      id: generateId(),
      order: rules.length,
      enabled: true,
    };
    await saveRules([...rules, newRule]);
  }, [rules, saveRules]);

  const updateRule = useCallback(async (
    id: string,
    updates: Partial<GroupingRule>
  ) => {
    const updated = rules.map(r => r.id === id ? { ...r, ...updates } : r);
    await saveRules(updated);
  }, [rules, saveRules]);

  const deleteRule = useCallback(async (id: string) => {
    const filtered = rules.filter(r => r.id !== id);
    // Recalculate order indices
    const reordered = filtered.map((r, i) => ({ ...r, order: i }));
    await saveRules(reordered);
  }, [rules, saveRules]);

  const reorderRules = useCallback(async (fromIndex: number, toIndex: number) => {
    const newRules = [...rules];
    const [moved] = newRules.splice(fromIndex, 1);
    newRules.splice(toIndex, 0, moved);
    // Update order property
    const reordered = newRules.map((r, i) => ({ ...r, order: i }));
    await saveRules(reordered);
  }, [rules, saveRules]);

  return { rules, loading, addRule, updateRule, deleteRule, reorderRules };
}
```

#### RuleEditor Component Pattern

```typescript
// src/options/components/RuleEditor.tsx
import { useState } from 'preact/hooks';
import type { GroupingRule, PatternType, TabGroupColor } from '@shared/types';
import { validatePattern } from '@shared/utils/pattern-matcher';
import { TAB_GROUP_COLORS } from '@shared/constants';

interface Props {
  rule?: GroupingRule;  // Undefined = add mode, defined = edit mode
  onSave: (rule: Omit<GroupingRule, 'id' | 'order' | 'enabled'>) => void;
  onCancel: () => void;
}

export function RuleEditor({ rule, onSave, onCancel }: Props) {
  const [pattern, setPattern] = useState(rule?.pattern ?? '');
  const [patternType, setPatternType] = useState<PatternType>(rule?.patternType ?? 'glob');
  const [groupName, setGroupName] = useState(rule?.groupName ?? '');
  const [groupColor, setGroupColor] = useState<TabGroupColor>(rule?.groupColor ?? 'blue');
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    // Validate pattern
    const validation = validatePattern(pattern, patternType);
    if (!validation.valid) {
      setError(validation.error ?? 'Invalid pattern');
      return;
    }

    // Validate group name
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }

    onSave({ pattern, patternType, groupName: groupName.trim(), groupColor });
  };

  return (
    <div class="rule-editor-modal">
      {/* Pattern input with type toggle */}
      {/* Group name input */}
      {/* Color picker */}
      {/* Error display */}
      {/* Save/Cancel buttons */}
    </div>
  );
}
```

### Testing Requirements

Per architecture standards:
- Unit tests in `tests/unit/use-grouping-rules.test.ts`
- Mock `chrome.storage.sync` API
- Test cases:
  - Hook returns empty array when storage empty
  - Hook returns stored rules when available
  - addRule creates rule with UUID and order
  - updateRule modifies existing rule
  - deleteRule removes rule and recalculates order
  - reorderRules updates order property correctly
  - Storage change listener updates local state
  - Invalid patterns are rejected on save

### Edge Cases to Handle

1. **Empty Rules State**: Show helpful empty state with "Add your first rule" CTA
2. **Storage Quota**: `chrome.storage.sync` has ~100KB limit - rules should be fine but consider large regex patterns
3. **Concurrent Edits**: Storage change listener handles external updates (popup toggles, other devices)
4. **Invalid Patterns on Load**: Existing rules with invalid patterns should still display (log warning, allow edit)
5. **Color Migration**: If Chrome adds new colors, handle gracefully with fallback to 'blue'
6. **Rule Order Corruption**: If `order` property is missing, sort by array index and normalize

### Previous Story Learnings

From Stories 1-1 and 1-2:

1. **useSettings Hook Pattern**: Established pattern for storage hooks:
   - Load on mount with Promise API
   - Optimistic local state updates
   - Storage change listener for external sync
   - Error handling with console logging
   - Return loading state for UI

2. **Chrome Storage API**:
   - Use Promise API (not callbacks) for consistency
   - Check `areaName === 'sync'` in change listener
   - Merge with defaults to handle partial objects

3. **Component Structure**:
   - Use Preact (`preact/hooks`), NOT React
   - CSS in `src/options/styles/options.css`
   - Import aliases: `@shared/` → `src/shared/`

4. **Testing Setup**:
   - Vitest with jsdom environment
   - Mock `chrome.storage.sync` as global
   - `@testing-library/preact` for hook testing

### Project Structure Notes

- Components go in `src/options/components/`
- Hooks go in `src/options/hooks/`
- Shared types in `src/shared/types/`
- Import alias: `@shared/` maps to `src/shared/`
- Follow existing naming: `useXxx.ts` for hooks, `XxxComponent.tsx` for components

### UI/UX Requirements

- **Rule List**: Show rules in a card/table format
  - Pattern (truncate if long, show full on hover)
  - Pattern type badge (glob/regex)
  - Group name
  - Color swatch
  - Edit/Delete buttons
  - Drag handle or up/down arrows for reorder

- **Add/Edit Modal**:
  - Clear title: "Add Grouping Rule" / "Edit Grouping Rule"
  - Pattern input with placeholder: `*.github.com/*`
  - Pattern type toggle (glob selected by default)
  - Group name input with placeholder: `GitHub`
  - Color picker showing all 9 colors as clickable circles
  - Error message area (red text)
  - Cancel / Save buttons

- **Empty State**:
  - Icon or illustration
  - "No grouping rules yet"
  - "Add your first rule to automatically organize tabs"
  - Prominent "Add Rule" button

### Example Rules (for user guidance)

```json
{
  "pattern": "*.github.com/*",
  "patternType": "glob",
  "groupName": "GitHub",
  "groupColor": "blue"
}
```

```json
{
  "pattern": "^https://docs\\..+",
  "patternType": "regex",
  "groupName": "Documentation",
  "groupColor": "green"
}
```

> **Note on regex patterns**: Regex patterns should be entered as raw JavaScript regex source strings (e.g., `^https://docs\\.` NOT `/^https:\/\/docs\./`). The engine uses `new RegExp(pattern)` internally, so no leading/trailing slashes are needed.
```

---

## References

- [Source: docs/user-stories.md#Story 2.1]
- [Source: docs/technical/architecture.md#GroupingRule]
- [Source: docs/technical/architecture.md#Data Models - SyncStorage]
- [Source: docs/technical/architecture.md#Pattern Matching Library]
- [Source: src/shared/types/rules.ts#GroupingRule]
- [Source: src/shared/utils/pattern-matcher.ts]
- [Source: src/options/hooks/useSettings.ts]

---

## Dev Agent Record

### Context Reference

Story prepared by SM agent using BMAD create-story workflow (YOLO mode).

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

- ✅ Implemented `useGroupingRules` hook with full CRUD operations, storage sync, and external change listener
- ✅ Created `RuleEditor` modal component with pattern validation, pattern type toggle, group name input, and color picker
- ✅ Created `GroupingRuleList` component with rule cards, edit/delete buttons, and reorder functionality (up/down)
- ✅ Created `ColorPicker` component displaying all 9 Chrome tab group colors as clickable swatches
- ✅ Wired up `GroupingRulesTab` in App.tsx with loading state, add/edit flows, and all CRUD operations
- ✅ Added comprehensive CSS styles for rule editor modal, color picker, rule list, and empty/loading states
- ✅ Created 16 unit tests covering hook initialization, CRUD operations, persistence, reorder, storage listener, and error handling
- ✅ All 47 tests pass, build successful
- ✅ **[Review Follow-up]** Added read-latest-then-write pattern to prevent lost updates
- ✅ **[Review Follow-up]** Added rollback/error handling for failed saves in all CRUD operations
- ✅ **[Review Follow-up]** Added `normalizeRules()` to sort by order and fix corrupted indices on load
- ✅ **[Review Follow-up]** Extracted `TAB_GROUP_COLOR_VALUES` to shared constants, removed duplication
- ✅ **[Review Follow-up]** Replaced browser `confirm()` with in-app modal dialog for delete confirmation
- ✅ **[Review Follow-up]** Corrected regex pattern example and added usage guidance note
- ✅ **[Re-Review Follow-up]** Implemented ID-based reorder to handle concurrent storage updates correctly
- ✅ **[Re-Review Follow-up]** Enhanced rollback error handling with previousState fallback and original error preservation
- ✅ **[Re-Review Follow-up]** Added stable ID-based tie-breaker to `normalizeRules()` for deterministic ordering
- ✅ **[Re-Review Follow-up]** Added full ARIA accessibility to delete modal with keyboard support and focus management
- ✅ **[Re-Review Follow-up]** Replaced hardcoded hover color with `color-mix()` and CSS variable
- ✅ **[Re-Review Follow-up]** Added 7 new unit tests (23 total for hook), all 54 tests pass

### File List

- `src/options/hooks/useGroupingRules.ts` - **CREATED** - Hook for managing grouping rules with ID-based reorder, robust rollback, and stable normalization
- `src/options/components/RuleEditor.tsx` - **CREATED** - Add/edit rule modal
- `src/options/components/GroupingRuleList.tsx` - **CREATED** - Rules list with reorder + accessible delete modal
- `src/options/components/ColorPicker.tsx` - **CREATED** - Color selection component
- `src/options/App.tsx` - **MODIFIED** - Wired up GroupingRulesTab with hook and components
- `src/options/styles/options.css` - **MODIFIED** - Added styles for rule editor, color picker, rule list, modal overlay with CSS variables
- `src/shared/constants.ts` - **MODIFIED** - Added `TAB_GROUP_COLOR_VALUES` shared constant
- `tests/unit/use-grouping-rules.test.ts` - **CREATED** - 23 comprehensive unit tests for useGroupingRules hook
- `docs/sprint-artifacts/2-1-define-grouping-rules.md` - **MODIFIED** - Updated AC5 wording, added regex guidance, marked all review follow-ups complete



