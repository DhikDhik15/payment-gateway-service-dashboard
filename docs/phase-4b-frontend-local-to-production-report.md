# GO-SAAS Phase 4B — Frontend: Local-to-Production Configuration Audit

**Repository:** `github.com/dhikaarta/pay-gate-dashboard`
**Branch:** `main` (working tree contains pre-existing uncommitted changes — all preserved)
**Audit type:** Audit and documentation only. No implementation, no deployment, no source changes.
**Report file:** `docs/phase-4b-frontend-local-to-production-report.md` (new)

---

## 1. Overall Readiness

**Frontend: READY WITH CONFIGURATION REQUIRED**

The frontend builds, passes typecheck/lint/tests, and has been verified locally against the backend. Moving from `localhost:5173` to production requires explicit configuration of `VITE_API_BASE_URL` (must be HTTPS in production), `VITE_ENABLE_SIMULATOR=false`, and a TLS-terminating origin for the SPA. No code changes are required; the remaining work is operational provisioning and build-time configuration.

---

## 2. Configuration Inventory

All frontend configuration is via `VITE_*` environment variables, which Vite bundles into the browser build at build time. These are **publicly visible** in the browser bundle. Per `pay-gate-dashboard/.env.example:6-8`, no secrets must ever be placed in `VITE_*` variables.

| # | Variable | Component | Required? | Secret? | Dev-specific? | Different in prod? | Source file |
|---|----------|-----------|-----------|---------|---------------|--------------------|-------------|
| 1 | `VITE_API_BASE_URL` | API client base URL (`src/lib/api/client.ts`) | Yes (in production builds) | **NO** — bundled in browser build, publicly visible | Yes (default `http://localhost:8081`) | **YES** — must be production HTTPS origin | `.env.example`, `.env.development`, `.env.production`, `src/lib/api/client.ts` |
| 2 | `VITE_ENABLE_SIMULATOR` | Payment simulator UI routes | No | No | **YES** (development only) | **YES** — must be `false` in staging/production | `.env.example`, `.env.development`, `.env.production`, `src/lib/simulator/config.ts` |

### Backend-provided configuration (not frontend variables)
The following backend variables affect frontend behavior but are configured in the backend repository:
- `FRONTEND_PUBLIC_URL` — origin serving `/pay/:identifier` (backend constructs `payment_url` from this)
- `CORS_ALLOWED_ORIGINS` — must include the frontend origin for cross-origin API access

---

## 3. Localhost and URL Dependencies

| # | Location | Value | Classification | Notes |
|---|----------|-------|----------------|-------|
| 1 | `.env.example:11` | `VITE_API_BASE_URL=http://localhost:8081` | Expected development configuration | Backend API origin; must be replaced with production HTTPS origin |
| 2 | `.env.development:2` | `VITE_API_BASE_URL=http://localhost:8081` | Expected development configuration | Local dev override; not committed |
| 3 | `.env.production:3` | `VITE_API_BASE_URL=` | Example/documentation only | Production must supply a real HTTPS origin; empty = fail closed at runtime |
| 4 | `.env.example:15` | `VITE_ENABLE_SIMULATOR=false` | Expected development configuration | Simulator off by default |
| 5 | `src/lib/simulator/config.ts:8` | `VITE_ENABLE_SIMULATOR === 'true'` | Expected development configuration | Simulator compiled out of production builds (`MODE !== 'production'`) |
| 6 | `src/lib/api/client.ts:13-25` | `VITE_API_BASE_URL` localhost check | Potential production risk (mitigated) | Production builds reject non-HTTPS non-localhost API URLs at build time |

**No automatic replacement of localhost values is recommended.** The production build must consciously set `VITE_API_BASE_URL` to the production backend API origin over HTTPS.

