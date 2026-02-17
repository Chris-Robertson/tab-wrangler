# Story 3.1: Define Auto-Close Rules

**Status:** ready-for-dev  
**Epic:** 3 - Auto-Close Tabs  
**Created:** 2026-02-17

---

## Story

**As a** user who accumulates stale tabs  
**I want to** define rules for auto-closing tabs by URL and age  
**So that** unimportant tabs don't linger forever

---

## Acceptance Criteria

1. **AC1: Options Page Auto-Close Section**
   - Options page has dedicated "Auto-Close Rules" section
   - Section is clearly labeled and visually distinct from other rule sections
   - Section includes descriptive text explaining auto-close functionality
   - Empty state shows helpful message when no rules exist

2. **AC2: Rule List Display**
   - All auto-close rules are displayed in a list format
   - Each rule shows: URL pattern, pattern type (glob/regex), max age (human-readable), enabled status
   - List supports scrolling if many rules exist
   - Rules are sortable/reorderable by user (drag-and-drop or up/down buttons)

3. **AC3: Add Rule UI**
   - "Add Rule" button is prominently displayed
   - Clicking opens rule editor form (inline or modal)
   - **URL Pattern is auto-populated:** When Add Rule is clicked, the URL pattern input is automatically populated with the current active tab's URL
   - Form fields:
     - **URL Pattern:** Text input with pattern type toggle (glob/regex)
     - **Pattern Type:** Toggle between "glob" (default) and "regex"
     - **Max Age:** Duration input with units (minutes/hours/days)
     - **Enabled:** Checkbox (default: checked)
   - Form validation prevents empty pattern or invalid duration
   - Regex patterns are validated for syntax errors

4. **AC4: Edit Rule UI**
   - Each rule has "Edit" action button/icon
   - Clicking opens pre-filled rule editor with current values
   - Changes are saved on form submit
   - User can cancel editing without saving

5. **AC5: Delete Rule UI**
   - Each rule has "Delete" action button/icon
   - Deletion requires confirmation (prevent accidental deletion)
   - Confirmation shows which rule is being deleted (pattern + age)
   - Deleted rules are removed immediately from UI and storage

6. **AC6: URL Pattern Support**
   - URL patterns support **BOTH** glob syntax **AND** regex
   - Pattern type selector: "glob" (default) or "regex"
   - Glob examples shown: `*.reddit.com/*`, `*stackoverflow.com*`
   - Regex examples shown: `/^https:\/\/reddit\.com\/.*/`, `/twitter\.com\/\w+/`
   - Pattern validation on save (invalid patterns show error)

7. **AC7: Duration Configuration**
   - Max age configurable in **minutes, hours, or days**
   - Duration input accepts both numeric input and unit selector
   - Presets available: 30 min, 1 hour, 2 hours, 4 hours, 8 hours, 1 day, 1 week
   - Custom durations supported (user can type any value)
   - Duration stored as **milliseconds** in storage for consistency

8. **AC8: Rule Persistence**
   - Rules are persisted in `chrome.storage.sync`
   - Rules sync across browser instances (if user signed in)
   - Storage schema matches `AutoCloseRule` type from architecture
   - Each rule has unique ID (UUID) for tracking

9. **AC9: Enabled/Disabled Toggle**
   - Each rule has enabled/disabled toggle (checkbox or switch)
   - Disabled rules are stored but not evaluated during auto-close checks
   - Visual distinction between enabled/disabled rules (opacity, strikethrough, or icon)

10. **AC10: Rule Validation**
    - URL pattern cannot be empty
    - Max age must be positive number
    - Regex patterns are validated for syntax errors
    - Invalid patterns show inline error message with guidance

---

## Tasks / Subtasks

- [ ] **Task 1: Update TypeScript Types** (AC: 8)
  - [ ] Verify `AutoCloseRule` interface exists in `src/shared/types/rules.ts`
  - [ ] Ensure all fields match AC requirements: `id`, `pattern`, `patternType`, `maxAge`, `enabled`
  - [ ] Verify `maxAge` is typed as `number` (milliseconds)

