# Frontend Audit Report — GO-SAAS PayGate Merchant Dashboard

**Audited repository:** pay-gate-dashboard (frontend of the GO-SAAS Payment Gateway Simulator)
**Working tree state:** branch `main`, working tree contains pre-existing uncommitted user modifications (preserved — see Repository Integrity)
**Audit date:** 2026-10-16
**Scope:** Frontend only (`src/`, configuration, docs). Backend was not executed and no backend changes were inspected beyond frontend-referenced contract documentation.
**Constraint honored:** Audit-only. No application source, configuration, lockfile, or documentation file was modified, created, deleted, or overwritten except this report file itself (no prior audit report existed).

---

## Section 1 — Executive Summary

### Current frontend maturity

The frontend is a **mature, production-oriented single-page application**, not a prototype or skeleton. It is implemented with React 18, TypeScript 5.6, Vite 6, React Router 7, TanStack Query 5, React Hook Form + Zod, and Tailwind CSS. All quality gates pass: `tsc -b` typecheck, ESLint, 225 unit/contract tests across 34 test files, and the Vite production build.

The architecture is centralized and consistent: one typed API client (`src/lib/api/client.ts`), one auth service (`src/lib/auth/service.ts` + `context.tsx`), TanStack Query for server state, and a custom UI component library (`src/components/ui`). Route definitions live in `src/routes/index.tsx`; the real entry point is `src/app/App.tsx` (booted via `src/main.tsx` with a fatal-startup-error boundary); `src/App.tsx` is a compatibility re-export.

### Strongest existing areas

| Area | Evidence |
|---|---|
| API client & error normalization | `src/lib/api/client.ts` — standard `{success, data, meta}` / `{success: false, error, meta}` envelope validation, `ApiClientError` with an allowlisted safe-message table, no raw backend bodies surfaced to the UI |
| Authentication & session handling | `src/lib/auth/service.ts`, `src/lib/auth/context.tsx` — access tokens in JS memory only, refresh token is an HttpOnly cookie never read by JS, single-flight refresh, auth-transition epoch barrier, proactive refresh 60s before expiry |
| Payment flow (hosted payment page) | `src/pages/PaymentDetailPage.tsx` (same-origin guard on `payment_url`, lines 94-99), `src/pages/PublicPaymentPage.tsx`, `src/lib/mock-payment/` — QRIS rendered exclusively from backend-provided `qris_payload`, no fabricated QR, terminal-state handling |
| Dashboard metrics & transaction management | `src/pages/DashboardPage.tsx`, `src/pages/PaymentsPage.tsx`, `src/hooks/useOverview.ts`, `src/hooks/usePayments.ts` — all metrics sourced from backend GET endpoints; pagination, search, status and date-range filters, empty/loading/error states |
| Testing & quality gates | 34 test files / 225 tests all passing; `npm run lint`, `npm run typecheck`, `npm run build` all green |

### Most significant weaknesses

- **No `openapi.yaml` in the repository.** The API contract of record is `docs/phase-10-frontend-contract.md`, which describes the *assembled Go router behavior* (not generated Swagger annotations, noted stale in places). Frontend-vs-contract drift cannot be machine-checked from the repo alone.
- **Backend-dependent correctness is unverifiable from the frontend repo.** The frontend consumes fields (`provider`, `timeline`, `unsuccessful_transactions`, `revenue`, `recent_payments`, mock-payment `qris_payload`) whose presence on the live backend could not be confirmed without executing the backend.
- **Payment-URL topology is a backend/configuration dependency.** The README documents that the backend's `PaymentURL` (and `MOCK_PAYMENT_BASE_URL`) must be configured so the returned URL serves the SPA route; otherwise the backend default may target a backend JSON endpoint or an unpublished port — exactly the historical "JSON instead of a payment page" failure. The frontend mitigates this client-side with a same-origin guard, but cannot fix a backend-issued URL.
- **Missing operational conveniences:** no server-aware sorting on the payments list, no amount-range or provider filters, no expiration countdown on the QRIS payment page (expiry shown as a timestamp only), no toast notification component.
- **Subtle display inconsistency:** timestamps are rendered in local browser time (`src/lib/utils/format.ts`, `formatDateTime`) while date-range filters use strict UTC midnight boundaries (`src/hooks/overviewQuery.ts`).

### Highest-priority risks

1. Payment URL served by the backend points outside the SPA origin → customer sees JSON or an unreachable port (historical issue; client-side guard exists, backend topology config remains a dependency).
2. Frontend assumes backend response shapes that were not verified against a running backend (field-level contract mismatch risk).
3. No end-to-end or page-level test coverage for the payment and webhook journeys; regressions in those paths would rely entirely on manual testing.

### Recommended next development phase

**Phase 0 — Correctness and Critical Defects**, scoped to frontend-controllable work plus documented backend/configuration dependencies: confirm the payment-URL flow end-to-end in the development topology (no JSON rendering), add sorting to the payments list, and add component test coverage for the payment pages. Rationale in Section 12.

No completion percentage is claimed, because backend behavior was not executed and cannot be attributed to the frontend.

---

## Section 2 — Architecture Inventory

### 1. Framework and version
React 18.3.1, ReactDOM 18.3.1, TypeScript ~5.6.2, Vite 6.4.3 (`@vitejs/plugin-react` 4.3.3). Source: `package.json` lines 17-29.

### 2. Programming language and build tooling
TypeScript, compiled by Vite (esbuild/Rollup). Type checking via `tsc -b` (project references: `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`). CSS via Tailwind CSS 3.4.15 + PostCSS + Autoprefixer (`tailwind.config.js`, `postcss.config.js`).

### 3. Package manager and dependency management
npm, lockfile `package-lock.json` (committed). `node_modules/` is present and gitignored. Engines: Node >= 20.19.0 (`package.json` line 7).

### 4. Application entry points
- HTML entry: `index.html` → `<script type="module" src="/src/main.tsx"></script>`
- JS entry: `src/main.tsx` — renders `src/app/App.tsx` dynamically inside `renderStartupError` boundary
- App root: `src/app/App.tsx` — `QueryProvider` > `AuthProvider` > `AppErrorBoundary` > `RouterProvider`
- Legacy compatibility shim: `src/App.tsx` re-exports `./app/App`
- Fatal startup boundary: `src/fatalStartupError.ts` (+ `src/fatalStartupError.test.ts`)

### 5. Directory and component structure
```
src/
  main.tsx                    # bootstrapping + startup error boundary
  app/App.tsx                 # root component (providers + router)
  app/providers/QueryProvider.tsx   # TanStack Query client (retry 5xx, staleTime 30s)
  routes/index.tsx            # route table + getRouter()
  layouts/
    DashboardLayout.tsx       # sidebar + header + merchant banner + mobile drawer (+ Outlet)
    AuthLayout.tsx            # centered layout for unauth pages
  pages/                      # 27 page components (see Section 3)
  components/
    ui/                       # custom design-system components (Button, DataTable, Dialog, ...)
    layout/                   # Sidebar, Header, MerchantStatusBanner, navigation.ts
    dashboard/                # AnalyticsPanel, RevenueTrendChart, TopProductsChart, StatCard, DateRangeFilterPanel (untracked addition)
    payments/                 # ProductDetailsCard
    mock-payment/             # MockPaymentQrCode
    keys/                     # LegacyCredentialCard
    feedback/                 # AppErrorBoundary, LoadingPage, LoadingSpinner
    simulator/                # simulator-specific components
    team/                     # TeamManagementPanel
  features/auth/              # ProtectedRoute, RequireRole, RestoreErrorScreen
  hooks/                      # TanStack Query hooks (usePayments, useOverview, useWebhooks, useMockPayments, ...)
  lib/
    api/client.ts             # centralized fetch client (+ client.test.ts)
    api/errors.ts             # safe error-message normalization
    auth/                     # service.ts, context.tsx, permissions.ts
    utils/                    # format.ts, url.ts, documentTitle.ts
    mock-payment/             # api.ts, contract.ts (public dev payment provider)
    simulator/                # config.ts, qr.ts, polling.ts
    client-simulator/         # api.ts, credential.ts, webhookReceiver.ts
    invitations/, password-reset/, catalog/
  types/                      # auth.ts, backend.ts, common.ts
```
Source: directory listing; `tailwind.config.js` content paths `./index.html`, `./src/**/*.{ts,tsx}`.

