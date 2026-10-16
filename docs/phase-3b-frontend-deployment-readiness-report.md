# GO-SAAS Phase 3B — Frontend Deployment Readiness Audit Report

**Repository:** pay-gate-dashboard (frontend of the GO-SAAS Payment Gateway Simulator)
**Branch:** `main`
**Audit date:** 2026-10-16
**Constraint honored:** Audit only. No deployment performed. No application source code, CI workflow, configuration, dependency, or `.env` file modified. Existing user changes preserved.

---

## 1. Executive Summary

The frontend is a **static Vite SPA** that is build-ready but not deploy-ready from this repository alone. All code-quality gates pass (typecheck, lint, 255 tests, production build), and the build emits static HTML/CSS/JS assets to `dist/`. However:

- **No production web server, reverse proxy, or container definition exists** in this repository (no `Dockerfile`, no `docker-compose.yml`, no `nginx.conf`).
- **No CD/deployment workflow exists** (only `ci.yml` for PR/push validation).
- **`VITE_API_BASE_URL` is a build-time variable**, validated when `vite build` runs; the production `.env.production` intentionally leaves it empty so the app fails closed until the deployment injects a real HTTPS origin.
- **SPA fallback is required** for browser-router routes (`/pay/:identifier`, `/dashboard/*`, `/login`, `/accept-invitation`) but no hosting configuration is present to implement it.
- The frontend and backend are **separate origins**: the frontend consumes the backend API via `VITE_API_BASE_URL`, and the backend issues hosted-payment URLs targeting the frontend origin (`FRONTEND_PUBLIC_URL`).

The safest, simplest production hosting strategy is a **static host with SPA fallback** (e.g., Vercel, Netlify, Cloudflare Pages, Firebase Hosting, or an S3+CloudFront reverse proxy), with `VITE_API_BASE_URL` injected at build time and the backend's `FRONTEND_PUBLIC_URL`/`CORS_ALLOWED_ORIGINS` configured to match the deployed frontend origin.

No deployment should be performed during this audit.

---

## 2. Current Architecture

### Build-time architecture
- Framework: React 18 + TypeScript 5.6, bundled by Vite 6 (`@vitejs/plugin-react`)
- Entry: `index.html` → `src/main.tsx` → `src/app/App.tsx`
- Router: React Router 7 `createBrowserRouter` (`src/routes/index.tsx`)
- API client: `src/lib/api/client.ts` — centralized fetch client, `BASE_URL` from `VITE_API_BASE_URL`
- Styling: Tailwind CSS 3 (`tailwind.config.js`, `postcss.config.js`)
- Build command: `npm run build` = `tsc -b && vite build` → `dist/`

### Runtime architecture (separate-origin)
- Frontend SPA is served from its own origin (`FRONTEND_PUBLIC_URL`)
- Backend API is served from a separate origin (`VITE_API_BASE_URL`)
- Cross-origin requests carry credentials (`credentials: 'include'`) for dashboard calls; the backend must allow the frontend origin via CORS
- Public payment page (`/pay/:identifier`) uses `publicApiClient` with no auth/cookies

### Route inventory (from `src/routes/index.tsx` and `README.md`)
| Route | Auth | Notes |
|---|---|---|
| `/` | Redirect | Redirects to `/dashboard` or `/login` |
| `/login` | Public | Unauthenticated |
| `/forgot-password` | Public | — |
| `/reset-password` | Public | — |
| `/accept-invitation?token=...` | Public | Token stripped from history early |
| `/pay/:identifier` | Public | Hosted payment page; no dashboard JWT |
| `/dashboard/*` | Protected | Dashboard, payments, refunds, webhooks, etc. |
| `/client-simulator` | Public | External client API (X-API-Key) |
| `/simulator`, `/checkout/:paymentId` | Dev-only | Compiled out of production builds |
| `*` | NotFoundPage | React Router fallback (still needs server SPA fallback) |

