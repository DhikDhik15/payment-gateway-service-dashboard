import { NavLink } from 'react-router-dom';
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
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

// ─── Nav structure ────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

const NAV: (NavItem | NavGroup)[] = [
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

// ─── NavItem component ────────────────────────────────────────────────────────

function SidebarNavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === '/dashboard'}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-sidebar-accent text-white'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-white',
        )
      }
    >
      <Icon aria-hidden="true" className="h-4 w-4 flex-shrink-0" />
      {item.label}
    </NavLink>
  );
}

// ─── Sidebar content ─────────────────────────────────────────────────────────

interface SidebarContentProps {
  onClose?: () => void;
  merchantName?: string;
  merchantCode?: string;
  merchantStatus?: string;
}

export function SidebarContent({
  onClose,
  merchantName,
  merchantCode,
  merchantStatus,
}: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          <div
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground"
          >
            P
          </div>
          <span className="text-sm font-semibold text-white">PayGate</span>
        </div>
        {/* Close button — mobile only */}
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-white md:hidden"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 scrollbar-thin" aria-label="Main navigation">
        <ul className="space-y-0.5" role="list">
          {NAV.map((entry, i) => {
            // Top-level link (no heading)
            if ('to' in entry) {
              return (
                <li key={i}>
                  <SidebarNavLink item={entry} onClick={onClose} />
                </li>
              );
            }
            // Group
            return (
              <li key={i} className="mt-4 first:mt-0">
                <p className="mb-1 px-3 text-xs font-semibold tracking-widest text-sidebar-foreground/50">
                  {entry.heading}
                </p>
                <ul role="list" className="space-y-0.5">
                  {entry.items.map((item) => (
                    <li key={item.to}>
                      <SidebarNavLink item={item} onClick={onClose} />
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer — Merchant info */}
      <div className="border-t border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn(
              'h-2 w-2 rounded-full',
              merchantStatus === 'ACTIVE' ? 'bg-success' : 'bg-warning',
            )}
          />
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-white">{merchantName ?? 'Loading merchant…'}</p>
            <p className="truncate text-xs text-sidebar-foreground/60">
              {merchantCode ? `${merchantCode} · ` : ''}{merchantStatus ?? 'Status unavailable'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
