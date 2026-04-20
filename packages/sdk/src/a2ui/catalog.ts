import type { A2UICatalog } from './types';

/**
 * Create an A2UI component catalog.
 * Generic over component type — the UI layer provides React.ComponentType.
 */
export function createCatalog<TComponent = unknown>(
  name: string,
  components?: Record<string, TComponent>,
): A2UICatalog<TComponent> {
  const map = new Map<string, TComponent>();

  if (components) {
    for (const [key, component] of Object.entries(components)) {
      map.set(key, component);
    }
  }

  return {
    name,
    register(type: string, component: TComponent) {
      map.set(type, component);
    },
    resolve(type: string): TComponent | null {
      return map.get(type) ?? null;
    },
    has(type: string): boolean {
      return map.has(type);
    },
    extend(parent: A2UICatalog<TComponent>): A2UICatalog<TComponent> {
      const merged = createCatalog<TComponent>(`${parent.name}+${name}`);
      // Copy parent entries
      for (const entry of map) {
        merged.register(entry[0], entry[1]);
      }
      return merged;
    },
  };
}
