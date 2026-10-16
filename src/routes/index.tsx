/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter, Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { RouteObject } from 'react-router-dom';
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { ProtectedRoute, RequireRole, RestoreErrorScreen } from '@/features/auth';
import { LoadingPage } from '@/components/feedback';
import { useAuth } from '@/lib/auth';
import { MANAGER_ROLES } from '@/lib/auth/permissions';
import { LoginPage } from '@/pages/LoginPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { PaymentsPage } from '@/pages/PaymentsPage';
import { CreatePaymentPage } from '@/pages/CreatePaymentPage';
import { PaymentDetailPage } from '@/pages/PaymentDetailPage';
import { RefundsPage } from '@/pages/RefundsPage';
import { RefundDetailPage } from '@/pages/RefundDetailPage';
import { WebhooksPage } from '@/pages/WebhooksPage';
import { WebhookDetailPage } from '@/pages/WebhookDetailPage';
import { SettlementsPage } from '@/pages/SettlementsPage';
import { ReconciliationPage } from '@/pages/ReconciliationPage';
import { ReconciliationDetailPage } from '@/pages/ReconciliationDetailPage';
import { ApiKeysPage } from '@/pages/ApiKeysPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { CategoriesPage } from '@/pages/CategoriesPage';
import { WebhookConfigPage } from '@/pages/WebhookConfigPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { TeamPage } from '@/pages/TeamPage';
import { InvitationAcceptancePage } from '@/pages/InvitationAcceptancePage';
import PaymentSimulatorPage from '@/pages/PaymentSimulatorPage';
import CheckoutSimulatorPage from '@/pages/CheckoutSimulatorPage';
import { PublicPaymentPage } from '@/pages/PublicPaymentPage';
import ClientSimulatorPage from '@/pages/ClientSimulatorPage';
import { simulatorEnabled } from '@/lib/simulator/config';
import { NotFoundPage } from '@/pages/NotFoundPage';

function RootRedirect() {
  const { isAuthenticated, isLoading, restoreFailed, retryRestore } = useAuth();
  if (isLoading) return <LoadingPage />;
  if (restoreFailed && !isAuthenticated) return <RestoreErrorScreen onRetry={retryRestore} />;
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />;
}

function LoginRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <LoadingPage />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace state={{ from: location.pathname }} />;
  return <LoginPage />;
}

function Protected({ children }: { children: ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

const simulatorRoutes = simulatorEnabled
  ? [
      { path: '/simulator', element: <PaymentSimulatorPage /> },
      { path: '/checkout/:paymentId', element: <CheckoutSimulatorPage /> },
    ]
  : [];

/**
 * Route table under test: unknown URLs must resolve to the not-found page
 * and restricted routes must stay behind the role guard. The browser router
 * for production is built from these definitions via getRouter().
 */
export const routeDefinitions: RouteObject[] = [
  // Public provider page: intentionally outside AuthLayout and ProtectedRoute.
  // Its API helper omits dashboard bearer tokens and cookies.
  { path: '/pay/:identifier', element: <PublicPaymentPage /> },
  // Simulator routes are compiled out of production builds. The backend also
  // rejects simulator use outside an explicitly configured development tenant.
  ...simulatorRoutes,
  // Client Simulator: standalone page using External Client API (X-API-Key auth).
  // Intentionally outside AuthLayout/ProtectedRoute — it does not use dashboard JWT.
  { path: '/client-simulator', element: <ClientSimulatorPage /> },
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginRoute /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/accept-invitation', element: <InvitationAcceptancePage /> },
    ],
  },
  {
    element: <Protected><DashboardLayout /></Protected>,
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/dashboard/payments', element: <PaymentsPage /> },
      { path: '/dashboard/payments/new', element: <RequireRole allowedRoles={MANAGER_ROLES} fallback="/dashboard/payments"><CreatePaymentPage /></RequireRole> },
      { path: '/dashboard/payments/:id', element: <PaymentDetailPage /> },
      { path: '/dashboard/products', element: <ProductsPage /> },
      { path: '/dashboard/categories', element: <CategoriesPage /> },
      { path: '/dashboard/refunds', element: <RefundsPage /> },
      { path: '/dashboard/refunds/:id', element: <RefundDetailPage /> },
      { path: '/dashboard/webhooks', element: <WebhooksPage /> },
      { path: '/dashboard/webhooks/:id', element: <WebhookDetailPage /> },
      { path: '/dashboard/settlements', element: <SettlementsPage /> },
      { path: '/dashboard/reconciliation', element: <ReconciliationPage /> },
      { path: '/dashboard/reconciliation/:id', element: <ReconciliationDetailPage /> },
      { path: '/dashboard/api-keys', element: <ApiKeysPage /> },
      { path: '/dashboard/webhook-config', element: <WebhookConfigPage /> },
      { path: '/dashboard/settings', element: <SettingsPage /> },
      { path: '/dashboard/team', element: <TeamPage /> },
    ],
  },
  { path: '/', element: <RootRedirect /> },
  { path: '*', element: <NotFoundPage /> },
];

// Created lazily so that importing the route table (e.g. in Node tests via
// matchRoutes) never touches browser history. App startup calls getRouter().
let cachedRouter: ReturnType<typeof createBrowserRouter> | null = null;
export function getRouter(): NonNullable<typeof cachedRouter> {
  if (!cachedRouter) cachedRouter = createBrowserRouter(routeDefinitions);
  return cachedRouter;
}
