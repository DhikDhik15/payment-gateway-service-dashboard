# PayGate Merchant Dashboard

Production-oriented React dashboard for merchants using the PayGate backend API.

## Stack

- React 18 + TypeScript 5.6
- Vite 6
- React Router 7 (v6-compatible data-router APIs)
- TanStack Query 5
- React Hook Form + Zod
- Tailwind CSS 3
- `qrcode.react` is used by the explicitly development-only mock payment page to render the backend-provided QRIS payload; the production dashboard API still exposes no raw QRIS payload.

## Run locally

Requires Node.js 20.19 or newer.

```bash
npm install
cp .env.example .env
npm run dev
```

`VITE_API_BASE_URL` must point at the backend origin. The backend must allow the dashboard origin through CORS and must use HTTPS outside local development.

## Quality gates

```bash
npm run lint
npm run typecheck
npm run build
npm test
```

The test script uses the already-installed esbuild binary to bundle TypeScript tests before invoking Node's built-in test runner, so it does not depend on Node's experimental TypeScript loader.

## Environment and deployment

| Variable | Required | Description |
|---|---:|---|
| `VITE_API_BASE_URL` | production | Backend origin. Non-local production origins must use HTTPS. |
| `VITE_ENABLE_SIMULATOR` | no | Must be `true` only in a non-production development build. Defaults to false. |

The local production-mode env file is intentionally empty for the API origin; the built app fails closed until a real HTTPS `VITE_API_BASE_URL` is injected by the deployment. All `VITE_*` values are public browser configuration. Never put API keys, passwords, refresh tokens, webhook secrets, invitation tokens, or provider credentials in environment variables, URL parameters, local storage, session storage, or IndexedDB.

The production host must rewrite browser-router paths (`/login`, `/pay/*`, `/dashboard/*`, `/accept-invitation`, and any enabled development routes) to `index.html`. Configure HTTPS, HSTS, CSP, `frame-ancestors`, and `Referrer-Policy: no-referrer` at the edge or web server.

## Architecture

```text
React pages
  -> feature hooks / TanStack Query
  -> centralized src/lib/api/client.ts
  -> PayGate dashboard REST API
```

- Dashboard calls use a short-lived Bearer access token held in JavaScript memory.
- Public mock-payment calls use a separate no-auth/no-cookie client and never inherit dashboard credentials.
- The refresh token is an HttpOnly, SameSite cookie managed by the browser. It is never read or stored by the SPA.
- A single-flight refresh path handles concurrent 401 responses; only GETs are retried automatically. Mutations require an explicit safe/idempotency policy.
- Merchant identity is always derived from the authenticated user. The UI never sends `merchant_id` in dashboard requests.
- API errors are normalized into `ApiClientError`; pages handle loading, empty, error, and success states without displaying stack traces or provider response bodies.

## Implemented routes

### Public

- `/login`
- `/accept-invitation?token=...` (the token is captured and removed from browser history as early as possible; the backend contract uses a query token)
- `/pay/:identifier` (public development mock-payment page; no dashboard JWT)
- Development-only `/simulator` and `/checkout/:paymentId` when explicitly enabled

### Authenticated

- `/dashboard`
- `/dashboard/payments`
- `/dashboard/payments/new`
- `/dashboard/payments/:id`
- `/dashboard/refunds` and detail
- `/dashboard/webhooks` and delivery detail
- `/dashboard/reconciliation` and mismatch detail
- `/dashboard/api-keys`
- `/dashboard/webhook-config`
- `/dashboard/settings`
- `/dashboard/team`

## Backend contract notes

See [`docs/phase-10-frontend-contract.md`](docs/phase-10-frontend-contract.md) for the route inventory and implementation discrepancies.

The frontend consumes the existing Phase 8/9 dashboard routes for authentication, merchant settings, team users, invitations, overview, payments, refunds, webhooks, reconciliation, API keys, and legacy credential migration. It does not invent merchant-scoped settlement endpoints.

The current backend does not expose:

- an atomic dashboard API-key rotation route (create and revoke are available; the merchant API-key integration route is separate);
- a raw QRIS/EMV payload or QR image in the production dashboard payment API (the public development mock-payment API does expose its transaction-specific `qris_payload`, which the public page renders without creating a replacement);
- merchant-scoped settlement lists;
- a dashboard payment cancellation route.

These remain backend contract limitations rather than client-side substitutes.

### Phase 11.2B public mock payment contract

The public `/pay/:identifier` route reads `GET /api/v1/mock-payments/:identifier` and uses only the PaymentURL returned by the canonical payment detail response. Configure the backend's `FRONTEND_PUBLIC_URL` (or an equivalent reverse proxy) so that the returned `payment_url` — `{FRONTEND_PUBLIC_URL}/pay/{providerTxId}` — serves this public SPA route; the frontend never rewrites it. `MOCK_PAYMENT_BASE_URL` is deprecated and must not be used. Without that explicit topology, the backend's default PaymentURL may target the backend JSON endpoint or an unpublished port instead of the SPA. The public development simulator actions are `POST /api/v1/mock-payments/:identifier/success` and `/fail`; they are provider actions and do not directly update the merchant dashboard payment.

## Security review checklist

- No refresh token in browser storage or JavaScript.
- Access tokens and one-time secrets are memory-only and cleared from UI state after acknowledgement where practical.
- Invitation and simulator bearer credentials are not logged or persisted by the app. The backend-required invitation link necessarily contains its one-time token in the query string; the acceptance page removes it from browser history/router state as early as possible.
- Public invitation, simulator, and mock-payment requests skip dashboard Bearer/cookie auth and refresh/session-expiry handling.
- UI role/state checks are UX hints only. Backend middleware and ownership checks remain authoritative.
- Webhook destination security (HTTPS/SSRF/DNS/redirect policy) is enforced by the backend; the client only performs basic URL shape/HTTPS checks.
