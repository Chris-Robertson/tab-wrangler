# Story 3.5: Archive Tabs to Bookmarks Before Auto-Close

Status: done

## Story

As a user who might need closed tabs later,
I want auto-closed tabs to be saved to bookmarks,
so that I can recover the URL if needed.

## Acceptance Criteria

1. **AC1: Auto-closed tabs are bookmarked before closing** — When `AutoCloseScheduler.runCheck()` closes a stale tab, it calls `ArchiveManager.archiveTab(tab)` first (if archiving is enabled). The tab is only closed after a successful bookmark save (or if archiving fails gracefully).
2. **AC2: Bookmarks saved to "Tab Wrangler Archive" folder** — All archived tabs land in a dedicated top-level bookmark folder named exactly `"Tab Wrangler Archive"` (`ARCHIVE_FOLDER_NAME` constant).
3. **AC3: Archive folder auto-created if missing** — On first use, `ArchiveManager` locates or creates the folder via `chrome.bookmarks`. The folder ID is cached in `settings.archiveBookmarkFolderId` so future calls skip the search.
4. **AC4: Bookmark title includes date** — Bookmark title format: `[YYYY-MM-DD] {tab title} – {hostname}` (e.g., `[2026-02-26] GitHub – github.com`). If the tab has no title, use the URL hostname.
5. **AC5: Archive exclusion rules respected** — Before archiving, `archiveExclusionRules` are evaluated via `matchPattern`. If any rule matches the tab URL, the tab is **not** archived (but still closed). Exclusion rules have no `enabled` field — all stored rules are always active.
6. **AC6: `settings.archiveEnabled` toggle** — If `settings.archiveEnabled` is `false`, `ArchiveManager.archiveTab()` returns immediately without creating a bookmark.
7. **AC7: Archive exclusion rules manageable via UI** — Options page gets a new "Archive" tab/section. Users can add, edit, delete exclusion rules. Same pattern/glob/regex support as other rule editors. **No `enabled` toggle** — exclusion rules are always active.
8. **AC8: Rules persisted in `chrome.storage.sync`** — `archiveExclusionRules` uses key `STORAGE_KEYS.sync.ARCHIVE_EXCLUSION_RULES`. Schema matches `ArchiveExclusionRule` type (`{ id, pattern, patternType }` — no `enabled` field).
9. **AC9: `bookmarks` permission already declared** — Verified in `src/manifest.json` — no manifest changes needed.

## Tasks / Subtasks

- [x] **Task 1: Create `ArchiveManager` module** (AC: 1–6)
  - [x] Create `src/background/modules/archive-manager.ts`
  - [x] Class constructor: `constructor(private storage: StorageService)`
  - [x] Implement `archiveTab(tab: chrome.tabs.Tab): Promise<void>`
    - [x] Load `settings` — if `!settings.archiveEnabled`, return immediately (AC6)
    - [x] Load `archiveExclusionRules` from storage
    - [x] Check: if any exclusion rule matches `tab.url`, return without archiving (AC5)
    - [x] Resolve or create the archive bookmark folder (AC2, AC3)
    - [x] Build bookmark title: `[YYYY-MM-DD] {title} – {hostname}` (AC4)
    - [x] Create bookmark
    - [x] Wrap everything in `try/catch` — archive failure must NOT prevent tab closure
  - [x] Export `ArchiveManager`

- [x] **Task 2: Integrate `ArchiveManager` into `AutoCloseScheduler`** (AC: 1)
  - [x] Update `src/background/modules/auto-close-scheduler.ts` constructor
  - [x] In `runCheck()`, before calling `chrome.tabs.remove(tab.id!)`, call `await this.archiveManager.archiveTab(tab)`
  - [x] Update instantiation in `background/index.ts`

- [x] **Task 3: Create `useArchiveExclusionRules` hook** (AC: 7, 8)
  - [x] Create `src/options/hooks/useArchiveExclusionRules.ts`
  - [x] Model after `useAutoCloseRules.ts`
  - [x] Key: `STORAGE_KEYS.sync.ARCHIVE_EXCLUSION_RULES`
  - [x] No `toggleEnabled` method

- [x] **Task 4: Create `ArchiveExclusionRuleEditor` component** (AC: 7)
  - [x] Create `src/options/components/ArchiveExclusionRuleEditor.tsx`
  - [x] Pattern input + glob/regex toggle only
  - [x] No enabled checkbox, no duration

- [x] **Task 5: Create `ArchiveExclusionRuleList` component** (AC: 7)
  - [x] Create `src/options/components/ArchiveExclusionRuleList.tsx`
  - [x] No enabled toggle
  - [x] Delete confirmation, reorder buttons

- [x] **Task 6: Add Archive section to `App.tsx`** (AC: 7)
  - [x] Add `'archive'` to `Tab` union type
  - [x] Add "Archive" nav tab between Whitelist and Settings
  - [x] Implement `ArchiveRulesTab` with `archiveEnabled` toggle and exclusion rule list

