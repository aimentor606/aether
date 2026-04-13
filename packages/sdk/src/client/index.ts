/**
 * @acme/sdk/client — React-specific hooks and providers.
 *
 * This module depends on React. Import from '@acme/sdk/client' in React components only.
 * The core SDK modules (@acme/sdk/api, @acme/sdk/auth, etc.) are React-free.
 */

export { useQuery } from './hooks/use-query';
export { ApiClientProvider, useApiClient } from './providers/api-client-provider';
export { useFinance } from './hooks/use-finance';
export { useLiteLLMAdmin } from './hooks/use-litellm-admin';
