import type { A2UIBlock } from './types';

const REQUIRED_BLOCK_FIELDS = ['type', 'id'] as const;

export function validateA2UIBlock(block: unknown): block is A2UIBlock {
  if (typeof block !== 'object' || block === null) return false;

  const obj = block as Record<string, unknown>;

  for (const field of REQUIRED_BLOCK_FIELDS) {
    if (typeof obj[field] !== 'string') return false;
  }

  return true;
}
