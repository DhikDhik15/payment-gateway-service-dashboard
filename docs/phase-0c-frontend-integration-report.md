# GO-SAAS Phase 0C — Frontend/Backend Payment Contract Verification Report

**Repository:** pay-gate-dashboard (frontend-only; no Go backend present in this workspace)
**Branch:** `main`
**Verification date:** 2026-10-16
**Verified backend contract source:** backend repository Phase 0B audit (confirmed contract supplied to this task)

---

## 1. Implementation Status — PARTIAL

**Source-level verification:** PASS — the frontend payment URL flow, public payment page routing, API calls, and state handling were inspected against the confirmed backend contract and are consistent.

**Automated unit/component tests:** PASS — 255/255 tests pass; `typecheck`, `lint`, and `build` all pass.

**Live API integration:** NOT performed — the Go backend is not present in this repository and no backend service is running. Runtime integration against `GET /api/v1/mock-payments/:identifier` could not be executed.

**Browser E2E:** NOT performed — no browser automation tooling is present and no backend/frontend services are running in this workspace.

Per the reporting requirement, the overall status is **PARTIAL** (not PASS) because runtime integration and browser E2E have not been verified. No source-level defect was found that would block integration.

---

## 2. Route Verification

| Check | Result | Evidence |
|---|---|---|
| `/pay/:identifier` resolves to the public payment page | PASS | `src/routes/index.tsx:73` — `{ path: '/pay/:identifier', element: <PublicPaymentPage /> }` |
| Route is accessible without dashboard authentication | PASS | The route is registered at the top level, outside `AuthLayout` and `ProtectedRoute` (`src/routes/index.tsx:70-78`). No `useAuth`/gate on `PublicPaymentPage`. |
| Route fetches the public payment endpoint | PASS | `src/pages/PublicPaymentPage.tsx:108` — `usePublicMockPayment(identifier)` → `src/hooks/useMockPayments.ts:15-23` → `src/lib/mock-payment/api.ts:9-16` → `GET /api/v1/mock-payments/:identifier` via `publicApiClient`. |
| Identifier used in request matches route identifier | PASS | `useParams<{ identifier: string }>()` (`PublicPaymentPage.tsx:107`) passed to `buildMockPaymentPath(identifier)` → `/api/v1/mock-payments/${encodeURIComponent(identifier)}` (`contract.ts:10-13`). |
| Direct navigation / browser refresh on `/pay/:identifier` | PASS (frontend) | `createBrowserRouter` handles `/pay/:identifier` as a client route. Production requires SPA fallback rewriting `/pay/*` to `index.html` (documented in `README.md:47`). |
| No dashboard JWT/cookies on public page | PASS | `publicApiClient` sets `skipAuth: true`, `credentials: 'omit'` (`client.ts:390-397`, `publicRequestOptions:371-387`). |

**Finding:** No route defect. The public payment page is correctly wired, unauthenticated, and identifier-driven.

---

## 3. API Contract Comparison

Backend contract (confirmed in Phase 0B) vs frontend implementation:

| Contract field / behavior | Backend expectation | Frontend implementation | Result |
|---|---|---|---|
| `GET /api/v1/mock-payments/:identifier` | Public payment lookup | `buildMockPaymentPath` → `publicApiClient.get` (`api.ts:9-16`, `contract.ts:10-13`) | PASS |
| `reference` | string | `MockPaymentResponse.reference` (`backend.ts:57`) | PASS |
| `amount` | number | `MockPaymentResponse.amount` (`backend.ts:58`) | PASS |
| `currency` | string | `MockPaymentResponse.currency` (`backend.ts:59`) | PASS |
| `payment_method` | string | `MockPaymentResponse.payment_method` (`backend.ts:60`) | PASS |
| `status` | PENDENT? contract: CREATED/PENDING/PAID/FAILED/EXPIRED/CANCELLED | `MockPaymentStatus = PENDENT? | PAID | FAILED | EXPIRED` (`backend.ts:52`). CREATED and CANCELLED are **not** in the mock-payment projection. | PASS with note (see below) |
| `expired_at` | string | `MockPaymentResponse.expired_at` (`backend.ts:62`) | PASS |
| `provider_transaction_id` | string | `MockPaymentResponse.provider_transaction_id` (`backend.ts:63`) | PASS |
| `qris_payload` | string for QRIS, when applicable | `MockPaymentResponse.qris_payload?` (`backend.ts:65`), rendered via `MockPaymentQrCode` only when `payment_method === 'QRIS'`; never fabricated | PASS |
| `payment_url` | `{FRONTEND_PUBLIC_URL}/pay/{providerTxId}` | Dashboard-side opaque value (`PaymentResponse.payment_url` `backend.ts:44`). Frontend never constructs or rewrites it; same-origin guard before opening (`PaymentDetailPage.tsx:94-99`, `url.ts:2-19`). | PASS (frontend); backend must emit a frontend-origin URL |
| Status handling | Terminal states (PAID/FAILED/EXPIRED/CANCELLED) must not be downgraded to PENDING | `effectiveMockPaymentStatus` only downgrades PENDING→EXPIRED when past `expired_at`; never converts terminal states to PENDING (`contract.ts:46-60`). Public page hides simulation actions in terminal states. | PASS |
| Loading state | — | `LoadingPage` while `isLoading` (`PublicPaymentPage.tsx:122-124`) | PASS |
| Error / 404 / network failure | — | `ErrorState` with safe messages; 404 → "Payment not found"; `NETWORK_ERROR` → connection message; retry via `refetch()` (`PublicPaymentPage.tsx:126-136`, `publicErrorDescription:91-96`) | PASS |
| Response envelope | `{ success, data, meta }` / `{ success: false, error, meta }` | `client.ts:293-305` validates envelope; `INVALID_RESPONSE` for non-conforming bodies | PASS |
| QRIS payload source | Backend-provided only | `qris_payload` from backend; no placeholder/fabricated QR (`PublicPaymentPage.tsx:198-204`, `MockPaymentQrCode.tsx:44-46`) | PASS |