### Build output evidence
`npm run build` produces:
- `dist/index.html` (531 bytes) — unversioned entry, must be served with short/no cache
- `dist/assets/index-DQ8VuhPk.css` (30.9 KB)
- `dist/assets/index-DFHdagtM.js` (146 KB)
- `dist/assets/App-s99xlx7c.js` (511 KB)

Hashed asset filenames support long-term caching; `index.html` must not be long-cached.

---

## 3. Production Build Configuration

### How `VITE_API_BASE_URL` is supplied and validated
- Read from `import.meta.env.VITE_API_BASE_URL` at module load in `src/lib/api/client.ts` (lines 10-26)
- Vite replaces `import.meta.env.*` values **at build time** — there is **no runtime environment injection** without additional server-side code
- When `import.meta.env.PROD === true` (set automatically by Vite during `vite build`):
  - If `VITE_API_BASE_URL` is unset → throws: `"VITE_API_BASE_URL must be configured for a production dashboard build."`
  - If set but non-HTTPS and non-localhost → throws: `"Production dashboard API URLs must use HTTPS."`
- `VITE_ENABLE_SIMULATOR` must be `false` in production (`src/lib/simulator/config.ts`); it gates dev-only simulator routes

### `.env.production` (committed template)
```
VITE_API_BASE_URL=
VITE_ENABLE_SIMULATOR=false
```
Intentionally empty — the built app fails closed until the deployment injects a real HTTPS `VITE_API_BASE_URL`.

### Implications
- The frontend must be **rebuilt per environment** (different `VITE_API_BASE_URL` per dev/staging/production)
- The build cannot be promoted unchanged across environments unless the hosting platform injects `VITE_API_BASE_URL` at build time
- `.env` and `.env.*` (except `.env.example`) are gitignored and must not be committed

---

## 4. SPA Fallback Requirements

The application is a single-page application using React Router's browser history. The web server / reverse proxy must serve `dist/index.html` for **all** browser-router routes so that direct navigation and page refresh work.

### Routes requiring SPA fallback (from `README.md:47`)
- `/login`
- `/pay/*` (hosted payment page — critical for the payment flow)
- `/dashboard/*`
- `/accept-invitation`
- Any enabled development routes

### Required hosting behavior
| Scenario | Required behavior |
|---|---|
| Direct navigation to `/pay/:identifier` | Serve `index.html`; React Router renders `PublicPaymentPage` |
| Browser refresh on `/pay/:identifier` | Serve `index.html` (not 404) |
| Direct navigation to `/dashboard/payments/:id` | Serve `index.html`; React Router renders `PaymentDetailPage` behind auth guard |
| Browser refresh on any dashboard route | Serve `index.html`; auth guard redirects to `/login` if unauthenticated |
| Static assets (`/assets/*.js`, `/assets/*.css`) | Served directly with long-term caching |
| API requests (`/api/v1/...`) | Proxied to backend origin (`VITE_API_BASE_URL`) or handled by backend on its own origin |
| Unknown URL (`*`) | Serve `index.html`; React Router renders `NotFoundPage` |

### Current state
No web-server or reverse-proxy configuration exists in this repository. The SPA fallback requirement is documented in `README.md:47` but not implemented as repo config. This is a **deployment/infrastructure responsibility outside this repository**.

---

## 5. Security Requirements

### Transport security
- **HTTPS required** for production (`client.ts:19-25` rejects non-HTTPS non-localhost `VITE_API_BASE_URL`)
- **HSTS** should be configured at the edge/web server (`README.md:47`)

### Security headers (to be configured at the edge/web server, not in repo)
Per `README.md:47`:
- `Content-Security-Policy` (CSP)
- `frame-ancestors`
- `Referrer-Policy: no-referrer`
- HSTS (already noted)

CSP must permit the Vite-built inline scripts/styles and `qrcode.react` rendering on the public payment page.

