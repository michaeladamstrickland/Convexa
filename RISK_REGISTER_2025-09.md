# Risk Register (Sept 2025)

| Risk | Impact | Likelihood | Owner | Mitigation | Trigger/Monitor |
|---|---|---|---|---|---|
| Provider API changes (v1/v2) | High | Medium | Eng Lead | Feature-flag, contract tests, canary | Build fails tests; 4xx schema errors |
| Quota/cost overrun | High | Medium | Ops | Budget guardrails, daily quota tracker, alerts | Cost > 80% budget; quota near-limit |
| PII exposure (logs/exports) | High | Low | Security | Mask tokens; gate debug; encrypt backups; redact options | Log scan flags secret; external request to debug |
| Windows shell quirks | Medium | High | Eng | Prefer Node runners; provide PowerShell/batch wrappers | Script failures on CI/ops machines |
| Data quality variance | Medium | Medium | Data | Address normalization, inference, sampling QA | Hit-rate dips; bounce reports |
| DB corruption/dual paths | High | Low | Eng | Single canonical path; backups; VACUUM checks | File mismatch; migration errors |
| Secrets leakage in repo | High | Low | SecOps | Pre-commit hooks/scan; rotate on incident | Secret detected alert |
| Cache staleness | Medium | Medium | Eng | TTLs; force-refresh flags; audit cache-hit | Complaints of outdated contacts |
| High 5xx/error spikes | High | Medium | Ops | Auto-retry/backoff; alerting; circuit-breakers | Error-rate > 5% over 5m |
