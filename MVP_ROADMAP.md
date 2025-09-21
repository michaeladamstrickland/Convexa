# 🚀 Convexa MVP Roadmap

## 🎯 ### Phase 2: AI Lead Scoring (Week 2)

- ✅ AI service stubs already exist.
- ✅ Add 4-tier lead temperature tags: Dead, Warm, Hot, On Fire.
- ✅ Allow manual user feedback to "teach" AI scoring (learning loop).
- ✅ Persist scores and tags in DB for each lead.

### Phase 3: Skip-Tracing (Week 2–3)

- ✅ Activate Batch Skip Tracing API (budget-friendly, quick ROI).
- ✅ Add "Skip Trace" button in lead list UI.
- ✅ Store returned phones/emails + confidence rating.
- ✅ Display results in Lead Detail View with quick "Call/Text" actions.eliver real, contactable leads within 30 days that can be:

- Searched by city, state, zip, or county (map-draw search in future).
- Ranked automatically by AI into Dead, Warm, Hot, On Fire.
- Enriched via skip-tracing to obtain phone/email.
- Tracked in a CRM-style Kanban board.
- Exported (CSV/manual outreach in v1; automated campaigns later).

## 🛠 Current Foundation (Done / In Repo)

- Frontend: React + Vite UI with multiple pages (Leads, Analytics, Scraper).
- Backend: Node/Express with lead models and orchestration service.
- Database: Direct SQLite implementation (bypasses Prisma compatibility issues).
- Working APIs: Search, ZIP code search, and analytics endpoints.
- Integrations present (keys required): Zillow, ATTOM, RealtyMole, DataTree, Batch Skip Tracing, OpenAI, Twilio.
- Scrapers: Puppeteer for Zillow FSBO (works, needs proxy/stealth).
- AI scoring: Implemented via OpenAI service.
- Auth: Demo login works (JWT scaffolding in place).

## 📌 MVP Priorities (Next 4 Weeks)

### Phase 1: Core UI + Search (Week 1–2)

- ✅ Build polished search UI (city, state, zip, county).
- ✅ Results list with columns: address, owner, estimated value, equity %, lead temperature.
- ✅ Add filter chips (equity %, distress tags).
- ✅ Fixed database connectivity issues with direct SQLite implementation.
- ✅ Connect backend `/search-zip` API with working endpoints.
- ✅ Implement caching and dedupe at search time.
- ✅ Created unified `/api/search` with Prisma as canonical data layer.

### Phase 2: AI Lead Scoring (Week 2)

- ✅ AI service stubs already exist.
- 🔲 Add 4-tier lead temperature tags: Dead, Warm, Hot, On Fire.
- 🔲 Allow manual user feedback to “teach” AI scoring (learning loop).
- 🔲 Persist scores and tags in DB for each lead.

### Phase 3: Skip-Tracing (Week 2–3)

- 🔲 Activate Batch Skip Tracing API (budget-friendly, quick ROI).
- 🔲 Add “Skip Trace” button in lead list UI.
- 🔲 Store returned phones/emails + confidence rating.
- 🔲 Display results in Lead Detail View with quick “Call/Text” actions.

### Phase 4: CRM Kanban Board (Week 3–4)

- 🔲 Build Kanban UI: stages like New, Contacted, Negotiating, Under Contract, Closed.
- 🔲 Drag-and-drop leads into stages.
- 🔲 Persist stage changes in DB (Prisma).
- 🔲 Activity log (add notes, calls, emails).

### Phase 5: Export + Outreach Prep (Week 4)

- 🔲 Create CSV export of leads (address, contact, AI score, stage).
- 🔲 Add cost/budget tracking to backend (already scaffolded).
- 🔲 Compliance prep: add quiet-hours + DNC flags (basic guardrails).

## 💰 Budget (30 Days)

With $2,000 available now, focus spend here:

- Data sourcing (must have):
  - ATTOM Data API (~$299/mo).
  - Batch Skip Tracing (~$100–$300 for 1k lookups).

- Infra:
  - DigitalOcean droplet + managed DB (~$80).

- AI:
  - OpenAI GPT-4 mini or GPT-4o for scoring (~$200 usage budget).

- Scraping infra:
  - Proxy/anti-captcha service (~$50–$100).

- Buffer:
  - $500+ for extra API calls or skip-trace volume.

## 📊 Success Criteria (MVP Complete)

User can:

- Log in and search by city/state/zip/county.
- See results list with AI scores and lead temperature tags.
- Skip-trace any lead to fetch contact info.
- Move selected leads into CRM Kanban board.
- Export leads to CSV for manual outreach.

Target outcome: 200+ enriched leads (with phone/email) generated in first 30 days.

## 🌟 Differentiators Beyond Competitors

- AI learning loop → lead scoring improves with user feedback.
- Unified search across APIs and scrapers (most apps do one or the other).
- Fast-track Kanban CRM → actionable lead management out-of-the-box.
- Skip trace confidence levels → prioritize which number/email to call first.
- Budget tracking → cost-per-lead transparency baked into dashboard.

## 👉 Next practical steps (short-term)

1. ✅ Fixed database connectivity issues with direct SQLite implementation.
2. ✅ Connect frontend to new search API endpoints (Phase 1 complete).
3. ✅ Implement lead temperature mapping in DB and UI (Phase 2 complete).
4. ✅ Enable Batch Skip Tracing and create skip-trace UI actions (Phase 3 complete).
5. Build CRM Kanban board for lead management.
6. Build CSV export script.
7. Add basic analytics to monitor cost per lead and conversion metrics.

## 🚧 Blockers

Track any implementation blockers here:
- None currently

---

This roadmap gets you a usable MVP with real leads, AI scoring, skip-tracing, and CRM basics in under a month.

Generated: 2025-09-06
