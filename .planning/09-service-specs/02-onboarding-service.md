# 09.02 — onboarding-service

**Language:** Node.js + Express
**Build order:** #2
**Module mapping:** PRD §4.1, §5.1 Steps 2–7

---

## Responsibilities

1. Business profile CRUD (PRD §4.1.1)
2. Social account status — read `social_accounts` to surface what's linked vs. not
3. Competitor list management (PRD §4.3.1) — add/remove competitor names manually
4. Menu/service catalog management (food/services items with images)
5. Onboarding completeness scoring — what % of the profile is filled, used to gate audit run
6. Trigger first audit + competitor analysis when onboarding hits 70% complete

**Out of scope:** OAuth flows (auth-service owns those), audit scoring (audit-service owns).

---

## Public API

| Method | Path | Purpose |
|---|---|---|
| GET | `/onboarding/state` | Returns completeness % + which steps remain |
| GET | `/onboarding/profile` | Full business profile |
| PUT | `/onboarding/profile` | Upsert business profile |
| POST | `/onboarding/menu/items` | Add a menu/service item |
| PUT | `/onboarding/menu/items/:id` | Update item |
| DELETE | `/onboarding/menu/items/:id` | Remove item |
| GET | `/onboarding/social-status` | List of platforms + link status |
| POST | `/onboarding/competitors` | Add a competitor by name |
| DELETE | `/onboarding/competitors/:name` | Remove competitor |
| POST | `/onboarding/finish` | Mark onboarding complete; triggers first audit |
| POST | `/onboarding/upload-image` | Signed-URL issuance for client-side direct upload to GCS |

---

## Completeness scoring

A simple weighted formula in `src/services/completeness.ts`:
- Business name + category: 15%
- Location (filled): 10%
- Brand voice selected: 10%
- Target audience filled: 10%
- USPs (≥2): 10%
- Menu/service items (≥3): 15%
- Social accounts linked (≥1 IG/FB): 20%
- Competitor names (≥1, optional auto-discovery covers if 0): 10%

Threshold to trigger audit: **70%**. Tenants below this get a friendly UI prompt instead of an audit.

---

## Events published

- `onboarding.completed` (internal — add to event bus map)
  - Payload: `{ tenantId, completedAt, completeness }`
  - Consumed by: audit-service (kicks off first audit), competitor-service (kicks off discovery if competitors empty), notification-service (welcome email)

---

## Events consumed

- `social.connected` (from auth-service) → bumps completeness score; potentially auto-triggers `onboarding.completed`

---

## DB tables touched

- `business_profiles` — primary
- `social_accounts` — read-only
- `tenants` — read

---

## File uploads

Menu item images and brand assets:
1. Client requests signed URL: `POST /onboarding/upload-image` with `{ purpose: 'menu' | 'logo' | 'banner', contentType }`
2. Service generates a 5-minute signed PUT URL for `gs://aura-uploads-<env>/<tenantId>/<uuid>.<ext>`
3. Client uploads directly to GCS
4. Client confirms with `POST /onboarding/menu/items` providing the GCS path
5. A nightly job promotes images to `aura-public-<env>` and deletes the upload — for MVP, this can be inline-on-confirm

Image constraints: <10 MB, JPG/PNG/WebP only, validated server-side via GCS metadata read.

---

## Dependencies

- `auth-service` JWKS for JWT verification
- `packages/db`, `packages/utils`, `packages/queue`, `packages/types`
- GCS for image storage

---

## Configuration

- `DATABASE_URL`, `REDIS_URL`, `JWT_PUBLIC_KEY`
- `GCS_BUCKET_UPLOADS`, `GCS_BUCKET_PUBLIC`

---

## Testing

Unit:
- Completeness scoring formula edge cases
- Image upload URL generation

Integration:
- Full profile CRUD flow
- `/onboarding/finish` correctly publishes `onboarding.completed` to outbox

---

## Definition of done

- [ ] Skeleton checklist green
- [ ] All 11 routes implemented + tested
- [ ] Completeness scoring documented in code with examples
- [ ] `onboarding.completed` event reaches the audit-service stub in staging
- [ ] Coverage > 80%

---

## AI Agent Prompt Template

```
Build onboarding-service per .planning/09-service-specs/02-onboarding-service.md.

Read first:
- .planning/09-service-specs/02-onboarding-service.md (this file)
- DOSC/AURA_PRD.md §4.1
- .planning/06-event-bus-pubsub-map.md (and add the new `onboarding.completed` topic to that map)

Skeleton first, then ping me. Then implement.

Confirm before starting:
- Completeness scoring threshold of 70% — agree, or should it be 60% to reduce friction?
- Should we allow editing profile after onboarding.finished is fired, or freeze it for the first month? (My recommendation: always editable; profile changes don't re-trigger audit until next monthly cycle)
```