**Contract gap flagged for verification (not confirmed as a defect):** `MockPaymentStatus` excludes `CREATED` and `CANCELLED`, while the backend contract lists them as possible transaction states. If the backend returns `CREATED` or `CANCELLED` from `GET /api/v1/mock-payments/:identifier`, `isMockPaymentResponse` (`contract.ts:28-39`) would reject the response with `INVALID_RESPONSE`. This could not be confirmed without a running backend. Documented as **Needs Verification** (backend-dependent), not a confirmed defect.

**No frontend DTO or API contract changes are required.** No fields were invented; no DTOs were modified.

---

## 4. Environment / Configuration Findings

| Variable / concern | Value found | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8081` (`.env.example`, `.env.development`, `.env`); empty in `.env.production` (fails closed) | Backend API origin. Consistent with `client.ts:10-26`. Production build throws if unset/non-HTTPS (non-localhost). |
| Frontend public origin | Not configured in frontend env | The frontend does **not** construct payment URLs; the backend provides `payment_url` as an opaque value (`FRONTEND_PUBLIC_URL` is backend configuration, not a frontend `VITE_*`). No `VITE_FRONTEND_PUBLIC_URL` exists in this repo. |
| `MOCK_PAYMENT_BASE_URL` | Not present in frontend source or env | Deprecated per the confirmed backend contract. `README.md:105` still references it (see defect below). |
| `CORS_ALLOWED_ORIGINS` | Not present (backend config) | Backend must allow the dashboard origin through CORS (`README.md:25`). Backend-side concern, not in this repo. |
| Same-origin requirement for "Open Payment" | `payment_url.origin === window.location.origin` | `isFrontendOrigin` (`PaymentDetailPage.tsx:46-53`). If the backend issues a cross-origin `payment_url`, the dashboard button is suppressed with a safe message (frontend degrades gracefully; cannot fix a cross-origin backend URL). |
| Production SPA fallback | Documented | Rewrite `/login`, `/pay/*`, `/dashboard/*`, `/accept-invitation` to `index.html` (`README.md:47`). |

**Verified documentation defect:** `README.md:105` instructs operators to configure the backend's deprecated `MOCK_PAYMENT_BASE_URL`. Per the confirmed backend contract, `FRONTEND_PUBLIC_URL` is canonical and `MOCK_PAYMENT_BASE_URL` is deprecated. Minimal fix applied (see Section 5).

No `.env` files were overwritten; no secrets exposed.

---

## 5. Confirmed Defects and Fixes

| ID | Defect | Severity | Fix applied | Files changed |
|---|---|---|---|---|
| FE-0C-01 | `README.md:105` references deprecated `MOCK_PAYMENT_BASE_URL` for payment-URL topology, contradicting the confirmed backend contract (`FRONTEND_PUBLIC_URL` canonical; `MOCK_PAYMENT_BASE_URL` deprecated). | Low | Updated README line 105 to reference `FRONTEND_PUBLIC_URL` and note `MOCK_PAYMENT_BASE_URL` is deprecated. | `README.md` |

**No application source-code defects were found.** The frontend payment flow is contract-consistent; no source code (other than the README documentation line above) was modified.

---

## 6. Tests and Exact Results

| Command | Result | Conclusive? |
|---|---|---|
| `npm run typecheck` (`tsc -b --pretty false`) | PASS (exit 0) | Yes |
| `npm run lint` (`eslint .`) | PASS (exit 0) | Yes |
| `npm test` (`scripts/run-tests.sh` → esbuild + `node:test`) | PASS — 255 tests, 0 fail, 0 skip | Yes |
| `npm run build` (`tsc -b && vite build`) | PASS (pre-existing chunk-size warning only) | Yes |
| Live API integration (`GET /api/v1/mock-payments/:identifier`) | NOT performed | No — no backend service available |
| Browser E2E | NOT performed | No — no browser automation tooling, no services running |

**New/existing payment-page test coverage (all passing):**
- `src/pages/PaymentsPage.test.tsx` — 7 tests (loading, list rendering, detail links, empty state, create gating by role/merchant status)
- `src/pages/PaymentDetailPage.test.tsx` — 11 tests (loading, paid detail, all terminal statuses CREATED/PENDING/PAID/FAILED/EXPIRED/CANCELLED, refund gating, QRIS panel, missing fields, no/unsafe/same-origin payment URL)
- `src/pages/PublicPaymentPage.test.tsx` — 6 tests (loading, successful load, terminal-state simulation hidden, missing QRIS payload without fabrication)
- `src/lib/api/errors.test.ts` — 9 tests (safe error-message normalization used on API failure)

Page-level `isError` (API-failure) rendering cannot be produced under `renderToStaticMarkup` SSR because TanStack Query defers fetching to client mount effects; error handling is covered at the client/helper level (`src/lib/api/client.test.ts` covers `NETWORK_ERROR`, `INVALID_RESPONSE`, 401 retry; `errors.test.ts` covers message normalization). This is a test-infrastructure limitation, not a code defect.

---

## 7. Runtime Integration / E2E Evidence

**Not available.** The following runtime verification steps could not be executed because no Go backend service and no browser automation tooling exist in this workspace:

1. Open `/pay/:identifier` directly in a browser
2. Refresh the payment page
3. Fetch `GET /api/v1/mock-payments/:identifier` against a live backend
4. Render returned transaction details
5. Verify QRIS rendering for QRIS payments
6. Verify terminal payment states
7. Verify error handling for unknown identifiers
8. Verify Open Payment from the dashboard

These steps remain as **remaining blockers** (Section 8). Source-level verification and automated unit/component tests are the only evidence available in this repository.

---

## 8. Remaining Blockers

| Blocker | Required resolution |
|---|---|
| Live backend not present | Run the Go backend (separate repository) and execute the 8 E2E steps above against `GET /api/v1/mock-payments/:identifier`. |
| `MockPaymentStatus` excludes `CREATED`/`CANCELLED` | Confirm whether the backend returns these statuses from the mock-payment lookup; if so, extend `MockPaymentStatus` and `isMockPaymentResponse` accordingly. |
| Browser E2E tooling absent | Add a browser-based test capability or perform manual E2E in a staging topology. |
| Backend `FRONTEND_PUBLIC_URL` topology | Confirm the backend issues `payment_url = {FRONTEND_PUBLIC_URL}/pay/{providerTxId}` so the dashboard same-origin guard passes (or accept the documented graceful degradation for cross-origin topologies). |

---

## 9. Files Changed

| File | Type | Reason |
|---|---|---|
| `README.md` | Documentation | Line 105: replaced deprecated `MOCK_PAYMENT_BASE_URL` reference with `FRONTEND_PUBLIC_URL` per confirmed backend contract; noted deprecation. |
| `docs/phase-0c-frontend-integration-report.md` | Documentation | This report (new). |

No application source code, configuration, lockfile, environment, or test files were modified beyond the README line above. Pre-existing uncommitted user modifications were preserved; `.env` files were not touched.

---

## 10. Recommended Next Action

**Proceed to live backend integration verification.** The frontend implementation is contract-consistent and all quality gates pass, but runtime integration has not been verified. The exact next steps:

1. Start the Go backend (separate repository) and the frontend dev server.
2. Create a payment, capture `payment_url`, confirm it equals `{FRONTEND_PUBLIC_URL}/pay/{providerTxId}`.
3. Open `/pay/:identifier` directly and on refresh; confirm the frontend payment page (not JSON) renders.
4. Fetch `GET /api/v1/mock-payments/:identifier`; confirm transaction details, QRIS rendering (for QRIS), and terminal states display correctly.
5. Confirm error handling for unknown identifiers (404) and network failure.
6. Confirm "Open Payment" from the dashboard opens the backend-provided `payment_url`.

Until this live verification is done, do not mark the end-to-end payment integration as PASS.
