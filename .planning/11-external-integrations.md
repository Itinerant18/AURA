# 11 — External Integrations

**Goal:** For every external API AURA touches, document the SDK choice, scopes, rate limits, error handling, and which service owns the integration. This is the integration index — services consult it before adding new external calls.

---

## Integration matrix

| External API | Owner service(s) | SDK | Auth | Rate limits |
|---|---|---|---|---|
| Meta Graph API (Instagram + Facebook) | auth, audit, content, publish, analytics | `facebook-nodejs-business-sdk` (Node) + `httpx` direct (Python) | OAuth 2.0 per tenant | 200 calls/h/user token |
| LinkedIn API v2 | auth, audit | `linkedin-api-client` or direct httpx | OAuth 2.0 | Tier-dependent |
| Twitter/X API v2 | audit, competitor | `twitter-api-v2` (Node) / `tweepy` (Py) | OAuth 2.0 + Bearer | 1500 req / 15 min on Basic tier |
| Google Sheets API | sheets | `googleapis` Node | Per-tenant OAuth | 60 read/min, 60 write/min per user |
| Google Drive API | sheets | `googleapis` Node | Per-tenant OAuth | shared with Sheets |
| Google Places API | competitor | `@googlemaps/google-maps-services-js` | Server API key | 100 QPS |
| Google Business Profile API | audit | `googleapis` | Per-tenant OAuth | Standard GCP quotas |
| Google Gemini (Flash + Pro) | audit, competitor, strategy, content, review | `@google/generative-ai` (Node), `google-generativeai` (Py) | Server API key | 60 RPM (after quota request) |
| Stability AI | content | direct httpx | Server API key | per-key tier |
| OpenAI (DALL-E 3) | content (Growth+/Agency) | `openai` SDK | Server API key | Tier-based |
| Stripe | billing | `stripe` SDK | Server API key | High; not a concern |
| Resend (email) | notification | `resend` SDK | Server API key | 100 emails/sec |
| Sentry | all services | `@sentry/node`, `@sentry/python` | DSN | High |
| GCP services (Cloud SQL, Pub/Sub, GCS, Secret Manager) | all | official `@google-cloud/*` (Node), `google-cloud-*` (Py) | ADC + service account | Per-service GCP quotas |

---

## Integration-by-integration detail

### Meta Graph API v20

**Scopes needed:**
- `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`
- `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_read_user_content`
- `business_management`

**Endpoints used:**
- OAuth: `/oauth/access_token`
- IG: `/{ig-user-id}` (profile), `/{ig-user-id}/media` (publish step 1), `/{ig-user-id}/media_publish` (step 2), `/{ig-user-id}/insights`, `/{ig-business-account}/business_discovery`
- FB: `/{page-id}/feed`, `/{page-id}/photos`, `/{page-id}/insights`

**App review:**
- Submit on day 0 of Phase 0
- Review takes 5–14 days
- Until approved, use Meta's "test users" feature for development

**Token handling:**
- Long-lived page access tokens (60 days)
- Refresh proactively at day 50
- Encrypt at rest with `db-encryption-key`

**Common errors:**
- `(#100)` Invalid parameter — usually image URL not HTTPS-publicly-accessible
- `(#10)` Permission denied — re-prompt user to reconnect
- `(#190)` Token expired — refresh or re-prompt

---

### LinkedIn API v2 (read-only MVP)

**Scopes:** `r_organization_social`, `r_basicprofile`, `r_emailaddress` (or OpenID Connect set)

**Endpoints used:**
- `/v2/organizationAcls?q=roleAssignee` — list managed orgs
- `/v2/organizationalEntityShareStatistics`
- `/v2/socialActions/{shareUrn}`

**Note:** LinkedIn's API approval gate is strict. The "Marketing Developer Platform" tier needs an enterprise account or partnership request. For MVP, the **public organization data** scope (basic, free) is enough to read post engagement on the company page.

---

### Twitter/X API v2 (read-only)

**Endpoints used:**
- `/2/users/by/username/{username}` — discover competitor handle
- `/2/users/:id/tweets` — recent tweets (limit 100, last 7 days on Basic tier)
- `/2/tweets/:id` — engagement metrics

**Cost:** Basic tier $100/mo. Confirm with stakeholder before paying for MVP — it's the smallest signal in the audit.

> **Decision flag for you:** If Twitter spend is contentious, audit-service can skip Twitter and the dimension reduces gracefully ("No Twitter linked — partial audit"). Revisit when there's customer demand.

---

### Google Sheets

**Sheet creation:**
- `drive.files.create` with `mimeType: 'application/vnd.google-apps.spreadsheet'`
- Owner is the tenant user (not AURA)
- Initial parents: tenant's root Drive — they see it in "My Drive"