### `VITE_*` variable exposure (verified)
- All `VITE_*` variables are **bundled into the browser build at build time** and are publicly visible (`.env.example` security note, lines 6-8)
- `README.md:45` explicitly warns: never put API keys, passwords, refresh tokens, webhook secrets, invitation tokens, or provider credentials in `VITE_*` variables
- **No secrets found** in `VITE_*` variables; `.env.example` contains only non-secret placeholder values

### API URL validation
- `safeHttpUrl` / `openPaymentPage` (`src/lib/utils/url.ts`) restrict payment URLs to absolute HTTP(S); reject `javascript:` and relative URLs
- `PaymentDetailPage` enforces same-origin for `payment_url` before opening (`isFrontendOrigin`, `PaymentDetailPage.tsx:46-53`)
- Webhook destination URL validation on `WebhookConfigPage` (HTTPS required in production; no embedded credentials)

### Production artifacts
- No source maps configured in `vite.config.js` (Vite default: no source maps in production build)
- Hashed asset filenames

---

## 6. Hosting Options and Recommendation

### Option A: Static hosting with SPA fallback (Recommended)
Platforms: Vercel, Netlify, Cloudflare Pages, Firebase Hosting

| Factor | Assessment |
|---|---|
| Build | `npm run build` → `dist/` |
| SPA fallback | Native support via rewrite rules (`/*` → `index.html`) |
| Environment injection | Build-time `VITE_API_BASE_URL` via platform UI/CI |
| HTTPS | Managed certificates by default |
| Operational complexity | Low |
| Backend integration | Separate origin; CORS configured on backend |

### Option B: Object storage + CDN
Platforms: Amazon S3 + Amazon CloudFront, Google Cloud Storage + Cloud CDN

| Factor | Assessment |
|---|---|
| Build | `npm run build` → upload `dist/` |
| SPA fallback | Requires CloudFront/Lambda@Edge or equivalent rewrite rule; S3 alone does not support SPA fallback |
| HTTPS | Managed via CDN |
| Operational complexity | Medium (more components to configure) |

### Option C: Reverse proxy / web server
Platforms: nginx, Apache, Caddy, or a dedicated application host

| Factor | Assessment |
|---|---|
| Build | `npm run build` → deploy `dist/` to server |
| SPA fallback | Server rewrite rule (`try_files $uri /index.html` in nginx) |
| HTTPS | Terminated at server or edge |
| Operational complexity | Medium (server management, patching) |

### Recommendation
**Static hosting with SPA fallback (Option A)** is the safest, simplest production hosting strategy for this repository because:
1. The build output is pure static assets (no server-side rendering)
2. These platforms natively support SPA fallback rewrite rules without server management
3. Managed HTTPS reduces operational burden
4. Build-time `VITE_API_BASE_URL` injection is supported via platform configuration or CI
5. No Dockerfile or server config needs to be authored and maintained

No exact hosting prices are provided (per instructions). The decision among Option A providers should be based on the organization's existing infrastructure, budget, and CORS/secret-injection capabilities.

---

## 7. Backend Integration Requirements

The frontend and backend are **separate repositories with separate origins**. The production relationship is:

| Configuration | Where defined | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | Frontend build env (injected at build time) | Backend API origin consumed by the frontend |
| `FRONTEND_PUBLIC_URL` | Backend config | Frontend origin; backend issues `payment_url = {FRONTEND_PUBLIC_URL}/pay/{providerTxId}` |
| `CORS_ALLOWED_ORIGINS` | Backend config | Must include the deployed frontend origin so cross-origin dashboard requests (with credentials) succeed |

