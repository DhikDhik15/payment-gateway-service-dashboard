# GO-SAAS Phase 4B — Backend Local-to-Production Configuration Audit Report

**Repository:** pay-gate-dashboard (frontend of the GO-SAAS Payment Gateway Simulator) — **frontend only**
**Backend repository:** Separate repository (not present in this workspace)
**Branch:** `main`
**Audit date:** 2026-10-16
**Constraint honored:** Audit and documentation only. No deployment performed. No CD workflow created. No application source or runtime configuration modified. No secrets exposed. Existing user changes preserved.

---

## 1. Overall Readiness — CANNOT BE DETERMINED (BACKEND NOT IN THIS REPOSITORY)

This workspace contains the **frontend only**. There is no Go backend source code, no `go.mod`, no `*.go` files, no backend configuration, no database migrations, and no Dockerfile for the backend. Consequently, the backend's actual production readiness **cannot be verified from this repository**.

All backend findings below are based on:
1. **Frontend expectations** — what the frontend code consumes from the backend API (`src/lib/api/client.ts`, hooks, types).
2. **Contract documentation** — `docs/phase-10-frontend-contract.md` and `README.md`, which describe the assembled Go router behavior.

Backend production readiness must be confirmed by auditing the separate backend repository.

---

## 2. Configuration Inventory — Backend (Expected, Not Verified)

The following backend configuration variables are **referenced by the frontend or contract documentation**, but their actual definitions, defaults, and validation logic live in the separate backend repository and could not be inspected:

| Configuration name | Expected component | Required? | Secret? | Dev-specific? | Different in production? | Source of knowledge |
|---|---|---|---|---|---|---|
| Backend API listen address / port | Go backend HTTP server | Yes | No | Yes (localhost:8081 in dev) | Yes | Frontend expects `VITE_API_BASE_URL=http://localhost:8081` (`.env.development:2`) |
| Database connection string (PostgreSQL) | Go backend | Yes | Yes (DB credentials) | Yes (local dev DB) | Yes | Frontend never connects to DB; backend owns PostgreSQL (README.md architecture) |
| `FRONTEND_PUBLIC_URL` | Go backend — payment URL generation | Yes | No | Yes (dev frontend origin) | Yes — must match deployed frontend origin | `README.md:105` |
| `CORS_ALLOWED_ORIGINS` | Go backend CORS middleware | Yes | No | Yes (dev frontend origin) | Yes — must include deployed frontend origin | `README.md:25` |
| Access token signing key / JWT secret | Go backend auth | Yes | Yes | Yes | Yes | Frontend receives JWT; backend signs (`src/lib/auth/service.ts`) |
| Refresh token signing key / session store | Go backend auth (PostgreSQL-backed refresh sessions) | Yes | Yes | Yes | Yes | `docs/phase-10-frontend-contract.md:20-31` |
| Webhook signing secret | Go backend outbound webhooks | Yes | Yes | Yes | Yes | `README.md:113` (webhook destination security) |
| Provider credentials (Midtrans server key, etc.) | Go backend payment provider simulation | Yes | Yes | Yes | Yes | `.env.example:7` (security note lists examples never to put in `VITE_*`) |
| Migrations path / migration execution | Go backend startup | Yes | No | No | No | Backend owns PostgreSQL migrations |

### What is confirmed NOT in the frontend
- No database connection variables in frontend source.
- No backend secret variables in frontend source.
- `.env.example:6-8` explicitly prohibits secrets in `VITE_*` variables.

---

## 3. Localhost and URL Dependencies — Backend (Expected)

| Occurrence | Source of knowledge | Classification |
|---|---|---|
| Backend API at `localhost:8081` | `.env.development:2`, `.env.example:11` | Expected development configuration |
| Frontend at `localhost:5173` | `docs/*` audit references; test fixtures in `src/pages/PaymentDetailPage.test.tsx` | Expected development configuration / test fixture |
| Backend `FRONTEND_PUBLIC_URL` | `README.md:105` | Configuration required later (must match deployed frontend origin) |
| Backend `CORS_ALLOWED_ORIGINS` includes frontend origin | `README.md:25` | Configuration required later |

