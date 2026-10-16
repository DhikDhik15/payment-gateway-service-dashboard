import type { DashboardRole } from '@/types/auth';

/**
 * Authoritative frontend mirror of the backend role policy.
 *
 * The backend remains the authorization authority; these helpers only mirror
 * its current policy so route guards, navigation, and mutation buttons share
 * one definition instead of drifting per-component copies:
 *
 * - OWNER: full team and credential management, plus everything ADMIN can do.
 * - ADMIN: payment, refund, webhook, API-key, and catalog mutations.
 * - VIEWER: read-only dashboard access.
 */

export const MANAGER_ROLES: readonly DashboardRole[] = ['OWNER', 'ADMIN'];

/** True for OWNER and ADMIN. Accepts null/undefined for unresolved auth state. */
export function isManagerRole(role: DashboardRole | null | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

/** True for OWNER only. Team invite/role/status mutations require OWNER. */
export function isOwnerRole(role: DashboardRole | null | undefined): boolean {
  return role === 'OWNER';
}

/** Product and category create/update/delete/toggle. */
export function canManageCatalog(role: DashboardRole | null | undefined): boolean {
  return isManagerRole(role);
}

/** Payment creation. */
export function canCreatePayments(role: DashboardRole | null | undefined): boolean {
  return isManagerRole(role);
}

/** Refund creation from a paid payment. */
export function canIssueRefunds(role: DashboardRole | null | undefined): boolean {
  return isManagerRole(role);
}

/** API-key create/revoke and legacy-credential migrate/disable. */
export function canManageApiKeys(role: DashboardRole | null | undefined): boolean {
  return isManagerRole(role);
}

/** Webhook endpoint config, secret rotation, and delivery retry. */
export function canManageWebhooks(role: DashboardRole | null | undefined): boolean {
  return isManagerRole(role);
}

/** Team invitation, role change, and status change. OWNER only. */
export function canManageTeam(role: DashboardRole | null | undefined): boolean {
  return isOwnerRole(role);
}

// ─── Route permissions ───────────────────────────────────────────────────────

/**
 * Dashboard routes that are not readable by every authenticated role.
 * Every other dashboard route has a designed read-only mode for VIEWER and
 * stays accessible; mutations on those pages are gated per-action instead.
 */
export interface RestrictedRoute {
  /** Exact pathname. Matched exactly so `/new` never leaks into `:id` routes. */
  path: string;
  allowedRoles: readonly DashboardRole[];
  /** Safe in-app destination for denied roles. Must itself be unrestricted. */
  fallback: string;
}

export const RESTRICTED_ROUTES: readonly RestrictedRoute[] = [
  {
    path: '/dashboard/payments/new',
    allowedRoles: MANAGER_ROLES,
    fallback: '/dashboard/payments',
  },
];

/** Exact-match lookup. Returns null for unrestricted paths. */
export function routePermissionFor(pathname: string): RestrictedRoute | null {
  return RESTRICTED_ROUTES.find((entry) => entry.path === pathname) ?? null;
}

// ─── Access decisions ────────────────────────────────────────────────────────

export type AccessDecisionKind = 'allowed' | 'loading' | 'login' | 'forbidden';

export interface AccessDecision {
  kind: AccessDecisionKind;
  /** Populated for `login` (destination) and `forbidden` (fallback). */
  target: string | null;
}

export interface AccessInput {
  isLoading: boolean;
  isAuthenticated: boolean;
  role: DashboardRole | null | undefined;
  allowedRoles: readonly DashboardRole[];
  loginPath?: string;
  fallbackPath?: string;
}

/**
 * Pure authorization decision shared by the route guard. Kept pure so the
 * full role matrix is unit-testable without a DOM:
 * - Loading auth never renders restricted content and never redirects.
 * - Unauthenticated users go to login with the caller preserving `from`.
 * - Authenticated users with a denied role go to a safe fallback.
 */
export function resolveRouteAccess(input: AccessInput): AccessDecision {
  if (input.isLoading) return { kind: 'loading', target: null };
  if (!input.isAuthenticated) return { kind: 'login', target: input.loginPath ?? '/login' };
  if (input.allowedRoles.includes(input.role as DashboardRole)) {
    return { kind: 'allowed', target: null };
  }
  return { kind: 'forbidden', target: input.fallbackPath ?? '/dashboard' };
}