### 6. Routing implementation
React Router 7 `createBrowserRouter` in `src/routes/index.tsx` (lines 1-121), built lazily via `getRouter()`. Data-router-style usage (`Outlet`, `useParams`, `useNavigate`, `Navigate`). Route table includes:
- Public: `/pay/:identifier` (PublicPaymentPage), `/client-simulator` (ClientSimulatorPage)
- Dev-only (compiled out when `VITE_ENABLE_SIMULATOR !== true` or `MODE === production`, `src/lib/simulator/config.ts`): `/simulator`, `/checkout/:paymentId`
- Auth layout (`AuthLayout`): `/login`, `/forgot-password`, `/reset-password`, `/accept-invitation`
- Protected layout (`ProtectedRoute` > `DashboardLayout`): 17 dashboard routes (`/dashboard`, `/dashboard/payments`, `/dashboard/payments/new`, `/dashboard/payments/:id`, `/dashboard/products`, `/dashboard/categories`, `/dashboard/refunds`, `/dashboard/refunds/:id`, `/dashboard/webhooks`, `/dashboard/webhooks/:id`, `/dashboard/settlements`, `/dashboard/reconciliation`, `/dashboard/reconciliation/:id`, `/dashboard/api-keys`, `/dashboard/webhook-config`, `/dashboard/settings`, `/dashboard/team`)
- Root redirect `/` and wildcard `*` → `NotFoundPage`

### 7. Layout and navigation structure
`DashboardLayout.tsx` renders a fixed sidebar (desktop) / drawer (mobile) with skip-to-content link, header, merchant status banner, and `Outlet`. Navigation entries in `src/components/layout/navigation.ts` (`NAV`), role-filtered by `filterNavEntries`; active route indicated via `NavLink` `isActive` styling (`Sidebar.tsx` lines 18-30). `documentTitle.ts` sets `<title>` per route.

### 8. State management
- Server state: TanStack Query 5 (`QueryProvider`, default retry for 5xx only, `staleTime: 30_000`, `refetchOnWindowFocus: true`)
- Auth state: React context (`AuthProvider`) holding user/session in memory; access token stored in `authService` module memory only (never `localStorage`/`sessionStorage`)
- UI state: local React state per page/component
- Cache invalidation helpers: `src/hooks/invalidation.ts`

### 9. API client implementation
`src/lib/api/client.ts` — single fetch-based client:
- `BASE_URL` from `VITE_API_BASE_URL`; production build throws if unset or non-HTTPS (non-localhost) — fails closed (lines 16-25)
- Standard envelope validation: response must be `{success: boolean, ...}` or 204; otherwise `INVALID_RESPONSE` (lines 293-305)
- Bearer token from in-memory getter; `credentials: 'include'` sends the browser-managed HttpOnly refresh cookie
- `publicApiClient` strips auth/cookie for public flows (lines 390-397)
- Single-flight refresh on 401; GETs retried once; mutations only with explicit `retryOnUnauthorized: true`
- Default timeout 20s; abort/signal support; `Retry-After` honored
- `ApiClientError` with `status`, `code`, `requestId`, `details`, `retryAfterSeconds`
- Safe user messages via allowlist (`safeCodeMessages`, `statusMessages`); arbitrary response text never rendered

### 10. Authentication and authorization handling
- `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `POST /api/v1/auth/refresh`, `GET /api/v1/auth/me` (`src/lib/auth/service.ts` lines 140-237)
- Access JWT: short-lived (backend default 15 min per contract doc), memory-only, never persisted
- Refresh token: HttpOnly SameSite cookie, managed by browser; never read/written by JS
- Proactive refresh 60s before expiry (`context.tsx` lines 110-119); single-flight refresh (`service.ts` lines 239-248); auth-transition epoch prevents stale refreshes from restoring state after logout (`service.ts` lines 12-12, 64-72, 261-267)
- Session restore on mount (`getSession`); transport failures yield `restoreFailed` retry screen rather than a login bounce
- `sessionExpired` handler clears memory token, notifies listeners, clears TanStack Query cache (`context.tsx` lines 43-55)
- Role-based UI gating: `src/lib/auth/permissions.ts` (`MANAGER_ROLES`, `RESTRICTED_ROUTES`, `resolveRouteAccess`); `/dashboard/payments/new` restricted to OWNER/ADMIN via `RequireRole` (`routes/index.tsx` line 94)
- Frontend role checks documented as UX hints only; backend middleware is authoritative (README, `permissions.ts` header comment)

### 11. Form handling and validation
React Hook Form 7 + Zod 3 (+ `@hookform/resolvers`) on `CreatePaymentPage`, `WebhookConfigPage`, `PaymentDetailPage` (refund form), `ApiKeysPage`, product/category forms. Idempotency keys (`crypto.randomUUID`) generated per operation and kept stable across retries.

### 12. UI component library and styling approach
Custom component library in `src/components/ui/` (Badge, Button, Card, DataTable, Dialog, Dropdown, EmptyState, ErrorState, Input, Label, PageHeader, Skeleton) built on Tailwind CSS with semantic design tokens (`tailwind.config.js` colors: background/foreground/muted/border/primary/.../sidebar/input/ring). Icons: `lucide-react`. No external design-system library (e.g. no Radix, no shadcn). `qrcode.react` used only for the development mock-payment QRIS rendering.

### 13. Error handling strategy
- `AppErrorBoundary` (`src/components/feedback/AppErrorBoundary.tsx`) + fatal startup render (`fatalStartupError.ts`)
- Per-page `ErrorState`/`EmptyState`/skeleton loading UI; retry via `refetch()`
- API errors normalized by `src/lib/api/errors.ts` (`errorMessage`, `isErrorCode`, `isStatus`, `fieldError`) with an allowlist so provider/internal details never leak to the UI
- 401 → session-expired flow; 403 → permission denied; 404 → not found; 429 → rate limit; ≥500 → service unavailable

### 14. Environment configuration
- `.env.example` (committed template): `VITE_API_BASE_URL=http://localhost:8081`, `VITE_ENABLE_SIMULATOR=false`
- `.env.development`, `.env.production` (committed); `.env` and `.env.*` gitignored (one local `.env` exists uncommitted — user file, preserved)
- README documents: VITE_* values are public browser config; never secrets; production origin must be HTTPS; local production `.env.production` intentionally empty so the built app fails closed until a real HTTPS origin is injected

### 15. Testing infrastructure
- Runner: Node's built-in `node:test`; tests bundled by esbuild via `scripts/run-tests.sh` (no vitest/jest; no experimental TS loader needed)
- 34 test files, 225 tests, 0 failures (executed — see Section 9)
- No coverage thresholds, no coverage report configuration, no E2E tooling (Playwright/Cypress) present
- Lint: ESLint 9 (`eslint.config.js`); typecheck: `tsc -b`; build: `vite build`

---