- [x] **Task 7: Unit Tests**
  - [x] Create `tests/unit/archive-manager.test.ts`
  - [x] Create `tests/unit/archive-exclusion-rule-editor.test.tsx`
  - [x] Create `tests/unit/archive-exclusion-rule-list.test.tsx`

### Review Follow-ups (AI) - 2026-02-27 Code Review
- [x] [AI-Review][High] Enforce AC2 top-level archive folder semantics in `findOrCreateArchiveFolder()` (creation and selection), rather than matching any folder title anywhere in tree. [src/background/modules/archive-manager.ts:80]
- [x] [AI-Review][Medium] Constrain existing-folder search/cache to a true top-level folder (avoid caching unrelated nested folder IDs). [src/background/modules/archive-manager.ts:80]
- [x] [AI-Review][Medium] Add regression tests for top-level folder behavior (create with explicit top-level parent and ignore nested-title collisions). [tests/unit/archive-manager.test.ts:190]

## Dev Notes

### Architecture Context

```
AutoCloseScheduler.runCheck()
        │
        ├── for each stale tab:
        │     ArchiveManager.archiveTab(tab)   ← NEW (this story)
        │           │
        │           ├── check settings.archiveEnabled
        │           ├── check archiveExclusionRules (matchPattern)
        │           ├── findOrCreateArchiveFolder()
        │           └── chrome.bookmarks.create(...)
        │
        └── chrome.tabs.remove(tab.id)
```

### `ArchiveExclusionRule` Type (already defined — do NOT redefine)

```typescript
// From src/shared/types/rules.ts
export interface ArchiveExclusionRule {
  id: string;
  pattern: string;
  patternType: PatternType;
  // NOTE: No 'enabled' field — all stored rules are always active
}
```

This is simpler than `WhitelistRule` — no `enabled` field at all. The editor and list have no toggle.

### Archive Folder Caching Strategy

```typescript
private async findOrCreateArchiveFolder(): Promise<string> {
  const settings = await this.storage.getSettings();
  
  // 1. Try cached ID first (fast path)
  if (settings.archiveBookmarkFolderId) {
    try {
      const [folder] = await chrome.bookmarks.get(settings.archiveBookmarkFolderId);
      if (folder) return folder.id;
    } catch {
      // Folder was deleted — fall through to re-create
    }
  }
  
  // 2. Search by title
  const results = await chrome.bookmarks.search({ title: ARCHIVE_FOLDER_NAME });
  const existing = results.find((b) => !b.url); // folders have no URL
  if (existing) {
    await this.storage.updateSettings({ archiveBookmarkFolderId: existing.id });
    return existing.id;
  }
  
  // 3. Create new folder
  const newFolder = await chrome.bookmarks.create({ title: ARCHIVE_FOLDER_NAME });
  await this.storage.updateSettings({ archiveBookmarkFolderId: newFolder.id });
  return newFolder.id;
}
```

### Bookmark Title Format

```typescript
const dateStr = new Date().toISOString().slice(0, 10); // "2026-02-26"
const hostname = new URL(tab.url!).hostname;           // "github.com"
const titleText = tab.title?.trim() || hostname;       // fallback to hostname
const bookmarkTitle = `[${dateStr}] ${titleText} – ${hostname}`;
// Result: "[2026-02-26] GitHub – github.com"
```

Note: `–` is an en-dash (U+2013), matching architecture Decision 5.

### Archive Failure Must Not Block Tab Close

```typescript
// In ArchiveManager.archiveTab():
try {
  // ... all archive logic ...
} catch (error) {
  console.error('[ArchiveManager] Failed to archive tab:', tab.url, error);
  // Do NOT rethrow — caller (AutoCloseScheduler) must still close the tab
}
```

### `AutoCloseScheduler` Constructor Change

This story changes the `AutoCloseScheduler` constructor signature (adds `archiveManager`). If Story 3.3 has already been implemented, update the constructor and instantiation in `background/index.ts`. The test for `AutoCloseScheduler` will also need its mock updated to pass a mock `ArchiveManager`.

### `settings.archiveEnabled` is already in `Settings` type and `DEFAULT_SETTINGS`

Confirmed in `src/shared/types/storage.ts` and `src/shared/constants.ts` (`archiveEnabled: true` by default).

### `ARCHIVE_FOLDER_NAME` constant already exists

Confirmed in `src/shared/constants.ts`: `export const ARCHIVE_FOLDER_NAME = 'Tab Wrangler Archive'`

### `bookmarks` Permission Already Declared

Confirmed in `src/manifest.json` — `"bookmarks"` is already in the permissions array. No manifest changes needed.

### Hook — No `toggleEnabled`

