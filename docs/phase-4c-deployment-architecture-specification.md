# GO-SAAS Phase 4C — Deployment Architecture Specification

**Repository:** pay-gate-dashboard (frontend of the GO-SAAS Payment Gateway Simulator) — **frontend only**
**Branch:** `main`
**Specification date:** 2026-10-16
**Constraint honored:** Design and documentation only. No deployment performed. No CD workflows created. No application source modified. No infrastructure provisioned. No secrets exposed.

---

## 1. Executive Summary

The GO-SAAS Payment Gateway Simulator consists of two independently operated repositories:

| Repository | Status in this workspace | Nature |
|---|---|---|
| Frontend (`pay-gate-dashboard`) | Present — audited | React/Vite SPA, static build to `dist/`, build-time `VITE_API_BASE_URL` |
| Backend (Go API + PostgreSQL) | **Not present** | Referenced only via frontend source and contract documentation |

This specification is **frontend-grounded**: all frontend claims are verified against actual source files in this workspace. All backend claims (Dockerfile, Docker Compose, golang-migrate migrations, backend CI, database connection details) are taken from the Phase 4B backend report and the contract documentation referenced by the frontend (`docs/phase-10-frontend-contract.md`, `README.md`), and are **marked as requiring separate backend-repository verification**.

The proposed target architecture is:

```
┌─────────────────────┐      HTTPS + CORS      ┌──────────────────────┐
│   Static Frontend   │ ─────────────────────▶ │   Go Backend API     │
│  (SPA, dist/, Vite) │   VITE_API_BASE_URL    │  (Docker Compose)    │
└─────────────────────┘                        │  + PostgreSQL        │
                                               └──────────────────────┘
                                              (separate repo)
```

No source, CI workflow, or configuration file was modified during this audit.

---

## 2. Verified Current Architecture

### 2.1 Frontend build architecture (verified against source)

| Component | Evidence | Status |
|---|---|---|
| Framework | React 18 + TypeScript 5.6 + Vite 6 | `package.json:17-29` |
| Build command | `npm run build` = `tsc -b && vite build` | `package.json:12` |
| Build output | `dist/` (static HTML/CSS/JS, hashed asset filenames) | `vite.config.ts`, `dist/` present |
| Entry point | `index.html` → `src/main.tsx` → `src/app/App.tsx` | `index.html`, `src/main.tsx`, `src/app/App.tsx` |
| Router | React Router 7 `createBrowserRouter` | `src/routes/index.tsx` |
| Public payment route | `/pay/:identifier` → `PublicPaymentPage`, no dashboard JWT | `src/routes/index.tsx:73` |
| Simulator routes | `/simulator`, `/checkout/:paymentId` — compiled out when `MODE === production` or `VITE_ENABLE_SIMULATOR !== true` | `src/lib/simulator/config.ts:7-9`, `src/routes/index.tsx:58-63` |
| API client | Centralized fetch client, `BASE_URL` from `VITE_API_BASE_URL` | `src/lib/api/client.ts:10-26` |
| Auth | Short-lived Bearer access token in JS memory; refresh token is HttpOnly SameSite cookie (browser-managed, never read by SPA) | `src/lib/auth/service.ts:5-6`, `README.md:60` |
| Response envelope | `{ success, data, meta }` / `{ success: false, error, meta }` validated at `client.ts:293-305` | `src/lib/api/client.ts` |
| URL security | `safeHttpUrl` rejects `javascript:`/relative; `openPaymentPage` opens exact backend URL with `noopener,noreferrer`; `PaymentDetailPage` same-origin guards `payment_url` | `src/lib/utils/url.ts`, `src/pages/PaymentDetailPage.tsx:46-53` |

### 2.2 Frontend configuration (verified against source)

| Variable | Required? | Secret? | Dev value | Production requirement | Source |
|---|---|---|---|---|---|
| `VITE_API_BASE_URL` | Yes (production build throws if unset) | No — publicly visible in browser bundle | `http://localhost:8081` | Must be real HTTPS backend origin; `.env.production` intentionally empty (fail closed) | `.env.example:11`, `.env.development:2`, `.env.production:3`, `client.ts:16-17` |
| `VITE_ENABLE_SIMULATOR` | No | No | `false` | Must be `false` in staging/production | `.env.example:15`, `.env.development:3`, `.env.production:4`, `simulator/config.ts:7-9` |

