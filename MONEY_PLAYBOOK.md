# Convexa Revenue Playbook — Where We Are, What To Do Next, And The Likely Upside

Date: 2025-09-21

This document puts Convexa’s current state in perspective and lays out a pragmatic, low-risk path to generate real revenue. It focuses on doing what works now with the product we have, and sequencing efforts so we can charge customers while we de-risk.

---

## TL;DR

- We can start making money quickly by packaging the working parts into two sellable offers:
  1) Operator bundle (Lead ops + dashboard + reporting) for solopreneurs/small shops.
  2) Data/ops backend (API + dialer slice + observability) for small teams.
- Zero-vendor-spend mode is already in place; we can run paid pilots using the stubbed integrations to validate workflows, then upsell to real provider spend.
- 7-Day Plan: Stand up a demo instance, preload sample leads, publish a live dashboard, run 3 paid pilots at $199–$499/mo each. Focus on outcomes: “show me leads, calls, and a health dashboard.”
- 30/60/90: Wire one paid provider, tighten dialer and cache metrics, and add one revenue-proof feature (export bundle or AI call summaries) to lift ARPU.
- Success rate expectations: With targeted outreach and a crisp positioning (investor/RE wholesaler ops), 20–40% pilot conversion at the low tier is realistic; long-term success depends on delivery and support.

---

## Current State Snapshot

What’s working and production-leaning today:

- Backend integrated server
  - Stable endpoints for leads, search, skiptrace bulk path (ordering fixed), artifacts (signed URLs), and a dialer v1 slice (dial, ASR-complete, Twilio webhook signature check).
  - Zod DTOs and Problem+JSON error format give us a clean API surface for customers and partners.
- Observability and Ops
  - Prometheus scrapes across multiple local app ports on Windows/Docker Desktop via host.docker.internal.
  - Recording rules loaded and a robust Grafana dashboard that shows live signals (requests, dial attempts, webhook errors) with safe fallbacks.
  - Warm and verify scripts to ensure the dashboard presents data for demos/pilots.
- DevEx & Tests
  - Route tests and a tiny dialer smoke script pass; the server launcher handles Windows specifics and DB path.
- SQLite as the canonical store with WAL, unique constraints for idempotency.
- Zero-spend guardrails
  - Skiptrace demo mode and unique indices allow end-to-end demos without incurring provider costs.

What’s partially implemented or stubbed:

- Cache metrics (convexa_cache_*), queue/DLQ depth, quota metrics are placeholders (panels clamp to zero until wired).
- Vendor latency metrics reuse ASR latency for now (panel labeled accordingly).
- Twilio integration is signature-checked but recording pipeline is stubbed; storage backend is scaffolded.
- Frontend UI exists but the Operator workflow relies on simple endpoints and dashboard visibility.

Key risks/dependencies:

- Real provider spend (BatchData/ATTOM/etc.) isn’t enabled by default; you’ll need API keys and to toggle demo mode off to deliver “real” outcomes (with cost).
- Dialer needs more product work for production calling (retries, disposition logging, compliance notes).
- Sales motion must be narrow and value-anchored; avoid generic “AI CRM” competition.

---

## Who Will Pay Us (Right Now)

Target segments with immediate willingness to pay for outcomes, not features:

1) Solo investors / small wholesaling teams (1–5 reps)
   - Pain: messy leads, inconsistent dialing, no live visibility.
   - Offer: preloaded lead set, one-click “dial now” workflow, and a clean live dashboard.
   - Price: $199–$499/mo (low-touch onboarding), tiered by seats and export limits.

2) Micro-agencies (lead gen/dialing services) that need a repeatable backend
   - Pain: stitching tools, lack of SLAs/metrics for clients.
   - Offer: managed backend with Prometheus+Grafana, artifacts, reporting; white-label option.
   - Price: $499–$1,499/mo depending on seats and dashboards.

3) Data-savvy operators (power users)
   - Pain: want APIs with sane DTOs and reliable idempotency to plug into their apps.
   - Offer: API-first package with Problem+JSON, signed artifacts, and stable lead/search endpoints.
   - Price: $199/mo developer plan with rate limits.

Why these win now: the product’s strength is backend reliability + observability + pragmatic routes, not a big front-end suite. Sell the engine and the visibility, not a full CRM replacement.

---

## What To Sell: Two Offers

1) Operator Bundle (Fastest to revenue)
   - Contents: Integrated server (hosted), live dashboard, daily report export, dialer slice, zero-spend demo mode, CSV import/export.
   - SLA: Best-effort; 24-hour response; uptime target 99% during pilot.
   - Onboarding: Upload your CSV → we preload and verify → we share Grafana link → you dial.
   - Pricing: $299/mo (pilot 30 days), $499/mo standard; add-ons: +$99/seat, +$99 per additional “market” (e.g., extra filters/zip).

2) Backend/API Plan (Lean, dev-centric)
   - Contents: API access with DTOs, signed artifacts endpoints, health/metrics endpoints, dashboard, warm scripts.
   - SLA: Best-effort, response ≤24h.
   - Pricing: $199/mo; overages for batch jobs or additional scraping/dialing capacity.

Migration path: Pilot customers can graduate to metered provider spend (pay-as-you-go) once they see value.

