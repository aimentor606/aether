/**
 * Utility Functions
 *
 * General-purpose utility functions and helpers
 */

// Core utilities
export * from './utils';
export * from './uuid';
export * from './date';
export * from './search';

// Theme & styling
export * from './theme';
export * from './fonts';
export * from './icon-mapping';

// Parsing & formatting
// message-grouping moved to @agentpress/shared/utils
// tool-parser moved to @agentpress/shared/tools
// tool-display moved to @agentpress/shared/tools
// credit-formatter moved to @agentpress/shared
export {
  formatCredits,
  formatCreditsWithSign,
  dollarsToCredits,
  creditsToDollars,
  formatDollarsAsCredits,
  CREDITS_PER_DOLLAR,
} from '@agentpress/shared';

// Streaming & tool call utilities (portable from frontend)
// streaming-utils moved to @agentpress/shared/streaming
export {
  parseToolCallArguments,
  normalizeToolName,
  getToolDisplayParam,
  parseToolCallForDisplay,
  extractAndParseToolCalls,
  isFileOperationTool,
  isCommandTool,
  isWebTool,
  getToolCategory,
  type ToolCategory,
  type ParsedToolCallData,
  type ToolResultData as ToolResultDataFromShared,
} from './tool-call-utils';
export {
  type ToolCallData,
  type ToolResultData,
  extractToolCall,
  extractToolResult,
  extractToolCallFromToolMessage,
  extractToolData,
  extractToolCallAndResult,
} from './tool-data-extractor';

// Domain-specific utilities
export * from './thread-utils';
export * from './trigger-utils';
export * from './model-provider';
export * from './error-handler';

// Type definitions
export * from './auth-types';

// i18n
export * from './i18n';