### Needs further verification (backend not present)
- Actual backend listen address and port in production.
- Whether backend trusts a trusted proxy (for client IP / forwarded-proto).
- Actual CORS implementation and allowed origins in production.
- Whether backend enforces HTTPS and HSTS.

---

## 4. Frontend-to-Backend Integration — What the Frontend Expects

Based on frontend source and contract documentation:

### API base URL
- Frontend reads `VITE_API_BASE_URL` at build time (`src/lib/api/client.ts:13`).
- All dashboard fetch calls prefix `BASE_URL` to the path (line 226).
- Production build throws if unset or non-HTTPS non-localhost (`client.ts:16-25`).
- **Cannot be changed at runtime** — requires rebuild.

### Authentication and session
- `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `POST /api/v1/auth/refresh`, `GET /api/v1/auth/me` (`docs/phase-10-frontend-contract.md:7`).
- Access token: short-lived Bearer JWT (backend default 15 min per contract doc), returned in login response, held in frontend memory only.
- Refresh token: PostgreSQL-backed refresh session, HttpOnly SameSite cookie managed by browser (`docs/phase-10-frontend-contract.md:20-31`, `README.md:60`).
- Frontend single-flight refresh on 401; logout sends memory bearer so backend can revoke stable session ID (`docs/phase-10-frontend-contract.md:20-31`).
- Logout does **not** create a JWT blacklist; already-issued JWT remains usable until natural `exp` (`docs/phase-10-frontend-contract.md:27-29`).

### Payment processing
- `POST /api/v1/dashboard/payments` with `Idempotency-Key` header (`src/hooks/usePayments.ts:97-117`, `docs/phase-10-frontend-contract.md:9`).
- Response includes `payment_url` (opaque backend value), `transaction_id`, `expired_at`, `status` (`types/backend.ts:75-87`).
- Backend generates `payment_url = {FRONTEND_PUBLIC_URL}/pay/{providerTxId}` (`README.md:105`).
- `GET /api/v1/dashboard/payments/:payment_id` for detail (`docs/phase-10-frontend-contract.md:9`).
- `POST /api/v1/dashboard/payments/:payment_id/refunds` for refunds (`docs/phase-10-frontend-contract.md:10`).

### Webhooks
- **Provider-to-gateway webhooks:** Backend-consumed (not frontend).
- **Gateway-to-merchant outbound webhooks:** `GET/PUT/DELETE /api/v1/dashboard/webhook-config`, `POST /api/v1/dashboard/webhook-config/rotate` (`docs/phase-10-frontend-contract.md:13`); `GET /api/v1/dashboard/webhooks`, `GET /api/v1/dashboard/webhooks/:id`, `POST /api/v1/dashboard/webhooks/:id/retry` (`docs/phase-10-frontend-contract.md:14`).
- Frontend inspects delivery metadata only; does not display raw provider response bodies or signing material (`src/pages/WebhookDetailPage.tsx:45`).
- Frontend does **not** assume successful transaction = successful webhook delivery (`docs/phase-10-frontend-contract.md`, Phase 0C findings).

### Public payment page
- `GET /api/v1/mock-payments/:identifier` (public, no auth) (`src/lib/mock-payment/api.ts:9-16`).
- `POST /api/v1/mock-payments/:identifier/success` and `/fail` (provider actions, dev-only) (`README.md:105`).
- Backend exposes `qris_payload` for QRIS payments in the public mock-payment DTO (`types/backend.ts:65`).

### What the frontend does NOT expect from backend
- Atomic dashboard API-key rotation route (create and revoke available; rotation is separate) (`docs/phase-10-frontend-contract.md:35`).
- Raw QRIS/EMV payload or QR image in production dashboard payment API (`docs/phase-10-frontend-contract.md:36`).
- Merchant-scoped settlement lists (`docs/phase-10-frontend-contract.md:38`).
- Dashboard payment cancellation route (`README.md:99`).

---

## 5. Database and Migration Requirements — Backend (Not Verified)

The backend owns PostgreSQL. The frontend does not connect to the database. The following are **backend responsibilities** that could not be inspected:

| Item | Status | Notes |
|---|---|---|
| PostgreSQL configuration | Not inspectable | Backend-owned; not in this repo |
| Migration execution mechanism | Not inspectable | Backend-owned |
| Startup schema validation | Not inspectable | Backend-owned |
| Backup prerequisites | Not inspectable | Backend-owned |
| Safe migration sequencing | Not inspectable | Backend-owned |

### Deployment ordering dependency
The frontend depends on the backend's API being available and migrated before `VITE_API_BASE_URL` can point at it. Backend migrations must complete before the frontend is directed at the backend origin.

---

## 6. Production Security Prerequisites — Backend (Expected, Not Verified)

| Prerequisite | Expected | Source of knowledge | Verified? |
|---|---|---|---|
| HTTPS / TLS termination | Required | `client.ts:19-25` (frontend rejects non-HTTPS prod API URLs); `README.md:47` | No — backend not present |
| Secure cookie flags (Secure, HttpOnly, SameSite) | Expected | `README.md:60` (HttpOnly, SameSite refresh cookie) | No — backend not present |
| Trusted proxy configuration | Possibly required | If frontend behind reverse proxy; backend must trust proxy for client IP/forwarded-proto | No — not inspectable |
| CORS with credentials | Required | `README.md:25`; frontend sends `credentials: 'include'` on dashboard calls | No — backend not present |
| Secret injection | Required | Backend secrets (DB, JWT, webhook signing, provider keys) must never be in frontend `VITE_*` | No — backend not present |
| Logging (no credential/payment data leakage) | Expected | Frontend normalizes errors (`client.ts:144-152`); backend must do the same | No — backend not present |
| Health and readiness checks | Not present in frontend | Backend responsibility | No — backend not present |
| Security headers (CSP, HSTS, frame-ancestors, Referrer-Policy) | Frontend host concern | `README.md:47` | Partial — frontend host, not backend |

---

## 7. Deployment Readiness Checklist — Backend

| Item | Status | Category | Basis |
|---|---|---|---|
| Backend source code present in this repo | Not present | — | No `go.mod`, no `*.go` files found |
| Backend build/test commands | Not inspectable | — | Backend in separate repo |
| Database migrations | Not inspectable | — | Backend owns PostgreSQL migrations |
| `VITE_API_BASE_URL` production value | Configuration required later | Frontend build | `.env.production:3` empty |
| `FRONTEND_PUBLIC_URL` backend config | Configuration required later | Backend | `README.md:105` |
| `CORS_ALLOWED_ORIGINS` backend config | Configuration required later | Backend | `README.md:25` |
| HTTPS/TLS for backend API | Infrastructure required later | Backend/hosting | Required for production (`client.ts:19-25`) |
| Secure cookie flags | Configuration required later | Backend | `README.md:60` |
| Webhook signing secret | Configuration required later | Backend | `README.md:113` |
| Provider credentials | Configuration required later | Backend | `.env.example:7` examples |

### Actual blockers vs optional improvements
- **Blockers:** Backend source not in this repo; backend must be deployed and reachable before frontend `VITE_API_BASE_URL` can point at it; backend `FRONTEND_PUBLIC_URL` and `CORS_ALLOWED_ORIGINS` must align with deployed frontend origin.
- **Optional improvements:** Backend health checks, dependency audit, source maps.

---

## 8. Future Deployment Design — Backend (Proposed, Not Implemented)

```
┌─────────────────┐     HTTPS + CORS     ┌──────────────────┐
│  Static Frontend│ ───────────────────▶  Go Backend API   │
│  (SPA, dist/)   │   VITE_API_BASE_URL │  + PostgreSQL    │
└─────────────────┘                     └──────────────────┘
                                           │
                                           ▼
                                    Backend repo config:
                                    FRONTEND_PUBLIC_URL,
                                    CORS_ALLOWED_ORIGINS,
                                    JWT secret, DB URL,
                                    webhook secret, provider keys
