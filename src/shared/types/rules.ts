/**
 * Rule type definitions for Tab Wrangler
 */

/** Chrome's available tab group colors */
export type TabGroupColor = 
  | 'grey' 
  | 'blue' 
  | 'red' 
  | 'yellow' 
  | 'green' 
  | 'pink' 
  | 'purple' 
  | 'cyan' 
  | 'orange';

/** Pattern matching type */
export type PatternType = 'glob' | 'regex';

/** Base rule interface */
export interface BaseRule {
  id: string;
  pattern: string;
  patternType: PatternType;
  enabled: boolean;
}

/** Rule for auto-grouping tabs */
export interface GroupingRule extends BaseRule {
  groupName: string;
  groupColor: TabGroupColor;
  order: number; // Lower = higher priority
}

/** Rule for auto-closing tabs */
export interface AutoCloseRule extends BaseRule {
  maxAge: number; // Duration in milliseconds
}

/** Rule for whitelisting tabs from auto-close */
export interface WhitelistRule extends BaseRule {}

/** Rule for excluding URLs from archive */
export interface ArchiveExclusionRule {
  id: string;
  pattern: string;
  patternType: PatternType;
}

/** Duplicate detection modes */
export type DuplicateDetectionMode = 
  | 'exact' 
  | 'ignoreParams' 
  | 'ignoreAnchors' 
  | 'ignoreBoth';

/** Sort order options */
export type SortOrder = 
  | 'domain' 
  | 'url' 
  | 'title' 
  | 'ageOldest' 
  | 'ageNewest';

