# Lead Enrichment Scoring

## Deterministic Rules (Sprint 4.6)
Base score: 50

Adjustments:
- +10 if `sqft > 1200`
- -10 if `sqft < 800`
- +10 if `price < 150000`
- -5  if `price > 350000`
- +15 if `condition == NeedsWork`

Clamp 0–100.

## Tags
- `high-potential`: score > 80
- `low-margin`: `sqft < 800` AND `price > 300000`

## Condition Inference
If absent: `NeedsWork` when `price < 120000` OR `sqft < 900`, else `Fair`.

## Extensibility
Future AI/ML override may provide probability-weighted scores; design keeps rule engine isolated in `enrichment/scoring.ts`.

## Example
```
sqft=1300 price=140000 condition(Fair inferred) => 50 +10 +10 = 70 (no tags)
sqft=700 price=400000 condition(NeedsWork inferred) => 50 -10 -5 +15 = 50 (adds low-margin)
```

## Next Ideas
- Add market velocity weighting.
- Incorporate external valuation delta.
- ML model override path with confidence interval.
