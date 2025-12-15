/**
 * Pattern matching utilities for glob and regex patterns
 */

import micromatch from 'micromatch';
import type { PatternType } from '../types';

/**
 * Match a URL against a pattern
 */
export function matchPattern(
  url: string,
  pattern: string,
  patternType: PatternType
): boolean {
  try {
    if (patternType === 'glob') {
      return micromatch.isMatch(url, pattern);
    }
    const regex = new RegExp(pattern);
    return regex.test(url);
  } catch {
    // Invalid pattern - treat as no match
    console.warn(`Invalid ${patternType} pattern:`, pattern);
    return false;
  }
}

/**
 * Validate a pattern without matching
 */
export function validatePattern(
  pattern: string,
  patternType: PatternType
): { valid: boolean; error?: string } {
  if (!pattern.trim()) {
    return { valid: false, error: 'Pattern cannot be empty' };
  }

  try {
    if (patternType === 'regex') {
      new RegExp(pattern);
    }
    // Glob patterns are more permissive, but we can try to parse
    if (patternType === 'glob') {
      micromatch.isMatch('test', pattern);
    }
    return { valid: true };
  } catch (e) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : 'Invalid pattern',
    };
  }
}

/**
 * Find the first matching rule from a list
 */
export function findFirstMatchingRule<T extends { pattern: string; patternType: PatternType; enabled?: boolean }>(
  url: string,
  rules: T[]
): T | null {
  for (const rule of rules) {
    // Skip disabled rules if the enabled property exists
    if ('enabled' in rule && !rule.enabled) continue;
    
    if (matchPattern(url, rule.pattern, rule.patternType)) {
      return rule;
    }
  }
  return null;
}

/**
 * Check if URL matches any rule in a list
 */
export function matchesAnyRule<T extends { pattern: string; patternType: PatternType; enabled?: boolean }>(
  url: string,
  rules: T[]
): boolean {
  return findFirstMatchingRule(url, rules) !== null;
}