### 2.3 Backend architecture (documented, not verifiable from this workspace)

The backend repository is separate and **not present** in this workspace. The following are documented in the frontend repo's contract documentation and Phase 4B backend report, and must be verified against the actual backend repository:

| Component | Documented status | Verification source |
|---|---|---|
| Go API server | Exists in separate repository | `docs/phase-10-frontend-contract.md`, `README.md` |
| Dockerfile and Docker Compose | Documented as existing | Phase 4B backend report |
| PostgreSQL + golang-migrate migrations | Documented as existing | Phase 4B backend report |
| Existing backend CI workflow | Documented as existing | Phase 4B backend report |
| Health/readiness checks | Not verifiable from frontend repo | Not present in frontend source |

### 2.4 Discrepancies between reports and actual source

| Report claim | Actual source evidence | Discrepancy? |
|---|---|---|
| `payment_url` is opaque backend value; frontend never rewrites it | `README.md:105`; `client.ts` treats `payment_url` as opaque; `PaymentDetailPage.tsx:94-99` same-origin guards it | No — consistent |
| `MOCK_PAYMENT_BASE_URL` deprecated; `FRONTEND_PUBLIC_URL` canonical | `README.md:105`; no `MOCK_PAYMENT_BASE_URL` reference in frontend source | No — consistent |
| `.env.production` `VITE_API_BASE_URL` empty → fail closed | `.env.production:3` empty; `client.ts:16-17` throws if unset in prod | No — consistent |
| Simulator routes compiled out of production | `simulator/config.ts:7-9`; `routes/index.tsx:58-63` | No — consistent |
| SPA fallback required for `/pay/*`, `/dashboard/*`, `/login`, `/accept-invitation` | `README.md:47`; no server config present in repo | No — consistent (requirement documented, implementation pending) |

---

## 3. Proposed Target Architecture

### 3.1 Architecture diagram

```
┌─────────────────────────────┐      HTTPS + CORS (credentials)     ┌────────────────────────────────┐
│      Static Frontend        │                                     │          Go Backend API        │
│   (Vite SPA, dist/ assets)  │  VITE_API_BASE_URL                  │  (Docker Compose, separate repo)│
│                             │                                     │  + PostgreSQL (external)       │
└─────────────────────────────┘                                     └────────────────────────────────┘
        │                                                                              │
        │ build-time env injection                                                    │ runtime config
        ▼                                                                              ▼
   GitHub Actions CI                                                      Backend repo:
   (npm ci, typecheck, lint, test, build)                                 FRONTEND_PUBLIC_URL,
                                                                           CORS_ALLOWED_ORIGINS,
                                                                           JWT secret, DB URL,
                                                                           webhook secret
```

### 3.2 Component responsibilities

| Component | Responsibility | Repository |
|---|---|---|
| Static frontend hosting | Serve `dist/` SPA with SPA fallback (`/*` → `index.html`), managed HTTPS, security headers | Frontend deployment |
| Go backend container | Serve REST API, auth, payment processing, webhook handling | Backend deployment |
| External PostgreSQL | Backend-owned data store; migrations run as part of backend deployment | Backend deployment |
| Container registry | Store backend image (if containerized) | Backend deployment |
| GitHub Actions CI | Existing `ci.yml` — typecheck, lint, test, build on PR/push to main | Frontend repo (present) |
| GitHub Actions CD | **Not yet created** — separate from `ci.yml`; deploy backend image and frontend assets after CI passes | To be created in a future phase |
| Secret management | `VITE_API_BASE_URL` (frontend build-time); backend secrets (DB URL, JWT, webhook signing, provider keys) never in frontend | Deployment platform / backend env |

### 3.3 Suitability confirmation

The proposed architecture (VPS with Docker Compose backend, separate PostgreSQL, static frontend hosting, container registry, GitHub Actions CI/CD, TLS-enabled ingress, external secret management, separate migration job) is **suitable** for the existing implementation because:

1. The frontend is a pure static Vite SPA with no server-side rendering — ideal for static hosting with SPA fallback.
2. The frontend already fails closed when `VITE_API_BASE_URL` is unset in production (`client.ts:16-17`), enforcing explicit configuration.
3. Simulator routes are compiled out of production builds (`simulator/config.ts:7-9`), so no dev-only endpoints leak to production.
4. The backend is documented as containerized (Dockerfile + Docker Compose) in the separate repository.