### Verified configuration names (from repository evidence)
- `VITE_API_BASE_URL` — `src/lib/api/client.ts`, `.env.example`, `.env.development`, `.env.production`, `README.md`
- `VITE_ENABLE_SIMULATOR` — `src/lib/simulator/config.ts`, env files
- `FRONTEND_PUBLIC_URL` — referenced in `README.md:105` (Phase 0C fix) and the backend contract (Phase 0B audit); **not a frontend `VITE_*` variable** — it is backend configuration
- `CORS_ALLOWED_ORIGINS` — backend configuration name referenced in `README.md:25` (`The backend must allow the dashboard origin through CORS`); not present in frontend source

### Required production relationship
1. Deploy frontend to its origin (e.g., `https://dashboard.paygate.example`)
2. Set `VITE_API_BASE_URL=https://api.paygate.example` at frontend build time
3. Set backend `FRONTEND_PUBLIC_URL=https://dashboard.paygate.example` so issued `payment_url` values target the SPA
4. Set backend `CORS_ALLOWED_ORIGINS` to include `https://dashboard.paygate.example` (with credentials support for dashboard calls)
5. Configure SPA fallback on the frontend host for `/pay/*`, `/dashboard/*`, `/login`, `/accept-invitation`

### Do not invent
No additional configuration keys were invented. `MOCK_PAYMENT_BASE_URL` is deprecated (per Phase 0C audit and `README.md:105`) and must not be used.

---

## 8. Proposed CD Workflow (do not implement in this phase)

A deployment workflow would **follow successful CI** (`ci.yml` runs typecheck/lint/test/build) and be triggered separately (e.g., on a GitHub release, tag, or manual dispatch). It would:

1. Reuse the CI validation jobs (or require them as a prerequisite)
2. Build the frontend with the production `VITE_API_BASE_URL` injected as a GitHub secret/variable
3. Upload `dist/` to the static host or build/push a container image (if a `Dockerfile` is later added)
4. Trigger the host's deployment / invalidate CDN cache
5. **Not** be part of this phase; `ci.yml` must remain unchanged

### Required GitHub environments/secrets/variables
| Item | Purpose | Sensitivity |
|---|---|---|
| `VITE_API_BASE_URL` (production value) | Build-time API origin | Secret (GitHub secret/variable) — real HTTPS production origin |
| Host deployment token / API key | Deploy `dist/` to static host | Secret (GitHub secret) |
| `FRONTEND_PUBLIC_URL` | Backend config (separate repo) | Not a frontend secret; configured in backend repo |

### Triggers
- Release published (recommended) or manual `workflow_dispatch`
- **Not** on every push to `main` (deployment should be deliberate)

### Rollback considerations
- Static hosts typically support instant rollback to a previous deployment
- `index.html` must not be long-cached so rollback/redirect takes effect quickly
- Hashed asset filenames allow old and new assets to coexist briefly
- `VITE_API_BASE_URL` changes require a rebuild; there is no runtime config toggle

---

## 9. Blockers (Classified)

| ID | Blocker | Severity | Description | Resolution |
|---|---|---|---|---|
| DEP-001 | No CI/CD deployment workflow | High | Only `ci.yml` exists; no CD workflow to deploy `dist/` after build | Platform/DevOps (separate phase) |
| DEP-002 | No production web server / reverse-proxy config | High | No `Dockerfile`, `nginx.conf`, or hosting config; SPA fallback unimplemented in repo | Infrastructure/DevOps |
| DEP-003 | Production `VITE_API_BASE_URL` must be injected at build time | Medium | `.env.production` is empty; app fails closed without a real HTTPS origin | Deployment/DevOps (secret injection) |
| DEP-004 | SPA fallback for `/pay/:identifier` and dashboard routes | High | Browser refresh/direct navigation would 404 without server rewrite to `index.html` | Hosting configuration |
| DEP-005 | Backend `FRONTEND_PUBLIC_URL` and `CORS_ALLOWED_ORIGINS` must match deployed frontend origin | Medium | Backend must issue `payment_url` values resolving to the SPA and allow cross-origin dashboard requests | Backend configuration (separate repo) |
| DEP-006 | Security headers (CSP, HSTS, frame-ancestors, Referrer-Policy) | Medium | Documented in `README.md:47` but not implemented as repo config | Edge/web server configuration |

