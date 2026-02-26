# Tab Wrangler - User Stories

**Version:** 1.2  
**Date:** December 11, 2025  
**Status:** Draft  
**Last Updated:** Added Tab Sorting feature (Epic 6)

---

## Epic 1: Duplicate Tab Management

### Story 1.1: Remove Duplicate Tabs

**As a** power user with many tabs open  
**I want to** identify and remove duplicate tabs  
**So that** I reduce clutter and browser memory usage

**Acceptance Criteria:**
- [ ] Extension can scan all open tabs across all windows
- [ ] Duplicates are identified by URL excluding query parameters (default)
- [ ] User sees a list of detected duplicates before removal
- [ ] User can choose which duplicate to keep (newest/oldest)
- [ ] Removal is triggered manually via extension popup
- [ ] Confirmation shows count of tabs removed

**Technical Notes:**
- Use `chrome.tabs.query()` to get all tabs
- URL normalization: strip query params and anchors for comparison
- `https://example.com/page?ref=123` and `https://example.com/page` are duplicates

---

### Story 1.2: Configure Duplicate Detection Rules

**As a** technical user  
**I want to** configure how duplicates are detected  
**So that** I can handle edge cases (query params, anchors, etc.)

**Acceptance Criteria:**
- [ ] Options page allows configuring duplicate detection mode
- [ ] Modes available: Exact URL, Ignore query params, Ignore anchors, Ignore both
- [ ] Settings persist across browser sessions
- [ ] Default mode is "Ignore query params"

**Priority:** Nice-to-have for MVP

---

## Epic 2: Auto-Group Tabs

### Story 2.1: Define Grouping Rules

**As a** user who wants organized tabs  
**I want to** define URL pattern → group name rules  
**So that** my tabs are automatically categorized

**Acceptance Criteria:**
- [ ] Options page provides rule management UI
- [ ] Each rule has: URL pattern, pattern type, group name, group color
- [ ] URL patterns support BOTH glob syntax AND regex
- [ ] Pattern type selector: "glob" (default) or "regex"
- [ ] Rules can be added, edited, deleted, reordered
- [ ] Rules are persisted in chrome.storage.sync
- [ ] Rules are validated on save (invalid patterns show error)
- [ ] Regex patterns are validated for syntax errors

