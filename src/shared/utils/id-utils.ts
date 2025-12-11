/**
 * ID generation utilities
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a new UUID
 */
export function generateId(): string {
  return uuidv4();
}

