import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MANAGER_ROLES,
  RESTRICTED_ROUTES,
  canCreatePayments,
  canIssueRefunds,
  canManageApiKeys,
  canManageCatalog,
  canManageTeam,
  canManageWebhooks,
  isManagerRole,
  isOwnerRole,
  resolveRouteAccess,
  routePermissionFor,
} from './permissions.ts';
import type { DashboardRole } from '@/types/auth';

const ALL_ROLES: DashboardRole[] = ['OWNER', 'ADMIN', 'VIEWER'];

test('manager roles are OWNER and ADMIN only', () => {
  assert.deepEqual([...MANAGER_ROLES], ['OWNER', 'ADMIN']);
  for (const role of ALL_ROLES) {
    assert.equal(isManagerRole(role), role !== 'VIEWER', role);
  }
  assert.equal(isManagerRole(null), false);
  assert.equal(isManagerRole(undefined), false);
});

test('owner role check admits OWNER only', () => {
  for (const role of ALL_ROLES) {
    assert.equal(isOwnerRole(role), role === 'OWNER', role);
  }
  assert.equal(isOwnerRole(null), false);
  assert.equal(isOwnerRole(undefined), false);
});

test('mutation capabilities deny VIEWER and unresolved roles', () => {
  const capabilities = {
    catalog: canManageCatalog,
    payments: canCreatePayments,
    refunds: canIssueRefunds,
    apiKeys: canManageApiKeys,
    webhooks: canManageWebhooks,
  };
  for (const [name, check] of Object.entries(capabilities)) {
    assert.equal(check('OWNER'), true, `${name}/OWNER`);
    assert.equal(check('ADMIN'), true, `${name}/ADMIN`);
    assert.equal(check('VIEWER'), false, `${name}/VIEWER`);
    assert.equal(check(null), false, `${name}/null`);
    assert.equal(check(undefined), false, `${name}/undefined`);
  }
});

test('team management admits OWNER only', () => {
  assert.equal(canManageTeam('OWNER'), true);
  assert.equal(canManageTeam('ADMIN'), false);
  assert.equal(canManageTeam('VIEWER'), false);
  assert.equal(canManageTeam(null), false);
  assert.equal(canManageTeam(undefined), false);
});

test('restricted route table guards the payment creation route', () => {
  const entry = routePermissionFor('/dashboard/payments/new');
  assert.ok(entry);
  assert.deepEqual([...entry.allowedRoles], ['OWNER', 'ADMIN']);
  assert.equal(entry.fallback, '/dashboard/payments');
  assert.deepEqual(
    RESTRICTED_ROUTES.map((route) => route.path),
    ['/dashboard/payments/new'],
  );
});

test('route permission lookup matches exactly, never by prefix', () => {
  assert.equal(routePermissionFor('/dashboard/payments'), null);
  assert.equal(routePermissionFor('/dashboard/payments/abc123'), null);
  assert.equal(routePermissionFor('/dashboard/payments/new/extra'), null);
  assert.equal(routePermissionFor('/dashboard/team'), null);
  assert.equal(routePermissionFor('/dashboard/api-keys'), null);
});

test('access decision never renders restricted content while loading', () => {
  for (const role of [...ALL_ROLES, null, undefined]) {
    const decision = resolveRouteAccess({
      isLoading: true,
      isAuthenticated: true,
      role,
      allowedRoles: MANAGER_ROLES,
      fallbackPath: '/dashboard/payments',
    });
    assert.equal(decision.kind, 'loading', String(role));
    assert.equal(decision.target, null);
  }
});

test('access decision sends unauthenticated users to login', () => {
  const decision = resolveRouteAccess({
    isLoading: false,
    isAuthenticated: false,
    role: null,
    allowedRoles: MANAGER_ROLES,
    fallbackPath: '/dashboard/payments',
  });
  assert.equal(decision.kind, 'login');
  assert.equal(decision.target, '/login');
});

test('access decision allows managers and forbids VIEWER to the fallback', () => {
  for (const role of ['OWNER', 'ADMIN'] as const) {
    const decision = resolveRouteAccess({
      isLoading: false,
      isAuthenticated: true,
      role,
      allowedRoles: MANAGER_ROLES,
      fallbackPath: '/dashboard/payments',
    });
    assert.equal(decision.kind, 'allowed', role);
  }
  const denied = resolveRouteAccess({
    isLoading: false,
    isAuthenticated: true,
    role: 'VIEWER',
    allowedRoles: MANAGER_ROLES,
    fallbackPath: '/dashboard/payments',
  });
  assert.equal(denied.kind, 'forbidden');
  assert.equal(denied.target, '/dashboard/payments');
});