**Example Rules:**
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
  "pattern": "/^https:\\/\\/docs\\..+/",
  "patternType": "regex",
  "groupName": "Documentation",
  "groupColor": "green"
}
```

---

### Story 2.2: Auto-Group New Tabs

**As a** user with grouping rules defined  
**I want** new tabs to be automatically grouped  
**So that** I don't have to manually organize them

**Acceptance Criteria:**
- [ ] When a new tab is created, check URL against rules
- [ ] If match found, add tab to corresponding group
- [ ] If group doesn't exist, create it with configured name/color
- [ ] First matching rule wins (rules are ordered by priority)
- [ ] Tabs not matching any rule remain ungrouped
- [ ] Auto-grouping can be toggled on/off globally

**Technical Notes:**
- Use `chrome.tabs.onCreated` and `chrome.tabs.onUpdated` listeners
- Group management via `chrome.tabGroups` API

---

### Story 2.3: Bulk Organize Existing Tabs

**As a** user with many ungrouped tabs  
**I want to** apply grouping rules to all existing tabs  
**So that** my current session becomes organized

**Acceptance Criteria:**
- [ ] "Organize All Tabs" action available in popup
- [ ] All tabs across all windows are evaluated against rules
- [ ] Matching tabs are moved to appropriate groups
- [ ] Summary shown: X tabs organized into Y groups
- [ ] Non-matching tabs are left untouched

---

## Epic 3: Auto-Close Tabs

### Story 3.1: Define Auto-Close Rules

**As a** user who accumulates stale tabs  
**I want to** define rules for auto-closing tabs by URL and age  
**So that** unimportant tabs don't linger forever

**Acceptance Criteria:**
- [ ] Options page provides auto-close rule management
- [ ] Each rule has: URL pattern, pattern type, max age (duration), enabled flag
- [ ] URL patterns support BOTH glob syntax AND regex
- [ ] Duration configurable in minutes/hours/days
- [ ] Rules can be added, edited, deleted
- [ ] Rules are persisted in chrome.storage.sync

**Example Rule:**
```json
{
  "pattern": "*.reddit.com/*",
  "patternType": "glob",
  "maxAge": "2h",
  "enabled": true
}
```

---

### Story 3.2: Track Tab Activity

**As the** extension  
**I need to** track when tabs were last active  
**So that** I can determine tab age for auto-close rules

**Acceptance Criteria:**
- [ ] Track "last active" timestamp for each tab
- [ ] "Active" = tab was selected/viewed
- [ ] Timestamp updates when tab becomes active
- [ ] New tabs start with current timestamp
- [ ] Activity data persists across browser restarts

**Technical Notes:**
- Use `chrome.tabs.onActivated` to track selection
- Store activity map in chrome.storage.local

---

### Story 3.3: Auto-Close Stale Tabs

**As a** user with auto-close rules defined  
**I want** matching tabs to close automatically when stale  
**So that** my browser stays clean without manual effort

**Acceptance Criteria:**
- [ ] Background script periodically checks tab ages
- [ ] Tabs matching rules AND exceeding max age are closed
- [ ] Check interval is configurable (default: 5 minutes)
- [ ] Auto-close can be paused/resumed globally
- [ ] Pinned tabs are never auto-closed (unless explicitly configured)

---

### Story 3.4: Define Whitelist Rules

**As a** user who wants to protect important tabs  
**I want to** whitelist certain URL patterns from auto-close  
**So that** they're never automatically closed

**Acceptance Criteria:**
- [ ] Whitelist rules take precedence over auto-close rules
- [ ] Same pattern syntax as auto-close rules (glob + regex)
- [ ] Whitelist rules are evaluated first
- [ ] If any whitelist rule matches, tab is protected

**Example:**
```json
{
  "pattern": "*.github.com/*",
  "patternType": "glob",
  "type": "whitelist"
}
```

---

### Story 3.5: Archive Tabs to Bookmarks Before Auto-Close

**As a** user who might need closed tabs later  
**I want** auto-closed tabs to be saved to bookmarks  
**So that** I can recover the URL if needed

**Acceptance Criteria:**
- [ ] Auto-closed tabs are bookmarked before closing
- [ ] Bookmarks are saved to a "Tab Wrangler Archive" folder
- [ ] Archive folder is auto-created if it doesn't exist
- [ ] Bookmark includes: title, URL, date closed
- [ ] Archive exclusion rules can be defined (URL patterns to NOT archive)
- [ ] Exclusion rules support both glob and regex syntax

**Example Exclusion Rules:**
```json
[
  { "pattern": "*.reddit.com/*", "patternType": "glob" },
  { "pattern": "*.twitter.com/*", "patternType": "glob" },
  { "pattern": "*.youtube.com/*", "patternType": "glob" }
]
```

**Technical Notes:**
- Use `chrome.bookmarks` API
- Consider subfolder organization by date or domain

---

### Story 3.6: Undo Auto-Closed Tabs

**As a** user who accidentally had an important tab closed  
**I want to** undo recent auto-closes  
**So that** I can recover tabs I still needed

**Acceptance Criteria:**
- [ ] Recently auto-closed tabs are tracked in memory/storage
- [ ] Recovery window is 1 day (24 hours)
- [ ] Popup shows "Recently Closed" section with undo option
- [ ] Clicking undo reopens the tab at its original URL
- [ ] Entries older than 1 day are automatically purged
- [ ] Maximum of 100 entries stored (oldest purged first)

**Technical Notes:**
- Store in chrome.storage.local: `{ url, title, closedAt, originalTabId }`
- Could also leverage `chrome.sessions.getRecentlyClosed()` as supplement

---

## Epic 4: Extension UI

### Story 4.1: Extension Popup

**As a** user  
**I want** a popup with quick actions  
**So that** I can manage tabs without opening settings

**Acceptance Criteria:**
- [ ] Popup shows current tab/group counts
- [ ] Quick actions: Remove Duplicates, Organize All Tabs
- [ ] Sort actions: Sort by Domain (default), URL, Title, Age
- [ ] Toggle switches: Auto-group enabled, Auto-close enabled
- [ ] "Recently Closed" section showing undo-able tabs (from Story 3.6)
- [ ] Link to full options page
- [ ] Clean, minimal UI that works in Brave vertical tabs

---

### Story 4.2: Options Page

**As a** user  
**I want** a full options page for rule management  
**So that** I can configure all extension behavior

**Acceptance Criteria:**
- [ ] Separate sections for: Grouping Rules, Auto-Close Rules, Whitelist, Archive Exclusions, Settings
- [ ] Rule lists with add/edit/delete/reorder capabilities
- [ ] Pattern type selector (glob/regex) for each rule
- [ ] Import/export rules as JSON
- [ ] All changes save automatically (or with explicit save button)
- [ ] Validation errors shown inline
- [ ] Regex syntax validation with helpful error messages

---

## Epic 5: Brave Browser Compatibility

### Story 5.1: Vertical Tab Bar Support

**As a** Brave browser user with vertical tabs  
**I want** the extension to work correctly  
**So that** grouping and management integrates with my setup

**Acceptance Criteria:**
- [ ] Extension functions correctly in Brave browser
- [ ] Tab groups display properly in vertical tab bar
- [ ] No visual glitches or layout issues
- [ ] Performance is acceptable

**Technical Notes:**
- Brave is Chromium-based, most Chrome APIs should work
- Test specifically with vertical tab bar enabled
- Document any Brave-specific limitations found

---

## Epic 6: Tab Sorting

### Story 6.1: Sort Tabs by Domain

**As a** user with many tabs open  
**I want to** sort all tabs by domain  
**So that** tabs from the same website are grouped together

**Acceptance Criteria:**
- [ ] "Sort by Domain" action available in popup
- [ ] Tabs are reordered so same-domain tabs are adjacent
- [ ] Sort is alphabetical by domain (e.g., `github.com` before `reddit.com`)
- [ ] Subdomains are grouped with their parent domain
- [ ] This is the default/primary sort option
- [ ] Works across all tabs in the current window

**Technical Notes:**
- Use `chrome.tabs.move()` to reorder tabs
- Extract domain from URL for comparison
- Consider: `docs.github.com` groups with `github.com`

---

### Story 6.2: Sort Tabs by URL

**As a** user who wants alphabetical tab order  
**I want to** sort tabs by full URL  
**So that** I have a predictable, consistent order

**Acceptance Criteria:**
- [ ] "Sort by URL" action available in popup/options
- [ ] Tabs are sorted alphabetically by full URL
- [ ] Protocol (http/https) is considered in sort
- [ ] Case-insensitive sorting

---

### Story 6.3: Sort Tabs by Title

**As a** user who organizes by content  
**I want to** sort tabs by page title  
**So that** I can find tabs by their human-readable names

**Acceptance Criteria:**
- [ ] "Sort by Title" action available in popup/options
- [ ] Tabs are sorted alphabetically by page title
- [ ] Case-insensitive sorting
- [ ] Tabs without titles (loading, etc.) sort to end

---

### Story 6.4: Sort Tabs by Age

**As a** user who wants to find old/new tabs  
**I want to** sort tabs by when they were opened  
**So that** I can identify stale tabs or find recent ones

**Acceptance Criteria:**
- [ ] "Sort by Age" action available in popup/options
- [ ] Option to sort oldest-first or newest-first
- [ ] Age is determined by tab creation time (or last activated time)
- [ ] Default: oldest first (helps find stale tabs)

**Technical Notes:**
- Tab creation time may need to be tracked separately (not in Chrome API)
- Could use activity tracking data from Story 3.2

---

### Story 6.5: Preserve Tab Groups When Sorting

**As a** user who uses tab groups  
**I want** sorting to respect my existing groups  
**So that** groups stay intact after sorting

**Acceptance Criteria:**
- [ ] Tabs within groups are sorted together
- [ ] Groups themselves are sorted (by first tab or group name)
- [ ] Ungrouped tabs are sorted separately
- [ ] Option to ignore groups and sort all tabs flat (optional)

**Technical Notes:**
- Use `chrome.tabGroups` API to identify groups
- Sort within groups first, then sort groups relative to each other

---

## Backlog / Future Considerations

- **Session save/restore** - Save tab sessions for later
- **Keyboard shortcuts** - Quick actions via hotkeys
- **Statistics** - Track tabs closed, duplicates removed, etc.
- **Rule templates** - Pre-built rules for common sites
- **Notification on close** - Optional notification when tabs are auto-closed
- **Tab age badge** - Show age indicator on tabs nearing auto-close

---

## Priority Matrix

| Story | Priority | Complexity | MVP |
|-------|----------|------------|-----|
| 1.1 Remove Duplicates | High | Low | ✅ |
| 1.2 Configure Duplicate Detection | Low | Low | ❌ |
| 2.1 Define Grouping Rules | High | Medium | ✅ |
| 2.2 Auto-Group New Tabs | High | Medium | ✅ |
| 2.3 Bulk Organize | Medium | Low | ✅ |
| 3.1 Define Auto-Close Rules | High | Medium | ✅ |
| 3.2 Track Tab Activity | High | Medium | ✅ |
| 3.3 Auto-Close Stale Tabs | High | Medium | ✅ |
| 3.4 Whitelist Rules | Medium | Low | ✅ |
| 3.5 Archive to Bookmarks | High | Medium | ✅ |
| 3.6 Undo Auto-Close | High | Medium | ✅ |
| 4.1 Extension Popup | High | Medium | ✅ |
| 4.2 Options Page | High | High | ✅ |
| 5.1 Brave Compatibility | High | Low | ✅ |
| 6.1 Sort by Domain | High | Low | ✅ |
| 6.2 Sort by URL | Medium | Low | ✅ |
| 6.3 Sort by Title | Medium | Low | ✅ |
| 6.4 Sort by Age | Medium | Low | ✅ |
| 6.5 Preserve Groups When Sorting | Medium | Medium | ✅ |

---

## MVP Summary

**Total MVP Stories:** 18  
**Key Features:**
- ✅ Duplicate removal (URL excluding query params)
- ✅ Rule-based auto-grouping (glob + regex support)
- ✅ Age-based auto-close with whitelists
- ✅ Archive to bookmarks (with exclusions)
- ✅ 1-day undo window for auto-closed tabs
- ✅ **Tab sorting** (by domain, URL, title, age)
- ✅ Extension popup + full options page
- ✅ Brave vertical tab bar support

