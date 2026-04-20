import type { Metadata } from 'next';
import FactoryPageClient from './factory-client';

export const metadata: Metadata = {
  title: 'The Autonomy Factory',
  description:
    'We build self-driving companies. The playbook for migrating from human-operated to AI-operated. 76% agents, 24% humans.',
  keywords:
    'Aether, autonomous company, self-driving company, AI-operated, autonomy factory, agent workforce, playbook, company automation',
  openGraph: {
    title: 'The Autonomy Factory — Aether',
    description:
      'We build self-driving companies. The playbook for migrating from human-operated to AI-operated. 76% agents, 24% humans.',
    url: 'https://www.aether.dev/factory',
    images: [
      {
        url: '/images/team.webp',
        width: 1200,
        height: 675,
        alt: 'The Aether team',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Autonomy Factory — Aether',
    description:
      'We build self-driving companies. The playbook for migrating from human-operated to AI-operated. 76% agents, 24% humans.',
    images: ['/images/team.webp'],
  },
  alternates: {
    canonical: 'https://www.aether.dev/factory',
  },
};

export default function FactoryPage() {
  return <FactoryPageClient />;
}