```

### Components (backend-side)
1. **Go backend container** — serves REST API, auth, payment processing, webhook handling.
2. **External PostgreSQL** — backend-owned; migrations run as part of backend deployment.
3. **Container registry** — for backend image (if containerized).
4. **Secret management** — JWT secret, refresh token store, DB credentials, webhook signing secret, provider credentials (never in frontend).

### Deployment ordering
1. Deploy backend infrastructure (PostgreSQL, backend container).
2. Run backend migrations.
3. Configure backend secrets (`FRONTEND_PUBLIC_URL`, `CORS_ALLOWED_ORIGINS`, JWT secret, etc.).
4. Confirm backend API reachable at the production `VITE_API_BASE_URL`.
5. Build and deploy frontend pointing `VITE_API_BASE_URL` at the backend.

---

## 9. Files Inspected

| File | Purpose |
|---|---|
| `src/lib/api/client.ts` | API base URL, auth headers, credentials, error normalization |
| `src/lib/auth/service.ts`, `context.tsx` | Auth session, memory-only token, HttpOnly refresh cookie, logout semantics |
| `src/lib/auth/permissions.ts` | Role-based access control |
| `src/lib/simulator/config.ts` | `VITE_ENABLE_SIMULATOR` gating |
| `src/lib/utils/url.ts` | `safeHttpUrl`, `openPaymentPage` |
| `src/types/backend.ts` | DTOs (`CreatePaymentResponse`, `MockPaymentResponse`, `PaymentResponse`) |
| `src/types/auth.ts` | `AuthSession`, `AuthCredentials`, `DashboardRole` |
| `src/types/common.ts` | `ApiResponse`, `ApiError`, `PaymentStatus` |
| `src/hooks/usePayments.ts`, `useMockPayments.ts`, `useWebhooks.ts` | API hooks and endpoints |
| `src/pages/PaymentDetailPage.tsx` | same-origin guard for `payment_url` |
| `src/pages/PublicPaymentPage.tsx` | public payment page |
| `src/pages/WebhookDetailPage.tsx` | webhook delivery metadata (no raw payloads) |
| `src/routes/index.tsx` | route table |
| `docs/phase-10-frontend-contract.md` | backend contract notes (assembled Go router behavior) |
| `README.md` | environment/deployment docs, backend contract notes |
| `.env.example`, `.env.development`, `.env.production` | frontend env templates |

---

## 10. Files Created

| File | Type |
|---|---|
| `docs/phase-4b-backend-local-to-production-report.md` | This report |

No application source, configuration, dependency, CI workflow, Docker, or `.env` file was modified.

---

## 11. Files Modified

None. Existing user modifications were preserved.

---

## 12. Commands Executed

No backend commands were executed (no backend code in this repository). Frontend validation commands were run as part of the overall repository state confirmation:
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm test` — PASS (255/255)
- `npm run build` — PASS

