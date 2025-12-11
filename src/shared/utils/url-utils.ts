/**
 * URL manipulation utilities
 */

import type { DuplicateDetectionMode } from '../types';

/**
 * Normalize a URL based on the duplicate detection mode
 */
export function normalizeUrl(
  url: string,
  mode: DuplicateDetectionMode
): string {
  try {
    const parsed = new URL(url);

    switch (mode) {
      case 'exact':
        return url;

      case 'ignoreParams':
        parsed.search = '';
        return parsed.toString();

      case 'ignoreAnchors':
        parsed.hash = '';
        return parsed.toString();

      case 'ignoreBoth':
        parsed.search = '';
        parsed.hash = '';
        return parsed.toString();

      default:
        return url;
    }
  } catch {
    // Invalid URL, return as-is
    return url;
  }
}

/**
 * Extract the domain from a URL
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return url;
  }
}

/**
 * Extract the base domain (without subdomain) from a URL
 * e.g., "docs.github.com" -> "github.com"
 */
export function extractBaseDomain(url: string): string {
  const hostname = extractDomain(url);
  const parts = hostname.split('.');
  
  // Handle cases like "localhost" or IP addresses
  if (parts.length <= 2) {
    return hostname;
  }
  
  // Return last two parts (simplified - doesn't handle .co.uk etc.)
  return parts.slice(-2).join('.');
}

/**
 * Check if a URL is a valid http/https URL
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Check if a URL is a Chrome internal page
 */
export function isChromeInternalUrl(url: string): boolean {
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('about:') ||
    url.startsWith('edge://') ||
    url.startsWith('brave://')
  );
}

