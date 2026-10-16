# GO-SAAS Phase 2C — Frontend Continuous Integration Report

**Repository:** pay-gate-dashboard (frontend of the GO-SAAS Payment Gateway Simulator)
**Branch:** `main`
**Implementation date:** 2026-10-16
**Constraint honored:** CI only. No deployment implemented. No application source, configuration, dependency, Docker, or `.env` file modified. The only new artifacts are `.github/workflows/ci.yml` and this report.

---

## 1. Overall Status — PASS

The CI workflow has been created and validated locally. All quality gates pass in a clean, lockfile-based installation:

| Gate | Command | Result |
|---|---|---|
| Dependency installation | `npm ci` | PASS (exit 0) |
| Typecheck | `npm run typecheck` (`tsc -b`) | PASS (exit 0) |
| Lint | `npm run lint` (`eslint .`) | PASS (exit 0) |
| Unit tests | `npm test` (`scripts/run-tests.sh` → esbuild + `node:test`) | PASS — 255 tests, 0 fail |
| Production build | `npm run build` (`tsc -b && vite build`) | PASS (exit 0) |

No secrets were introduced. No deployment is performed by the workflow. Existing user changes remain preserved.

---

## 2. Workflow Triggers

`.github/workflows/ci.yml` triggers on:

- `push` to `main` (the default branch)
- `pull_request` to `main`

This provides both pre-merge validation (pull requests) and post-merge protection (push to default branch).

---

## 3. Node.js Version

- **Node.js 22** (via `actions/setup-node@v4`, `node-version: '22'`, which resolves to the latest Node 22.x LTS)
- Compatible with the repository's documented minimum `engines.node: ">=20.19.0"` in `package.json`
- The test bundler targets `node20` (`scripts/run-tests.sh`), which Node 22 satisfies

---

## 4. Commands Executed (in CI order)

The workflow runs these commands in order, and fails if any gate fails:

1. `npm ci` — lockfile-based installation using the committed `package-lock.json` (lockfileVersion 3)
2. `npm run typecheck` — `tsc -b --pretty false`
3. `npm run lint` — `eslint .`
4. `npm test` — `bash scripts/run-tests.sh` (esbuild bundles each test, then Node's built-in `node:test` runs them)
5. `npm run build` — `tsc -b && vite build`

Locally validated:

| Gate | Result | Exit code |
|---|---|---|
| `npm ci` | PASS | 0 |
| `npm run typecheck` | PASS | 0 |
| `npm run lint` | PASS | 0 |
| `npm test` | PASS — 255/255 | 0 |
| `npm run build` | PASS | 0 |

---

## 5. Build Environment Configuration — `VITE_API_BASE_URL`

**How it's validated during build:** `src/lib/api/client.ts` (lines 16-25) throws at module load when `import.meta.env.PROD === true` (which Vite sets automatically during `vite build`) if `VITE_API_BASE_URL` is unset, and rejects non-HTTPS non-localhost production origins. Vite's production build therefore requires `VITE_API_BASE_URL`.

**CI handling:** The workflow sets `VITE_API_BASE_URL=http://localhost:8081` as a job-level env var, used **only for build validation**. This is:

- A non-secret value matching `.env.example`
- Suitable only for CI build validation, not production
- Not a credential or private secret
- Not written to any `.env` file

**CI does NOT:**
- Modify `VITE_API_BASE_URL` in application configuration
- Commit `.env` files
- Place secrets in `VITE_*` variables
- Use `npm install` (uses `npm ci`, required by the lockfile)

---

## 6. Files Changed

| File | Type | Reason |
|---|---|---|
| `.github/workflows/ci.yml` | New workflow | CI pipeline: typecheck, lint, test, build on PR/push to main |
| `docs/phase-2c-frontend-ci-report.md` | New document | This report |

No application source code, configuration, dependency files (`package.json`, `package-lock.json`), `.env` files, Docker files, or existing documentation were modified. Pre-existing uncommitted user modifications were preserved.

---

## 7. How to Verify the Workflow on GitHub

1. Push this branch (including `.github/workflows/ci.yml`) to the repository.
2. Open a pull request against `main`, or push directly to `main`.
3. GitHub Actions will automatically run the `ci` job on an `ubuntu-latest` runner.
4. Confirm all five steps succeed: checkout, setup Node, `npm ci`, typecheck, lint, test, build.
5. Any step failure (non-zero exit) fails the workflow and blocks the merge/push until fixed.

**Note:** Local validation (above) confirms the commands pass on this machine. An actual GitHub Actions run has **not** been performed — that requires pushing to GitHub and is distinct from local validation.

---

## 8. Remaining Deployment Requirements (out of scope for CI)

These were identified in Phase 1B and are **not** part of this CI phase:

- Production host must serve `dist/` static assets with SPA fallback (rewrite `/login`, `/pay/*`, `/dashboard/*`, `/accept-invitation` to `index.html`) so browser refresh on `/pay/:identifier` works.
- Production `VITE_API_BASE_URL` must be injected at runtime (real HTTPS origin; `.env.production` is intentionally empty so the app fails closed until configured).
- HTTPS, HSTS, CSP, `frame-ancestors`, and `Referrer-Policy: no-referrer` should be configured at the edge/web server.
- No `Dockerfile` or container definition exists; none was added in this phase.

No deployment workflow or secrets were created.

---

## 9. Remaining Blockers

None for CI. The workflow is complete and locally validated. Deployment infrastructure (SPA fallback host, runtime `VITE_API_BASE_URL` injection, security headers) remains a separate deployment-phase concern outside this repository's current scope.
