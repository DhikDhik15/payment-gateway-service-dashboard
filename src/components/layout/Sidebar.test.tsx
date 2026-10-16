import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { MemoryRouter } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';
import { SidebarContent } from './Sidebar.tsx';
import { filterNavEntries } from './navigation.ts';
import type { NavEntry } from './navigation.ts';
import { AuthContext } from '@/lib/auth';
import type { AuthContextValue } from '@/lib/auth';
import type { AuthUser, DashboardRole } from '@/types/auth';

function userWithRole(role: DashboardRole): AuthUser {
  return {
    id: 'user-1',
    merchant_id: 'merchant-1',
    email: 'teammate@example.com',
    role,
    status: 'ACTIVE',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function renderSidebar(role: DashboardRole | null): string {
  const state: AuthContextValue = {
    user: role ? userWithRole(role) : null,
    session: null,
    isAuthenticated: role !== null,
    isLoading: false,
    sessionExpired: false,
    sessionEndReason: null,
    restoreFailed: false,
    login: () => Promise.resolve(),
    logout: () => Promise.resolve(),
    retryRestore: () => undefined,
  };
  return renderToStaticMarkup(
    <AuthContext.Provider value={state}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <SidebarContent merchantName="Acme" merchantCode="ACME" merchantStatus="ACTIVE" />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

const EXPECTED_LABELS = [
  'Overview',
  'Payments',
  'Refunds',
  'Products',
  'Categories',
  'Webhooks',
  'Reconciliation',
  'API Keys',
  'Webhook Config',
  'Merchant Profile',
  'Team',
];

test('every supported role sees the full navigation hierarchy', () => {
  for (const role of ['OWNER', 'ADMIN', 'VIEWER'] as const) {
    const markup = renderSidebar(role);
    for (const label of EXPECTED_LABELS) {
      assert.ok(markup.includes(label), `${role} should see ${label}`);
    }
    assert.match(markup, /aria-label="Main navigation"/);
  }
});

test('unresolved auth renders no navigation entries', () => {
  const markup = renderSidebar(null);
  assert.doesNotMatch(markup, /\/dashboard\/payments/);
  assert.doesNotMatch(markup, /\/dashboard\/team/);
});

test('filter drops restricted entries and emptied groups', () => {
  const entries: NavEntry[] = [
    { label: 'Open', to: '/open', icon: LayoutDashboard },
    { label: 'Managers', to: '/managers', icon: LayoutDashboard, allowedRoles: ['OWNER', 'ADMIN'] },
    {
      heading: 'GROUP',
      items: [
        { label: 'Open item', to: '/open-item', icon: LayoutDashboard },
        { label: 'Owner item', to: '/owner-item', icon: LayoutDashboard, allowedRoles: ['OWNER'] },
      ],
    },
    {
      heading: 'OWNERS ONLY',
      items: [{ label: 'Secret', to: '/secret', icon: LayoutDashboard, allowedRoles: ['OWNER'] }],
    },
  ];

  const viewer = filterNavEntries(entries, 'VIEWER');
  assert.equal(viewer.length, 2);
  assert.ok(viewer.some((entry) => 'to' in entry && entry.to === '/open'));
  assert.ok(!viewer.some((entry) => 'to' in entry && entry.to === '/managers'));
  const group = viewer.find((entry) => 'heading' in entry && entry.heading === 'GROUP');
  assert.ok(group && 'items' in group && group.items.length === 1);
  assert.ok(!viewer.some((entry) => 'heading' in entry && entry.heading === 'OWNERS ONLY'));

  const owner = filterNavEntries(entries, 'OWNER');
  assert.equal(owner.length, 4);

  assert.deepEqual(filterNavEntries(entries, null), []);
  assert.deepEqual(filterNavEntries(entries, undefined), []);
});