- [ ] **Task 2: Implement Storage Methods** (AC: 8)
  - [ ] Verify `getAutoCloseRules()` exists in `StorageService` (likely returns empty array currently)
  - [ ] Verify `saveAutoCloseRules()` exists in `StorageService`
  - [ ] Test methods read/write to `chrome.storage.sync` using key from `STORAGE_KEYS.sync.AUTO_CLOSE_RULES`
  - [ ] Ensure default enabled field handling (default to `true` if undefined)

- [ ] **Task 3: Create Duration Utility Functions** (AC: 7)
  - [ ] Create `src/shared/utils/duration-utils.ts` if doesn't exist
  - [ ] Implement `parseDuration(value: number, unit: 'minutes' | 'hours' | 'days'): number` → returns milliseconds
  - [ ] Implement `formatDuration(milliseconds: number): { value: number; unit: string }` → converts ms to human-readable
  - [ ] Use `DURATION_PRESETS` from `constants.ts` for dropdown options

- [ ] **Task 4: Create Auto-Close Rule Editor Component** (AC: 3, 4, 6, 7, 9, 10)
  - [ ] Create `src/options/components/AutoCloseRuleEditor.tsx`
  - [ ] Component props: `rule?: AutoCloseRule`, `initialUrl?: string`, `onSave: (rule: AutoCloseRule) => void`, `onCancel: () => void`
  - [ ] Initialize pattern state with `initialUrl` if provided (for AC3 current tab population)
  - [ ] Form fields:
    - [ ] Pattern input with validation (reuse PatternInput component if available)
    - [ ] Pattern type toggle (glob/regex)
    - [ ] Duration input with value + unit selector
    - [ ] Duration presets dropdown
    - [ ] Enabled checkbox
  - [ ] Validation logic:
    - [ ] Pattern cannot be empty
    - [ ] Regex syntax validation (try `new RegExp(pattern)`)
    - [ ] Duration must be positive number
  - [ ] Save button disabled when validation fails
  - [ ] Display inline error messages for validation failures

- [ ] **Task 5: Create Auto-Close Rule List Component** (AC: 2, 4, 5)
  - [ ] Create `src/options/components/AutoCloseRuleList.tsx`
  - [ ] Display all rules from storage
  - [ ] Each rule item shows:
    - [ ] Pattern (with pattern type badge: "glob" or "regex")
    - [ ] Max age (human-readable: "2 hours", "1 day")
    - [ ] Enabled toggle switch
    - [ ] Edit button
    - [ ] Delete button
  - [ ] Delete confirmation dialog (reuse existing modal or create simple confirm dialog)
  - [ ] Empty state: "No auto-close rules defined. Add your first rule to start."

- [ ] **Task 6: Integrate Auto-Close Section in Options Page** (AC: 1, 3)
  - [ ] Open `src/options/App.tsx` or equivalent options page component
  - [ ] Add "Auto-Close Rules" section
  - [ ] Section header with description: "Automatically close tabs matching these patterns after they've been inactive for the specified duration."
  - [ ] Add "Add Rule" button at top of section
  - [ ] When "Add Rule" clicked: Query current active tab URL using `chrome.tabs.query({ active: true, currentWindow: true })` and pass as `initialUrl` to editor
  - [ ] Render `AutoCloseRuleList` component
  - [ ] Handle Add/Edit flows (show/hide `AutoCloseRuleEditor`)
  - [ ] Wire up storage operations (save, delete, update)

- [ ] **Task 7: Add Styling** (AC: 1, 2, 9)
  - [ ] Style auto-close section to match existing options page design
  - [ ] Style rule list items with proper spacing and hover states
  - [ ] Style enabled/disabled visual distinction (opacity or strikethrough)
  - [ ] Style pattern type badge (glob = blue, regex = purple)
  - [ ] Style duration display (consistent font/color)
  - [ ] Style validation error messages (red text, icon)

- [ ] **Task 8: Unit Tests** (AC: 3-10)
  - [ ] Create `tests/unit/auto-close-rule-editor.test.tsx`
  - [ ] Test: Pattern validation (empty, invalid regex)
  - [ ] Test: Duration parsing (minutes/hours/days → milliseconds)
  - [ ] Test: Duration formatting (milliseconds → human-readable)
  - [ ] Test: Save button disabled when validation fails
  - [ ] Test: Enabled toggle updates rule state
  - [ ] Create `tests/unit/auto-close-rule-list.test.tsx`
  - [ ] Test: Empty state displays when no rules
  - [ ] Test: Rules display with correct pattern and duration
  - [ ] Test: Delete confirmation shows before deletion
  - [ ] Test: Edit opens editor with pre-filled values

