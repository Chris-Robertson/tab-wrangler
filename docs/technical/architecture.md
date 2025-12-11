# Tab Wrangler - Technical Architecture

**Version:** 1.0  
**Date:** December 11, 2025  
**Status:** Draft

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Component Architecture](#component-architecture)
4. [Data Models](#data-models)
5. [Chrome APIs](#chrome-apis)
6. [File Structure](#file-structure)
7. [Key Flows](#key-flows)
8. [Design Decisions](#design-decisions)

---

## Architecture Overview

Tab Wrangler is a Chrome Extension built on **Manifest V3**, designed for modularity and maintainability. The architecture follows a service-worker-centric pattern with clear separation between background processing, UI, and storage.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Chrome/Brave)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │    Popup     │    │   Options    │    │   Service    │       │
│  │     UI       │◄──►│    Page      │◄──►│   Worker     │       │
│  └──────────────┘    └──────────────┘    └──────┬───────┘       │
│         │                   │                    │               │
│         └───────────────────┴────────────────────┤               │
│                                                  │               │
│  ┌───────────────────────────────────────────────▼─────────────┐│
│  │                     Chrome APIs                              ││
│  │  ┌─────────┐ ┌───────────┐ ┌─────────┐ ┌─────────────────┐  ││
│  │  │  tabs   │ │ tabGroups │ │bookmarks│ │     storage     │  ││
│  │  └─────────┘ └───────────┘ └─────────┘ │ (sync + local)  │  ││
│  │                                         └─────────────────┘  ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Core Principles

1. **Service Worker as Brain** - All tab operations and rule processing in background
2. **Reactive UI** - Popup and options page query state, don't manage it
3. **Storage as Source of Truth** - All state persisted, service worker ephemeral
4. **Pattern Engine** - Unified glob/regex matching across all features
5. **Non-Destructive** - Archive and undo mechanisms protect against mistakes

---

## Technology Stack

### Core Technologies

| Technology | Purpose | Rationale |
|------------|---------|-----------|
| **TypeScript** | Primary language | Type safety, better DX, catches errors early |
| **Manifest V3** | Extension platform | Required for Chrome Web Store, modern APIs |
| **Vite** | Build tool | Fast builds, HMR for development |
| **Preact** | UI framework | Lightweight React alternative, ~3KB |

### Development Tools

| Tool | Purpose |
|------|---------|
| **CRXJS Vite Plugin** | Chrome extension development with Vite |
| **ESLint** | Code quality |
| **Prettier** | Code formatting |
| **Vitest** | Unit testing |

### Why These Choices?

- **TypeScript over JavaScript**: Rule patterns, storage schemas, and Chrome APIs benefit greatly from types
- **Preact over React**: Minimal bundle size matters for extensions; Preact is API-compatible
- **Vite over Webpack**: Faster builds, simpler config, excellent plugin ecosystem
- **No state library**: Extension state is simple enough; Chrome storage + React context suffices

---

## Component Architecture

### Module Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICE WORKER (Background)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Tab Manager   │  │  Rule Engine    │  │ Activity Tracker│  │
│  │                 │  │                 │  │                 │  │
│  │ - Query tabs    │  │ - Pattern match │  │ - Track active  │  │
│  │ - Sort tabs     │  │ - Glob support  │  │ - Store times   │  │
│  │ - Close tabs    │  │ - Regex support │  │ - Check ages    │  │
│  │ - Group tabs    │  │ - Rule priority │  │                 │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │           │
│  ┌────────┴────────────────────┴────────────────────┴────────┐  │
│  │                    Storage Service                         │  │
│  │  - Rules (sync)  - Activity (local)  - Settings (sync)    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Duplicate       │  │ Auto-Close      │  │ Archive         │  │
│  │ Detector        │  │ Scheduler       │  │ Manager         │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         UI LAYER                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐   │
│  │        POPUP            │  │       OPTIONS PAGE          │   │
│  │                         │  │                             │   │
│  │ ┌─────────────────────┐ │  │ ┌─────────────────────────┐ │   │
│  │ │ Stats Dashboard     │ │  │ │ Rule Editor (Groups)    │ │   │
│  │ │ - Tab count         │ │  │ │ - Add/Edit/Delete       │ │   │
│  │ │ - Group count       │ │  │ │ - Pattern type toggle   │ │   │
│  │ │ - Duplicate count   │ │  │ │ - Drag to reorder       │ │   │
│  │ └─────────────────────┘ │  │ └─────────────────────────┘ │   │
│  │ ┌─────────────────────┐ │  │ ┌─────────────────────────┐ │   │
│  │ │ Quick Actions       │ │  │ │ Rule Editor (Auto-Close)│ │   │
│  │ │ - Remove duplicates │ │  │ │ - Pattern + duration    │ │   │
│  │ │ - Organize all      │ │  │ │ - Whitelist rules       │ │   │
│  │ │ - Sort tabs         │ │  │ │ - Archive exclusions    │ │   │
│  │ └─────────────────────┘ │  │ └─────────────────────────┘ │   │
│  │ ┌─────────────────────┐ │  │ ┌─────────────────────────┐ │   │
│  │ │ Toggles             │ │  │ │ Settings                │ │   │
│  │ │ - Auto-group on/off │ │  │ │ - Duplicate detection   │ │   │
│  │ │ - Auto-close on/off │ │  │ │ - Check interval        │ │   │
│  │ └─────────────────────┘ │  │ │ - Import/Export         │ │   │
│  │ ┌─────────────────────┐ │  │ └─────────────────────────┘ │   │
│  │ │ Recently Closed     │ │  │                             │   │
│  │ │ - Undo list         │ │  │                             │   │
│  │ └─────────────────────┘ │  │                             │   │
│  └─────────────────────────┘  └─────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Module Responsibilities

#### Service Worker Modules

| Module | Responsibility |
|--------|----------------|
| **TabManager** | Query, sort, move, close, group tabs via Chrome APIs |
| **RuleEngine** | Parse and match patterns (glob/regex) against URLs |
| **ActivityTracker** | Track tab activation times, calculate ages |
| **DuplicateDetector** | Find duplicate tabs based on URL normalization |
| **AutoCloseScheduler** | Periodic check for stale tabs, trigger closes |
| **ArchiveManager** | Save tabs to bookmarks, manage archive folder |
| **StorageService** | Unified interface to chrome.storage.sync/local |

#### UI Components

| Component | Location | Responsibility |
|-----------|----------|----------------|
| **Popup** | Toolbar click | Quick actions, stats, toggles |
| **OptionsPage** | Extension settings | Full rule management, settings |
| **RuleEditor** | Options page | CRUD for rules with validation |
| **PatternInput** | Shared | Input with glob/regex toggle and validation |

---

## Data Models

### Storage Schema

Tab Wrangler uses two storage areas:

- **`chrome.storage.sync`** - User rules and settings (synced across devices)
- **`chrome.storage.local`** - Activity data and recently closed (device-local)

#### Sync Storage Schema

```typescript
interface SyncStorage {
  // Grouping rules
  groupingRules: GroupingRule[];
  
  // Auto-close rules
  autoCloseRules: AutoCloseRule[];
  
  // Whitelist (protected from auto-close)
  whitelistRules: WhitelistRule[];
  
  // Archive exclusion rules
  archiveExclusionRules: PatternRule[];
  
  // Global settings
  settings: Settings;
}

interface GroupingRule {
  id: string;                    // UUID
  pattern: string;               // URL pattern
  patternType: 'glob' | 'regex'; // Pattern syntax
  groupName: string;             // Tab group name
  groupColor: TabGroupColor;     // Chrome tab group color
  enabled: boolean;
  order: number;                 // Priority (lower = higher priority)
}

interface AutoCloseRule {
  id: string;
  pattern: string;
  patternType: 'glob' | 'regex';
  maxAge: number;                // Duration in milliseconds
  enabled: boolean;
}

interface WhitelistRule {
  id: string;
  pattern: string;
  patternType: 'glob' | 'regex';
  enabled: boolean;
}

interface PatternRule {
  id: string;
  pattern: string;
  patternType: 'glob' | 'regex';
}

interface Settings {
  // Feature toggles
  autoGroupEnabled: boolean;
  autoCloseEnabled: boolean;
  
  // Duplicate detection
  duplicateDetectionMode: 'exact' | 'ignoreParams' | 'ignoreAnchors' | 'ignoreBoth';
  
  // Auto-close settings
  autoCloseCheckInterval: number;  // milliseconds (default: 5 min)
  autoCloseProtectPinned: boolean; // default: true
  
  // Archive settings
  archiveEnabled: boolean;
  archiveBookmarkFolderId: string | null;
  
  // Sort preferences
  defaultSortOrder: 'domain' | 'url' | 'title' | 'ageOldest' | 'ageNewest';
  sortPreserveGroups: boolean;
}

// Chrome's tab group colors
type TabGroupColor = 'grey' | 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan' | 'orange';
```

#### Local Storage Schema

```typescript
interface LocalStorage {
  // Tab activity tracking
  tabActivity: Record<number, TabActivity>;  // tabId -> activity
  
  // Recently closed tabs (for undo)
  recentlyClosed: ClosedTabEntry[];
  
  // Persistent tab activity (survives tab ID changes)
  tabActivityByUrl: Record<string, number>;  // url -> lastActiveTimestamp
}

interface TabActivity {
  tabId: number;
  url: string;
  lastActiveAt: number;   // timestamp
  createdAt: number;      // timestamp
}

interface ClosedTabEntry {
  id: string;             // UUID
  url: string;
  title: string;
  favicon: string | null;
  closedAt: number;       // timestamp
  closedBy: 'auto' | 'duplicate' | 'manual';
}
```

### Default Values

```typescript
const DEFAULT_SETTINGS: Settings = {
  autoGroupEnabled: true,
  autoCloseEnabled: false,  // Off by default for safety
  duplicateDetectionMode: 'ignoreParams',
  autoCloseCheckInterval: 5 * 60 * 1000,  // 5 minutes
  autoCloseProtectPinned: true,
  archiveEnabled: true,
  archiveBookmarkFolderId: null,
  defaultSortOrder: 'domain',
  sortPreserveGroups: true,
};

const RECENTLY_CLOSED_MAX_ENTRIES = 100;
const RECENTLY_CLOSED_MAX_AGE = 24 * 60 * 60 * 1000;  // 1 day
```

---

## Chrome APIs

### Required Permissions

```json
{
  "permissions": [
    "tabs",
    "tabGroups",
    "bookmarks",
    "storage"
  ]
}
```

### API Usage by Feature

| Feature | APIs Used |
|---------|-----------|
| **Duplicate Detection** | `chrome.tabs.query()`, `chrome.tabs.remove()` |
| **Auto-Grouping** | `chrome.tabs.group()`, `chrome.tabGroups.update()`, `chrome.tabs.onCreated`, `chrome.tabs.onUpdated` |
| **Auto-Close** | `chrome.tabs.remove()`, `chrome.tabs.onActivated`, `chrome.alarms` |
| **Tab Sorting** | `chrome.tabs.query()`, `chrome.tabs.move()`, `chrome.tabGroups.query()` |
| **Archive** | `chrome.bookmarks.create()`, `chrome.bookmarks.getTree()` |
| **Settings** | `chrome.storage.sync`, `chrome.storage.local` |

### Event Listeners

```typescript
// Service worker event subscriptions
chrome.tabs.onCreated.addListener(handleTabCreated);
chrome.tabs.onUpdated.addListener(handleTabUpdated);
chrome.tabs.onActivated.addListener(handleTabActivated);
chrome.tabs.onRemoved.addListener(handleTabRemoved);
chrome.alarms.onAlarm.addListener(handleAlarm);
chrome.runtime.onInstalled.addListener(handleInstall);
```

---

## File Structure

```
tab-wrangler/
├── docs/
│   ├── index.md
│   ├── product-brief.md
│   ├── user-stories.md
│   ├── technical/
│   │   └── architecture.md        # This document
│   └── sprint-artifacts/
│
├── src/
│   ├── manifest.json              # Extension manifest (Manifest V3)
│   │
│   ├── background/                # Service worker
│   │   ├── index.ts               # Service worker entry point
│   │   ├── modules/
│   │   │   ├── tab-manager.ts     # Tab operations
│   │   │   ├── rule-engine.ts     # Pattern matching
│   │   │   ├── activity-tracker.ts
│   │   │   ├── duplicate-detector.ts
│   │   │   ├── auto-close-scheduler.ts
│   │   │   ├── archive-manager.ts
│   │   │   └── storage-service.ts
│   │   └── listeners/
│   │       ├── tab-listeners.ts
│   │       └── alarm-listeners.ts
│   │
│   ├── popup/                     # Popup UI
│   │   ├── index.html
│   │   ├── index.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Stats.tsx
│   │   │   ├── QuickActions.tsx
│   │   │   ├── Toggles.tsx
│   │   │   ├── SortMenu.tsx
│   │   │   └── RecentlyClosed.tsx
│   │   └── styles/
│   │       └── popup.css
│   │
│   ├── options/                   # Options page
│   │   ├── index.html
│   │   ├── index.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── RuleList.tsx
│   │   │   ├── RuleEditor.tsx
│   │   │   ├── PatternInput.tsx
│   │   │   ├── DurationInput.tsx
│   │   │   ├── ColorPicker.tsx
│   │   │   ├── ImportExport.tsx
│   │   │   └── Settings.tsx
│   │   └── styles/
│   │       └── options.css
│   │
│   ├── shared/                    # Shared code
│   │   ├── types/
│   │   │   ├── rules.ts
│   │   │   ├── storage.ts
│   │   │   └── tabs.ts
│   │   ├── utils/
│   │   │   ├── pattern-matcher.ts # Glob/regex matching
│   │   │   ├── url-utils.ts       # URL normalization
│   │   │   ├── duration-utils.ts  # Duration parsing
│   │   │   └── id-utils.ts        # UUID generation
│   │   ├── constants.ts
│   │   └── messaging.ts           # Type-safe messaging
│   │
│   └── assets/
│       ├── icons/
│       │   ├── icon-16.png
│       │   ├── icon-32.png
│       │   ├── icon-48.png
│       │   └── icon-128.png
│       └── logo.svg
│
├── tests/
│   ├── unit/
│   │   ├── rule-engine.test.ts
│   │   ├── pattern-matcher.test.ts
│   │   ├── url-utils.test.ts
│   │   └── duplicate-detector.test.ts
│   └── integration/
│       └── storage.test.ts
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .eslintrc.js
├── .prettierrc
└── README.md
```

---

## Key Flows

### Flow 1: Auto-Group New Tab

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐     ┌───────────┐
│  Chrome  │────►│ tabs.onCreated│────►│ RuleEngine  │────►│TabManager │
│          │     │ tabs.onUpdated│     │             │     │           │
└──────────┘     └──────────────┘     └─────────────┘     └───────────┘
                        │                    │                   │
                        │                    │                   │
                 1. Tab created        2. Match URL        3. Add to group
                    with URL           against rules       or create group
```

```typescript
// Pseudocode
async function handleTabUpdated(tabId: number, changeInfo: object, tab: Tab) {
  if (!changeInfo.url || !settings.autoGroupEnabled) return;
  
  const matchingRule = ruleEngine.findFirstMatch(tab.url, groupingRules);
  if (matchingRule) {
    await tabManager.addToGroup(tabId, matchingRule.groupName, matchingRule.groupColor);
  }
}
```

### Flow 2: Auto-Close Stale Tab

```
┌──────────┐     ┌──────────────────┐     ┌───────────────┐     ┌──────────────┐
│  Alarm   │────►│AutoCloseScheduler│────►│ActivityTracker│────►│ArchiveManager│
│  (5 min) │     │                  │     │               │     │              │
└──────────┘     └──────────────────┘     └───────────────┘     └──────────────┘
                        │                      │                    │
                        │                      │                    │
                  1. Check all           2. Filter by          3. Archive &
                     tabs                   age > max             close
```

```typescript
// Pseudocode
async function handleAutoCloseCheck() {
  const tabs = await chrome.tabs.query({});
  const now = Date.now();
  
  for (const tab of tabs) {
    // Skip whitelisted
    if (ruleEngine.matchesAny(tab.url, whitelistRules)) continue;
    
    // Check auto-close rules
    const rule = ruleEngine.findFirstMatch(tab.url, autoCloseRules);
    if (!rule) continue;
    
    const activity = await activityTracker.getActivity(tab.id);
    const age = now - activity.lastActiveAt;
    
    if (age > rule.maxAge) {
      await archiveManager.archiveTab(tab);
      await tabManager.closeTab(tab.id);
    }
  }
}
```

### Flow 3: Sort Tabs by Domain

```
┌──────────┐     ┌───────────┐     ┌───────────┐     ┌───────────┐
│  Popup   │────►│TabManager │────►│  Sort by  │────►│ tabs.move │
│  Click   │     │.sortTabs()│     │  domain   │     │   loop    │
└──────────┘     └───────────┘     └───────────┘     └───────────┘
```

```typescript
// Pseudocode
async function sortTabsByDomain(preserveGroups: boolean) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  
  // Extract domain and sort
  const sorted = tabs.sort((a, b) => {
    const domainA = new URL(a.url).hostname;
    const domainB = new URL(b.url).hostname;
    return domainA.localeCompare(domainB);
  });
  
  // Move tabs to sorted positions
  for (let i = 0; i < sorted.length; i++) {
    await chrome.tabs.move(sorted[i].id, { index: i });
  }
}
```

---

## Design Decisions

### Decision 1: Service Worker vs Background Page

**Choice:** Service Worker (Manifest V3)

**Rationale:**
- Required for Manifest V3
- Lower memory footprint
- Wakes on events, sleeps when idle
- Must persist all state to storage (no global variables)

**Implications:**
- Activity tracking must store timestamps in chrome.storage.local
- Alarms used for periodic auto-close checks (not setInterval)

---

### Decision 2: Pattern Matching Library

**Choice:** Custom implementation with micromatch for globs

**Rationale:**
- **micromatch**: Battle-tested glob matching, ~6KB
- Native RegExp for regex patterns
- Unified interface via RuleEngine

**Implementation:**
```typescript
import micromatch from 'micromatch';

function matchPattern(url: string, pattern: string, type: 'glob' | 'regex'): boolean {
  if (type === 'glob') {
    return micromatch.isMatch(url, pattern);
  } else {
    return new RegExp(pattern).test(url);
  }
}
```

---

### Decision 3: UI Framework

**Choice:** Preact

**Rationale:**
- ~3KB vs React's ~40KB
- API-compatible with React
- Fast enough for extension UI
- Good TypeScript support

**Implications:**
- Use `preact/hooks` instead of `react`
- Alias in Vite config: `react` → `preact/compat`

---

### Decision 4: Tab Activity Tracking

**Choice:** Hybrid approach

**Rationale:**
- Tab IDs are not persistent (change on browser restart)
- Need to track activity across sessions
- Use URL as secondary key for persistence

**Implementation:**
```typescript
// Primary: tabId -> activity (fast lookup)
// Secondary: url -> lastActiveAt (survives tab ID changes)
```

---

### Decision 5: Archive Folder Structure

**Choice:** Flat folder with date in bookmark title

**Rationale:**
- Simple to implement
- Easy to browse in bookmark manager
- No complex folder maintenance

**Implementation:**
```
Bookmarks Bar
└── Tab Wrangler Archive
    ├── [2025-12-11] Page Title - example.com
    ├── [2025-12-11] Another Page - site.com
    └── ...
```

---

## Next Steps

1. [ ] Set up project with Vite + CRXJS
2. [ ] Implement core types and storage schema
3. [ ] Build RuleEngine with pattern matching
4. [ ] Implement service worker foundation
5. [ ] Create popup UI
6. [ ] Create options page
7. [ ] Add auto-grouping feature
8. [ ] Add auto-close feature
9. [ ] Add sorting feature
10. [ ] Add duplicate detection
11. [ ] Testing and polish

---

## Appendix: Manifest.json

```json
{
  "manifest_version": 3,
  "name": "Tab Wrangler",
  "version": "1.0.0",
  "description": "Intelligently manage, group, and clean up browser tabs",
  
  "permissions": [
    "tabs",
    "tabGroups", 
    "bookmarks",
    "storage",
    "alarms"
  ],
  
  "background": {
    "service_worker": "src/background/index.ts",
    "type": "module"
  },
  
  "action": {
    "default_popup": "src/popup/index.html",
    "default_icon": {
      "16": "src/assets/icons/icon-16.png",
      "32": "src/assets/icons/icon-32.png",
      "48": "src/assets/icons/icon-48.png",
      "128": "src/assets/icons/icon-128.png"
    }
  },
  
  "options_page": "src/options/index.html",
  
  "icons": {
    "16": "src/assets/icons/icon-16.png",
    "32": "src/assets/icons/icon-32.png",
    "48": "src/assets/icons/icon-48.png",
    "128": "src/assets/icons/icon-128.png"
  }
}
```

