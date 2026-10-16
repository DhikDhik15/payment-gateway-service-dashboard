# GO-SAAS Phase 1B — Frontend CI/CD & Deployment Readiness Audit Report

**Repository:** pay-gate-dashboard (frontend of the GO-SAAS Payment Gateway Simulator)
**Branch:** `main`
**Audit date:** 2026-10-16
**Constraint honored:** Audit only. No CI/CD implemented. No application source, configuration, dependency, Docker, or workflow file modified. The only new artifact is this report.

---

## 1. Overall Readiness — READY WITH GAPS

The frontend application itself is **CI-ready from a code-quality standpoint**: `npm run typecheck`, `npm run lint`, `npm test` (255/255 passing), and `npm run build` all succeed on a clean working tree with the committed lockfile. The app builds to static assets and requires no browser automation, external services, or network access for its test suite.

However, the project is **not yet CI/CD-enabled**:
- No GitHub Actions workflows exist (the `.github/` directory is absent).
- No `Dockerfile`, `docker-compose.yml`, or any container definition exists.
- No reverse-proxy or web-server configuration exists for production SPA serving.
- Production requires `VITE_API_BASE_URL` to be injected by the deployment (the app fails closed if absent), and the production host must rewrite browser-router paths to `index.html` — both are deployment responsibilities outside this repository.

The codebase is in a state where a minimal CI pipeline can be added safely, but deployment infrastructure (container image, reverse proxy, secret injection) remains to be provisioned.

---

## 2. Node.js and Package Manager Requirements

| Item | Value | Evidence |
|---|---|---|
| Package manager | npm | `package-lock.json` present and committed |
| Lockfile format | lockfileVersion 3 | `package-lock.json` line 4 |
| Node.js engine | `>=20.19.0` | `package.json` `engines.node` |
| Install command | `npm ci` (lockfile-based) | Standard for committed `package-lock.json` |
| Lockfile committed? | Yes | `package-lock.json` tracked in git |

The `engines` field in `package.json` declares Node.js >= 20.19.0, so a CI runner should use a pinned Node 20 LTS (or newer 20.x) major version. `npm ci` is the correct lockfile-based install for CI because `package-lock.json` is committed and `node_modules/` is gitignored.

---

## 3. Existing Build/Test Commands

| Command | Purpose | Result (verified) |
|---|---|---|
| `npm run dev` | Vite dev server | Not executed (requires running server) |
| `npm run typecheck` | `tsc -b --pretty false` | PASS (exit 0) |
| `npm run build` | `tsc -b && vite build` | PASS (exit 0; static assets to `dist/`) |
| `npm run lint` | `eslint .` | PASS (exit 0) |
| `npm run preview` | Vite production preview | Not executed |
| `npm test` | `bash scripts/run-tests.sh` (esbuild bundle + `node:test`) | PASS — 255 tests, 0 fail, 0 skip |

**Test infrastructure notes (from `scripts/run-tests.sh` and README):**
- Tests use Node's built-in `node:test` runner.
- Each `*.test.ts` / `*.test.tsx` file under `src/` is bundled with the already-installed `esbuild` binary (`--bundle --jsx=automatic --platform=node --format=esm --target=node20`) into a temp directory, then executed with `node --test`.
- No vitest/jest, no Playwright/Cypress, no browser automation.
- Tests do **not** require browser automation, external services, environment variables, or network access (fetch is mocked in tests).
- 34 test files, 255 tests total (225 pre-existing + 30 added in Phase 0).
- No coverage thresholds or coverage report configuration.
- Lint: ESLint 9 (`eslint.config.js`), ignores `dist` and `node_modules`.

All four quality-gate commands were executed successfully during this audit (typecheck, lint, test, build).

---

## 4. Production Build and SPA Routing Findings

### Vite configuration
- `vite.config.ts`: React plugin only, `@` path alias to `./src`. No `base` path configured (defaults to `/`, correct for root-served SPA).
- Build output directory: `dist/` (default). Output is static HTML/JS/CSS.
- `index.html`: `<script type="module" src="/src/main.tsx"></script>`, `<meta name="referrer" content="no-referrer">`.

### Production environment variable handling
- `VITE_API_BASE_URL`: backend API origin. Required for production builds (`client.ts:16-18` throws if unset in prod). Non-local production origins must use HTTPS (`client.ts:19-25`). `.env.production` intentionally leaves it empty so the built app fails closed until the deployment injects a real HTTPS origin.
- `VITE_ENABLE_SIMULATOR`: `false` by default; must be `true` only in non-production development builds (`src/lib/simulator/config.ts`). Controls whether dev-only simulator routes (`/simulator`, `/checkout/:paymentId`) are compiled in.
- All `VITE_*` values are public browser configuration; no secrets belong in them (`.env.example` security note; `README.md:45`).

