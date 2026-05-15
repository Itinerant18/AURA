# 09.03 — audit-service

**Language:** Python + FastAPI
**Build order:** #4 (after auth + onboarding)
**Module mapping:** PRD §4.2

---

## Responsibilities

1. Pull social data via Meta/LinkedIn/Twitter APIs for a tenant
2. Score 9 dimensions (PRD §4.2.1)
3. Generate insights + action items via Gemini 1.5 Flash
4. Render PDF report (PRD §4.2.2)
5. Upload PDF to GCS, save scores + insights to DB
6. Publish `audit.completed`
7. Re-run monthly per tenant via Cloud Scheduler

**Out of scope:** Competitor data (separate service), AI strategy (separate service)

---

## Public API

| Method | Path | Purpose |
|---|---|---|
| POST | `/audit/run` | Trigger a manual audit run (admin or tenant-initiated) |
| GET | `/audit/reports` | List all audit reports for current tenant |
| GET | `/audit/reports/:id` | Get specific report metadata + signed PDF URL |
| GET | `/audit/reports/:id/raw` | Raw scores + insights JSON (for in-app dashboard) |

Internal:
| Method | Path | Purpose |
|---|---|---|
| POST | `/internal/audit/run-batch` | Cloud Scheduler hits this monthly with `{ tenantIds: [...] }` (limit 50 per call) |
| POST | `/_pubsub/social-connected` | Push subscription handler for `social.connected` event |
| POST | `/_pubsub/onboarding-completed` | Push subscription handler |

---

## The 9 audit dimensions (PRD §4.2.1)

Each scored 0–100. Implemented as a class per dimension in `src/scoring/`:

1. **Profile Completeness** (`profile.py`) — bio length, profile photo, links, contact info, location tagged
2. **Posting Frequency** (`posting.py`) — posts/week compared to category benchmark (load from `data/category_benchmarks.json`)
3. **Engagement Rate** (`engagement.py`) — (likes + comments + shares + saves) / followers, per post, averaged
4. **Content Mix** (`content_mix.py`) — % promotional / educational / lifestyle / interactive — Gemini Flash classifies each post
5. **Hashtag Strategy** (`hashtag.py`) — hashtag count per post, mix of high/medium/niche volume
6. **Audience Growth** (`growth.py`) — follower delta over 30 + 90 days (requires historical data; for first audit, use a stub baseline)
7. **Best-Performing Content** (`top_posts.py`) — top 5 posts by engagement, with pattern notes
8. **Response Time** (`response.py`) — avg reply time to comments + DMs (Meta Insights API)
9. **SEO & Discoverability** (`seo.py`) — bio keyword density, alt text presence, location tag use

**Overall score:** weighted average. Weights configurable per category in `data/category_weights.json`.

---

## Dependencies

- Meta Graph API v20 (Instagram Business Insights + Facebook Page Insights)
- LinkedIn API v2 (organization analytics) — read-only
- Twitter/X API v2 (user metrics + tweets) — read-only
- Gemini 1.5 Flash for content classification + insight prose generation
- GCS for PDF storage
- Pub/Sub for event publishing

---

## Events consumed

- `social.connected` — trigger first audit if onboarding ≥ 70%
- `onboarding.completed` — trigger first audit
- Scheduled monthly via Cloud Scheduler hitting `/internal/audit/run-batch`

---

## Events published

- `audit.completed` (see `06-event-bus-pubsub-map.md` for payload)

---

## Audit run pipeline

```
1. Load social_accounts for tenant, decrypt tokens
2. For each platform in parallel (asyncio.gather):
   a. Fetch profile data
   b. Fetch recent 50 posts + insights
3. Compute scores for each of 9 dimensions
4. Call Gemini Flash with structured prompt → insights JSON
5. Render PDF (Jinja2 → WeasyPrint → PDF)
6. Upload PDF to gs://aura-private-<env>/audits/<tenantId>/<reportId>.pdf
7. Generate 7-day signed URL
8. INSERT audit_reports row + outbox_events row in single transaction
9. Outbox relay → publishes audit.completed
```