**No alternatives are required** based on frontend evidence. The only caveat is that backend-specific claims (Dockerfile, migrations, CI) must be verified in the backend repository before implementation.

---

## 4. Network and URL Contract

### 4.1 URL and environment configuration matrix

| Configuration name | Build-time or runtime? | Component | Where configured | Production requirement |
|---|---|---|---|---|
| `VITE_API_BASE_URL` | **Build-time** (Vite bundles at build time; no runtime injection in this repo) | Frontend API client | Deployment injects at frontend build time | Real HTTPS backend origin; `.env.production` empty → fail closed |
| `VITE_ENABLE_SIMULATOR` | Build-time | Frontend simulator route gating | Deployment injects at frontend build time | Must be `false` in production |
| `FRONTEND_PUBLIC_URL` | **Runtime/backend config** | Backend — constructs `payment_url = {FRONTEND_PUBLIC_URL}/pay/{providerTxId}` | Backend repository environment | Must equal deployed frontend origin |
| `CORS_ALLOWED_ORIGINS` | **Runtime/backend config** | Backend CORS middleware | Backend repository environment | Must include deployed frontend origin; credentials support required |
| Backend API listen address/port | Runtime/backend config | Go HTTP server | Backend repository environment | Frontend `VITE_API_BASE_URL` must resolve to this |
| Database connection string | Runtime/backend config | Go backend + PostgreSQL | Backend repository environment | Never exposed to frontend |

### 4.2 Build-time vs runtime distinction

- **Frontend `VITE_*` variables are build-time only.** Vite replaces `import.meta.env.VITE_*` at bundle time (`client.ts:10-12`). There is **no runtime environment injection** in this frontend repo. Changing `VITE_API_BASE_URL` requires a frontend rebuild.
- **Backend variables (`FRONTEND_PUBLIC_URL`, `CORS_ALLOWED_ORIGINS`, DB URL, secrets) are runtime configuration** owned by the backend repository. The frontend cannot influence them.

### 4.3 Public payment route and authentication/cookie flow

| Flow element | Behavior | Source |
|---|---|---|
| Public payment page | `/pay/:identifier`, no dashboard JWT, no cookies | `routes/index.tsx:73` |
| Public payment API | `GET /api/v1/mock-payments/:identifier` via `publicApiClient` (`skipAuth`, `credentials: 'omit'`) | `useMockPayments.ts`, `client.ts:371-387` |
| Dashboard API calls | Bearer access token from JS memory + `credentials: 'include'` (HttpOnly refresh cookie sent by browser) | `client.ts:232-244` |
| Refresh token | HttpOnly SameSite cookie, browser-managed, never read/written by SPA | `service.ts:5-6`, `README.md:60` |
| `payment_url` | Opaque backend value; frontend same-origin guards before opening; opens exact URL with `noopener,noreferrer` | `PaymentDetailPage.tsx:46-53`, `url.ts:16-19` |
| Webhook endpoints | Provider-to-gateway: backend-consumed (not frontend). Gateway-to-merchant outbound: `/api/v1/dashboard/webhook-config`, `/api/v1/dashboard/webhooks/*` — frontend inspects delivery metadata only, never raw payloads | `docs/phase-10-frontend-contract.md:13-14`, `WebhookDetailPage.tsx:45` |

---

## 5. Database and Migration Strategy

### 5.1 Database isolation and connectivity

- The frontend **does not connect to PostgreSQL** and **does not run migrations**. All database concerns belong to the separate backend repository.
- The backend owns PostgreSQL configuration, connection pooling, and schema. The frontend depends on the backend API being available and migrated before `VITE_API_BASE_URL` can point at it.
- Deployment ordering: backend (with migrations) must be ready before the frontend is directed at the backend origin.

### 5.2 TLS requirements

- Backend API must use HTTPS in production (`client.ts:19-25` rejects non-HTTPS non-localhost `VITE_API_BASE_URL`).
- Frontend hosting must use HTTPS (`README.md:47`).
- Database connections between backend and PostgreSQL should use TLS where supported by the hosting provider (backend responsibility).

### 5.3 Migration sequencing

