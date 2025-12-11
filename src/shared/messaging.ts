/**
 * Type-safe messaging between extension components
 */

import type { SortOrder } from './types';

/** Message types for communication between popup/options and service worker */
export type Message =
  | { type: 'GET_STATS' }
  | { type: 'REMOVE_DUPLICATES' }
  | { type: 'ORGANIZE_ALL_TABS' }
  | { type: 'SORT_TABS'; sortOrder: SortOrder }
  | { type: 'UNDO_CLOSE'; entryId: string }
  | { type: 'TOGGLE_AUTO_GROUP'; enabled: boolean }
  | { type: 'TOGGLE_AUTO_CLOSE'; enabled: boolean };

/** Response types for messages */
export interface StatsResponse {
  tabCount: number;
  groupCount: number;
  duplicateCount: number;
  recentlyClosedCount: number;
}

export interface ActionResponse {
  success: boolean;
  message?: string;
  count?: number;
}

/** Send a message to the service worker */
export async function sendMessage<T>(message: Message): Promise<T> {
  return chrome.runtime.sendMessage(message);
}

/** Type guard for message types */
export function isMessage(obj: unknown): obj is Message {
  return typeof obj === 'object' && obj !== null && 'type' in obj;
}

