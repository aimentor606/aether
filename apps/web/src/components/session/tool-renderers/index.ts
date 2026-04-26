// Barrel exports for tool-renderers
// Re-exports the same public API as the original tool-renderers.tsx

// Public API exports
export { ToolRegistry } from './registry';
export { BasicTool } from './shared';
export { ToolError } from './tool-error';
export { GenericTool } from './generic-tool';
export { ToolPartRenderer } from './tool-part-renderer';

// Re-export types used by consumers
export type { ToolProps, ToolComponent } from './shared';

// Tool registrations (side-effect imports — each file registers its tools with ToolRegistry)
import './memory-tools';
import './bash-tool';
import './pty-tools';
import './file-tools';
import './search-tools';
import './web-tools';
import './media-tools';
import './dcp-tools';
import './integration-tools';
import './task-tool';
import './session-tools';
import './agent-tools';
import './task-manage-tools';
import './project-tools';