### Build-time vs runtime
- `VITE_*` variables are **baked into the browser build at build time** by Vite. They cannot be changed at runtime without rebuilding.
- `.env.production` has `VITE_API_BASE_URL=` empty intentionally — the production build fails closed at runtime if `VITE_API_BASE_URL` is not configured (`src/lib/api/client.ts:16-18`).
- This means the build pipeline must inject the correct production value; there is no runtime configuration file to edit after build.

---

## 4. Frontend-to-Backend Integration

### 4.1 `VITE_API_BASE_URL` → Backend API origin
- **Frontend role:** `src/lib/api/client.ts:13-26` reads `VITE_API_BASE_URL` at build time, strips trailing slashes, and uses it as the base for all dashboard API requests (`/api/v1/...`).
- **Build-time validation:**
  - Production builds (`runtimeEnv.PROD === true`) require `VITE_API_BASE_URL` to be set, otherwise the app throws at module load.
  - Production builds require the URL to use HTTPS unless the host is `localhost`, `127.0.0.1`, or `[::1]`.
- **Backend expectation:** Backend serves API on `APP_PORT` (container `8080`, Docker host `8081`).
- **Production requirement:** `VITE_API_BASE_URL` must be set to the production backend API origin (e.g. `https://api.example.com`) at build time.

### 4.2 `FRONTEND_PUBLIC_URL` (backend variable) → SPA route
- **Frontend role:** The frontend SPA serves the public payment page at route `/pay/:identifier` (`src/routes/index.tsx:73`, `PublicPaymentPage`).
- **Backend role:** Backend constructs `payment_url = {FRONTEND_PUBLIC_URL}/pay/{providerTransactionId}` and returns it in payment creation responses.
- **Production requirement:** The frontend SPA must be hosted at the origin configured as `FRONTEND_PUBLIC_URL` in the backend. The frontend and backend may run on separate origins; the frontend uses `VITE_API_BASE_URL` (separate from `FRONTEND_PUBLIC_URL`) to call the backend API.
- **Do not assume same-origin deployment.** The frontend does not reconstruct the payment URL; it uses the backend-returned value as opaque.

### 4.3 `CORS_ALLOWED_ORIGINS` (backend variable)
- **Backend role:** `CORS_ALLOWED_ORIGINS` must include the frontend origin for the dashboard's cross-origin API requests to succeed (credentials allowed, explicit origin matching).
- **Production requirement:** Backend `CORS_ALLOWED_ORIGINS` must include the production frontend origin (e.g. `https://dashboard.example.com`).

### 4.4 API authentication
- **Frontend role:** `src/lib/api/client.ts` attaches Bearer access tokens (stored in frontend memory only) and sends HttpOnly refresh cookies with `credentials: "include"` for authenticated calls. Public token-flow and mock-payment flows explicitly opt out (`skipAuth: true`, `credentials: 'omit'`).
- **Production requirement:** Auth endpoints must be reachable over the TLS-terminating ingress; refresh cookie must be set with `Secure` and `SameSite` attributes.

### 4.5 Cookie behavior
- **Access tokens:** Stored in frontend module memory only (`src/lib/auth/service.ts:6`); never in `localStorage` or cookies readable by JS.
- **Refresh token:** HttpOnly cookie, set by backend auth endpoints; never read or written by JavaScript.
- **Production requirement:** Backend auth endpoints must set the refresh cookie with `Secure` and appropriate `SameSite`; frontend must be served over HTTPS so cookies are not sent over insecure connections.

---

## 5. Database and Migration Requirements

The frontend has **no direct database dependency**. All data access goes through the backend API. Indirect considerations:

- The frontend depends on the backend being reachable at `VITE_API_BASE_URL`.
- The backend requires a migrated PostgreSQL database (see backend Phase 4B report).
- Frontend changes that depend on new backend fields require coordinated deployment: backend deployed first (or backward-compatible), then frontend.

**No database or migration commands are required for the frontend.**

---

## 6. Production Security Prerequisites

