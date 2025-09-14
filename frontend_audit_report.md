# Frontend State Audit (Sprint Planning)

Date: 2025-09-14
Scope: leadflow_ai/frontend (Vite + React + TS + Tailwind + MUI)

## 1. File and Directory Structure
- Top-level: frontend/{index.html, vite.config.ts, tailwind.config.js, postcss.config.js, package.json, src/, components/, utils/, public/}
- src/: App.tsx, main.tsx, index.css, api/{client.ts, auth.ts, leads.ts}, pages/{Dashboard.tsx, EmpireDashboard.tsx, Leads.tsx, SearchPage.tsx, PropertySearchWorkspace.tsx, LeadManagementWorkspace.tsx, EnhancedPropertySearch.tsx, EnhancedPropertyDetailPage.tsx, ...}, components/{Layout.tsx, Property* views, Attom* widgets, ui/Spinner.tsx, analytics/*, scraper/*, skiptrace/*, lead/*}, contexts/, hooks/{useLeadSelection.ts, useTraceFilters.ts}, services/ (AttomPropertyService, LeadService referenced), types/, setupProxy.js.
- Standalone JSX utilities: PropertyMap.jsx, PropertyValuationChart.jsx, etc. under frontend/ root alongside components/.
- Placeholder/Mock: Leads.tsx uses mocked data; PropertySearchWorkspace.tsx mocks saved searches; some services references indicate planned real integrations.

## 2. Routing & Navigation
- React Router (v6) via BrowserRouter in main.tsx.
- Routes mounted in App.tsx: '/', '/dashboard', '/leads', '/lead-management', '/kanban', '/property-search', '/search', '/enhanced-search', '/property/:attomId', '/skip-trace', '/analytics', '/cost-analytics', '/attom-leads', '/scraper', '/zip-search'.
- Layout sidebar links align with routes; all appear mounted and reachable post-login.
- Login gating: local state isAuthenticated in App.tsx; no real auth persistence yet; redirects to <Login/> until toggled.

## 3. Component Architecture
- Mixed architecture: MUI-heavy workspace screens (PropertySearchWorkspace) and Tailwind-based layout and simple pages.
- Reusable pieces: Layout.tsx, ui/Spinner.tsx, multiple property/lead widgets; Attom components (AttomPropertySearch, AttomLeadGenerator) exist.
- No clear atomic design library; components are ad hoc but reasonably modular.
- Duplication risk: multiple property detail/view components; several standalone JSX files outside src/components likely duplicates/legacy.

## 4. Styling & Theme
- TailwindCSS configured (tailwind.config.js with primary color scale) and plugins (forms, typography).
- Also uses MUI v7 theme components in several pages; no global MUI ThemeProvider found, but components work with defaults.
- Styling split between Tailwind utility classes and MUI; tokens partially centralized (Tailwind primary colors). Some inline styles minimal.

## 5. API Integration
- Axios client in src/api/client.ts with baseURL VITE_API_URL (defaults to http://localhost:5000/api) + bearer token injection + 401 redirect to /login.
- Leads API wrapper in src/api/leads.ts exposes CRUD and analytics; expects backend endpoints like /leads, /leads/:id, /leads/stats, /leads/:id/skip-trace, /leads/:id/call-script.
- setupProxy.js proxies /api/attom to localhost:5002, suggests separate gateway for ATTOM.
- In pages, much data is mocked; PropertySearchWorkspace calls services/AttomPropertyService and LeadService (files present under src/services) to hit backend (not fully verified here).

## 6. State Management
- @tanstack/react-query is initialized globally with QueryClient in main.tsx; but current pages mostly use local state and direct service calls; limited usage of useQuery/useMutation observed in reviewed files.
- No Redux/Zustand. Some hooks exist (useLeadSelection, useTraceFilters) to localize logic.
- Potential prop drilling minimal; larger pages encapsulate own state.

## 7. Auth & Permissions
- No real auth provider/context. App.tsx maintains local isAuthenticated; Login component controls setIsAuthenticated but doesn’t persist token to api client by default.
- api/client.ts reads localStorage token, but no code here sets it; 401 interceptor clears and redirects.
- Route protection rudimentary; needs real auth context/guard and persisted session.

## 8. Tests (Frontend)
- No frontend tests located in frontend/ (no __tests__, RTL, or Cypress setup). Backend Jest tests exist separately.
- Test gap: significant.

## 9. Dependency Integrity
- UI: MUI v7, Headless UI, Heroicons, Tailwind, Recharts.
- Data: axios, react-query, date-fns, zod, clsx, toast libraries.
- Build: Vite + TS. Versions look current enough; Tailwind v3; React 18; react-router-dom 6.20.1; Query v5.
- Mix of Tailwind and MUI increases surface; ensure consistency plan.

## 10. Alignment with Backend
- Backend provides endpoints for properties feed (/api/properties), admin metrics, webhooks, CRM, and calls; frontend client currently points to /api base but pages largely use mocked data or services.
- Leads API contract in frontend likely misaligned with backend’s current lead models (backend Lead vs ScrapedProperty/CRM/Calls). Need to map:
  - Leads list: which backend endpoint? (likely /api/properties feed + enrichment meta or a new /api/leads).
  - Skip trace endpoints: backend has setup for skip trace; verify route names and payloads.
  - Call intelligence UI: could consume /api/dev/metrics and /api/admin/crm-activity.

---

## Gap Summary (Sprint 1 Targets)
- Auth: Missing real auth flow (login, token storage, guards, user context).
- API wiring: Many pages use mock data; Leads, PropertySearchWorkspace rely on placeholder services. Align to backend endpoints.
- Services/Types: Ensure TypeScript types align to backend Prisma/DTOs; add zod schemas where helpful.
- Routing: Replace local isAuthenticated with auth-aware router and protected routes.
- State: Use react-query for server state (lists, details, mutations) instead of ad hoc local state + side effects.
- UI consistency: Decide Tailwind vs MUI baseline; add MUI ThemeProvider or Tailwind design tokens consistently.
- Tests: Add Jest + RTL for critical components; smoke E2E with Playwright/Cypress optional.
- Env/config: Ensure VITE_API_URL points to backend at 3001/api (current default 5000/api is likely wrong for this workspace).
- ATTOM integration: Confirm proxy/ports and component wiring.

---

## Suggested Sprint Plan (two sprints)

Sprint FE-1 (4–6 tickets)
1) Auth foundation
   - Implement AuthContext with login/logout, token persistence, and route guards.
   - Wire Login to backend auth (stub if needed) and set localStorage token for api client.
2) Leads list + details (real data)
   - Replace mocked Leads.tsx with react-query fetching from backend endpoint (decide target: /api/properties or /api/leads).
   - Create LeadsTable component using MUI DataGrid or table; map fields from backend.
3) Properties feed workspace hookup
   - Wire PropertySearchWorkspace to backend /api/properties feed and /api/admin/export-leads.
   - Introduce query hooks (useProperties, useExport) with react-query.
4) API client config
   - Fix VITE_API_URL to match backend (http://localhost:3001/api) and add .env examples.
5) UI consistency pass
   - Add ThemeProvider (MUI) or Tailwind design tokens utilities; document usage; unify buttons/inputs.
6) Testing baseline
   - Add Jest + RTL setup for frontend; write tests for Leads list and Auth flow.

Sprint FE-2 (4–6 tickets)
1) Lead detail/actions
   - Create LeadDetailPage: show CRM activities, call summaries, and enrichment tags; integrate /api/admin/crm-activity list.
2) Voice intelligence UI
   - Add Calls page/section to display live transcript/summary activities and metrics; poll /api/dev/metrics; subscribe to webhooks later.
3) Skip trace UI wiring
   - Hook SkipTraceModal/BulkSkipTraceModal to backend routes; display results in Leads table.
4) Saved searches & filters persistence
   - Persist PropertySearchWorkspace saved searches to backend; restore filters; add export.
5) Charts/Analytics
   - Wire dashboard/analytics pages to /api/admin/dashboard-metrics and /api/dev/metrics.
6) E2E smoke
   - Add Playwright/Cypress minimal flow: login → leads → property details → export.

Notes
- Keep tickets small and vertical (UI + API + test). Use react-query for all server state.
- Add types from backend DTOs (generate via openapi or hand-written types module).