- Migrations are versioned (golang-migrate, per Phase 4B backend report) and executed as part of backend deployment.
- Migration execution must complete **before** the frontend points `VITE_API_BASE_URL` at the backend.
- Migrations should be run as a separate controlled job (not embedded in the application startup) to allow independent failure handling.
- **Do not recommend automatic destructive rollback.** A failed migration should leave the database in its last known good state; rollback, if needed, must be a deliberate operational decision using targeted down migrations or point-in-time recovery, never an automatic `drop`/`truncate`.

### 5.4 Backup requirements

- PostgreSQL backups must be configured and tested before production traffic.
- Backup strategy should include point-in-time recovery (PITR) or equivalent so a failed migration can be reversed without data loss.
- Backup verification (restore test) should be part of staging validation.

### 5.5 Readiness verification

- Backend health/readiness checks are not defined in the frontend repository and must be confirmed in the backend repository.
- Frontend readiness is implied by a successful `npm run build` producing `dist/` assets; runtime readiness depends on the backend API responding at `VITE_API_BASE_URL`.

### 5.6 Application rollback vs database rollback limitations

- **Application rollback:** Frontend static assets support instant rollback via hashed filenames and redeploying a previous `dist/` build. Backend container image rollback is supported if using a container registry with tagged images.
- **Database rollback limitations:** Database schema changes are not automatically reversible in a safe, generic way. A failed forward migration requires a deliberate down migration or PITR. Application code must be compatible with the schema state at rollback time (i.e., do not deploy frontend/backend code that depends on a not-yet-applied migration, and do not roll back code to a version incompatible with the current schema without a corresponding data rollback).

### 5.7 Staging verification requirements

Before production, staging must verify:
1. Backend migrations apply cleanly against a production-like PostgreSQL.
2. Frontend builds with production `VITE_API_BASE_URL` pointing at the staging backend.
3. Direct navigation and browser refresh on `/pay/:identifier` render the frontend payment page (not JSON or 404).
4. API authentication (login, refresh, logout) works across origins with cookies.
5. CORS permits frontend origin with credentials.
6. Webhook delivery metadata is inspectable; no raw provider payloads leaked to frontend.

---

## 6. Security Requirements

| Requirement | Detail | Owner |
|---|---|---|
| Secret injection | `VITE_API_BASE_URL` injected at frontend build time (non-secret but production-critical). Backend secrets (DB URL, JWT signing key, refresh-token store, webhook signing secret, provider credentials) injected into backend environment only — **never** in frontend `VITE_*` variables. | Deployment platform / backend env |
| Least-privilege GitHub Actions | Existing `ci.yml` uses `permissions: contents: read`. Any future CD workflow must use minimal job-level permissions and scoped deployment tokens. | CI/CD config |
| Container registry credentials | Scoped read/write tokens for backend image push/pull; never stored in repo. | Container registry |
| SSH/deployment authentication | If applicable, use scoped deployment keys/tokens, not personal SSH keys or broad tokens. | Deployment platform |
| Trusted proxy configuration | If frontend or backend sits behind a reverse proxy, configure trusted proxy headers so client IP and forwarded-proto are correctly determined (backend responsibility). | Backend/hosting |
| HTTPS and secure cookies | Backend API over HTTPS; refresh token cookie set with `Secure` flag; frontend served over HTTPS. | Backend + frontend host |
| CORS | Backend must allow the deployed frontend origin with credentials support (dashboard calls send `credentials: 'include'`). Public mock-payment endpoints omit credentials. | Backend |
| Frontend security headers | CSP, HSTS, `frame-ancestors`, `Referrer-Policy: no-referrer` at the edge/web server (`README.md:47`). CSP must permit Vite-built inline scripts/styles and `qrcode.react` on the public payment page. | Frontend host |
| Sensitive logging | Frontend normalizes errors via `ApiClientError` with safe messages; arbitrary response text never surfaced (`client.ts:144-152`). Backend must not log credentials, payment data, or refresh tokens. | Frontend + backend |
| Database network access | Restricted to backend only; not exposed to frontend or public internet. | Backend/hosting |

---

## 7. Deployment Workflow Design

### 7.1 Existing CI workflow (present, unchanged)

`.github/workflows/ci.yml` runs on push/PR to `main`: `npm ci` → `npm run typecheck` → `npm run lint` → `npm test` → `npm run build`. It uses Node 22, lockfile-based install, and `contents: read` permissions. It never deploys or publishes artifacts. **This workflow must not be modified in this phase.**

