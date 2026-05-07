import {
  BarChart3,
  Database,
  Flag,
  Gauge,
  Bell,
  MessageCircle,
  Server,
  Settings,
  TestTube,
  UserPlus,
  Bot,
  type LucideIcon,
} from 'lucide-react';

export type OpsNavGroup = 'platform' | 'infrastructure' | 'users' | 'tools';

export interface OpsNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  group: OpsNavGroup;
  keywords?: string[];
}

export interface OpsNavGroupDef {
  id: OpsNavGroup;
  label: string;
}

export const OPS_NAV_GROUPS: OpsNavGroupDef[] = [
  { id: 'platform', label: 'Platform' },
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'users', label: 'Users' },
  { id: 'tools', label: 'Tools' },
];

export const OPS_NAV_ITEMS: OpsNavItem[] = [
  // Platform
  {
    id: 'admin-analytics',
    label: 'Analytics',
    icon: BarChart3,
    href: '/admin/analytics',
    group: 'platform',
    keywords: ['metrics', 'revenue', 'users', 'charts', 'dashboard'],
  },
  {
    id: 'admin-feature-flags',
    label: 'Feature Flags',
    icon: Flag,
    href: '/admin/feature-flags',
    group: 'platform',
    keywords: ['flags', 'features', 'toggles', 'verticals'],
  },
  {
    id: 'admin-litellm',
    label: 'LiteLLM',
    icon: Bot,
    href: '/admin/litellm',
    group: 'platform',
    keywords: ['models', 'proxy', 'llm', 'ai', 'providers'],
  },
  {
    id: 'admin-stateless',
    label: 'Stateless',
    icon: Gauge,
    href: '/admin/stateless',
    group: 'platform',
    keywords: ['execution', 'runs', 'circuit breaker', 'dead letter', 'backpressure'],
  },

  // Infrastructure
  {
    id: 'admin-sandboxes',
    label: 'Sandboxes',
    icon: Server,
    href: '/admin/sandboxes',
    group: 'infrastructure',
    keywords: ['instances', 'machines', 'containers', 'vps'],
  },
  {
    id: 'admin-sandbox-pool',
    label: 'Sandbox Pool',
    icon: Database,
    href: '/admin/sandbox-pool',
    group: 'infrastructure',
    keywords: ['pool', 'capacity', 'resources', 'scaling'],
  },

  // Users
  {
    id: 'admin-access-requests',
    label: 'Access Requests',
    icon: UserPlus,
    href: '/admin/access-requests',
    group: 'users',
    keywords: ['signup', 'waitlist', 'approve', 'reject'],
  },

  // Tools
  {
    id: 'admin-stress-test',
    label: 'Stress Test',
    icon: TestTube,
    href: '/admin/stress-test',
    group: 'tools',
    keywords: ['load', 'test', 'performance', 'latency'],
  },
  {
    id: 'admin-notifications',
    label: 'Notifications',
    icon: Bell,
    href: '/admin/notifications',
    group: 'tools',
    keywords: ['push', 'broadcast', 'novu', 'messages'],
  },
  {
    id: 'admin-feedback',
    label: 'Feedback',
    icon: MessageCircle,
    href: '/admin/feedback',
    group: 'tools',
    keywords: ['reviews', 'sentiment', 'ratings', 'insights'],
  },
  {
    id: 'admin-utils',
    label: 'Utils',
    icon: Settings,
    href: '/admin/utils',
    group: 'tools',
    keywords: ['maintenance', 'system', 'status', 'incidents'],
  },
];

export function getOpsNavItemsByGroup(group: OpsNavGroup): OpsNavItem[] {
  return OPS_NAV_ITEMS.filter((item) => item.group === group);
}

export function findOpsNavItemByHref(href: string): OpsNavItem | undefined {
  return OPS_NAV_ITEMS.find((item) => item.href === href);
}