These confirm the frontend is build-ready; they do not validate the backend.

---

## 13. Remaining Blockers — Backend

| ID | Blocker | Severity | Resolution |
|---|---|---|---|
| BE-DEP-001 | Backend source not in this repository | Critical | Audit the separate backend repository before any production deployment |
| BE-DEP-002 | Backend database/migrations not inspectable | Critical | Confirm PostgreSQL config, migration mechanism, and safe sequencing in backend repo |
| BE-DEP-003 | `FRONTEND_PUBLIC_URL` / `CORS_ALLOWED_ORIGINS` not verified | High | Backend must align with deployed frontend origin |
| BE-DEP-004 | Backend HTTPS/TLS not verified | High | Required for production API |
| BE-DEP-005 | Backend secrets (JWT, refresh store, webhook, provider) not configured | High | Backend environment must be provisioned |

---

## 14. Recommended Next Phase

**Audit the separate backend repository** using the same Phase 4B rigor:
1. Inspect backend `go.mod`, source, and configuration.
2. Verify backend environment variables (`FRONTEND_PUBLIC_URL`, `CORS_ALLOWED_ORIGINS`, database URL, JWT/webhook secrets).
3. Confirm migration execution mechanism and safe sequencing.
4. Confirm HTTPS/TLS, secure cookie flags, CORS with credentials.
5. Confirm backend issues `payment_url = {FRONTEND_PUBLIC_URL}/pay/{providerTxId}`.
6. Only then proceed to frontend CD deployment.

No deployment is performed during this audit.