### SPA fallback for `/pay/:identifier`
- Route `/pay/:identifier` (`PublicPaymentPage`, no auth) is registered in `src/routes/index.tsx:73`.
- `createBrowserRouter` handles it client-side. On a production static host, a direct URL or browser refresh on `/pay/:identifier` would return 404 unless the web server / reverse proxy rewrites browser-router paths to `index.html`.
- `README.md:47` documents this requirement: rewrite `/login`, `/pay/*`, `/dashboard/*`, `/accept-invitation` (and any enabled dev routes) to `index.html`. Configure HTTPS, HSTS, CSP, `frame-ancestors`, `Referrer-Policy: no-referrer` at the edge/web server.

**Finding:** The frontend itself is correctly structured for SPA serving, but **no reverse-proxy or web-server configuration exists in this repository** to implement the fallback. That is a deployment/infrastructure responsibility outside this repo.

### Asset paths and caching
- Vite produces hashed asset filenames (`index-DFHdagtM.js`, etc.) suitable for long-term caching.
- `index.html` is unversioned and should be served with short/no cache so SPA fallback works.

### Source maps
- No explicit `build.sourcemap` or `build.rollupOptions` config in `vite.config.ts`. Vite production builds do not emit source maps by default. No finding requiring change.

### Production server configuration
- None present in this repository (no Dockerfile, no `docker-compose.yml`, no nginx/Caddy/Apache config, no `.github/` workflows).

---

## 5. Docker and Web Server Findings

| Artifact | Present? | Location | Notes |
|---|---|---|---|
| `Dockerfile` | No | — | Not found at repository root |
| `docker-compose.yml` / `docker-compose.yaml` | No | — | Not found |
| `nginx.conf` / web server config | No | — | Not found |
| `.github/` (CI workflows) | No | — | Directory does not exist |
| `public/` | Yes (empty) | `public/` | No static assets beyond what Vite generates |

**Finding:** There is no containerization or web-server configuration in this repository. The frontend is a static Vite build intended to be served by an external host/reverse proxy (separate-origin architecture: frontend SPA served by the host; backend API served separately; `VITE_API_BASE_URL` configures the API origin independently).

---

## 6. Environment and Security Findings

### Environment variables
| Variable | Required? | Status | Notes |
|---|---|---|---|
| `VITE_API_BASE_URL` | Production | `.env.example` documents `http://localhost:8081`; `.env.production` empty (fails closed) | Injected by deployment; must be HTTPS for non-localhost production |
| `VITE_ENABLE_SIMULATOR` | No | `false` in all env files | Dev-only simulator flag |

### Secret exposure (verified)
- `.env` and `.env.*` are gitignored (`.gitignore` lines 12-13), except `.env.example` which is intentionally committed as a template with no secrets.
- `.env.example` contains a security note (lines 6-8): never put DB passwords, admin API keys, server keys, webhook signing secrets, or merchant secret keys in `VITE_*` variables.
- `README.md:45` reiterates: never put credentials or provider credentials in environment variables.
- No hardcoded secrets found in source inspected during this audit. API keys/secrets are not stored in browser storage (auth tokens are memory-only; refresh token is HttpOnly cookie).
- `safeHttpUrl`/`openPaymentPage` (`src/lib/utils/url.ts`) restrict payment URLs to absolute HTTP(S) and reject `javascript:`/relative URLs. `PaymentDetailPage` enforces same-origin for `payment_url` before opening.

### Dependency lockfile
- `package-lock.json` (lockfileVersion 3) is committed. `node_modules/` is gitignored. CI should use `npm ci` for reproducible, lockfile-based installs.

### Dependency audit
- No `npm audit` configuration or dependency-vulnerability scanning is present in the repo or scripts. This is an optional enhancement, not a blocker.

### HTTP security headers / CSP
- No web-server config exists in this repo, so no headers can be audited here. `README.md:47` documents the operator's responsibility to configure HTTPS, HSTS, CSP, `frame-ancestors`, and `Referrer-Policy: no-referrer` at the edge/web server. CSP must allow the Vite-built inline scripts/styles and the `qrcode.react` rendering on the public payment page.

---

## 7. CI Requirements and Dependencies

A clean CI runner must be able to execute, in order:

1. **Install dependencies** — `npm ci` (Node >= 20.19.0, lockfile-based; no `npm install` which can mutate the lockfile).
2. **Typecheck** — `npm run typecheck` (`tsc -b`).
3. **Lint** — `npm run lint` (`eslint .`).
4. **Unit tests** — `npm test` (`scripts/run-tests.sh` → esbuild + `node:test`). No browser, no services, no network, no env vars needed.
5. **Production build** — `npm run build` (`tsc -b && vite build`).

**No additional dependencies are required** for CI. All tooling (TypeScript, ESLint, Vite, esbuild, Node test runner) is already in `package.json` / `package-lock.json` and `node_modules` is present locally.

