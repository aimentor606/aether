'use client';

import React from 'react';
import type { A2UIBlock, A2UICatalog } from '@acme/sdk/a2ui';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = React.ComponentType<any>;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface A2UIRendererProps {
  blocks: A2UIBlock[];
  catalog: A2UICatalog<AnyComponent>;
  fallback?: React.ComponentType<{ block: A2UIBlock }>;
}

interface BlockRendererProps {
  block: A2UIBlock;
  catalog: A2UICatalog<AnyComponent>;
  fallback?: React.ComponentType<{ block: A2UIBlock }>;
}

// ─── Default Fallback ─────────────────────────────────────────────────────────

function DefaultFallback({ block }: { block: A2UIBlock }) {
  return <div data-a2ui-type={block.type} data-a2ui-id={block.id} style={{ display: 'none' }} />;
}

// ─── Block Renderer ───────────────────────────────────────────────────────────

function BlockRenderer({ block, catalog, fallback }: BlockRendererProps): React.ReactElement | null {
  const Component = catalog.resolve(block.type);

  if (!Component) {
    const Fallback = fallback ?? DefaultFallback;
    return <Fallback block={block} />;
  }

  // Separate children from rest of props
  const { children: _children, ...restProps } = block.props ?? {};

  return (
    <Component {...restProps}>
      {block.children?.length
        ? block.children.map((child) => (
            <BlockRenderer key={child.id} block={child} catalog={catalog} fallback={fallback} />
          ))
        : undefined}
    </Component>
  );
}

// ─── Public Components ────────────────────────────────────────────────────────

/**
 * Renders an A2UI block tree using a component catalog.
 *
 * The catalog maps block `type` strings to React components.
 * Each component receives `block.props` (minus children) as its props.
 * Children blocks are rendered recursively as React children.
 */
export function A2UIRenderer({ blocks, catalog, fallback }: A2UIRendererProps) {
  if (!blocks?.length) return null;

  return (
    <>
      {blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} catalog={catalog} fallback={fallback} />
      ))}
    </>
  );
}

/**
 * Renders a single A2UI block.
 */
export function A2UIBlockRenderer({ block, catalog, fallback }: BlockRendererProps) {
  return <BlockRenderer block={block} catalog={catalog} fallback={fallback} />;
}