| Area | Requirement | Status | Source |
|------|-------------|--------|--------|
| HTTPS for frontend | SPA served over HTTPS; required for Secure cookies and secure contexts | Not implemented | `src/lib/api/client.ts:22` |
| HTTPS for API | `VITE_API_BASE_URL` must be HTTPS in production (unless localhost) | Build-time enforced | `src/lib/api/client.ts:22` |
| `VITE_*` secrets | No secrets in frontend env vars; all are publicly visible in bundle | Documented | `.env.example:6-8` |
| Simulator disabled | `VITE_ENABLE_SIMULATOR=false`; compiled out of production builds | Config enforced | `src/lib/simulator/config.ts:7-9` |
| Build-time API URL | Production build fails closed if `VITE_API_BASE_URL` unset | Build-time enforced | `src/lib/api/client.ts:16-18` |
| CORS | Backend `CORS_ALLOWED_ORIGINS` must include frontend origin | Backend config | `internal/middleware/cors.go` (backend repo) |
| Secure cookies | Refresh cookie HttpOnly + Secure + SameSite; served over HTTPS | Backend sets cookie; frontend relies on it | `src/lib/auth/service.ts:5` |
| No runtime config edit | `VITE_*` variables baked at build time; no runtime reconfiguration | By design | Vite build behavior |
| Build cache | `npm ci` with `package-lock.json` for reproducible builds | CI workflow | `.github/workflows/ci.yml` |

---

## 7. Deployment Readiness Checklist

### Already implemented (in repository)
- Vite build pipeline with typecheck, lint, tests, production build
- Build-time validation of `VITE_API_BASE_URL` (required in production, HTTPS-enforced)
- Simulator compiled out of production builds
- HttpOnly refresh cookie, in-memory access tokens
- Public payment page route `/pay/:identifier` (unauthenticated)
- CI workflow (`.github/workflows/ci.yml`): typecheck, lint, test, build

### Configuration required later (operator must supply)
- `VITE_API_BASE_URL` = production backend API origin (HTTPS), injected at build time
- `VITE_ENABLE_SIMULATOR=false` (explicit, for production builds)
- Backend `CORS_ALLOWED_ORIGINS` includes production frontend origin
- Backend `FRONTEND_PUBLIC_URL` = production frontend origin (serves `/pay/:identifier`)

### Infrastructure required later
- Static frontend hosting at `FRONTEND_PUBLIC_URL` origin, serving SPA with history fallback (direct navigation to `/pay/:identifier` must return `index.html`)
- TLS termination at the frontend host (HTTPS)
- Backend API reachable at `VITE_API_BASE_URL` origin (HTTPS)

### Application changes potentially required
- None identified. The frontend is architecture-compatible with production deployment given correct build-time configuration.

### Must be verified before production
- `VITE_API_BASE_URL` set to production HTTPS API origin at build time
- `VITE_ENABLE_SIMULATOR=false` in production build
- Frontend served over HTTPS at `FRONTEND_PUBLIC_URL`
- Direct navigation to `/pay/:identifier` returns the SPA (history fallback), not 404
- Backend `CORS_ALLOWED_ORIGINS` includes frontend origin
- Backend `FRONTEND_PUBLIC_URL` matches the frontend serving origin
- Refresh cookie set with `Secure`/`SameSite` by backend auth endpoints
- Build is reproducible (`npm ci` from `package-lock.json`)

### Actual blockers (must be resolved before production)
- **No production frontend hosting provisioned** (external to repository)
- **No TLS termination for frontend** (external to repository)
- **Build pipeline must inject `VITE_API_BASE_URL`** (external to repository)
- **Backend `FRONTEND_PUBLIC_URL` and `CORS_ALLOWED_ORIGINS` must be set** (backend configuration, external to this repo)
- **Remote GitHub Actions not yet verified** (Phase 4A finding)

### Optional improvements (not blockers)
- Frontend performance monitoring / error tracking
- Build artifact provenance / signature verification

---

## 8. Future Deployment Design (Proposed — Not Implemented)

**Target architecture:**