- [ ] **Task 9: Integration Testing** (AC: 1-10)
  - [ ] Manual test: Add glob rule (`*.reddit.com/*`, 2 hours)
  - [ ] Manual test: Add regex rule (`/^https:\/\/twitter\.com\/.*/`, 1 hour)
  - [ ] Manual test: Edit existing rule (change duration)
  - [ ] Manual test: Delete rule with confirmation
  - [ ] Manual test: Toggle enabled/disabled
  - [ ] Manual test: Invalid regex shows error
  - [ ] Manual test: Rules persist after browser restart
  - [ ] Verify storage schema matches `AutoCloseRule` type

---

## Dev Notes

### Project Context Reference

This story is the **first story in Epic 3: Auto-Close Tabs**. It lays the foundation for the entire auto-close feature by implementing rule management UI. Future stories will build on this:

- **Story 3.2 (Track Tab Activity)**: Will use these rules to identify tabs to track
- **Story 3.3 (Auto-Close Stale Tabs)**: Will execute these rules to close tabs
- **Story 3.4 (Whitelist Rules)**: Will add exception rules (similar UI pattern)
- **Story 3.5 (Archive Before Close)**: Will reference these rules for archiving logic

**Critical Dependencies:**
- Storage infrastructure MUST be in place (`StorageService`)
- TypeScript types MUST be defined (`AutoCloseRule` interface)
- Options page MUST exist with basic layout
- Pattern matching utilities likely exist from Epic 2 (grouping rules)

**Pattern Reuse Opportunities:**
- **Story 2.1 (Define Grouping Rules)**: This story created the rule management UI pattern
- Reuse `PatternInput` component if it exists
- Reuse pattern validation logic
- Reuse rule list UI design and interactions
- Follow same storage patterns and TypeScript types

### Architecture Compliance

Per [docs/technical/architecture.md](../technical/architecture.md):

**Module Architecture:**

```
┌────────────────────────────────────────────────────────────┐
│                    OPTIONS PAGE (UI)                       │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │        Auto-Close Rules Section                       │ │
│  │                                                       │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │  AutoCloseRuleList                              │ │ │
│  │  │                                                 │ │ │
│  │  │  ┌──────────────────────────────────────┐      │ │ │
│  │  │  │ Rule: *.reddit.com/* | 2 hours  [✓] │      │ │ │
│  │  │  │ [Edit] [Delete]                      │      │ │ │
│  │  │  └──────────────────────────────────────┘      │ │ │
│  │  │                                                 │ │ │
│  │  │  [+ Add Rule]                                   │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  │                                                       │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │  AutoCloseRuleEditor (modal/inline)             │ │ │
│  │  │                                                 │ │ │
│  │  │  Pattern: [____________] [glob ▼]               │ │ │
│  │  │  Max Age: [2] [hours ▼]   Presets: [1 hour ▼]  │ │ │
│  │  │  Enabled: [✓]                                   │ │ │
│  │  │                                                 │ │ │
│  │  │  [Cancel] [Save]                                │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│                    STORAGE LAYER                           │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │        StorageService                                 │ │
│  │                                                       │ │
│  │  getAutoCloseRules(): Promise<AutoCloseRule[]>       │ │
│  │  saveAutoCloseRules(rules: AutoCloseRule[]): Promise │ │
│  │                                                       │ │
│  │  Uses: chrome.storage.sync                           │ │
│  │  Key: STORAGE_KEYS.sync.AUTO_CLOSE_RULES             │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Core Principles Applied:**
1. **Storage as Source of Truth** - Rules persisted in `chrome.storage.sync`
2. **Reactive UI** - Options page loads/saves rules, doesn't manage state
3. **Pattern Engine** - Reuse glob/regex pattern types from Epic 2
4. **Non-Destructive** - Delete requires confirmation

**Storage Schema Usage:**

Per [architecture.md#Data Models](../technical/architecture.md#data-models):

```typescript
interface AutoCloseRule {
  id: string;                    // UUID
  pattern: string;               // URL pattern
  patternType: 'glob' | 'regex'; // Pattern syntax
  maxAge: number;                // Duration in milliseconds
  enabled: boolean;
}

