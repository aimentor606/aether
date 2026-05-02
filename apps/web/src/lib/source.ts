import * as sourceModule from '@/.source';
import { loader } from 'fumadocs-core/source';

type FumadocsSourceLike = {
  files?: unknown;
};

type DocsLike = {
  toFumadocsSource: () => FumadocsSourceLike;
};

function isDocsLike(value: unknown): value is DocsLike {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.toFumadocsSource === 'function';
}

const docsValue: unknown = (sourceModule as Record<string, unknown>).docs;
const mdxSource = isDocsLike(docsValue)
  ? docsValue.toFumadocsSource()
  : { files: [] };
const mdxFiles = mdxSource.files;

const resolvedFiles =
  Array.isArray(mdxFiles)
    ? mdxFiles
    : typeof mdxFiles === 'function'
      ? (mdxFiles as () => unknown[])()
      : [];

export const source = loader({
  baseUrl: '/docs',
  source: {
    // fumadocs-mdx can return files as a function, but fumadocs-core expects an array
    files: resolvedFiles,
  },
});