## Section 3 — Page and Route Inventory

| # | Page Name | Route | Purpose | Impl. Status | API Dependencies | UI Completeness | Functional Gaps | Evidence |
|---|---|---|---|---|---|---|---|---|
| 1 | Root redirect | `/` | Redirects to `/dashboard` or `/login` based on auth | Implemented | none | n/a | none | `src/routes/index.tsx:39-44` |
| 2 | Not found | `*` | Fallback for unknown URLs | Implemented | none | Basic | none | `src/pages/NotFoundPage.tsx` |
| 3 | Login | `/login` | Email/password login; redirects authenticated users to `/dashboard` | Implemented | `POST /api/v1/auth/login` | Complete | none | `src/pages/LoginPage.tsx` |
| 4 | Forgot password | `/forgot-password` | Password reset request | Implemented | (contract doc) | Complete | — | `src/pages/ForgotPasswordPage.tsx` |
| 5 | Reset password | `/reset-password` | Password reset form | Implemented | (contract doc) | Complete | — | `src/pages/ResetPasswordPage.tsx` |
| 6 | Invitation acceptance | `/accept-invitation` | Accept team invitation (token from query, stripped from history) | Implemented | `GET/POST /api/v1/invitations/:token` | Complete | — | `src/pages/InvitationAcceptancePage.tsx` |
| 7 | Dashboard overview | `/dashboard` | Merchant metrics + recent payments + analytics tab | Implemented | `GET /api/v1/dashboard/overview`, `/api/v1/dashboard/analytics`, `GET /api/v1/dashboard/settings` | Complete (tabs, metrics, charts, filters) | Sorting absent; chart data backend-dependent | `src/pages/DashboardPage.tsx`, `src/components/dashboard/*` |
| 8 | Payments list | `/dashboard/payments` | Transaction list with search, status/date filters, pagination | Implemented | `GET /api/v1/dashboard/payments` | Complete | No sorting; no amount-range/provider filters | `src/pages/PaymentsPage.tsx`, `src/hooks/paymentsQuery.ts` |
| 9 | Create payment | `/dashboard/payments/new` | QRIS/IDR payment creation with idempotency key (OWNER/ADMIN) | Implemented | `POST /api/v1/dashboard/payments` | Complete | Currency/method fixed to IDR/QRIS per backend contract | `src/pages/CreatePaymentPage.tsx` |
| 10 | Payment detail | `/dashboard/payments/:id` | Payment metadata, timeline, refund, QRIS panel, open payment page | Implemented | `GET /api/v1/dashboard/payments/:payment_id`, `POST .../refunds` | Complete | Failure reason not in DTO; webhook delivery info not on this page | `src/pages/PaymentDetailPage.tsx` |
| 11 | Refunds list | `/dashboard/refunds` | Refund list | Implemented | `GET /api/v1/dashboard/refunds` | — | Not deeply audited (out of core scope) | `src/pages/RefundsPage.tsx` |
| 12 | Refund detail | `/dashboard/refunds/:id` | Refund detail | Implemented | `GET /api/v1/dashboard/refunds/:refund_id` | — | — | `src/pages/RefundDetailPage.tsx` |
| 13 | Products | `/dashboard/products` | Catalog products | Implemented | catalog endpoints | — | — | `src/pages/ProductsPage.tsx` |
| 14 | Categories | `/dashboard/categories` | Catalog categories | Implemented | catalog endpoints | — | — | `src/pages/CategoriesPage.tsx` |
| 15 | Webhooks (deliveries) | `/dashboard/webhooks` | Outbound webhook delivery log with retry | Implemented | `GET /api/v1/dashboard/webhooks`, `POST .../:id/retry` | Complete | Payload inspection deliberately omitted (security) | `src/pages/WebhooksPage.tsx`, `src/hooks/useWebhooks.ts` |
| 16 | Webhook delivery detail | `/dashboard/webhooks/:id` | Delivery metadata + retry + linked payment | Implemented | `GET /api/v1/dashboard/webhooks/:id` | Complete | Raw payload not exposed by design | `src/pages/WebhookDetailPage.tsx` |
| 17 | Settlements | `/dashboard/settlements` | Settlement page (stub-ish) | Implemented (thin) | none evident | Minimal | Backend has no merchant-scoped settlement routes (contract doc) | `src/pages/SettlementsPage.tsx` (362 bytes) |
| 18 | Reconciliation | `/dashboard/reconciliation` | Reconciliation mismatches | Implemented | `GET /api/v1/dashboard/reconciliation/mismatches` | — | — | `src/pages/ReconciliationPage.tsx` |
| 19 | Reconciliation detail | `/dashboard/reconciliation/:id` | Mismatch detail | Implemented | `GET /api/v1/dashboard/reconciliation/mismatches/:id` | — | — | `src/pages/ReconciliationDetailPage.tsx` |
| 20 | API keys | `/dashboard/api-keys` | API key create/revoke | Implemented | `GET/POST /api/v1/dashboard/api-keys`, `POST .../:id/revoke` | Complete | No atomic rotation route (backend limitation) | `src/pages/ApiKeysPage.tsx` |
| 21 | Webhook config | `/dashboard/webhook-config` | Outbound webhook endpoint + secret rotate/disable | Implemented | `GET/PUT/DELETE /api/v1/dashboard/webhook-config`, `POST .../rotate` | Complete | Secret shown once; not persisted by frontend | `src/pages/WebhookConfigPage.tsx` |
| 22 | Settings | `/dashboard/settings` | Merchant profile | Implemented | `GET /api/v1/dashboard/settings` | — | — | `src/pages/SettingsPage.tsx` |
| 23 | Team | `/dashboard/team` | Team management | Implemented | users/invitations endpoints | — | — | `src/pages/TeamPage.tsx` (362 bytes, thin) |
| 24 | Public mock payment | `/pay/:identifier` | Dev-hosted payment page (no JWT); QRIS + simulate success/fail | Implemented | `GET/POST /api/v1/mock-payments/:identifier` | Complete | Expiration shows timestamp, no countdown; dev-only | `src/pages/PublicPaymentPage.tsx` |
| 25 | Client simulator | `/client-simulator` | External client API simulator (X-API-Key, no dashboard JWT) | Implemented | external client API | Dev tool | — | `src/pages/ClientSimulatorPage.tsx` |
| 26 | Payment simulator | `/simulator` | Dev-only payment simulator | Dev-only (compiled out in prod) | mock endpoints | — | Not in production builds | `src/routes/index.tsx:58-63` |
| 27 | Checkout simulator | `/checkout/:paymentId` | Dev-only checkout simulator | Dev-only (compiled out in prod) | mock endpoints | — | Not in production builds | `src/routes/index.tsx:58-63` |

**Authentication pages:** present (`/login`, `/forgot-password`, `/reset-password`, `/accept-invitation`).
**Dashboard / transactions / details / payment creation:** all present and implemented.
**Hosted payment page:** public `/pay/:identifier` implemented; dashboard-side "open payment page" button on `PaymentDetailPage` with same-origin guard.
**QRIS simulation:** public mock page renders backend `qris_payload`; dashboard detail page documents absence of a raw QRIS payload (no fabrication).
**Merchant management / API credentials / webhook config / delivery logs / settings / team:** present.
**Developer documentation page:** none as a frontend route; documentation lives in `docs/`.
**Error/fallback pages:** `NotFoundPage`, `RestoreErrorScreen`, `LoadingPage`, `AppErrorBoundary`, fatal startup error UI — all present.

**Missing pages (confirmed absent):** none that the current product scope requires; the README's documented route inventory matches the implemented table. "Developer documentation" is not a page in scope.

