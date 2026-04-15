import type { Metadata } from 'next';
import AboutPageClient from './about-client';

export const metadata: Metadata = {
  title: 'About',
  description:
    'We build self-driving companies. 76% agents, 24% humans — where humans verify, steer, and govern. Agents do the work. Full agent teams doing engineering, product, operations, finance, support, and growth.',
  keywords:
    'Aether, about Aether, self-driving company, AI-operated company, autonomous operations, agent workforce, AI agents, company automation',
  openGraph: {
    title: 'About Aether – Building Self-Driving Companies',
    description:
      'We take process-heavy companies and turn them into AI-operated ones. Full agent teams doing engineering, product, operations, finance, support, and growth.',
    url: 'https://www.aether.dev/about',
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
    title: 'About Aether – Building Self-Driving Companies',
    description:
      'We take process-heavy companies and turn them into AI-operated ones. Full agent teams doing engineering, product, operations, finance, support, and growth.',
    images: ['/images/team.webp'],
  },
  alternates: {
    canonical: 'https://www.aether.dev/about',
  },
};

export default function AboutPage() {
  return <AboutPageClient />;
}
