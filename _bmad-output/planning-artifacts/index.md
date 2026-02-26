# Tab Wrangler - Documentation Index

**Project:** Tab Wrangler Chrome/Brave Extension  
**Status:** Architecture Complete  
**Last Updated:** December 11, 2025

---

## 📁 Documentation Structure

```
_bmad-output/planning-artifacts/
└── implementation-artifacts/        # Implementation workflow output
    └── (implementation docs go here)
└── planning-artifacts/        # Sprint-specific deliverables
    ├── index.md                 # This file - documentation index
    ├── product-brief.md         # Vision, goals, constraints
    ├── user-stories.md          # Epics and user stories with acceptance criteria
    └── architecture.md      # System design & data models
```

---

## 📋 Project Documents

| Document | Description | Status |
|----------|-------------|--------|
| [Product Brief](./product-brief.md) | Vision, target users, features, constraints | ✅ Complete |
| [User Stories](./user-stories.md) | 6 Epics, 18 MVP stories with acceptance criteria | ✅ Complete |
| [Architecture](./architecture.md) | Tech stack, components, data models, file structure | ✅ Complete |

---

## 🎯 Quick Links

### Core Features (MVP)
1. **Duplicate Removal** - Detect and remove duplicate tabs (URL excluding query params)
2. **Auto-Grouping** - Rule-based tab organization (glob + regex)
3. **Auto-Close** - Age-based tab cleanup with whitelists
4. **Tab Sorting** - Sort by domain, URL, title, or age
5. **Archive & Undo** - Bookmark closed tabs, 1-day undo window

### Tech Stack
- **TypeScript** + **Preact** + **Vite**
- Chrome Extension **Manifest V3**
- **CRXJS** Vite plugin for development

### Key Constraints
- Must work with Brave browser vertical tab bar
- Personal use (no Web Store publication planned)
- Technical users comfortable with URL patterns (glob/regex)

---

## 🚀 Getting Started

### For Development
1. Review [Product Brief](./product-brief.md) for project context
2. Review [User Stories](./user-stories.md) for implementation requirements
3. Review [Architecture](./architecture.md) for technical design
4. Check sprint-artifacts/ for current sprint focus

### Next Steps
- [x] Define product requirements
- [x] Create user stories
- [x] Design technical architecture
- [ ] Set up project (Vite + CRXJS + TypeScript)
- [ ] Sprint 1 planning
- [ ] Begin implementation

---

## 📊 Project Status

**Phase:** Ready for Implementation  
**Completed:**
- ✅ Product Brief (v1.2)
- ✅ User Stories (18 MVP stories across 6 epics)
- ✅ Technical Architecture

**Next Milestone:** Project Setup & Sprint 1