No page was classified as broken: typecheck, lint, build, and 225 tests all pass, and every route component resolves statically.

---

## Section 4 — Feature Completeness Matrix

| Feature | Existing Implementation | Status | Evidence | Required Action |
|---|---|---|---|---|
| API client with auth & refresh | Centralized fetch client, envelope validation, memory access token, HttpOnly refresh cookie, single-flight refresh | Complete | `src/lib/api/client.ts`, `src/lib/auth/service.ts` | None; verify live backend contract alignment |
| Login / logout / session restore | `POST /login`, `POST /logout`, `GET /me`, refresh on 401 + proactive 60s-before-expiry refresh | Complete | `src/lib/auth/service.ts:140-237`, `context.tsx:110-119` | None |
| Protected routes + role guards | `ProtectedRoute`, `RequireRole`, `RESTRICTED_ROUTES` | Complete | `src/features/auth/ProtectedRoute.tsx`, `src/lib/auth/permissions.ts:72-78`, `src/routes/index.tsx:94` | None |
| Dashboard metrics (total/successful/unsuccessful/pending/paid/revenue/success rate) | All from `GET /api/v1/dashboard/overview`; success rate computed locally | Complete (frontend) | `src/hooks/useOverview.ts`, `src/hooks/overviewQuery.ts`, `src/pages/DashboardPage.tsx:55` | Verify backend actually exposes these fields |
| Transaction volume over time | `GET /api/v1/dashboard/analytics` revenue_trend buckets, zero-filled by backend | Complete | `src/hooks/analyticsQuery.ts`, `src/components/dashboard/RevenueTrendChart.tsx` | Verify backend contract |
| Transaction status distribution | Per-status counts (created/pending/paid/failed/expired/cancelled) in overview stats | Complete | `types/backend.ts:8-23`, `src/hooks/overviewQuery.ts:28-32` | None |
| Recent transactions | `recent_payments` in overview response | Complete | `types/backend.ts:95` | None |
| Date-range filtering | UTC-day presets + custom, exclusive `to` end, `from`/`to` params | Complete | `src/hooks/overviewQuery.ts:151-195`, `src/hooks/paymentsQuery.ts:68-75` | None |
| Payment creation (IDR/QRIS, idempotency key) | `POST /api/v1/dashboard/payments` with `Idempotency-Key` | Complete | `src/pages/CreatePaymentPage.tsx`, `src/hooks/usePayments.ts:97-117` | None |
| Hosted payment page (no JSON rendering) | `payment_url` same-origin guard + `openPaymentPage` (`window.open noopener,noreferrer`) | Complete (frontend) | `src/pages/PaymentDetailPage.tsx:94-99`, `src/lib/utils/url.ts` | Backend `MOCK_PAYMENT_BASE_URL` topology must be configured (README) |
| QRIS rendering | Public page renders backend `qris_payload` via `qrcode.react`; dashboard detail notes absence of raw payload | Complete (no fabrication) | `src/pages/PublicPaymentPage.tsx:192-205`, `src/lib/mock-payment/contract.ts` | Expiration countdown missing (Phase 1) |
| Payment status states (pending/success/failed/expired/cancelled/invalid reference/already completed/network failure) | All handled on public page and dashboard detail | Complete | `src/pages/PublicPaymentPage.tsx:52-63,136-153`, `PaymentDetailPage.tsx:88-91` | None |
| Transaction search | Debounced search on order ID / provider ID | Complete | `src/pages/PaymentsPage.tsx:44-69,217` | None |
| Payment list filters | Status, date range, search | Partial | `src/pages/PaymentsPage.tsx:222-230`, `paymentsQuery.ts:7-76` | Add amount range + provider filters (Phase 1) |
| Pagination | `page`/`limit`, `meta.total_pages`, legacy `pagination` fallback | Complete | `src/pages/PaymentsPage.tsx:239`, `src/types/common.ts:36-41` | None |
| Sorting | Not implemented | Missing | `src/pages/PaymentsPage.tsx` (no sort state) | Add sorting (Phase 1) |
| Empty / loading / error states | Skeleton rows, `ErrorState` with retry, `EmptyState` | Complete | `src/components/ui/*`, page components | None |
| Refund creation | `POST /api/v1/dashboard/payments/:id/refunds` with idempotency key | Complete | `src/hooks/usePayments.ts:72-95`, `PaymentDetailPage.tsx:166-173` | None |
| Webhook configuration (URL, status, rotate, disable) | `GET/PUT/DELETE /api/v1/dashboard/webhook-config`, `POST .../rotate`; URL validation incl. HTTPS in production | Complete | `src/pages/WebhookConfigPage.tsx`, `src/hooks/useWebhooks.ts:14-80` | None |
| Webhook delivery log + retry | List + detail + retry for FAILED/DEAD/PENDING | Complete | `src/pages/WebhooksPage.tsx`, `WebhookDetailPage.tsx`, `useWebhooks.ts:87-139` | Payload inspection intentionally omitted |
| API key management | Create/revoke; secret shown once on create | Complete | `src/pages/ApiKeysPage.tsx` | No atomic rotation route (backend limitation, documented) |
| Team/invitations | Invite, role/status changes (OWNER) | Implemented | `src/lib/invitations/contract.ts`, `src/pages/TeamPage.tsx` | Thin page (362 bytes) — verify against backend |

---

## Section 5 — API Integration Findings

### FE-API-01 — No `openapi.yaml` in the repository
**Evidence:** `find` for `openapi*`/`*.yaml`/`*.yml` returned nothing outside `node_modules`; the only contract document is `docs/phase-10-frontend-contract.md`, which states the frontend was implemented against "the assembled Go router and handler behavior, not the generated Swagger annotations where they disagreed" and that "Swagger annotations that describe bare response objects are stale in places."
**Impact:** Contract drift between frontend, backend, and any Swagger doc cannot be detected from the repo; frontend-vs-backend mismatches would surface only at runtime.
**Correction ownership:** Backend / API specification (publish or sync `openapi.yaml`); frontend consumes what exists.
**Severity:** Medium.

### FE-API-02 — All dashboard calls omit `merchant_id`
**Evidence:** `buildPaymentsListPath` (`src/hooks/paymentsQuery.ts:34-58`) and `buildOverviewPath` (`src/hooks/overviewQuery.ts:13-19`) explicitly omit `merchant_id`; comment: "merchantId must never be added to the HTTP query string" / "backend derives merchant from JWT."
**Impact:** Correct if the backend derives merchant from the JWT (per contract doc). If the backend ever requires `merchant_id`, all list/overview calls break.
**Correction ownership:** Backend contract decision; frontend already consistent. Informational.

### FE-API-03 — Standard response envelope validated
**Evidence:** `src/lib/api/client.ts:293-305` requires `success === boolean` in the JSON body; contract doc confirms handlers return `{success, data, meta}` / `{success: false, error, meta}` envelopes; bare-object Swagger annotations are stale.
**Impact:** None — frontend correctly defends against non-envelope responses with `INVALID_RESPONSE`.
**Severity:** Informational.

### FE-API-04 — Non-JSON responses handled
**Evidence:** `readResponseBody` (`client.ts:198-207`) returns `undefined` for non-JSON/empty bodies; envelope validation then throws `INVALID_RESPONSE`.
**Impact:** None visible.
**Severity:** Informational.

### FE-API-05 — Pagination conventions
**Evidence:** `page`/`limit` query params; `ApiMeta` supports flat `total_pages` and legacy nested `pagination.total_pages` (`src/types/common.ts:36-41`); `listTotalPages` checks both.
**Impact:** Backward compatible with legacy backend shapes.
**Severity:** Informational.