---

## Pricing & Packaging

- Free Trial: 7-day guided trial with preloaded sample leads (no vendor spend).
- Core: $299–$499/mo
- Pro: $999/mo adds white-label dashboard, SSO, and priority support.
- Optional COGS: pass-through of provider costs (skiptrace/data) with a 20% margin when demo mode is disabled.

---

## 7-Day Plan (Revenue in a Week)

Day 1–2: Demo instance and assets
- Spin up a hosted instance (small VM or container), set demo mode ON.
- Preload 300–500 sample leads.
- Import Grafana dashboard; confirm Live Signals row updates.
- Prepare a 3-minute demo video and two screenshots (dashboard + CSV import).

Day 3–4: Outreach (10–20 prospects)
- Script: “We’ll give you a working dial workflow and live ops dashboard in 24 hours. $299 for 30 days. No data vendor spend required; upgrade only if you want live skiptracing/data pulls.”
- Channels: FB groups, investor/wholesaler Slack/Discord, cold email to micro-agencies.

Day 5–7: Run 3 pilots
- Contract: month-to-month; cancel anytime.
- Deliverables: enable access to dashboard; import their CSV; guide their first dial session; weekly export.
- Measure: calls initiated, contacts reached (self-reported), elapsed time to first dial.

---

## 30/60/90 Plan (Scale and ARPU)

- By Day 30
  - Wire one provider end-to-end (skiptrace or property data) with clear cost guardrails.
  - Emit cache hit metrics; fix top panels to reflect real usage.
  - Basic “call notes” capture: POST /dial/:id/notes → show volume metric.

- By Day 60
  - Solidify dialer: retry policy, disposition outcomes, simple campaign queue.
  - Add signed export bundles (CSV + JSON + artifacts) per week.
  - Add “AI” summary from ASR transcript (local model or API-abstracted) to increase perceived value.

- By Day 90
  - Introduce white-label dashboard and SSO for agencies.
  - Add usage-based pricing and metering in billing.
  - Produce 2–3 customer case studies; push referrals.

---

## Go-To-Market (GTM) Tactics

- Narrow ICP: Rehab/wholesale investors and micro-agencies running dialing today.
- Proof-driven messaging: “Live dashboard + dial workflow in 24 hours, $299.”
- Reference demo: pre-recorded screencast and a live Grafana link (with dummy data refreshing every minute).
- Pilot guarantees: “If you don’t start calling in 48 hours, we refund your first month.”
- Land-and-expand: start with one market/seat; upsell seats and real provider spend.

---

## KPIs to Track From Day 1

- Sales: pilot sign-ups / outreach (target: 3/20 = 15%+).
- Activation: time to first dial (target < 48h), dashboard daily active users.
- Engagement: dial attempts per day, webhook errors (should trend to 0), ASR p95 (< 1s within demo).
- Revenue: MRR, ARPU, churn at 30/60 days.

---

## Success Likelihood & Risks (Candid)

- Short-term (pilots within 30 days): 20–40% conversion on targeted outreach is reasonable if we promise concrete outcomes and do the onboarding.
- Medium-term (3–6 months): 10–20 paying customers feasible with focused GTM; risk is support load vs. team bandwidth and product gaps (dialer depth, real provider wiring).
- Biggest risks:
  - Competing tools with complete CRMs; we must win by being the ops engine + dashboard, not the UI suite.
  - Vendor costs/limits once demo mode is off; mitigate with budget ceilings and explicit metering.
  - Reliance on the founder for onboarding; mitigate with scripts/checklists.

---

## What You Need To Do (Checklist)

Immediate (this week)
- [ ] Deploy demo instance; confirm Prometheus targets UP and dashboard live.
- [ ] Prepare import template CSV and sample leads.
- [ ] Record a 3-minute demo video.
- [ ] Outreach to 10–20 prospects; schedule 3 pilot kickoffs.

Pilot delivery
- [ ] Import client CSV; share dashboard link; run first dial session.
- [ ] Send weekly export bundle; collect NPS and “what’s missing?” feedback.

Engineering
- [ ] Emit cache hit metrics; ensure top panels are non-zero where applicable.
- [ ] Tighten dialer endpoints (notes/dispositions), ensure Problem+JSON coverage.
- [ ] Choose one provider to wire fully with spend guardrails.

---

## Appendix: What’s Ready vs. Not

Ready for pilots
- Integrated backend with stable endpoints; Problem+JSON; dialer slice; signed artifacts.
- Prometheus+Grafana stack; robust dashboard; warm/verify tooling; Windows-friendly launchers.
- Zero-spend demo mode and idempotent cache index.

Not ready (or needs attention) for production at scale
- Full dialer sophistication (queues, campaigns, retries, compliance docs).
- Real provider spend defaults off; requires keys and toggles.
- Cache/queue/quota metrics need implementation; panels are placeholders.

---

## Final Word

We can credibly charge for the engine (APIs + dial flow) and the visibility (dashboard) today. Start with pilots priced for outcomes, not features. Use the live dashboard and working endpoints to build trust, then wire real spend and add one “wow” feature to grow ARPU. Keep the ICP narrow, measure activation → engagement → retention, and iterate.
