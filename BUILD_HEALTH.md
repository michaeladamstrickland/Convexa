# LeadFlow — Build, CI/CD, and Code Health

Timestamp (ET): 2025-08-16 12:00 ET

Objective
- Establish a reliable build pipeline with type-safety, linting, tests, dependency hygiene, bundle analysis, and dead-code detection across the monorepo. Capture current health and prescribe actionable improvements.

Scope
- Packages:
  - backend/ (Express + TypeScript + Prisma)
  - frontend/ (React + Vite + Tailwind)
  - root/ (scripts and secondary server code in src/, separate prisma/)
- Languages/Tools: TypeScript, ESLint/Prettier, Jest/ts-jest, Prisma, Vite

---

## 1) Current State

Build scripts (from package.json files)
- Root
  - dev: tsx src/server.ts
  - build: tsc
  - start: node dist/server.js
  - test: jest (no config at root)
  - prisma: generate/migrate/reset scripts (targets root prisma, SQLite)
- Backend
  - dev: nodemon src/server.ts
  - build: tsc
  - start: node dist/server.js
  - test: jest (ts-jest configured via backend/jest.config.js)
  - prisma:* scripts (targets backend/prisma, PostgreSQL)
  - scrapers: tsx execution for Puppeteer
- Frontend
  - dev: vite
  - build: tsc && vite build
  - lint: eslint . --ext ts,tsx
  - preview: vite preview

Configs present
- TypeScript: root/tsconfig.json, backend/tsconfig.json, frontend/tsconfig.json
- Lint/format: backend/.eslintrc.js, backend/.prettierrc; frontend eslint via package.json; Prettier not centrally enforced for frontend
- Tests: backend/jest.config.js; frontend has no test runner configured (can use Vitest/Jest)
- Docker: backend/docker-compose.yml
- Prisma: duplication — backend/prisma (PostgreSQL), prisma/ (SQLite)

Key Findings
- Prisma duality (Postgres backend vs SQLite root) can cause build/test divergence.
- Puppeteer version mismatch (root ^24.x vs backend ^21.x) can bloat installs and cause Chromium incompatibilities.
- No CI workflows committed; lint/typecheck/tests not enforced automatically.
- TypeScript strictness likely not fully enabled (tsconfig not verified strict).
- No bundle analysis/budget for frontend; no dead-code pruning in backend/frontend.
- No OpenAPI spec; documentation via markdown only.

---

## 2) CI/CD — Recommended Workflow

GitHub Actions: .github/workflows/ci.yml (to be added)

Jobs
1) setup
- actions/checkout@v4
- setup-node@v4 with Node 20.x
- cache npm

2) lint-type-test-backend
- working-directory: backend
- steps:
  - npm ci
  - npx prisma generate
  - npx prisma validate
  - npm run lint
  - tsc --noEmit
  - npm test -- --coverage --runInBand

3) lint-type-test-frontend
- working-directory: frontend
- steps:
  - npm ci
  - npm run lint
  - tsc --noEmit
  - (optional) vitest run --coverage

4) build
- working-directory: backend and frontend
- steps:
  - npm run build (both)
  - upload build artifacts (frontend dist/, backend dist/)

5) optional: docker
- build and push image on main branch tags
- security scan (e.g., aquasecurity/trivy-action)

Environment variables for CI (use dummy values to pass validation):
- DATABASE_URL (test Postgres or dummy for prisma validate)
- JWT_SECRET
- LEADFLOW_TIER (starter|professional|enterprise)
- DAILY_BUDGET_LIMIT

---

## 3) Type Safety

Targets
- Enable strict mode across all tsconfig.json:
  - "strict": true
  - "noImplicitAny": true
  - "strictNullChecks": true
  - "noFallthroughCasesInSwitch": true
- Backend: prefer explicit types in controllers/services; reduce any in 3rd-party responses with thin DTOs
- Frontend: type API responses (zod schemas aligned with backend) and hooks

Actions
- Audit tsconfig files and enable strict; fix resultant errors incrementally
- Introduce DTOs/types for:
  - RealPropertyDataService outputs
  - MasterRealEstateService outputs
  - SkipTraceResult and AI analysis outputs
