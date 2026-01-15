/**
 * Tab Wrangler - Service Worker Entry Point
 * 
 * This is the background script that runs as a service worker in Manifest V3.
 * It handles all tab operations, rule processing, and event listeners.
 */

import { StorageService } from './modules/storage-service';
import { DuplicateDetector } from './modules/duplicate-detector';
import { AutoGroupManager } from './modules/auto-group-manager';
import { ALARM_AUTO_CLOSE_CHECK } from '@shared/constants';

// Initialize services
const storage = new StorageService();
const duplicateDetector = new DuplicateDetector(storage);
const autoGroupManager = new AutoGroupManager(storage);

/**
 * Extension installation handler
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // First install - initialize default settings
    await storage.initializeDefaults();
  }

  // Set up alarms for periodic tasks
  await setupAlarms();
});

/**
 * Extension startup handler
 */
chrome.runtime.onStartup.addListener(async () => {
  await setupAlarms();
});

/**
 * Set up periodic alarms
 */
async function setupAlarms(): Promise<void> {
  const settings = await storage.getSettings();

  // Auto-close check alarm
  if (settings.autoCloseEnabled) {
    const periodInMinutes = settings.autoCloseCheckInterval / (60 * 1000);
    chrome.alarms.create(ALARM_AUTO_CLOSE_CHECK, {
      periodInMinutes,
    });
  } else {
    chrome.alarms.clear(ALARM_AUTO_CLOSE_CHECK);
  }
}

/**
 * Alarm handler
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_AUTO_CLOSE_CHECK) {
    // TODO: Implement auto-close check
  }
});

/**
 * Tab created handler
 */
chrome.tabs.onCreated.addListener(async (tab) => {
  // Auto-group if URL is available (AC1)
  if (tab.url) {
    try {
      await autoGroupManager.autoGroupTab(tab.id!, tab.url, tab.windowId);
    } catch (error) {
      console.error('[Background] Failed to auto-group new tab:', error);
    }
  }
});

/**
 * Tab updated handler (URL changes)
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    // Auto-group on URL change (AC1)
    try {
      await autoGroupManager.autoGroupTab(tabId, changeInfo.url, tab.windowId);
    } catch (error) {
      console.error('[Background] Failed to auto-group updated tab:', error);
    }
  }
});

/**
 * Tab activated handler (user switched to tab)
 */
chrome.tabs.onActivated.addListener(async (_activeInfo) => {
  // TODO: Update tab activity timestamp
});

/**
 * Tab removed handler
 */
chrome.tabs.onRemoved.addListener(async (_tabId, _removeInfo) => {
  // TODO: Clean up tab activity data
});

/**
 * Message handler for popup/options communication
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Handle async responses
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      console.error('Message handler error:', error);
      sendResponse({ success: false, message: error.message });
    });

  // Return true to indicate async response
  return true;
});

/**
 * Handle incoming messages
 */
async function handleMessage(message: unknown): Promise<unknown> {
  if (!message || typeof message !== 'object' || !('type' in message)) {
    throw new Error('Invalid message format');
  }

  const msg = message as { type: string };

  switch (msg.type) {
    case 'GET_STATS':
      return getStats();

    case 'GET_DUPLICATE_COUNT': {
      const settings = await storage.getSettings();
      const count = await duplicateDetector.getDuplicateCount(settings.duplicateDetectionMode);
      return { success: true, count };
    }

    case 'REMOVE_DUPLICATES': {
      const settings = await storage.getSettings();
      const keepStrategy = (msg as { keepStrategy?: 'oldest' | 'newest' }).keepStrategy ?? 'oldest';
      const result = await duplicateDetector.removeDuplicates(
        settings.duplicateDetectionMode,
        keepStrategy
      );
      return { success: true, count: result.removed.length };
    }

    case 'ORGANIZE_ALL_TABS':
      // TODO: Implement
      return { success: true, count: 0 };

    case 'SORT_TABS':
      // TODO: Implement
      return { success: true };

    case 'UNDO_CLOSE': {
      const entryId = (msg as { type: string; entryId: string }).entryId;
      const { recentlyClosed } = await storage.getLocalStorage();
      
      // Find the entry to restore
      const entryIndex = recentlyClosed.findIndex(entry => entry.id === entryId);
      if (entryIndex === -1) {
        return { success: false, message: 'Entry not found' };
      }
      
      const entry = recentlyClosed[entryIndex];
      
      // Reopen the tab
      await chrome.tabs.create({ url: entry.url, active: false });
      
      // Remove from recentlyClosed list
      const updatedRecentlyClosed = [
        ...recentlyClosed.slice(0, entryIndex),
        ...recentlyClosed.slice(entryIndex + 1),
      ];
      await storage.updateLocalStorage({ recentlyClosed: updatedRecentlyClosed });
      
      return { success: true };
    }

    case 'TOGGLE_AUTO_GROUP': {
      const enabled = (msg as { type: string; enabled: boolean }).enabled;
      await storage.updateSettings({ autoGroupEnabled: enabled });
      return { success: true };
    }

    case 'TOGGLE_AUTO_CLOSE': {
      const enabled = (msg as { type: string; enabled: boolean }).enabled;
      await storage.updateSettings({ autoCloseEnabled: enabled });
      await setupAlarms();
      return { success: true };
    }

    default:
      throw new Error(`Unknown message type: ${msg.type}`);
  }
}

/**
 * Get extension stats for the popup
 */
async function getStats() {
  const tabs = await chrome.tabs.query({});
  const groups = await chrome.tabGroups.query({});
  const { recentlyClosed } = await storage.getLocalStorage();
  const settings = await storage.getSettings();

  // Calculate real duplicate count
  const duplicateCount = await duplicateDetector.getDuplicateCount(settings.duplicateDetectionMode);

  return {
    tabCount: tabs.length,
    groupCount: groups.length,
    duplicateCount,
    recentlyClosedCount: recentlyClosed?.length ?? 0,
  };
}

