/**
 * Tab Wrangler - Service Worker Entry Point
 * 
 * This is the background script that runs as a service worker in Manifest V3.
 * It handles all tab operations, rule processing, and event listeners.
 */

import { StorageService } from './modules/storage-service';
import { ALARM_AUTO_CLOSE_CHECK } from '@shared/constants';

// Initialize storage service
const storage = new StorageService();

/**
 * Extension installation handler
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Tab Wrangler installed:', details.reason);

  if (details.reason === 'install') {
    // First install - initialize default settings
    await storage.initializeDefaults();
    console.log('Initialized default settings');
  }

  // Set up alarms for periodic tasks
  await setupAlarms();
});

/**
 * Extension startup handler
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log('Tab Wrangler started');
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
    console.log(`Auto-close alarm set for every ${periodInMinutes} minutes`);
  } else {
    chrome.alarms.clear(ALARM_AUTO_CLOSE_CHECK);
  }
}

/**
 * Alarm handler
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('Alarm fired:', alarm.name);

  if (alarm.name === ALARM_AUTO_CLOSE_CHECK) {
    // TODO: Implement auto-close check
    console.log('Running auto-close check...');
  }
});

/**
 * Tab created handler
 */
chrome.tabs.onCreated.addListener(async (tab) => {
  console.log('Tab created:', tab.id);
  // TODO: Track tab activity
});

/**
 * Tab updated handler (URL changes)
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    console.log('Tab URL updated:', tabId, changeInfo.url);
    // TODO: Check auto-group rules and apply
  }
});

/**
 * Tab activated handler (user switched to tab)
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  console.log('Tab activated:', activeInfo.tabId);
  // TODO: Update tab activity timestamp
});

/**
 * Tab removed handler
 */
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  console.log('Tab removed:', tabId);
  // TODO: Clean up tab activity data
});

/**
 * Message handler for popup/options communication
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message);

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

    case 'REMOVE_DUPLICATES':
      // TODO: Implement
      return { success: true, count: 0 };

    case 'ORGANIZE_ALL_TABS':
      // TODO: Implement
      return { success: true, count: 0 };

    case 'SORT_TABS':
      // TODO: Implement
      return { success: true };

    case 'UNDO_CLOSE':
      // TODO: Implement
      return { success: true };

    case 'TOGGLE_AUTO_GROUP': {
      const settings = await storage.getSettings();
      await storage.updateSettings({ ...settings, autoGroupEnabled: (msg as { enabled: boolean }).enabled });
      return { success: true };
    }

    case 'TOGGLE_AUTO_CLOSE': {
      const settings = await storage.getSettings();
      await storage.updateSettings({ ...settings, autoCloseEnabled: (msg as { enabled: boolean }).enabled });
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

  // TODO: Calculate duplicate count

  return {
    tabCount: tabs.length,
    groupCount: groups.length,
    duplicateCount: 0,
    recentlyClosedCount: recentlyClosed?.length ?? 0,
  };
}

console.log('Tab Wrangler service worker loaded');