### FE-API-06 — Query parameter conventions
**Evidence:** `buildPaymentsListPath` allows an explicit filter set and throws on unsupported filters (`src/hooks/paymentsQuery.ts:42-46`); dates sent as RFC3339 UTC midnights (`created_from`/`created_to`, exclusive end).
**Impact:** Prevents accidental transmission of unsupported params; date boundaries documented.
**Severity:** Informational.

### FE-API-07 — Request timeout
**Evidence:** Default 20s timeout in `requestSignal` (`client.ts:236`); configurable via `timeoutMs`; timeout → `REQUEST_TIMEOUT` error.
**Impact:** None.
**Severity:** Informational.

### FE-API-08 — Environment-specific URL assumptions
**Evidence:** `BASE_URL` comes solely from `VITE_API_BASE_URL`; no hardcoded `localhost` API URLs in client code; production build rejects non-HTTPS non-localhost origins (`client.ts:16-25`). README notes backend `MOCK_PAYMENT_BASE_URL` topology must be configured so `PaymentURL` serves the SPA (`/pay/:identifier`) route — otherwise the backend default may target a JSON endpoint or unpublished port.
**Impact:** If the backend issues `payment_url` values pointing at itself rather than the SPA, customers see JSON — the historical issue. The frontend guard (`isFrontendOrigin`, `PaymentDetailPage.tsx:96-99`) prevents *opening* such URLs, but it also suppresses the payment-page button and shows a message instead; the root fix is backend/configuration.
**Correction ownership:** Backend / environment configuration (`MOCK_PAYMENT_BASE_URL` or reverse proxy); frontend mitigation already in place.
**Severity:** High (historically critical; client-side mitigated, backend dependency remains).

### FE-API-09 — Field assumptions unverified
**Evidence:** Frontend types declare `provider`, `provider_transaction_id`, `timeline`, `order_items`, `revenue`, `unsuccessful_transactions` (`types/backend.ts`, `useOverview.ts`). The frontend repo cannot confirm the backend emits them.
**Impact:** Potential runtime `undefined` rendering (defensively handled with `?? 'Not exposed'`, optional chaining) if backend omits fields.
**Correction ownership:** Backend verification.
**Severity:** Medium (Needs Verification).

---

## Section 6 — Payment Flow Findings

### Flow trace (dashboard-initiated payment)

1. **Payment creation:** `CreatePaymentPage` → `useCreatePayment` → `POST /api/v1/dashboard/payments` with `Idempotency-Key` header (`src/hooks/usePayments.ts:97-117`). Response (`CreatePaymentResponse`) includes `transaction_id`, `payment_url`, `expired_at`, `status`. On success, navigates to `/dashboard/payments/:transaction_id`.
2. **Payment URL generation:** Backend-owned; opaque value in `payment_url`.
3. **Payment URL configuration:** Backend topology (`MOCK_PAYMENT_BASE_URL`/reverse proxy) must make the URL serve the SPA `/pay/:identifier` route (README §Phase 11.2B).
4. **Frontend routing:** `/pay/:identifier` → `PublicPaymentPage`, outside `AuthLayout`/`ProtectedRoute`, no dashboard JWT/cookies (`src/routes/index.tsx:73`).
5. **Hosted payment page rendering:** `PublicPaymentPage` fetches `GET /api/v1/mock-payments/:identifier` via `publicApiClient` (`skipAuth`, `credentials: 'omit'`) (`src/hooks/useMockPayments.ts:15-23`, `src/lib/mock-payment/api.ts:9-16`).
6. **Payment data retrieval:** Validated by `isMockPaymentResponse` (`src/lib/mock-payment/contract.ts:28-39`) — reference, amount, currency, method, status, `expired_at`, `provider_transaction_id`, optional `qris_payload`.
7. **Payment method presentation:** Shown as text; QRIS branch renders QR.
8. **QRIS rendering:** `MockPaymentQrCode` renders the backend-provided `qris_payload` string via `qrcode.react`; if absent, an informational message is shown and **no replacement QR is generated** (`src/pages/PublicPaymentPage.tsx:198-204`).
9. **Payment status updates:** `refetchInterval: 3_000` while `PENDING` and not past expiry (`src/lib/mock-payment/contract.ts:62-67`); `effectiveMockPaymentStatus` downgrades past-expiry `PENDING` to `EXPIRED` (`contract.ts:55-60`).
10. **Payment completion / terminal states:** `PAID`, `FAILED`, `EXPIRED` terminal panels; simulation buttons (`POST .../success`, `.../fail`) disabled when not pending; mutation invalidates the query so the DTO is refetched from the provider (`useMockPaymentTransition`, `src/hooks/useMockPayments.ts:25-36`).

### Historical JSON-display issue
**Resolved on the dashboard side:** `PaymentDetailPage` validates `payment_url` with `safeHttpUrl` and `isFrontendOrigin` (same-origin as the dashboard) before exposing an "Open payment page" button; unsafe URLs yield an explanatory message instead of navigation (`PaymentDetailPage.tsx:46-53, 94-99`). `openPaymentPage` (`src/lib/utils/url.ts:16-19`) opens the exact backend URL in a new tab with `noopener,noreferrer` and never reconstructs it.
**Remaining dependency:** The backend must actually issue `payment_url` values that resolve to the SPA. Documented in README; classified as a backend/configuration dependency, not a frontend defect.

### Payment state coverage
| State | Handling | Evidence |
|---|---|---|
| Pending | Polling 3s (public), 5s (dashboard detail), status banners | `mock-payment/contract.ts:62-67`, `src/hooks/usePayments.ts:34-36` |
| Successful | Terminal panel; refund offered on detail | `PublicPaymentPage.tsx:52-63`, `PaymentDetailPage.tsx:151` |
| Failed | Terminal panel; simulation button disabled | `PublicPaymentPage.tsx:56-58` |
| Expired | Terminal panel; `effectiveMockPaymentStatus` downgrades stale PENDING | `contract.ts:46-60`, `PublicPaymentPage.tsx:59-61` |
| Cancelled | Domain status exists (`types/common.ts:44`); appears in list filters | `PaymentsPage.tsx:229` |
| Invalid payment reference | 404 → "Payment not found" error state | `PublicPaymentPage.tsx:126-136`, `paymentListErrorCopy` |
| Already completed | Terminal state; simulation actions hidden (`!isPending`) | `PublicPaymentPage.tsx:249-253` |
| Network / API failure | `ErrorState` with retry; offline → `NETWORK_ERROR` message | `client.ts:246-254`, page error handling |

### QRIS specifics
- **Data source:** backend `qris_payload` string only; never synthesized.
- **Rendering:** `MockPaymentQrCode` (`src/components/mock-payment/MockPaymentQrCode.tsx`) via `qrcode.react`, disabled when not pending.
- **Amount / instructions / expiration:** amount and `merchant_order_id` displayed; `expired_at` shown as formatted timestamp (no countdown timer); instructions listed.
- **Status refresh:** 3s refetch while pending; stops at terminal states.
- **Expired payment handling:** effective status `EXPIRED` after `expired_at` passes; simulation disabled.
- **Mobile responsiveness:** card-based layout, no fixed widths; not device-tested in this audit.
- **No frontend-initiated status changes:** success/fail are provider actions via backend endpoints; the dashboard payment is not updated directly (`PublicPaymentPage.tsx:229` comment).

### Automated simulation controls
Exist only on the public development mock page (`/pay/:identifier`), behind no auth (intentionally, per README). They call `POST /api/v1/mock-payments/:id/success|fail` — provider actions; dashboard is not updated directly. No dashboard-side "simulate payment" controls exist; the dedicated simulator routes (`/simulator`, `/checkout/:paymentId`) are compiled out of production.