### 7.2 Proposed CD workflow (design only, not created)

A deployment workflow would follow successful CI and be triggered separately (e.g., GitHub release or `workflow_dispatch`):

1. Require CI to pass first (or re-run validation).
2. Inject production `VITE_API_BASE_URL` as a GitHub secret/variable at frontend build time.
3. Build frontend (`npm run build`) → `dist/`.
4. Build/push backend image to container registry (backend repo responsibility).
5. Deploy backend container + run migrations as a separate controlled job.
6. Deploy frontend static assets to static host with SPA fallback.
7. Invalidate CDN cache if applicable.
8. No artifacts or container images published unless project requirements call for them.

**Triggers:** Release published or manual `workflow_dispatch` — not on every push to `main` (deployment should be deliberate).

**Rollback:** Frontend static assets support instant rollback via previous `dist/` build; backend container rollback via previous image tag. Database rollback is **not** automatic (see Section 5.6).

### 7.3 Required GitHub environments/secrets/variables

| Item | Purpose | Sensitivity |
|---|---|---|
| `VITE_API_BASE_URL` (production value) | Frontend build-time API origin | Secret/variable — real HTTPS production origin |
| Frontend deployment token | Deploy `dist/` to static host | Secret |
| Backend image push/pull credentials | Container registry | Secret |
| `FRONTEND_PUBLIC_URL` | Backend config (separate repo) | Not a frontend secret; configured in backend repo |
| `CORS_ALLOWED_ORIGINS` | Backend config (separate repo) | Not a frontend secret; configured in backend repo |

---

## 8. Rollback Strategy

| Layer | Rollback mechanism | Limitation |
|---|---|---|
| Frontend static assets | Redeploy previous `dist/` build; hashed filenames allow old/new coexistence briefly | `index.html` must not be long-cached |
| Backend container | Redeploy previous image tag from registry | Must be compatible with current DB schema |
| Database | **No automatic rollback.** Failed forward migration requires deliberate down migration or PITR. | Data loss risk if mishandled; operational decision required |

**Rule:** Application code must never depend on a migration that has not been applied, and code must not be rolled back to a version incompatible with the current schema without a corresponding, deliberate data rollback.

---

## 9. Infrastructure Prerequisites

| Prerequisite | Status | Notes |
|---|---|---|
| Frontend static host with SPA fallback | Not provisioned | Required for `/pay/:identifier`, `/dashboard/*`, `/login`, `/accept-invitation` refresh/direct navigation |
| Backend VPS / Docker Compose host | Not provisioned | Backend repo responsibility |
| External PostgreSQL | Not provisioned | Backend repo responsibility |
| Container registry | Not provisioned | Backend repo responsibility |
| GitHub Actions CI | Present | `ci.yml` in frontend repo |
| GitHub Actions CD | Not present | To be created in future phase |
| HTTPS/TLS termination | Not provisioned | Required for frontend host and backend API |
| Secret management | Not provisioned | `VITE_API_BASE_URL` + backend secrets |
| CORS_ALLOWED_ORIGINS alignment | Not configured | Backend must include frontend origin |
| FRONTEND_PUBLIC_URL alignment | Not configured | Backend must issue `payment_url` resolving to SPA |

---

## 10. Ordered Implementation Roadmap

| Phase | Objective | Dependencies | Acceptance criteria |
|---|---|---|---|
| 1 | Verify remote GitHub Actions CI passes on `main` | Existing `ci.yml`; repository pushed to GitHub | All CI steps green on remote runner |
| 2 | Select hosting providers and deployment regions (frontend static host, backend VPS, container registry, PostgreSQL) | None | Providers selected; regions documented |
| 3 | Provision staging infrastructure | Phase 2 complete | Staging frontend host, backend host, PostgreSQL reachable |
| 4 | Configure PostgreSQL and secrets | Phase 3 complete | DB initialized; backend secrets injected; `VITE_API_BASE_URL` available for frontend build |
| 5 | Implement backend CD | Phase 4 complete | Backend image builds, pushes, deploys; migrations run as separate job |
| 6 | Implement frontend CD | Phase 5 complete | Frontend builds with production `VITE_API_BASE_URL`; assets deploy; SPA fallback works |
| 7 | Test payment flows in staging | Phase 6 complete | Create payment → `payment_url` resolves to `/pay/:identifier` → page loads → QRIS/status render → terminal states correct |
| 8 | Validate backup and rollback | Phase 7 complete | Restore test successful; frontend/backend rollback procedures documented |
| 9 | Define production release criteria | Phase 8 complete | Signed-off checklist; rollback runbook available |