```
Client (browser)
  |
  | HTTPS
  v
Frontend SPA (static hosting, origin = FRONTEND_PUBLIC_URL)
  | serves /pay/:identifier (public payment page)
  | serves /dashboard (authenticated dashboard)
  |
  | VITE_API_BASE_URL = https://api.example.com
  v
Go Backend API (container, port 8080, behind TLS ingress)
  |--------------------------- PostgreSQL (private, TLS verify-full)
  |--------------------------- Payment provider (HTTPS)
  |--------------------------- SMTP relay (TLS when email enabled)
  |--------------------------- Merchant webhook destinations (HTTPS)
```

| Component | Recommendation |
|-----------|---------------|
| Static frontend hosting | Vite `dist/` output served from a static host or CDN at `FRONTEND_PUBLIC_URL`; history fallback for `/pay/:identifier` |
| Go backend container | Multi-stage Docker image, non-root, port 8080, behind TLS ingress |
| External PostgreSQL | Private network, certificate-verified TLS |
| Container registry | Store tagged frontend/backend images |
| GitHub Actions CI/CD | Existing `ci.yml` in each repo (unchanged); new CD workflow for promotion/deploy (not yet implemented) |
| HTTPS | External TLS termination at frontend host and API ingress |
| Secret management | No frontend secrets (`VITE_*` are public); backend secrets injected via deployment platform/secret manager |
| Build-time config | `VITE_API_BASE_URL` injected at frontend build time; no runtime config edits |
| Health checks | Backend `/health/ready`; frontend hosting provider health check |
| Rollback | Frontend: redeploy previous build artifact; Backend: image rollback |

**This is a proposed design only. Nothing is provisioned or deployed.**

---

## 9. Files Inspected

| File | Purpose |
|------|---------|
| `.env.example` | Frontend environment template (VITE_* variables) |
| `.env.development` | Local development overrides (not committed) |
| `.env.production` | Production template (empty API URL = fail closed) |
| `package.json` | Scripts (typecheck, lint, test, build), engines (Node >=20.19.0) |
| `package-lock.json` | Lockfile (lockfileVersion 3) for reproducible builds |
| `src/lib/api/client.ts` | API client; reads `VITE_API_BASE_URL`; production HTTPS enforcement |
| `src/lib/simulator/config.ts` | Simulator feature flag from `VITE_ENABLE_SIMULATOR` |
| `src/lib/auth/context.tsx` | Auth context; session management |
| `src/lib/auth/service.ts` | Auth service; in-memory access tokens, HttpOnly refresh cookie |
| `src/routes/index.tsx` | Route table; `/pay/:identifier` → `PublicPaymentPage` (public) |
| `src/pages/PublicPaymentPage.tsx` | Public payment page; calls `GET /api/v1/mock-payments/:identifier` |
| `.github/workflows/ci.yml` | Frontend CI workflow |

---

## 10. Files Created

- `docs/phase-4b-frontend-local-to-production-report.md` (this report — new)

---

## 11. Files Modified

**None.** No application source, configuration, Docker, migration, or CI files were modified by this audit.

---

## 12. Commands Executed

No repository-modifying or database-modifying commands were executed. Only read-only file inspection was performed.

---

## 13. Recommended Next Phase

Proceed to deployment infrastructure planning:
1. Provision static frontend hosting at the `FRONTEND_PUBLIC_URL` origin with HTTPS and SPA history fallback.
2. Ensure the frontend build pipeline injects `VITE_API_BASE_URL` (production HTTPS API origin) and `VITE_ENABLE_SIMULATOR=false`.
3. Coordinate with backend deployment: backend `FRONTEND_PUBLIC_URL` must match the frontend serving origin; backend `CORS_ALLOWED_ORIGINS` must include the frontend origin.
4. Validate in staging: build frontend with production `VITE_API_BASE_URL`, navigate directly to `/pay/:identifier`, confirm SPA loads and API calls succeed.
5. Production rollout: deploy frontend build artifact; verify direct navigation, refresh, and payment page behavior.