// Example stored rules
{
  "autoCloseRules": [
    {
      "id": "rule-123e4567-e89b-12d3-a456-426614174000",
      "pattern": "*.reddit.com/*",
      "patternType": "glob",
      "maxAge": 7200000, // 2 hours in milliseconds
      "enabled": true
    },
    {
      "id": "rule-223e4567-e89b-12d3-a456-426614174001",
      "pattern": "/^https:\\/\\/twitter\\.com\\/.*/",
      "patternType": "regex",
      "maxAge": 3600000, // 1 hour in milliseconds
      "enabled": true
    }
  ]
}
```

**Chrome APIs Required:**

| API | Purpose | Method |
|-----|---------|--------|
| `chrome.storage.sync` | Persist auto-close rules | `chrome.storage.sync.get()`, `chrome.storage.sync.set()` |

**Storage Events:**

```typescript
// Listen for storage changes to update UI reactively
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.autoCloseRules) {
    // Reload rules in UI
  }
});
```

### Technical Requirements

**Language & Framework:**
- TypeScript with strict mode
- Preact for options page UI components
- Reuse existing `StorageService` from `src/background/modules/storage-service.ts`
- Follow existing component patterns from Epic 2 (if available)

**Duration Utilities:**

```typescript
// src/shared/utils/duration-utils.ts

export type DurationUnit = 'minutes' | 'hours' | 'days';

export interface ParsedDuration {
  value: number;
  unit: DurationUnit;
}

/**
 * Parse duration from value and unit to milliseconds
 */
export function parseDuration(value: number, unit: DurationUnit): number {
  switch (unit) {
    case 'minutes':
      return value * 60 * 1000;
    case 'hours':
      return value * 60 * 60 * 1000;
    case 'days':
      return value * 24 * 60 * 60 * 1000;
  }
}

/**
 * Format milliseconds to human-readable duration
 */
export function formatDuration(milliseconds: number): ParsedDuration {
  const minutes = milliseconds / (60 * 1000);
  const hours = milliseconds / (60 * 60 * 1000);
  const days = milliseconds / (24 * 60 * 60 * 1000);

  // Choose most appropriate unit
  if (days >= 1 && Number.isInteger(days)) {
    return { value: days, unit: 'days' };
  } else if (hours >= 1 && Number.isInteger(hours)) {
    return { value: hours, unit: 'hours' };
  } else {
    return { value: Math.round(minutes), unit: 'minutes' };
  }
}

/**
 * Format milliseconds to display string
 */
export function formatDurationDisplay(milliseconds: number): string {
  const { value, unit } = formatDuration(milliseconds);
  const unitLabel = value === 1 ? unit.slice(0, -1) : unit; // Remove 's' for singular
  return `${value} ${unitLabel}`;
}
```

**Pattern Validation:**

```typescript
// src/shared/utils/pattern-validator.ts

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate URL pattern based on type
 */