`useArchiveExclusionRules` does NOT need a `toggleEnabled` method. `ArchiveExclusionRule` has no `enabled` field. The returned interface is:

```typescript
interface UseArchiveExclusionRulesReturn {
  rules: ArchiveExclusionRule[];
  loading: boolean;
  addRule: (rule: NewArchiveExclusionRuleInput) => Promise<void>;
  updateRule: (id: string, updates: Partial<ArchiveExclusionRule>) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  reorderRules: (fromIndex: number, toIndex: number) => Promise<void>;
}
```

### Testing `ArchiveManager` — Chrome Bookmarks Mock

```typescript
global.chrome = {
  bookmarks: {
    get: vi.fn(),
    search: vi.fn(),
    create: vi.fn(),
  },
  storage: { /* ... */ },
} as any;
```

Use `vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-02-26T00:00:00.000Z')` for deterministic date in title format tests.

### References

- User stories: [_bmad-output/planning-artifacts/user-stories.md](_bmad-output/planning-artifacts/user-stories.md) — Story 3.5
- Architecture: [_bmad-output/planning-artifacts/architecture.md](_bmad-output/planning-artifacts/architecture.md) — "ArchiveManager" module, "Decision 5: Archive Folder Structure"
- Manifest: [src/manifest.json](src/manifest.json) — `bookmarks` permission verified
- Storage types: [src/shared/types/storage.ts](src/shared/types/storage.ts) — `Settings.archiveEnabled`, `Settings.archiveBookmarkFolderId`
- Rules types: [src/shared/types/rules.ts](src/shared/types/rules.ts) — `ArchiveExclusionRule`
- Constants: [src/shared/constants.ts](src/shared/constants.ts) — `ARCHIVE_FOLDER_NAME`, `STORAGE_KEYS.sync.ARCHIVE_EXCLUSION_RULES`
- Pattern matcher: [src/shared/utils/pattern-matcher.ts](src/shared/utils/pattern-matcher.ts)
- Storage service: [src/background/modules/storage-service.ts](src/background/modules/storage-service.ts) — `getArchiveExclusionRules()`, `saveArchiveExclusionRules()`, `updateSettings()` already implemented
- AutoCloseScheduler: [src/background/modules/auto-close-scheduler.ts](src/background/modules/auto-close-scheduler.ts) — **modify** constructor + `runCheck()`
- Background index: [src/background/index.ts](src/background/index.ts) — **modify** instantiation
- Reference hook: [src/options/hooks/useAutoCloseRules.ts](src/options/hooks/useAutoCloseRules.ts) — copy & adapt
- Reference editor: [src/options/components/AutoCloseRuleEditor.tsx](src/options/components/AutoCloseRuleEditor.tsx) — copy & simplify (remove duration + enabled)
- Reference list: [src/options/components/AutoCloseRuleList.tsx](src/options/components/AutoCloseRuleList.tsx) — copy & simplify (remove duration + toggle)
- Options App: [src/options/App.tsx](src/options/App.tsx) — add Archive tab (currently has grouping/autoclose/settings)
- Auto-close rule list tests: [tests/unit/auto-close-rule-list.test.tsx](tests/unit/auto-close-rule-list.test.tsx) — reference pattern
- useAutoCloseRules tests: [tests/unit/use-auto-close-rules.test.ts](tests/unit/use-auto-close-rules.test.ts) — reference pattern
- Previous story (3.4): [_bmad-output/implementation-artifacts/3-4-define-whitelist-rules.md](_bmad-output/implementation-artifacts/3-4-define-whitelist-rules.md)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

### Completion Notes List

- All tasks complete. 33 new tests added; full suite: 291/291 passing.
- `ArchiveManager` is fully defensive: archive failures are caught/logged and never prevent tab closure.
- `AutoCloseScheduler` constructor now accepts a third `archiveManager` parameter; existing tests updated accordingly.
- `background/index.ts` updated to instantiate `ArchiveManager` and pass it to `AutoCloseScheduler`.
- Archive tab added to Options page between Whitelist and Settings.

### File List

- `src/background/modules/archive-manager.ts` ← **create**
- `src/background/modules/auto-close-scheduler.ts` ← **modify** (add `archiveManager` param, call `archiveTab` before close)
- `src/background/index.ts` ← **modify** (instantiate `ArchiveManager`, update `AutoCloseScheduler` call)
- `src/options/hooks/useArchiveExclusionRules.ts` ← **create**
- `src/options/components/ArchiveExclusionRuleEditor.tsx` ← **create**
- `src/options/components/ArchiveExclusionRuleList.tsx` ← **create**
- `src/options/App.tsx` ← **modify** (add Archive tab)
- `tests/unit/archive-manager.test.ts` ← **create**
- `tests/unit/archive-exclusion-rule-editor.test.tsx` ← **create**
- `tests/unit/archive-exclusion-rule-list.test.tsx` ← **create**
