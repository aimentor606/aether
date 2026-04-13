/**
 * A2UI Protocol Types
 *
 * Framework-agnostic types for the A2UI rendering protocol.
 * React component mapping lives in @acme/ui/a2ui, not here.
 */

export interface A2UIBlock {
  type: string;
  id: string;
  props?: Record<string, unknown>;
  children?: A2UIBlock[];
}

export interface A2UISurface {
  surfaceId: string;
  title?: string;
  description?: string;
  blocks: A2UIBlock[];
}

export interface A2UIAction {
  blockId: string;
  action: string;
  payload: Record<string, unknown>;
}

/**
 * Generic catalog — component type is left as `unknown`.
 * The UI layer (@acme/ui) casts to React.ComponentType when rendering.
 */
export interface A2UICatalog<TComponent = unknown> {
  name: string;
  register(type: string, component: TComponent): void;
  resolve(type: string): TComponent | null;
  has(type: string): boolean;
  extend(parent: A2UICatalog<TComponent>): A2UICatalog<TComponent>;
}

export type A2UIStreamEvent =
  | { type: 'block'; block: A2UIBlock }
  | { type: 'done' }
  | { type: 'error'; error: string };
