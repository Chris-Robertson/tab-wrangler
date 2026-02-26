# Tab Wrangler - Product Brief

**Version:** 1.2  
**Date:** December 11, 2025  
**Status:** Requirements Complete

---

## Executive Summary

Tab Wrangler is a Chrome/Brave browser extension that helps power users manage overwhelming tab counts through intelligent automation. It provides duplicate detection, rule-based auto-grouping, and age-based auto-closing to keep browser sessions organized and performant.

---

## Problem Statement

Power users frequently accumulate dozens to hundreds of browser tabs containing important information they don't want to lose. This leads to:

- **Cognitive overload** - difficulty finding relevant tabs
- **Browser performance degradation** - memory and CPU strain
- **Fear of closing tabs** - important information might be lost
- **Manual organization burden** - constant tab housekeeping

---

## Vision

> *For people who often have dozens of Chrome tabs open, Tab Wrangler helps them group and reduce their tabs through intelligent, rule-based automation.*

---

## Target Users

### Primary Persona: The Technical Power User

- Comfortable writing URL matching rules (regex, glob patterns)
- Regularly works with 30-100+ tabs open
- Values control and customization over "magic" automation
- Likely a developer, researcher, or knowledge worker
- Uses Brave browser with vertical tab bar

### User Characteristics

| Attribute | Description |
|-----------|-------------|
| Technical Comfort | High - can write URL patterns |
| Tab Count | 30-100+ typically open |
| Browser | Chrome/Brave (Chromium-based) |
| Pain Point | Important tabs buried in chaos |
| Desired Control | High - rule-based, not AI-guessed |

---

## Core Features (MVP)

### 1. Duplicate Tab Removal

**Description:** Detect and remove duplicate tabs based on URL matching.

**Key Behaviors:**
- Identify tabs with identical URLs
- Option to keep newest or oldest duplicate
- Visual indicator of duplicates before removal
- Configurable: exact URL match vs. normalized match (ignore query params, anchors)

---

### 2. Auto-Group Tabs (Rule-Based)

**Description:** Automatically organize tabs into Chrome tab groups based on user-defined URL rules.

**Key Behaviors:**
- User defines rules mapping URL patterns → group names
- Rules support glob patterns and/or regex
- New tabs matching rules are auto-grouped
- Existing tabs can be bulk-organized on demand
- Groups have customizable colors and names

**Example Rules:**
```
*.github.com/* → "GitHub" (blue)
*.stackoverflow.com/* → "Stack Overflow" (orange)
*docs.* → "Documentation" (green)
```

---

### 3. Auto-Close Tabs (URL + Age Based)

**Description:** Automatically close tabs that match certain patterns and have been inactive for a configurable duration.

**Key Behaviors:**
- User defines rules: URL pattern + max age
- Tabs matching pattern are closed after age threshold
- Whitelist rules to protect important tabs
- Optional: archive to bookmarks before closing
- Activity tracking: "inactive" means not viewed/interacted with

**Example Rules:**
```
*.reddit.com/* → close after 2 hours
*.twitter.com/* → close after 1 hour
*.github.com/* → never auto-close (whitelist)
```

---

### 4. Tab Sorting

**Description:** Sort all tabs in the current window by various criteria to bring order to chaos.

**Key Behaviors:**
- Sort by domain (default) - groups same-site tabs together
- Sort by full URL - alphabetical ordering
- Sort by title - alphabetical by page title
- Sort by age - oldest or newest first
- One-click action from popup
- Preserves tab groups (sorts within groups, then sorts groups)

**Sort Options:**
| Sort By | Description |
|---------|-------------|
| Domain | `github.com` tabs together, `reddit.com` tabs together, etc. |
| URL | Full URL alphabetical sort |
| Title | Page title alphabetical sort |
| Age (oldest) | Longest-open tabs first |
| Age (newest) | Most recently opened tabs first |

---

## Technical Constraints

| Constraint | Details |
|------------|---------|
| **Browser Compatibility** | Must work with Brave browser vertical tab bar |
| **Platform** | Chrome Extension Manifest V3 |
| **Performance** | Minimal memory/CPU footprint |
| **Storage** | User rules stored in chrome.storage.sync |

---

## Success Metrics

This is a **personal use project** - success is measured by:

1. ✅ Personal satisfaction with tab management
2. ✅ Reduction in manual tab housekeeping time
3. ✅ Fewer "lost" important tabs
4. ✅ Browser remains performant with extension active

---

## Out of Scope (v1)

- Public Chrome Web Store publication
- User accounts / cloud sync beyond chrome.storage
- AI/ML-based automatic categorization
- Cross-browser support (Firefox, Safari)
- Tab session saving/restoration (separate concern)

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Rule syntax** | Both glob AND regex | Maximum flexibility for technical users |
| **Duplicate detection** | URL excluding query params (default) | Most practical default; query params often vary |
| **Undo auto-close** | Yes, 1-day recovery window | Safety net for accidental closures |
| **Archive on close** | Yes, with exclusion rules | Preserve important content; exclude noisy sites |

### Rule Pattern Syntax

Users can write rules using either syntax:

**Glob patterns** (simpler):
```
*.github.com/*
*stackoverflow.com*
```

**Regex patterns** (powerful):
```
/^https:\/\/github\.com\/.*/
/reddit\.com\/r\/\w+/
```

Rules specify their type: `{ "pattern": "...", "type": "glob" | "regex" }`

### Archive Exclusion Rules

Auto-closed tabs are bookmarked to a "Tab Wrangler Archive" folder, EXCEPT for URLs matching exclusion patterns:
```
*.reddit.com/*     → don't archive (too noisy)
*.twitter.com/*    → don't archive
*.youtube.com/*    → don't archive
```

---

## Open Questions

1. ~~**Rule syntax:** Glob patterns, regex, or both?~~ ✅ **Decided: Both**
2. ~~**Duplicate handling:** What constitutes a "duplicate"?~~ ✅ **Decided: URL excluding query params**
3. **Brave vertical tabs:** Any API limitations or special considerations? *(Needs research)*
4. ~~**Undo mechanism:** Should auto-closed tabs be recoverable?~~ ✅ **Decided: Yes, 1 day**

---

## Next Steps

1. [x] Finalize rule syntax design
2. [x] Create user stories for MVP features
3. [ ] Research Brave vertical tab bar compatibility
4. [ ] Design extension popup/options UI
5. [ ] Create technical architecture document

