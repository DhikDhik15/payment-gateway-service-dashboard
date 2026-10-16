import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  CreditCard,
  RotateCcw,
  Package,
  Tags,
  Webhook,
  BarChart3,
  KeyRound,
  Settings,
  Radio,
  Users,
} from 'lucide-react';
import type { DashboardRole } from '@/types/auth';

// ─── Nav structure ────────────────────────────────────────────────────────────

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /**
   * Roles permitted to see this entry. Omitted = every authenticated role.
   * Uses the same role definitions as the route guards; every current entry
   * has a designed read-only mode for VIEWER, so none is restricted yet.
   * Direct URL access is guarded independently by the route guard.
   */
  allowedRoles?: readonly DashboardRole[];
}

export interface NavGroup {
  heading: string;
  items: NavItem[];
}

export type NavEntry = NavItem | NavGroup;

/**
 * Pure navigation filter shared by the sidebar. Drops entries (and emptied
 * groups) unavailable to the role. Null/undefined roles see nothing rather
 * than leaking entries while auth is unresolved.
 */
export function filterNavEntries(
  entries: readonly NavEntry[],
  role: DashboardRole | null | undefined,
): NavEntry[] {
  if (!role) return [];
  return entries.flatMap((entry): NavEntry[] => {
    if ('to' in entry) {
      if (entry.allowedRoles && !entry.allowedRoles.includes(role)) return [];
      return [entry];
    }
    const items = entry.items.filter(
      (item) => !item.allowedRoles || item.allowedRoles.includes(role),
    );
    if (items.length === 0) return [];
    return [{ ...entry, items }];
  });
}

export const NAV: NavEntry[] = [
  {
    label: 'Overview',
    to: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    heading: 'TRANSACTIONS',
    items: [
      { label: 'Payments', to: '/dashboard/payments', icon: CreditCard },
      { label: 'Refunds', to: '/dashboard/refunds', icon: RotateCcw },
    ],
  },
  {
    heading: 'CATALOG',
    items: [
      { label: 'Products', to: '/dashboard/products', icon: Package },
      { label: 'Categories', to: '/dashboard/categories', icon: Tags },
    ],
  },
  {
    heading: 'OPERATIONS',
    items: [
      { label: 'Webhooks', to: '/dashboard/webhooks', icon: Webhook },
      { label: 'Reconciliation', to: '/dashboard/reconciliation', icon: BarChart3 },
    ],
  },
  {
    heading: 'DEVELOPERS',
    items: [
      { label: 'API Keys', to: '/dashboard/api-keys', icon: KeyRound },
      { label: 'Webhook Config', to: '/dashboard/webhook-config', icon: Radio },
    ],
  },
  {
    heading: 'SETTINGS',
    items: [
      { label: 'Merchant Profile', to: '/dashboard/settings', icon: Settings },
      { label: 'Team', to: '/dashboard/team', icon: Users },
    ],
  },
];