Total target: **< 4 hours** per PRD §6.

---

## PDF template

`src/report/templates/audit_v1.html` — Jinja2 template. Sections:
1. Cover page (tenant name, period, overall score, traffic-light badge)
2. Executive summary (Gemini-generated, 3 paragraphs)
3. 9 dimension cards (score + traffic light + 1-paragraph explanation + top-3 action items)
4. Best-performing content snippets
5. Recommendations + roadmap teaser

Branding: AURA logo + tenant logo (if uploaded during onboarding). Output: A4, ~6–10 pages.

---

## Gemini prompts

Two prompts, both maintained as text files in `src/prompts/`:
- `insights_system.txt` — system prompt establishing role, output schema (JSON), tone
- `content_classify_system.txt` — for classifying posts into the 4 content-mix categories

Always request JSON output with explicit schema. Validate with Pydantic before persisting.

---

## Caching + rate limits

Meta API rate limit: 200 calls/hour/user token (PRD §9.2). The audit fetches ~30–50 calls per tenant. Stay under by:
- Batching calls into a single FB Graph API `?batch=` request where supported
- Caching social account data in Redis with 15-minute TTL during a single audit run
- Spacing batch runs (5 tenants/minute on the Cloud Scheduler trigger)

Gemini rate limit: 60 RPM (we requested in `01-prerequisites`). Audit uses Flash, ~10 calls per audit. Plenty of headroom.

---

## Configuration

Env vars:
- `DATABASE_URL`, `REDIS_URL`, `JWT_PUBLIC_KEY`
- `GEMINI_FLASH_API_KEY`, `META_APP_SECRET`, `LINKEDIN_CLIENT_SECRET`, `TWITTER_BEARER_TOKEN`
- `DB_ENCRYPTION_KEY`
- `GCS_BUCKET_PRIVATE`
- `PUBSUB_TOPIC_AUDIT_COMPLETED`

---

## Testing

Unit:
- Each scoring module with fixture social data (golden JSON fixtures in `tests/fixtures/`)
- PDF renders without exception for a sample report

Integration:
- Full audit run against the Meta Graph API sandbox for one test tenant
- Event published reaches a stub strategy-service subscriber

Snapshot:
- The rendered PDF for a fixture tenant matches a baseline (allow 5% pixel diff)

---

## Definition of done

- [ ] Skeleton checklist green
- [ ] All 4 public routes + 3 internal routes implemented
- [ ] All 9 dimension scorers implemented + tested
- [ ] PDF renders cleanly
- [ ] Real audit completes against the sandbox Meta app in <4 hours (target: <30 min for a single tenant)
- [ ] `audit.completed` published with valid payload
- [ ] Coverage > 75% (Python AI/ML services often hit a lower ceiling than pure Node)

---

## AI Agent Prompt Template

```
Build audit-service per .planning/09-service-specs/03-audit-service.md.

Read first:
- This spec
- DOSC/AURA_PRD.md §4.2
- .planning/06-event-bus-pubsub-map.md (the audit.completed payload)
- The latest Meta Graph API docs for Instagram Business Insights — confirm endpoints and required fields

Skeleton first (FastAPI app, /health, /ready, JWT middleware verifying against auth-service JWKS, tenant context middleware, structured logger, Sentry, /openapi.json). Ping me.

Then implement the 9 scoring modules ONE AT A TIME — write each, write its fixture tests, get them green, then move on. Don't try to build all 9 in one shot.

Confirm before starting:
- WeasyPrint vs. ReportLab for PDF? (Recommend WeasyPrint — HTML/CSS authoring is easier)
- Category benchmarks: should I bootstrap with industry data I synthesize, or do you have real benchmarks? (If synthesizing, output the JSON to data/category_benchmarks.json and flag for your review)
- For dimension #6 (Audience Growth), the first audit has no history. Default to "Not enough data — baseline set" with a 70/100 placeholder?
```
