import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Keys | Aether',
  description: 'Manage your API keys for programmatic access to Aether',
  openGraph: {
    title: 'API Keys | Aether',
    description: 'Manage your API keys for programmatic access to Aether',
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