export function validatePattern(
  pattern: string,
  patternType: 'glob' | 'regex'
): ValidationResult {
  // Empty check
  if (!pattern || pattern.trim() === '') {
    return { valid: false, error: 'Pattern cannot be empty' };
  }

  // Regex validation
  if (patternType === 'regex') {
    try {
      new RegExp(pattern);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Invalid regex: ${(error as Error).message}`,
      };
    }
  }

  // Glob validation (basic check)
  if (patternType === 'glob') {
    // Glob patterns are generally permissive, just check for empty
    return { valid: true };
  }

  return { valid: true };
}
```

**Auto-Close Rule Editor Component:**

```typescript
// src/options/components/AutoCloseRuleEditor.tsx

import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import type { AutoCloseRule } from '@shared/types';
import { parseDuration, formatDuration } from '@shared/utils/duration-utils';
import { validatePattern } from '@shared/utils/pattern-validator';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  rule?: AutoCloseRule; // Undefined for new rule
  initialUrl?: string; // Current tab URL for AC3 auto-population
  onSave: (rule: AutoCloseRule) => void;
  onCancel: () => void;
}

export function AutoCloseRuleEditor({ rule, initialUrl, onSave, onCancel }: Props) {
  const isEditing = !!rule;

  // Form state
  const [pattern, setPattern] = useState(rule?.pattern ?? initialUrl ?? '');
  const [patternType, setPatternType] = useState<'glob' | 'regex'>(
    rule?.patternType ?? 'glob'
  );
  const [durationValue, setDurationValue] = useState(() => {
    if (rule) {
      const { value } = formatDuration(rule.maxAge);
      return value;
    }
    return 2; // Default: 2 hours
  });
  const [durationUnit, setDurationUnit] = useState<'minutes' | 'hours' | 'days'>(
    () => {
      if (rule) {
        const { unit } = formatDuration(rule.maxAge);
        return unit;
      }
      return 'hours';
    }
  );
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);

  // Validation
  const patternValidation = validatePattern(pattern, patternType);
  const durationValid = durationValue > 0;

  const canSave = patternValidation.valid && durationValid;

  const handleSave = () => {
    if (!canSave) return;

    const maxAge = parseDuration(durationValue, durationUnit);

    const savedRule: AutoCloseRule = {
      id: rule?.id ?? uuidv4(),
      pattern,
      patternType,
      maxAge,
      enabled,
    };

    onSave(savedRule);
  };

  return (
    <div class="rule-editor">
      <h3>{isEditing ? 'Edit Rule' : 'Add Rule'}</h3>

      {/* Pattern Input */}
      <div class="form-field">
        <label>URL Pattern</label>
        <div class="pattern-input-group">
          <input
            type="text"
            value={pattern}
            onInput={(e) => setPattern((e.target as HTMLInputElement).value)}
            placeholder="*.reddit.com/*"
          />
          <select
            value={patternType}
            onChange={(e) =>
              setPatternType(
                (e.target as HTMLSelectElement).value as 'glob' | 'regex'
              )
            }
          >
            <option value="glob">Glob</option>
            <option value="regex">Regex</option>
          </select>
        </div>
        {!patternValidation.valid && (
          <div class="error">{patternValidation.error}</div>
        )}
      </div>

      {/* Duration Input */}
      <div class="form-field">
        <label>Max Age (Inactive Duration)</label>
        <div class="duration-input-group">
          <input
            type="number"
            min="1"
            value={durationValue}
            onInput={(e) =>
              setDurationValue(parseFloat((e.target as HTMLInputElement).value))
            }
          />
          <select
            value={durationUnit}
            onChange={(e) =>
              setDurationUnit(
                (e.target as HTMLSelectElement).value as
                  | 'minutes'
                  | 'hours'
                  | 'days'
              )
            }
          >
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
      </div>

      {/* Enabled Toggle */}
      <div class="form-field">
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled((e.target as HTMLInputElement).checked)}
          />
          Enabled
        </label>
      </div>

      {/* Actions */}
      <div class="form-actions">
        <button onClick={onCancel}>Cancel</button>
        <button onClick={handleSave} disabled={!canSave}>
          {isEditing ? 'Save Changes' : 'Add Rule'}
        </button>
      </div>
    </div>
  );
}
```

**Auto-Close Rule List Component:**

```typescript
// src/options/components/AutoCloseRuleList.tsx

import { h } from 'preact';
import type { AutoCloseRule } from '@shared/types';
import { formatDurationDisplay } from '@shared/utils/duration-utils';

interface Props {
  rules: AutoCloseRule[];
  onEdit: (rule: AutoCloseRule) => void;
  onDelete: (ruleId: string) => void;
  onToggleEnabled: (ruleId: string, enabled: boolean) => void;
}

export function AutoCloseRuleList({
  rules,
  onEdit,
  onDelete,
  onToggleEnabled,
}: Props) {
  if (rules.length === 0) {
    return (
      <div class="empty-state">
        <p>No auto-close rules defined.</p>
        <p>Add your first rule to start automatically closing stale tabs.</p>
      </div>
    );
  }

  const handleDelete = (rule: AutoCloseRule) => {
    const confirmed = confirm(
      `Delete rule "${rule.pattern}" (${formatDurationDisplay(rule.maxAge)})?`
    );
    if (confirmed) {
      onDelete(rule.id);
    }
  };

  return (
    <div class="rule-list">
      {rules.map((rule) => (
        <div
          key={rule.id}
          class={`rule-item ${!rule.enabled ? 'disabled' : ''}`}
        >
          <div class="rule-info">
            <div class="rule-pattern">
              <span class={`pattern-badge ${rule.patternType}`}>
                {rule.patternType}
              </span>
              <code>{rule.pattern}</code>
            </div>
            <div class="rule-duration">
              {formatDurationDisplay(rule.maxAge)}
            </div>
          </div>

          <div class="rule-actions">
            <label class="toggle">
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={(e) =>
                  onToggleEnabled(rule.id, (e.target as HTMLInputElement).checked)
                }
              />
              <span>Enabled</span>
            </label>
            <button onClick={() => onEdit(rule)}>Edit</button>
            <button onClick={() => handleDelete(rule)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### File Structure Requirements

Per [architecture.md#File Structure](../technical/architecture.md#file-structure):

**Files to Create:**
```
src/shared/utils/duration-utils.ts           # Duration parsing and formatting
src/shared/utils/pattern-validator.ts        # Pattern validation (if doesn't exist)
src/options/components/AutoCloseRuleEditor.tsx  # Rule editor component
src/options/components/AutoCloseRuleList.tsx    # Rule list component
tests/unit/duration-utils.test.ts            # Duration utilities tests
tests/unit/auto-close-rule-editor.test.tsx   # Editor component tests
tests/unit/auto-close-rule-list.test.tsx     # List component tests
```

**Files to Modify:**
```
src/options/App.tsx                          # Add auto-close section
src/options/styles/options.css               # Add auto-close styles
src/shared/types/rules.ts                    # Verify AutoCloseRule type exists
src/background/modules/storage-service.ts    # Verify auto-close methods exist
```

**Import Path Conventions:**

```typescript
import type { AutoCloseRule } from '@shared/types';
import { parseDuration, formatDuration } from '@shared/utils/duration-utils';
import { validatePattern } from '@shared/utils/pattern-validator';
import { StorageService } from '@background/modules/storage-service';
import { AutoCloseRuleEditor } from './components/AutoCloseRuleEditor';
import { AutoCloseRuleList } from './components/AutoCloseRuleList';
```

### Library & Framework Requirements

**Dependencies:**

```json
{
  "dependencies": {
    "uuid": "^9.0.0"  // For generating rule IDs
  },
  "devDependencies": {
    "@types/uuid": "^9.0.0"
  }
}
```

**TypeScript Patterns:**

```typescript
// Use async/await for Chrome APIs
const rules = await chrome.storage.sync.get(STORAGE_KEYS.sync.AUTO_CLOSE_RULES);

// Use strict null checks
const rule: AutoCloseRule | undefined = rules.find((r) => r.id === ruleId);
if (!rule) {
  console.error('Rule not found');
  return;
}

// Use type guards for user input
function isValidDuration(value: unknown): value is number {
  return typeof value === 'number' && value > 0;
}
```

**Component Patterns:**

```typescript
// Use Preact hooks for state management
import { useState, useEffect } from 'preact/hooks';

// Use type-safe props
interface Props {
  rules: AutoCloseRule[];
  onSave: (rule: AutoCloseRule) => void;
}

// Export components with explicit types
export function AutoCloseRuleEditor(props: Props) {
  // ...
}
```

### Previous Story Intelligence

**From Story 2.1 (Define Grouping Rules):**
- Established pattern for rule management UI
- Created reusable pattern input component (likely `PatternInput.tsx`)
- Implemented glob/regex toggle pattern
- Set precedent for rule ordering (drag-and-drop or up/down buttons)
- Established storage patterns for rules

**From Story 2.3 (Bulk Organize Existing Tabs):**
- Demonstrated comprehensive story documentation style
- Showed how to wire up UI actions with background service worker
- Established testing patterns for rule-based features
- Showed how to handle storage operations with proper error handling

**Key Learnings to Apply:**
1. **Reuse pattern validation logic** from Story 2.1 (glob/regex)
2. **Reuse PatternInput component** if it exists (DRY principle)
3. **Follow same storage patterns** for consistency
4. **Use same rule list UI design** for familiarity
5. **Include comprehensive tests** as demonstrated in Story 2.3

### Testing Strategy

**Unit Tests:**

```typescript
// tests/unit/duration-utils.test.ts
describe('Duration Utilities', () => {
  test('parseDuration converts minutes to milliseconds', () => {
    expect(parseDuration(30, 'minutes')).toBe(30 * 60 * 1000);
  });

  test('formatDuration converts milliseconds to hours', () => {
    expect(formatDuration(7200000)).toEqual({ value: 2, unit: 'hours' });
  });

  test('formatDurationDisplay returns readable string', () => {
    expect(formatDurationDisplay(7200000)).toBe('2 hours');
    expect(formatDurationDisplay(3600000)).toBe('1 hour'); // Singular
  });
});

// tests/unit/auto-close-rule-editor.test.tsx
describe('AutoCloseRuleEditor', () => {
  test('validates empty pattern', () => {
    // Render component, set pattern to empty, verify error shown
  });

  test('validates invalid regex pattern', () => {
    // Render component, set pattern type to regex, enter invalid regex, verify error
  });

  test('save button disabled when validation fails', () => {
    // Render component, enter invalid data, verify save button disabled
  });

  test('calls onSave with correct rule object', () => {
    // Render component, fill form, click save, verify onSave called with correct data
  });
});

// tests/unit/auto-close-rule-list.test.tsx
describe('AutoCloseRuleList', () => {
  test('displays empty state when no rules', () => {
    // Render with empty array, verify empty state message shown
  });

  test('displays rule with pattern and duration', () => {
    // Render with rule, verify pattern and formatted duration shown
  });

  test('shows delete confirmation on delete click', () => {
    // Render, click delete, verify confirm() called with correct message
  });
});
```

**Manual Testing Checklist:**

- [ ] Open options page with reddit.com as active tab → Click "Add Rule" → Verify pattern input is pre-filled with reddit URL (AC3)
- [ ] Add glob rule: `*.reddit.com/*`, 2 hours → Verify saved to storage
- [ ] Add regex rule: `/^https:\/\/twitter\.com\/.*/`, 1 hour → Verify saved
- [ ] Edit rule: Change duration from 2 hours to 4 hours → Verify updated
- [ ] Delete rule: Click delete, confirm → Verify removed from storage
- [ ] Toggle enabled/disabled → Verify visual change and storage update
- [ ] Enter invalid regex: `[abc` → Verify error shown and save disabled
- [ ] Enter empty pattern → Verify error shown and save disabled
- [ ] Reload options page → Verify rules persist
- [ ] Duration presets dropdown → Verify each preset works correctly
- [ ] Custom duration: Enter 90 minutes → Verify saved as 5400000ms

### Implementation Notes

**State Management:**

```typescript
// In Options Page (e.g., src/options/App.tsx)
const [rules, setRules] = useState<AutoCloseRule[]>([]);
const [editingRule, setEditingRule] = useState<AutoCloseRule | null>(null);
const [isAddingRule, setIsAddingRule] = useState(false);
const [currentTabUrl, setCurrentTabUrl] = useState<string>('');

// Load rules on mount
useEffect(() => {
  loadRules();
  loadCurrentTabUrl(); // AC3: Get current tab URL for auto-population
}, []);

async function loadCurrentTabUrl() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      setCurrentTabUrl(tab.url);
    }
  } catch (error) {
    console.error('[AutoClose] Failed to get current tab URL:', error);
  }
}

async function loadRules() {
  const storageService = new StorageService();
  const loadedRules = await storageService.getAutoCloseRules();
  setRules(loadedRules);
}

async function handleAddRule() {
  setIsAddingRule(true);
  // currentTabUrl will be passed to AutoCloseRuleEditor as initialUrl
}

async function handleSaveRule(rule: AutoCloseRule) {
  const storageService = new StorageService();
  
  // Update or add rule
  const updatedRules = editingRule
    ? rules.map((r) => (r.id === rule.id ? rule : r))
    : [...rules, rule];
  
  await storageService.saveAutoCloseRules(updatedRules);
  setRules(updatedRules);
  setEditingRule(null);
  setIsAddingRule(false);
}

async function handleDeleteRule(ruleId: string) {
  const storageService = new StorageService();
  const updatedRules = rules.filter((r) => r.id !== ruleId);
  await storageService.saveAutoCloseRules(updatedRules);
  setRules(updatedRules);
}

async function handleToggleEnabled(ruleId: string, enabled: boolean) {
  const storageService = new StorageService();
  const updatedRules = rules.map((r) =>
    r.id === ruleId ? { ...r, enabled } : r
  );
  await storageService.saveAutoCloseRules(updatedRules);
  setRules(updatedRules);
}
```

**CSS Styling Example:**

```css
/* src/options/styles/options.css */

.auto-close-section {
  margin: 2rem 0;
  padding: 1.5rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.auto-close-section h2 {
  margin-bottom: 0.5rem;
}

.auto-close-section .description {
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
}

.rule-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.rule-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--background-secondary);
}