**Finding FE-PAY-01:** No expiration countdown on the QRIS page (timestamp only). Severity: Low.
**Finding FE-PAY-02:** `payment_url` same-origin guard may suppress the payment-page button if backend topology is misconfigured; message explains it. Correct UX degradation; backend dependency documented. Severity: Informational (mitigated).
**Finding FE-PAY-03:** Dashboard payment detail does not display webhook delivery information for the payment (delivery list/detail are separate pages). Severity: Informational.

---

## Section 7 — Authentication and Security Findings

### Verified security properties (evidence-based)

1. **No secrets in source code.** `.env.example` warns against secrets in `VITE_*`; `.env`/`.env.*` gitignored; `qr.ts` rejects simulator payloads containing `secret`, `api_key`, `server_key`, `webhook`, `bearer`, etc. (`src/lib/simulator/qr.ts:27-41`). Severity: none.
2. **Access tokens never in browser storage.** `tokenStorage` is module memory (`src/lib/auth/service.ts:17-29`); type comment: "Never persist this value in browser storage."
3. **Refresh token never touched by JS.** HttpOnly cookie; `credentials: 'include'` only; `setApiClientTokenGetter` returns the memory access token (`service.ts:278`).
4. **No credentials/payment data in logs or errors.** `errorMessage` returns only safe strings; `safeCodeMessages` allowlist; `fieldError` strips control characters and truncates to 300 chars (`src/lib/api/errors.ts:5-21`); public payment page explicitly does not display raw provider response bodies or signing material (`WebhookDetailPage.tsx:45`, `PublicPaymentPage.tsx`).
5. **No unvalidated redirects.** `openPaymentPage` opens the exact backend URL (no `redirect=` parameter handling); `safeHttpUrl` rejects `javascript:` and relative URLs (`src/lib/utils/url.test.ts:6-9`).
6. **Webhook URL validation:** `URL` type check, HTTPS required in production builds (`import.meta.env.MODE === 'production'`), rejection of embedded username/password (`src/pages/WebhookConfigPage.tsx:28-40`); backend performs destination safety (SSRF/private/reserved) per page description.
7. **Sensitive one-time values handled cautiously:** webhook signing secret and API key secret shown once, maskable, copy-to-clipboard, "I have saved the secret" clearance (`WebhookConfigPage.tsx:66-111`); API key `secret` typed as create-only response (`types/backend.ts:243-253`).

### Potential risks (require backend confirmation; not claimed as vulnerabilities)

- **FE-SEC-01:** Access token lives in JS memory for up to its TTL (backend default 15 min per contract doc). XSS could exfiltrate it; this is inherent to SPAs and mitigated by short TTL + HttpOnly refresh + bounded stateless contract (no blacklist on logout; token valid until natural `exp`, `docs/phase-10-frontend-contract.md:27-28`). Severity: Medium. Mitigation: none feasible frontend-side beyond existing short TTL; ensure CSP in deployment (README §Deployment).
- **FE-SEC-02:** Timestamps rendered in local browser time while filters use UTC — a display inconsistency, not a vulnerability. Severity: Low.
- **FE-SEC-03:** Frontend role checks (`permissions.ts`) are UX hints; backend authorization is authoritative — correctly documented. No finding.
- **FE-SEC-04:** `webhookReceiver.ts` / client simulator uses `X-API-Key` auth outside the dashboard session — intended dev tool, compiled considerations apply. Severity: Informational.

### Severity-classified findings

| ID | Severity | Finding | Mitigation |
|---|---|---|---|
| FE-SEC-01 | Medium | Access token in memory valid until TTL; XSS theft possible | CSP/HSTS/deployment hardening (README); short TTL already set by backend |
| FE-SEC-02 | Low | Local-time timestamp display vs UTC filter boundaries | Align display to UTC or show timezone (Phase 3) |
| FE-SEC-03 | Informational | No `openapi.yaml`; contract drift risk | Publish/sync OpenAPI (backend/API spec) |

No Critical or High severity security findings were verified in the frontend.

---

## Section 8 — UI/UX Findings

### Consistency
- Single design-system component library (`src/components/ui`); semantic Tailwind tokens; `cn()`/`tailwind-merge` utility.
- Status badges: `PaymentStatusBadge`, `WebhookStatusBadge` — consistent status→variant mapping.
- Empty states, skeletons, and `ErrorState` used consistently across pages.
- Long identifiers handled with `font-mono text-xs`, `break-all`, and truncation (`transaction_id.slice(0, 8)…` in the payments list).
- Currency: `Intl.NumberFormat('id-ID')`, IDR, integer minor units; display only, never for calculation (`format.ts:5-12`).
- Timestamps: `Intl.DateTimeFormat('id-ID')` local time — inconsistent with UTC date-range filters (see FE-SEC-02).

### Navigation
- Sidebar with role-filtered entries, active-route highlighting via `NavLink`, skip-to-content link, mobile drawer with Escape/click-outside close, `aria-modal` dialog role (`DashboardLayout.tsx:72-76`).
- Breadcrumbs: none present; not required for the current flat hierarchy.

### Accessibility (observed)
- Skip link, `sr-only` focusable styles, `role="tablist"`/`role="tab"`/`role="tabpanel"` on dashboard tabs with keyboard arrow navigation (`DashboardPage.tsx:57-65`), `aria-label` on icon buttons, `aria-live="polite"` on status/range announcements, `htmlFor` label associations, `role="status"`, `role="alert"`.
- Focus styles rely on Tailwind defaults (`focus-visible:ring`); no formal contrast audit performed in this review (visual verification would need a deployed instance).
- Modal behavior: `Dialog` component present; no focus-trap inspection performed (Needs Verification).

### Responsive design
- Sidebar hidden below `md`, drawer overlay/panel on mobile (`DashboardLayout.tsx:51-86`); tables are card-based with responsive classes; no horizontal scroll issues evident statically. Not device-tested.

### Gaps
- **No toast notification component:** feedback is inline only (`ErrorState`, alert banners). Inventory of `src/components/ui` confirms no Toast. Severity: Low.
- **No sorting** on payments list. Severity: Medium (operational).
- **No expiration countdown** on QRIS page. Severity: Low.
- **Timestamp timezone inconsistency** (local vs UTC). Severity: Low.
- Build chunk warning: `index-DFHdagtM.js` + `App-s99xlx7c.js` exceed 500 kB minified — code-splitting opportunity (Vite warning only). Severity: Informational.

---

## Section 9 — Testing Results

Commands executed (all non-destructive, no dependency changes, no tracked-file modifications; `dist/` and `*.tsbuildinfo` are gitignored):

| Command | Result | Notes |
|---|---|---|
| `npm run typecheck` (`tsc -b --pretty false`) | PASS | Exit code 0 |
| `npm run lint` (`eslint .`) | PASS | Exit code 0 |
| `npm test` (`scripts/run-tests.sh` → esbuild bundle + `node:test`) | PASS | 34 test files, 225 tests, 0 fail, 0 skip, 0 todo |
| `npm run build` (`tsc -b && vite build`) | PASS | Production bundle built; only a chunk-size warning (>500 kB) |

