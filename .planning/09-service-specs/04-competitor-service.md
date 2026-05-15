# 09.04 — competitor-service

**Language:** Python + FastAPI
**Build order:** #5 (parallel with audit-service)
**Module mapping:** PRD §4.3

---

## Responsibilities

1. Auto-discover top 5 competitors via Google Places API + category + location
2. Scrape competitor social profiles (public data only)
3. Generate competitive intelligence report (PRD §4.3.2)
4. Maintain up to 10 competitors per tenant
5. Publish `competitor.report.ready`

**Out of scope:** Real-time tracking (we run on-demand + scheduled, not streaming)

---

## Public API

| Method | Path | Purpose |
|---|---|---|
| POST | `/competitors/discover` | Auto-discover competitors for the tenant |
| GET | `/competitors` | List current competitors with latest report metadata |
| POST | `/competitors/:name/analyze` | Run analysis for one competitor |
| POST | `/competitors/analyze-all` | Trigger batch analysis for all current competitors |
| GET | `/competitors/:name/report` | Full report payload |

Internal:
| POST | `/_pubsub/onboarding-completed` | Handler; if competitor list empty, auto-discover then analyze |

---

## Discovery flow

1. Read business_profile: category, location (lat/lng)
2. Query Places API: `nearbysearch` within 5 km radius, type matching category
3. Filter results: same category, exclude tenant itself, rank by review count + rating
4. Take top 5, store as competitor names
5. For each, attempt to find their social profiles:
   - Look up Instagram handle via website scrape (Places API gives website → fetch HTML → regex for IG handle)
   - Same for Facebook
   - Skip LinkedIn/Twitter for SMBs (rarely meaningful)
6. Persist to `business_profiles.competitor_names` and create empty `competitor_reports` rows ready for analysis

> Manual additions skip steps 1–3 but still need steps 5–6.

---

## Analysis flow (per competitor)

```
1. Scrape last 30 days of public posts (Meta public endpoints; for IG, business discovery API if both accounts are business)
2. Compute metrics: post frequency, avg engagement, hashtag set
3. Categorize content (Gemini Flash, same classifier as audit-service)
4. Detect campaigns: regex on captions for "%off", "buy", "limited", "menu launch", "open"
5. Call Gemini Pro with full data → JSON output with pros, cons, opportunities, content gap
6. INSERT competitor_reports + outbox_events in transaction
```

Time per competitor: ~30–60 seconds. Five competitors → ~3–5 minutes total.

---

## Web scraping rules

- Respect robots.txt; abort if disallowed
- User-Agent: `AURA-Competitor-Crawler/1.0 (+https://aura.app/bot)`
- Max 2 RPS per origin
- Cache responses in Redis for 24 hours (re-runs within a day reuse data)
- Use `httpx` + `selectolax` for HTML parsing; avoid headless browsers in MVP
- For Instagram, prefer the Graph API's Business Discovery endpoint (works only if competitor is also a Business account); for personal/creator accounts, **skip** — note in report

---

## Pros vs. Cons matrix

The Gemini Pro prompt produces a structured object:
```text
{
  "pros": ["High engagement on Reels", "Consistent posting schedule", ...],
  "cons": ["Weak hashtag strategy", "No story content", ...],
  "opportunities": ["No competitor uses 'behind the scenes' content", ...],
  "campaign_summary": "Currently running 'New Menu' campaign with 20% off",
  "benchmark_vs_tenant": { "follower_ratio": 1.4, "engagement_diff_pct": -0.8 }
}
```

Schema validated with Pydantic before persisting.

---

## Events published

- `competitor.report.ready` — fires once per *batch* (after all competitors analyzed in a run)

---

## Events consumed

- `onboarding.completed` — discover + analyze

---

## DB tables touched

- `competitor_reports` — primary
- `business_profiles` — read for category/location, update `competitor_names`

---

## Dependencies

- Google Places API
- Meta Graph API (Business Discovery)
- Gemini 1.5 Pro

---

## Configuration

- `DATABASE_URL`, `REDIS_URL`, `JWT_PUBLIC_KEY`
- `GEMINI_PRO_API_KEY`, `META_APP_SECRET`, `PLACES_API_KEY`
- `PUBSUB_TOPIC_COMPETITOR_REPORT_READY`

---

## Testing

Unit:
- Pros/cons schema validation
- Robots.txt respect logic
- Places API response parsing (golden fixture)

Integration:
- Discovery for a test tenant returns 5 plausible competitors in staging
- Full analyze run produces a valid competitor_reports row

---

## Definition of done

- [ ] Skeleton green
- [ ] Discovery works for at least 3 SMB categories (cafe, salon, gym)
- [ ] Analysis completes for 5 competitors in <5 minutes
- [ ] `competitor.report.ready` published
- [ ] Web scraping respects robots.txt + UA + rate limits
- [ ] Coverage > 70%

---

## AI Agent Prompt Template

```
Build competitor-service per .planning/09-service-specs/04-competitor-service.md.

Parallel work warning: audit-service may be under development at the same time. Pull main frequently. Do NOT modify packages/* without coordinating.

Read first:
- This spec
- DOSC/AURA_PRD.md §4.3
- .planning/06-event-bus-pubsub-map.md

Skeleton first; ping me; then implement.

Confirm:
- Should we use Playwright as a fallback when httpx scraping fails? (Recommend NO for MVP — adds 200MB to image and operational complexity. Skip the competitor and note in report instead)
- For competitors who are not Business IG accounts, do we surface them in the report or hide entirely? (Recommend surface with a "Limited data" note — adds transparency)
```
