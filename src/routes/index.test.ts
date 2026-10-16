import test from 'node:test';
import assert from 'node:assert/strict';
import { matchRoutes } from 'react-router-dom';
import { routeDefinitions } from './index.tsx';
import { RequireRole } from '@/features/auth';
import { NotFoundPage } from '@/pages/NotFoundPage.tsx';
import { MANAGER_ROLES } from '@/lib/auth/permissions';

function leafElement(pathname: string): unknown {
  const matches = matchRoutes(routeDefinitions, pathname);
  assert.ok(matches, `expected ${pathname} to match a route`);
  return matches[matches.length - 1].route.element;
}

function elementType(element: unknown): unknown {
  assert.ok(element && typeof element === 'object' && 'type' in element);
  return (element as { type: unknown }).type;
}

function elementProps(element: unknown): Record<string, unknown> {
  assert.ok(element && typeof element === 'object' && 'props' in element);
  return (element as { props: Record<string, unknown> }).props;
}

test('unknown top-level URL resolves to the not-found page', () => {
  const element = leafElement('/no-such-page');
  assert.equal(elementType(element), NotFoundPage);
});

test('unknown dashboard URL resolves to the not-found page, not login', () => {
  const element = leafElement('/dashboard/no-such-page');
  assert.equal(elementType(element), NotFoundPage);
});

test('payment creation route stays behind the manager role guard', () => {
  const element = leafElement('/dashboard/payments/new');
  assert.equal(elementType(element), RequireRole);
  const props = elementProps(element);
  assert.deepEqual([...(props.allowedRoles as readonly string[])], [...MANAGER_ROLES]);
  assert.equal(props.fallback, '/dashboard/payments');
});

test('payment detail and list routes are not wrapped in the role guard', () => {
  const detail = leafElement('/dashboard/payments/txn_123');
  const list = leafElement('/dashboard/payments');
  assert.notEqual(elementType(detail), RequireRole);
  assert.notEqual(elementType(list), RequireRole);
});

test('forgot-password and reset-password routes are public pages, not role-guarded', async () => {
  const { ForgotPasswordPage } = await import('@/pages/ForgotPasswordPage.tsx');
  const { ResetPasswordPage } = await import('@/pages/ResetPasswordPage.tsx');
  assert.equal(elementType(leafElement('/forgot-password')), ForgotPasswordPage);
  assert.equal(elementType(leafElement('/reset-password')), ResetPasswordPage);
});