.rule-item.disabled {
  opacity: 0.5;
}

.rule-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.rule-pattern {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pattern-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
  text-transform: uppercase;
}

.pattern-badge.glob {
  background: var(--color-blue-light);
  color: var(--color-blue);
}

.pattern-badge.regex {
  background: var(--color-purple-light);
  color: var(--color-purple);
}

.rule-duration {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.rule-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
}

.rule-editor {
  padding: 1.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--background-secondary);
  margin-bottom: 1rem;
}

.form-field {
  margin-bottom: 1rem;
}

.form-field label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.pattern-input-group,
.duration-input-group {
  display: flex;
  gap: 0.5rem;
}

.pattern-input-group input {
  flex: 1;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}

.error {
  color: var(--color-error);
  font-size: 0.875rem;
  margin-top: 0.25rem;
}
```

### Validation and Error Handling

**Validation Rules:**

1. **Pattern Validation:**
   - Cannot be empty or whitespace-only
   - Regex patterns must compile without errors
   - Show specific error message for syntax errors

2. **Duration Validation:**
   - Must be positive number (> 0)
   - Reasonable upper limit (e.g., max 365 days)
   - No decimals for days/hours, allow decimals for minutes if needed

3. **Storage Error Handling:**
   - Catch `chrome.storage` quota exceeded errors
   - Show user-friendly message: "Storage limit reached. Delete some rules."
   - Log detailed errors to console for debugging

**Error Messages:**

```typescript
const ERROR_MESSAGES = {
  PATTERN_EMPTY: 'Pattern cannot be empty',
  PATTERN_INVALID_REGEX: 'Invalid regex syntax',
  DURATION_INVALID: 'Duration must be a positive number',
  STORAGE_QUOTA_EXCEEDED: 'Storage limit reached. Delete some rules to free up space.',
  STORAGE_ERROR: 'Failed to save rules. Please try again.',
};
```

### Success Criteria

✅ Story is complete when:

1. Options page has dedicated "Auto-Close Rules" section
2. Users can add/edit/delete auto-close rules with URL pattern and max age
3. Rules support both glob and regex patterns with validation
4. Duration input accepts minutes/hours/days and stores as milliseconds
5. Rules persist in `chrome.storage.sync`
6. Enabled/disabled toggle works and is visually distinct
7. Delete requires confirmation
8. All unit tests pass
9. Manual testing checklist completed
10. Storage schema matches `AutoCloseRule` type

---

## Dev Agent Record

### Agent Model Used

_To be filled by dev agent_

### Debug Log References

_To be filled by dev agent_

### Completion Notes List

_To be filled by dev agent_

### File List

**Files Created:**
- `src/shared/utils/duration-utils.ts`
- `src/shared/utils/pattern-validator.ts` (if doesn't exist)
- `src/options/components/AutoCloseRuleEditor.tsx`
- `src/options/components/AutoCloseRuleList.tsx`
- `tests/unit/duration-utils.test.ts`
- `tests/unit/auto-close-rule-editor.test.tsx`
- `tests/unit/auto-close-rule-list.test.tsx`

**Files Modified:**
- `src/options/App.tsx`
- `src/options/styles/options.css`
- `package.json` (if uuid dependency added)

---

**STORY FILE CREATION COMPLETE** ✅

Ready for dev agent implementation!