**Optional (recommended, not blocking):**
- `npm audit` for dependency security advisories (read-only; do not use `--fix` in CI as it could modify the lockfile).
- Docker build validation (`docker build`) if a `Dockerfile` is later added — not applicable today since none exists.

**CI should NOT:**
- Require a running backend or database (tests mock `fetch`).
- Require browser automation or a display server.
- Require `VITE_API_BASE_URL` for typecheck/lint/test (the app does not read it at build/test time except the prod build guard, which only triggers when `PROD === true` and the var is unset — CI can set it to a placeholder or skip the prod-build guard by not setting `PROD=true`; `vite build` sets `PROD=true` automatically, so CI must either set `VITE_API_BASE_URL` to a non-empty value or accept the guard throwing. Simplest: set `VITE_API_BASE_URL=http://localhost:8081` in CI build step.)

---

## 8. Confirmed Blockers

| Blocker | Severity | Description | Resolution owner |
|---|---|---|---|
| No CI/CD workflows | High | `.github/` does not exist; no automated validation on PR or push. | Platform/DevOps (create GitHub Actions workflow) |
| No container definition | Medium | No `Dockerfile` or compose file; frontend cannot be shipped as an image from this repo. | Platform/DevOps (add `Dockerfile` if containerized deployment is desired) |
| No reverse-proxy / SPA fallback config | High | Production static host must rewrite `/pay/*` and other browser routes to `index.html`; no config in repo. | Infrastructure/DevOps (deployment host configuration) |
| Production `VITE_API_BASE_URL` must be injected | Medium | `.env.production` is empty; app fails closed at runtime without a real HTTPS origin injected by deployment. | Deployment/DevOps (secret/ConfigMap injection) |
| Chunk size > 500 kB | Low | `vite build` warns that `index-DFHdagtM.js` and `App-*.js` exceed 500 kB minified. | Frontend (optional code-splitting) |

None of these block CI pipeline creation; the first four are deployment/infrastructure concerns outside this repository's current scope.

---

## 9. Recommended GitHub Actions Workflow (not yet implemented)

A minimal pipeline, **pull-request validation separated from deployment**:

### `.github/workflows/ci.yml` (PR validation)
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    env:
      VITE_API_BASE_URL: http://localhost:8081   # required by prod build guard
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'          # pinned major, satisfies engines >=20.19.0
          cache: 'npm'

      - name: Install dependencies (lockfile-based)
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Unit tests
        run: npm test

      - name: Production build
        run: npm run build

      - name: Optional dependency audit
        run: npm audit --audit=moderate   # read-only; does not modify lockfile
```

### Deployment (separate, manual/protected)
A separate deploy workflow (triggered manually or on release) would:
1. Run the CI jobs above.
2. Build the Docker image (if a `Dockerfile` is added).
3. Deploy static `dist/` assets to the hosting provider.
4. Inject `VITE_API_BASE_URL` (real HTTPS origin) at runtime.
5. Configure the host/reverse proxy to serve `index.html` for `/login`, `/pay/*`, `/dashboard/*`, `/accept-invitation` (SPA fallback).
6. Apply HTTPS, HSTS, CSP, `frame-ancestors`, `Referrer-Policy: no-referrer` at the edge.

**Do not implement these workflows during this audit.** This is a design recommendation only.

---

## 10. Files Changed

| File | Type | Reason |
|---|---|---|
| `docs/phase-1b-frontend-cicd-readiness-report.md` | New document | This audit report (the only new artifact) |

No application source code, configuration, dependency files, `package.json`, `package-lock.json`, `.env` files, Docker files, or workflow files were modified, created, or deleted. Pre-existing uncommitted user modifications were preserved.

---

## 11. Exact Next Implementation Steps

1. **Create `.github/workflows/ci.yml`** using the recommended design above (Node 20, `npm ci`, typecheck, lint, test, build, optional `npm audit`). Keep it PR-validation only; separate from deployment.
2. **Add a `Dockerfile`** (multi-stage: build with Vite, serve static assets with a lightweight web server) if containerized deployment is desired.
3. **Provision the production host / reverse proxy** to:
   - Serve `dist/` static assets.
   - Rewrite `/login`, `/pay/*`, `/dashboard/*`, `/accept-invitation` to `index.html` (SPA fallback).
   - Inject `VITE_API_BASE_URL` (real HTTPS origin) at runtime.
   - Apply HTTPS, HSTS, CSP, `frame-ancestors`, `Referrer-Policy: no-referrer`.
4. **Run the CI pipeline** on a push/PR to confirm all gates pass in a clean runner before enabling merge protections.

**Smallest safe next step:** Create the GitHub Actions `ci.yml` workflow and verify it passes on a push to `main`. This requires no source or config changes beyond the workflow file itself and immediately establishes automated validation.
