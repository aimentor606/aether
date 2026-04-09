/**
 * Thread utilities for rendering tool calls and messages
 */

// Re-export shared utilities (used by AcmeComputer Desktop/Dock)
export { getUserFriendlyToolName } from '@acme/shared';

// Re-export getToolIcon from frontend icon resolver
export { getToolIcon } from '@/lib/icons/tool-icons';

// Frontend-specific flags
export const HIDE_BROWSER_TAB = true;