**Updates:**
- Use `spreadsheets.values.batchUpdate` for multi-row writes
- Always specify `valueInputOption: 'USER_ENTERED'` so dates and formulas work

**Token refresh:**
- Standard OAuth 2 refresh
- If refresh fails, user must reconnect

---

### Google Places API

**Endpoints:**
- `places.searchNearby` — for competitor discovery
- `places.details` — for website, phone, hours

**Cost:** Per-query pricing. For competitor discovery (5 results × 1 detail call each per tenant per onboarding): ~Rs. 1.5 per tenant. Negligible.

---

### Google Gemini

**Models:**
- `gemini-1.5-flash` — audit dimension classification, caption gen, hashtag gen, review regen
- `gemini-1.5-pro` — strategy, calendar, competitor analysis

**Best practices:**
- Always request JSON output with explicit schema (Pydantic / Zod validation)
- Set `temperature: 0.7` for creative content; `0.2` for analytical
- Use `responseMimeType: 'application/json'` where supported
- Don't include base64 images unless absolutely needed (token budget)

**Cost projection (per tenant per month, rough):**
- Audit: ~20 Flash calls, avg 4k tokens → ~Rs. 1.5
- Competitor: ~10 Pro calls, avg 6k tokens → ~Rs. 3
- Strategy: 2 Pro calls, avg 10k tokens → ~Rs. 2
- Content: 60 Flash calls × 3 (caption/hashtag/image-prompt) avg 1k tokens → ~Rs. 3
- **Total per tenant per month: ~Rs. 10–15**

Well under per-tenant unit economics.

---

### Stability AI

**Endpoints:**
- `/v2beta/stable-image/generate/core` (Starter)
- `/v2beta/stable-image/generate/ultra` (Growth/Agency)

**Cost per image:** Core ~Rs. 2.5, Ultra ~Rs. 8. For 60 posts/month on Growth: Rs. 480/month per tenant.

Higher cost than Gemini, but unavoidable for image gen. Monitor closely.

---

### OpenAI DALL-E 3

Used as fallback or Growth+/Agency upgrade. SDK: official `openai` package. Endpoints: `/v1/images/generations`.

Cost: ~Rs. 6 per image (1024x1024 standard) or Rs. 14 (HD).

---

### Stripe (India)

**SDK:** `stripe` (Node)

**Setup:**
- Three products created via Stripe Dashboard (or once via API at setup time)
- Currency: INR
- Payment methods: card + UPI (UPI is critical for Indian SMBs)
- Webhook endpoint: `https://api.aura.app/billing/webhooks/stripe`

**Test mode:** all dev work uses test keys. Live mode switched only at production cutover.

---

### Resend (email)

**SDK:** `resend` Node SDK

**Setup:**
- Verified sending domain
- Webhook for bounces/complaints → `notification-service /webhooks/email`

**Limits:** 100 emails/sec on the free tier, plenty for MVP volume.

---

## Adapter pattern (mandatory)

Every external API call goes through a thin adapter module in the service that owns it. Adapters:
1. Hide SDK specifics from business logic
2. Are the only place that holds API keys
3. Have explicit retry + backoff config
4. Are individually unit-tested with mocked HTTP

Bad:
```text
business logic directly calls stripe.checkout.sessions.create(...)
```

Good:
```text
business logic calls billingProvider.createCheckout({...})
where billingProvider is an interface and src/adapters/stripe.ts implements it
```

---

## Definition of done

- [ ] Every external API in the matrix has an adapter module in its owning service
- [ ] Every adapter has unit tests with mocked HTTP
- [ ] No external API key appears anywhere except Secret Manager + the service that needs it
- [ ] Rate limit handling (429 → retry with backoff) verified for at least Meta and Gemini
- [ ] An "integrations status" dashboard endpoint in notification-service shows last successful call + last error per provider

---

## AI Agent Prompt Template

```
You are implementing a specific external API integration for AURA.

Tell me which integration you're working on first, then read the row in .planning/11-external-integrations.md for that integration.

DELIVERABLES:
1. Adapter module in the owning service: src/adapters/<provider>.ts (or .py)
2. Interface contract that consumers depend on (not the provider's SDK directly)
3. Unit tests with mocked HTTP (msw for Node, httpx-mock for Python)
4. Documentation comment block at top: endpoints used, scopes/auth, retry policy

CONSTRAINTS:
- Adapter is the ONLY place that imports the provider's SDK
- Never log API keys, request bodies with PII, or full response bodies
- Always log: provider name, endpoint, response code, duration, error code if any
- Retry policy: 3 attempts, exponential backoff 1s/2s/4s, only on transient errors (429, 5xx, network)

ASK FIRST:
- For my integration, are there scopes/permissions I should request beyond what the guide lists?
- Should I add a circuit breaker (e.g., open after 10 consecutive failures)? (Recommend YES for paid APIs like Stability and OpenAI to limit cost on outages)
```
