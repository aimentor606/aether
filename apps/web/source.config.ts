import { defineDocs, defineConfig } from 'fumadocs-mdx/config';

export const docs: unknown = defineDocs({
  dir: 'content/docs',
});

export default defineConfig();
