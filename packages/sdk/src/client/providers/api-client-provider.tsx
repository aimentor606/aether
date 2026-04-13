'use client';

import { createContext, useContext } from 'react';
import type { ApiClient } from '../../api/types';

const ApiClientContext = createContext<ApiClient | null>(null);

export function ApiClientProvider({
  client,
  children,
}: {
  client: ApiClient;
  children: React.ReactNode;
}) {
  return (
    <ApiClientContext.Provider value={client}>
      {children}
    </ApiClientContext.Provider>
  );
}

export function useApiClient(): ApiClient {
  const client = useContext(ApiClientContext);
  if (!client) {
    throw new Error('useApiClient must be used within an ApiClientProvider');
  }
  return client;
}
