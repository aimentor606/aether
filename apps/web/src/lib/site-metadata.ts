/**
 * Site metadata configuration - SIMPLE AND WORKING
 */

const baseUrl = process.env.ACME_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || 'https://www.acme.dev';

export const siteMetadata = {
  name: 'Acme',
  title: 'Acme – The Autonomous Company Operating System',
  description:
    'A cloud computer where AI agents run your company. Connect 3,000+ tools, configure autonomous agents, set triggers — and the machine operates 24/7 with persistent memory.',
  url: baseUrl,
  keywords:
    'Acme, autonomous company operating system, AI agents, self-driving company, cloud computer, AI automation, agent orchestration, autowork, AI triggers, persistent memory, autonomous workforce, AI operations',
};