### Test inventory (34 files)
Auth/session: `src/lib/auth/service.test.ts`, `permissions.test.ts`, `restore.contract.test.ts`, `logout-cache.contract.test.ts`, `features/auth/RequireRole.test.tsx`, `features/auth/RestoreErrorScreen.test.tsx`
API client: `src/lib/api/client.test.ts` (refresh retry, POST no-retry, public client auth skipping)
Payment flow: `src/lib/mock-payment/api.test.ts`, `contract.test.ts`, `src/pages/PublicPaymentPage.test.tsx`, `src/lib/simulator/polling.test.ts`, `qr.test.ts`
Dashboard data: `src/hooks/overviewQuery.test.ts`, `analyticsQuery.test.ts`, `paymentsQuery.test.ts`, `usePayments.cache.test.ts`, `invalidation.test.ts`
Pages/components: `src/pages/LoginForgotPassword.test.tsx`, `PasswordResetPages.test.tsx`, `NotFoundPage.test.tsx`, `components/layout/Sidebar.test.tsx`, `components/payments/ProductDetailsCard.test.tsx`, `components/products/ProductImageUpload.test.ts`, `ProductModalClose.test.ts`
Utilities: `src/lib/utils/format.test.ts`, `url.test.ts`, `documentTitle.test.ts`, `fatalStartupError.test.ts`, `src/routes/index.test.ts`, `src/types/common.test.ts`, `src/lib/catalog/*`, `src/lib/invitations/contract.test.ts`

### Coverage gaps (meaningful workflows without dedicated page/component tests)
1. Authentication end-to-end (login→protected page→expiration) — service-layer contracts exist, no page-level test
2. Payment creation — no `CreatePaymentPage` test
3. Hosted payment page navigation — `PublicPaymentPage.test.tsx` exists; deep flow not E2E-tested
4. QRIS payment rendering — `qr.test.ts` covers helpers, not the page component
5. Payment status updates — covered at helper level only
6. Transaction filtering — `paymentsQuery.test.ts` covers path building, not the page
7. Webhook configuration — no `WebhookConfigPage`/`WebhooksPage` tests
8. Webhook delivery inspection — no tests
9. Session expiration — `restore.contract.test.ts` / `logout-cache.contract.test.ts` cover contracts, not UI
10. Error handling — covered at client/util level, not page level

No E2E tooling, no coverage thresholds, no CI configuration inspected in this repo (CI files absent from listing). Mocking strategy: manual `fetch` mocking in tests; no MSW/nock.

---

## Section 10 — Prioritized Findings

Severity definitions: **Critical** — severe, demonstrable issue compromising core functionality or security. **High** — major defect affecting a critical user journey or important security control. **Medium** — meaningful usability/reliability/functional gap. **Low** — minor issue, limited operational impact. **Informational** — observation or optional improvement.

| ID | Finding | Severity | Evidence | Impact | Recommended Action |
|---|---|---|---|---|---|
| FE-001 | `openapi.yaml` absent; contract drift undetectable from repo; Swagger annotations stale | Medium | `docs/phase-10-frontend-contract.md:3-5,39-40`; `find` found no OpenAPI file | Backend/frontend contract mismatches surface only at runtime | Publish/sync `openapi.yaml` (backend/API spec); frontend continue consuming assembled behavior |
| FE-002 | Backend-issued `payment_url` may point outside SPA (historical JSON-render issue); frontend same-origin guard mitigates but suppresses the button | High | README §Phase 11.2B; `src/pages/PaymentDetailPage.tsx:94-99`; `src/lib/utils/url.ts` | Customers cannot reach hosted payment page; trust/critical journey broken | Backend: configure `MOCK_PAYMENT_BASE_URL`/reverse proxy so `PaymentURL` serves `/pay/:identifier`; Frontend: keep guard, verify end-to-end in dev topology |
| FE-003 | Frontend assumes backend fields (`provider`, `timeline`, `unsuccessful_transactions`, `revenue`, mock `qris_payload`) not verifiable from frontend repo | Medium | `types/backend.ts`; `src/hooks/useOverview.ts:58-74` | Runtime `undefined` rendering if backend omits fields (defensively handled) | Verify backend response shapes; align types if missing |
| FE-004 | Payments list lacks server-aware sorting | Medium | `src/pages/PaymentsPage.tsx` (no sort state) | Operational inefficiency for high-volume merchants | Add sorting (Phase 1) |
| FE-005 | QRIS page shows `expired_at` timestamp; no expiration countdown | Low | `src/pages/PublicPaymentPage.tsx:187`; `src/lib/mock-payment/contract.ts:62-67` | Users must compute remaining time themselves | Add countdown tied to `expired_at` (Phase 1) |
| FE-006 | No toast notification component; feedback is inline only | Low | `src/components/ui/` inventory (no Toast) | Less immediate feedback for asynchronous actions | Add toast (Phase 3) |
| FE-007 | Timestamp display in local browser time vs UTC date-range boundaries | Low | `src/lib/utils/format.ts:17-21`; `src/hooks/overviewQuery.ts:151-195` | Possible user confusion at day boundaries | Align display or expose timezone (Phase 3) |
| FE-008 | Missing filters: amount range, payment provider (merchant filter not applicable — derived from JWT) | Medium | `src/hooks/paymentsQuery.ts:7-16`; `src/pages/PaymentsPage.tsx:222-230` | Filtering gaps for operations | Add amount-range + provider filters (Phase 1) |
| FE-009 | No page-level/E2E tests for payment and webhook journeys | Medium | 34 test files inventory; `src/pages/` tests limited to login/reset/not-found | Regressions in critical paths rely on manual testing | Add component tests for PaymentsPage/PaymentDetailPage/PublicPaymentPage/webhooks; consider E2E (Phase 4) |
| FE-010 | Build chunks > 500 kB minified | Informational | `npm run build` output | Slower initial load | Code-split (optional, Phase 3/4) |
| FE-SEC-01 | Access token in JS memory valid until backend TTL (XSS theft vector inherent to SPA) | Medium | `src/lib/auth/service.ts:6-29`; contract doc: 15 min TTL, no blacklist | Session theft window bounded by TTL | Deployment hardening (CSP); already mitigated by short TTL + HttpOnly refresh |
| FE-SEC-02 | No secrets embedded; tokens not stored; errors sanitized | Informational (positive) | `errors.ts`, `service.ts`, `.env.example` | None | Maintain current practice |

No Critical findings. Severities were not inflated: missing optional features (e.g. amount-range filter) are Medium operational gaps, not defects; unimplemented backend capabilities (settlements, raw QRIS payload, atomic key rotation) are explicitly documented as backend limitations, not frontend bugs.

---

## Section 11 — Recommended Improvement Roadmap

### Phase 0 — Correctness and Critical Defects

| ID | Objective | Current Problem | Evidence | Proposed Solution | Dependencies | Expected Outcome | Priority | Complexity |
|---|---|---|---|---|---|---|---|---|
| FE-002 remediation | Payment URL flow provably renders a payment page, never JSON | Backend `PaymentURL` topology unverified; historical JSON issue | README §Phase 11.2B; `PaymentDetailPage.tsx:94-99` | Verify `/pay/:identifier` loads a rendered page in the dev topology; confirm `MOCK_PAYMENT_BASE_URL`/`reverse proxy` configured so `PaymentURL` serves the SPA | Backend/configuration (MOCK_PAYMENT_BASE_URL); outside frontend scope | End-to-end payment URL flow validated | Critical | Medium (mostly backend) |
| FE-003 remediation | Confirm backend response shapes match frontend types | Fields assumed, not verified | `types/backend.ts`, `useOverview.ts` | Backend team to confirm `provider`, `timeline`, `unsuccessful_transactions`, `revenue`, mock `qris_payload`; frontend aligns types if needed | Backend | Contract confidence; no runtime undefined surprises | High | Small (frontend) |
| FE-009a | Add page tests for payment pages | No `PaymentsPage`/`PaymentDetailPage`/`PublicPaymentPage` page tests | Section 9 coverage gaps | Add component tests for list, detail, and public page flows | None (existing test infra) | Regression safety for payment journey | High | Small |

