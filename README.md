# Tab Wrangler

A Chrome/Brave browser extension for intelligently managing, grouping, and cleaning up browser tabs with rule-based automation.

## Features

- **Duplicate Removal** - Detect and remove duplicate tabs (URL excluding query params)
- **Auto-Grouping** - Rule-based tab organization using glob or regex patterns
- **Auto-Close** - Age-based tab cleanup with whitelists
- **Tab Sorting** - Sort by domain, URL, title, or age
- **Archive & Undo** - Bookmark closed tabs with a 1-day undo window

## Development

### Prerequisites

- Node.js 18+
- npm or pnpm

### Setup

```bash
# Install dependencies
npm install

# Start development server with HMR
npm run dev

# Build for production
npm run build
```

### Load Extension in Browser

1. Run `npm run dev` to start the development server
2. Open Chrome/Brave and navigate to `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `dist` folder

### Project Structure

```
src/
├── background/          # Service worker
│   ├── index.ts         # Entry point
│   └── modules/         # Business logic modules
├── popup/               # Extension popup UI
│   ├── App.tsx          # Main component
│   └── components/      # UI components
├── options/             # Settings page
│   ├── App.tsx          # Main component
│   └── styles/          # Page styles
├── shared/              # Shared code
│   ├── types/           # TypeScript types
│   ├── utils/           # Utility functions
│   ├── constants.ts     # Constants and defaults
│   └── messaging.ts     # Type-safe messaging
└── assets/              # Icons and images
```

## Tech Stack

- **TypeScript** - Type-safe development
- **Preact** - Lightweight React alternative (~3KB)
- **Vite** - Fast build tool with HMR
- **CRXJS** - Chrome extension Vite plugin
- **Manifest V3** - Modern extension platform

## Configuration

Rules are stored in `chrome.storage.sync` and sync across devices. Settings can be managed from the Options page.

### Pattern Syntax

Rules support two pattern types:

**Glob patterns:**
```
*.github.com/*
*stackoverflow.com*
```

**Regex patterns:**
```
/^https:\/\/github\.com\/.*/
/reddit\.com\/r\/\w+/
```

## License

MIT
