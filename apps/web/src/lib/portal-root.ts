'use client';

let portalRoot: HTMLElement | null = null;

/**
 * Returns a stable dedicated portal root for UI overlays.
 *
 * Avoids mounting dialogs directly into document.body, which can be fragile
 * when multiple portals mount/unmount during redirects, modal nesting, or
 * browser DOM mutations. A single dedicated root makes portal ordering stable.
 */
export function getPortalRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  if (portalRoot && document.body.contains(portalRoot)) return portalRoot;

  const existing = document.getElementById('aether-portal-root');
  if (existing) {
    portalRoot = existing;
    return portalRoot;
  }

  const el = document.createElement('div');
  el.id = 'aether-portal-root';
  el.setAttribute('data-aether-portal-root', 'true');
  document.body.appendChild(el);
  portalRoot = el;
  return portalRoot;
}