- Add type-safe config loader with zod (validated env)

---

## 4) Linting & Formatting

Standards
- ESLint with @typescript-eslint for all packages
- Prettier unified config at repo root (.prettierrc) and share across packages
- Rules:
  - no-explicit-any (warn), prefer-const, eqeqeq, no-return-await, @typescript-eslint/no-floating-promises

Actions
- Create root eslint config and extend in backend/frontend
- Add npm scripts:
  - "lint": "eslint . --ext .ts,.tsx"
  - "lint:fix": "eslint . --ext .ts,.tsx --fix"
- Run lint in CI

---

## 5) Tests

Backend
- Keep jest + ts-jest
- Expand unit coverage for controllers/services/middleware
- For integration, use supertest and a disposable Postgres (testcontainers) or dedicated CI DB

Frontend
- Add Vitest + @testing-library/react + MSW
- Cover routes, API hooks, and key components (ZipCodeLeadSearch, Leads)

Coverage thresholds (CI gate, initial):
- lines: 60%, statements: 60%, branches: 50% (ratchet upwards after stabilization)

---

## 6) Dependency Health

Actions
- Align Puppeteer to a single version (recommend pin in backend; remove from root if not needed)
- Run audits:
  - npm audit --production
  - npx npm-check-updates -u (in controlled PRs)
- License compliance:
  - npx license-checker --production --summary (report output artifact)
- Deduplicate axios usage patterns:
  - Create shared axios factory with timeouts, retries, and logging in backend services

---

## 7) Dead Code and Size

Dead Exports
- Add ts-prune in backend and run in CI:
  - npx ts-prune | tee ts-prune-report.txt
- Review root/src vs backend/src duplication; prefer backend as canonical server

Frontend Bundle
- Add source-map-explorer for production build:
  - npx source-map-explorer 'dist/assets/*.js'
- Define bundle budgets:
  - Initial main chunk < 200KB gz, vendor split; lazy routes for heavy pages (analytics)

---

## 8) Build Reproducibility

- Lockfiles: package-lock.json present across packages (keep consistent npm version in CI)
- Node: enforce engines >=18 in root and frontend (backend already has engines)
- Deterministic builds:
  - Ensure no dynamic imports based on env without fallbacks
  - Prefer exact versions for critical libs (OpenAI SDK, Prisma, Puppeteer)

---

## 9) Docs & Automation

- Generate and maintain:
  - ENDPOINTS.md (done in this audit)
  - OpenAPI spec (add later) to enable client generation and contract tests
- Add pre-commit hooks (husky + lint-staged) to run eslint and typecheck (fast) on changed files

---

## 10) Actionable Tasks (Build Health)

- BH-001: Add GitHub Actions CI with lint/typecheck/tests/build and prisma validate
- BH-002: Enable TS strict mode in backend and frontend
- BH-003: Align Puppeteer version and remove duplicate dependency at root if unused
- BH-004: Add ts-prune and dead code check to CI
- BH-005: Add source-map-explorer and establish bundle budgets
- BH-006: Introduce shared axios factory with retries/timeouts/circuit-breakers
- BH-007: Add OpenAPI draft for core endpoints and publish via Redoc in CI artifact

---

## 11) Example CI Workflow (Skeleton)

```yaml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
      - run: npx prisma generate
      - run: npx prisma validate
        env:
          DATABASE_URL: postgresql://user:pass@localhost:5432/dbname?schema=public
      - run: npm run lint
      - run: tsc --noEmit
      - run: npm test -- --coverage --runInBand

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: tsc --noEmit
      # - run: npm test -- --coverage (configure Vitest/Jest first)
      - run: npm run build
```

---

## 12) Risks and Mitigations

- Dual Prisma schemas → Unify on backend Postgres; deprecate root prisma for production.
- Missing CI → Add GH Actions immediately; protect main with required checks.
- Version drift → Dependabot/Renovate to manage updates; lock majors during critical launch window.
- Costly external calls in tests → Mock with MSW/nock; never hit real providers in CI.

---

Conclusion
Implementing the above CI/CD and build-health measures will create a stable, observable pipeline. Pair this with the security and compliance tasks to reach a production-ready posture within the 2-week playbook window.