---

## 11. Explicit Unresolved Decisions

| Decision | Why unresolved | Required before |
|---|---|---|
| Specific static frontend hosting provider | Not in scope; depends on organizational preference/budget | Phase 2 (hosting selection) |
| Backend container registry choice | Backend repo responsibility | Phase 2/5 |
| Exact `VITE_API_BASE_URL` production value | Must not be invented; injected at deployment | Phase 4 (secrets config) |
| Backend health-check endpoint implementation | Backend repo responsibility | Backend audit |
| Database backup tool and schedule | Backend repo responsibility | Phase 4/8 |
| Production domain name | Not in scope; must not be assumed | Phase 2 |

---

## 12. Acceptance Criteria Summary

| Criterion | Status |
|---|---|
| Conclusions grounded in both repositories | Frontend verified against source; backend documented as separate repo / not verifiable here |
| Discrepancies documented | Section 2.4 — no discrepancies found between reports and source |
| No source or CI files modified | Confirmed — only this report created |
| No deployment occurs | Confirmed — design and documentation only |
| No secrets exposed | Confirmed — no `.env` values or secrets printed |
| Existing user changes preserved | Confirmed — working tree left as found |

---

## 13. Files Inspected

| File | Purpose |
|---|---|
| `package.json` | scripts, engines, dependencies |
| `package-lock.json` | lockfileVersion 3, committed |
| `vite.config.ts` | Vite config, no `base` path |
| `tsconfig.app.json`, `tsconfig.node.json` | TypeScript config |
| `eslint.config.js` | ESLint config |
| `scripts/run-tests.sh` | esbuild + `node:test` runner |
| `.env.example`, `.env.development`, `.env.production` | frontend env templates |
| `.gitignore` | gitignores `.env`, `.env.*`, `node_modules/`, `dist/` |
| `src/lib/api/client.ts` | `VITE_API_BASE_URL` validation, auth/cookie handling |
| `src/lib/simulator/config.ts` | `VITE_ENABLE_SIMULATOR` gating |
| `src/lib/auth/service.ts`, `context.tsx` | auth session, memory-only token, HttpOnly refresh cookie |
| `src/lib/utils/url.ts` | `safeHttpUrl`, `openPaymentPage` |
| `src/routes/index.tsx` | route table incl. `/pay/:identifier` |
| `src/pages/PaymentDetailPage.tsx` | same-origin guard for `payment_url` |
| `src/pages/PublicPaymentPage.tsx` | public payment page |
| `src/pages/WebhookDetailPage.tsx` | webhook delivery metadata (no raw payloads) |
| `src/types/backend.ts` | DTOs (`payment_url`, `qris_payload`) |
| `docs/phase-10-frontend-contract.md` | backend contract notes |
| `README.md` | environment/deployment docs |
| `.github/workflows/ci.yml` | existing CI workflow |

---

## 14. Files Created

| File | Type |
|---|---|
| `docs/phase-4c-deployment-architecture-specification.md` | This specification |

No application source, configuration, dependency, CI workflow, Docker, or `.env` file was modified.

---

## 15. Files Modified

None. Existing user modifications were preserved.

---

## 16. Commands Executed

None beyond repository inspection (no source-modifying or destructive commands). The following were previously confirmed as passing in this workspace: `npm run typecheck`, `npm run lint`, `npm test` (255/255), `npm run build`.

---

## 17. Overall Readiness

**Architecture specification: COMPLETE (design only).**

The target architecture is suitable for the existing frontend implementation. **Implementation cannot proceed** until:

1. The separate backend repository is audited and confirmed (Dockerfile, migrations, CI, secrets, `FRONTEND_PUBLIC_URL`, `CORS_ALLOWED_ORIGINS`).
2. Production infrastructure is provisioned (static frontend host with SPA fallback, backend host, PostgreSQL, container registry, HTTPS).
3. Production `VITE_API_BASE_URL` is available for injection at frontend build time.

No deployment, CD workflow creation, source modification, or infrastructure provisioning was performed during this specification phase.
