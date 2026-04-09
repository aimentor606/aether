import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Keys | Acme',
  description: 'Manage your API keys for programmatic access to Acme',
  openGraph: {
    title: 'API Keys | Acme',
    description: 'Manage your API keys for programmatic access to Acme',
    type: 'website',
  },
};

export default async function APIKeysLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