### Phase 1 — Core Operational Experience

| ID | Objective | Current Problem | Evidence | Proposed Solution | Dependencies | Expected Outcome | Priority | Complexity |
|---|---|---|---|---|---|---|---|---|
| FE-004 | Sorting on payments list | No sort state | `PaymentsPage.tsx` | Add sortable columns (date, amount, status) backed by existing query params if backend supports; else client-side sort of the fetched page | Backend sort param support (Needs Verification) | Faster transaction lookup | High | Small |
| FE-008 | Amount-range + provider filters | Missing optional filters | `paymentsQuery.ts:7-16` | Add `amount_min`/`amount_max`, `provider` to `ListPaymentsParams` only if backend exposes them | Backend endpoint params | Better filtering | Medium | Small |
| FE-005 | QRIS expiration countdown | Timestamp only | `PublicPaymentPage.tsx:187` | Add countdown derived from `expired_at`; stop at terminal states | None | Better UX for QRIS payers | Medium | Small |
| FE-009b | Extend test coverage to webhook/dashboard pages | No webhook/page tests | Section 9 | Add tests for `WebhooksPage`, `WebhookConfigPage`, `DashboardPage` | None | Regression safety | Medium | Small |

### Phase 2 — Merchant Integration Experience

| ID | Objective | Current Problem | Evidence | Proposed Solution | Dependencies | Expected Outcome | Priority | Complexity |
|---|---|---|---|---|---|---|---|---|
| — | API key rotation UI | No atomic rotation route | `docs/phase-10-frontend-contract.md:35` | UI already explains boundary; no frontend substitute | Backend rotation route | n/a (blocked by backend) | — | — |
| — | Raw webhook payload inspection | Deliberately omitted (security) | `WebhookDetailPage.tsx:45` | None — backend must offer safe payload inspection | Backend | n/a (blocked by backend) | — | — |
| — | Settlements page substance | Thin stub (362 bytes) | `SettlementsPage.tsx`; contract doc: no merchant-scoped settlement routes | Backend settlement routes | Backend | n/a (blocked by backend) | — | — |

Phase 2 items are listed for completeness; most are blocked by missing backend capabilities and are intentionally not frontend-substituted.

### Phase 3 — UI/UX and Accessibility

| ID | Objective | Current Problem | Evidence | Proposed Solution | Dependencies | Expected Outcome | Priority | Complexity |
|---|---|---|---|---|---|---|---|---|
| FE-006 | Toast notifications | Inline-only feedback | `components/ui/` inventory | Add a toast component for async action feedback | None | Polished feedback | Low | Small |
| FE-007 | Timestamp/UTC consistency | Local time display vs UTC filters | `format.ts:17-21`, `overviewQuery.ts` | Align display (UTC label or timezone toggle) | None | Less confusion | Low | Small |
| FE-010 | Code-split large chunks | >500 kB chunks | `vite build` output | `manualChunks` or route-level splitting | None | Faster load | Low | Small |
| — | Formal contrast/focus audit | Not performed statically | Section 8 | Accessibility review on a deployed build | Deployed instance | WCAG confidence | Low | Medium |

### Phase 4 — Reliability and Quality Assurance

| ID | Objective | Current Problem | Evidence | Proposed Solution | Dependencies | Expected Outcome | Priority | Complexity |
|---|---|---|---|---|---|---|---|---|
| FE-009c | E2E tests for critical journeys | No E2E tooling | Section 9 | Add E2E (login, payment create→detail→open page, webhook retry) | Tooling selection | High-confidence releases | Medium | Large |
| — | Coverage thresholds | None configured | Section 9 | Add coverage config if E2E/unit suite grows | Test suite maturity | Measurable quality | Low | Small |

---

## Section 12 — Next Implementation Recommendation

**Recommended phase: Phase 0 — Correctness and Critical Defects**, limited to frontend-controllable scope plus documented backend dependencies.

**Why first:** The payment flow is the revenue-critical user journey and the site of the project's previous production incident (payment URL rendering JSON). The frontend already contains the correct mitigation (same-origin guard + exact-URL `window.open`), but its effectiveness depends on the backend issuing `payment_url` values that resolve to the SPA — a configuration the frontend cannot fix alone. Verifying this flow end-to-end, confirming backend response shapes, and adding regression tests for the payment pages de-risk everything else. Phase 1+ (sorting, filters, countdowns, toasts) are valuable but are enhancements on a flow that must first be proven correct.

**Expected scope:**
1. Confirm in the development topology that opening `GET /api/v1/mock-payments/:identifier` → `/pay/:identifier` renders the frontend payment page (not JSON), and that dashboard `payment_url` values pass the same-origin guard; document the required `MOCK_PAYMENT_BASE_URL`/reverse-proxy configuration (backend task).
2. Backend confirmation that `provider`, `timeline`, `unsuccessful_transactions`, `revenue`, and mock `qris_payload` are emitted; frontend type alignment if gaps exist.
3. Add component tests for `PaymentsPage`, `PaymentDetailPage`, and `PublicPaymentPage` (payment create→detail→page-open flow) using the existing `scripts/run-tests.sh` infrastructure.

**Acceptance criteria:**
- `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` remain green.
- Payment URL opens a rendered frontend page in dev; no JSON rendering.
- Page-level tests exist for the payment list, detail, and public mock payment page.
- Documented backend configuration requirement for `payment_url` topology.

No implementation is performed during this audit.

---

## Section 13 — Non-Goals and Deferred Improvements

**Features that already work and must not be reimplemented:** API client with refresh/session handling; authentication guards; payment creation with idempotency keys; hosted payment page with same-origin guard; QRIS rendering from backend payload (no fabrication); dashboard metrics and transaction list with search/filters/pagination; webhook config/delivery/retry; all 225 existing tests.

**Limited value at current stage:** atomic API-key rotation (frontend cannot substitute the missing backend route — documented boundary), raw webhook payload display (deliberately omitted for security), settlements page substance (no backend merchant-scoped settlement routes), a complete redesign or new UI library (no demonstrated need; existing library is consistent).

**Blocked by missing backend capabilities:** merchant-scoped settlements, raw QRIS/EMV payload in dashboard payment API (only the public mock DTO exposes `qris_payload`), dashboard payment cancellation route, webhook payload inspection.

**Requiring further product decisions:** multi-currency aggregation (types are single-currency IDR), E2E tooling selection, coverage thresholds, timezone display policy.

**Areas needing additional testing before conclusions:** live-backend contract alignment (Section 5, FE-003), payment-URL topology in production (Section 6), accessibility contrast on a deployed build, mobile device behavior, concurrent-token-refresh behavior under real network conditions.

---

### Repository Integrity (audit confirmation)

- Application source code: **not changed.**
- Configuration/dependency files (`package.json`, `package-lock.json`, `.env.*`, `vite.config.ts`, `tailwind.config.js`, `eslint.config.js`, `tsconfig.*`): **not changed.**
- Pre-existing uncommitted user modifications: **preserved** (working tree left exactly as found, including modified and untracked files).
- Validation commands executed: `npm run typecheck` (PASS), `npm run lint` (PASS), `npm test` (225/225 PASS), `npm run build` (PASS). These write only to gitignored outputs (`dist/`, `*.tsbuildinfo`, temp test dir) and no tracked files.
- The only new artifact is this report: `docs/frontend-audit-report.md`. No prior audit report existed in `docs/` (only `docs/phase-10-frontend-contract.md`), so nothing was overwritten.