None of these are blockers for creating a CD workflow design, but DEP-001 through DEP-005 must be resolved before a production deployment can succeed.

---

## 10. Implementation Plan for Next Phase

**Next phase: Frontend Continuous Deployment (CD)**

1. **Create `.github/workflows/cd.yml`** (separate from `ci.yml`, do not modify `ci.yml`):
   - Trigger: release published or `workflow_dispatch`
   - Require CI to pass first
   - Inject production `VITE_API_BASE_URL` as a GitHub secret/variable
   - Run `npm ci`, `npm run build`
   - Deploy `dist/` to the chosen static host
   - No artifacts or container images published unless project requirements call for them

2. **Provision the production host**:
   - Static host with SPA fallback rewrite (`/*` → `index.html`)
   - Managed HTTPS
   - Inject `VITE_API_BASE_URL` (real HTTPS origin) at build time
   - Configure security headers (CSP, HSTS, `frame-ancestors`, `Referrer-Policy: no-referrer`)

3. **Coordinate with backend team**:
   - Confirm backend `FRONTEND_PUBLIC_URL` = deployed frontend origin
   - Confirm backend `CORS_ALLOWED_ORIGINS` includes frontend origin with credentials support
   - Confirm backend issues `payment_url = {FRONTEND_PUBLIC_URL}/pay/{providerTxId}`

4. **Verify**:
   - Direct navigation and refresh on `/pay/:identifier` renders the frontend payment page (not JSON)
   - Dashboard routes load behind auth
   - API calls reach the backend origin
   - Rollback to a previous deployment works

---

## 11. Files Inspected, Created, and Commands Executed

### Files inspected (actual repository files)
- `package.json` — scripts, engines, dependencies
- `package-lock.json` — lockfileVersion 3, committed
- `vite.config.ts` — Vite config, no `base` path, `@` alias
- `tsconfig.app.json` — TypeScript build config
- `tsconfig.node.json` — Node types for `vite.config.ts`
- `eslint.config.js` — ESLint config, ignores `dist`/`node_modules`
- `scripts/run-tests.sh` — esbuild + `node:test` runner
- `.env.example` — env template (no secrets)
- `.env.development` — local dev values (not committed)
- `.env.production` — empty `VITE_API_BASE_URL` (fails closed)
- `.gitignore` — gitignores `.env`, `.env.*`, `node_modules/`, `dist/`
- `src/lib/api/client.ts` — `VITE_API_BASE_URL` build-time validation (lines 10-26)
- `src/lib/simulator/config.ts` — `VITE_ENABLE_SIMULATOR` gating
- `src/routes/index.tsx` — route table including `/pay/:identifier` (line 73) and `*` NotFoundPage (line 112)
- `src/lib/utils/url.ts` — `safeHttpUrl` / `openPaymentPage`
- `src/pages/PaymentDetailPage.tsx` — same-origin guard (lines 46-53)
- `.github/workflows/ci.yml` — existing CI workflow (unchanged)
- `README.md` — deployment documentation (lines 38-47, 65-105)
- `dist/` — build output (`index.html`, `assets/`)
- `public/` — empty (no static assets)

### Files created
- `docs/phase-3b-frontend-deployment-readiness-report.md` — this report (only new artifact)

### Commands executed (validation, non-destructive)
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm test` — PASS (255/255)
- `npm run build` — PASS (static assets to `dist/`)

`dist/` output is gitignored and was not committed.

### Repository integrity
- Existing user modifications: **preserved** (working tree left as found)
- Application source code: **not modified**
- CI workflow (`.github/workflows/ci.yml`): **not modified**
- No deployment performed
- No secrets exposed or committed
- No `.env` file inspected for values or modified
