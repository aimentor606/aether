import { Metadata } from 'next';
import { getServerPublicEnv } from '@/lib/public-env-server';

export async function generateMetadata({ params }: { params: Promise<{ shareId: string }> }): Promise<Metadata> {
  const { shareId } = await params;

  const title = 'Shared Conversation | Acme';
  const description = 'Replay this Worker conversation on Acme';
  const url = getServerPublicEnv().APP_URL || 'https://www.acme.dev';

  return {
    title,
    description,
    alternates: {
      canonical: `${url}/share/${shareId}`,
    },
    openGraph: {
      title,
      description,
      images: [`${url}/share-page/og-fallback.png`],
    },
    twitter: {
      title,
      description,
      images: `${url}/share-page/og-fallback.png`,
      card: 'summary_large_image',
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
