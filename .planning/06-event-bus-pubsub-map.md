# 06 — Event Bus: Pub/Sub Topic & Subscription Map

**Goal:** Define every topic, subscription, payload shape, retry policy, and dead-letter routing for the AURA event-driven pipeline. This is the contract between services.

**Source:** Architecture doc §1.2 ("Event Flow (Pub/Sub)") and §1.3 ("Service Communication Patterns").

**Owner:** AI agent for implementation; you review the payload shapes.

**Time estimate:** ½ day (mostly thinking, very little code).

---

## Topic naming convention

`<domain>.<event-name>`, lowercase, dot-separated, past tense.

We do **not** version topic names. Versioning lives inside the payload (`version` field). When a breaking change is needed, we create a fan-out subscriber that translates v1→v2 in-place rather than splitting the topic.

---

## The 6 pipeline topics

### 1. `audit.completed`

- **Published by:** `audit-service`
- **Consumed by:** `strategy-service`, `notification-service`
- **Trigger:** Audit report PDF written to GCS + scores row in DB
- **Payload (v1):**
  - `tenantId: string`
  - `auditReportId: string`
  - `pdfUrl: string` — GCS signed URL, 7-day expiry
  - `scoresSummary: { profile: number, posting: number, engagement: number, content_mix: number, hashtag: number, growth: number, response: number, seo: number, overall: number }`
  - `periodStart: string` (ISO date)
  - `periodEnd: string` (ISO date)
- **SLA from publish to first consumer ack:** 30 seconds
- **Retention:** 7 days
- **Dead-letter after:** 5 retries

### 2. `competitor.report.ready`

- **Published by:** `competitor-service`
- **Consumed by:** `strategy-service`, `notification-service`
- **Trigger:** Competitor analysis prose generated + saved
- **Payload (v1):**
  - `tenantId: string`
  - `competitorReportIds: string[]` — one report per competitor; events fired once per tenant per *batch*
  - `competitorCount: number`
  - `generatedAt: string`
- **DLQ after:** 5 retries

### 3. `strategy.generated`

- **Published by:** `strategy-service`
- **Consumed by:** `content-service`, `sheets-service`, `notification-service`
- **Trigger:** 30-day calendar + strategy summary persisted
- **Payload (v1):**
  - `tenantId: string`
  - `calendarId: string`
  - `monthStart: string` (ISO date)
  - `slotCount: number` — expected number of content posts to generate
  - `strategySummary: { pillars: string[], kpis: KPI[], platformStrategies: PlatformStrategy[] }`
- **SLA:** 1 minute for content-service to start consuming

### 4. `post.ready`

- **Published by:** `content-service`
- **Consumed by:** `review-service`, `notification-service`
- **Trigger:** A single post's caption + hashtags + image are all generated and persisted with `status='pending_review'`
- **Payload (v1):**
  - `tenantId: string`
  - `postId: string`
  - `calendarId: string`
  - `calendarDate: string`
  - `platform: 'instagram' | 'facebook' | 'linkedin' | 'twitter'`
  - `contentType: 'image' | 'carousel' | 'reel' | 'story'`
- **Note:** This fires **per post**, not per batch. Expect 20–60 events per calendar.

### 5. `post.approved`

- **Published by:** `review-service`
- **Consumed by:** `publish-service`
- **Trigger:** Reviewer clicks Approve (or auto-approve if Starter tier self-review)
- **Payload (v1):**
  - `tenantId: string`
  - `postId: string`
  - `scheduledFor: string` (ISO datetime, UTC)
  - `platform: SocialPlatform`
  - `reviewerId: string | null` — null if auto-approved

### 6. `post.published`

- **Published by:** `publish-service`
- **Consumed by:** `analytics-service`, `notification-service`, `sheets-service`
- **Trigger:** Platform API confirmed publish success
- **Payload (v1):**
  - `tenantId: string`
  - `postId: string`
  - `platform: SocialPlatform`
  - `platformPostId: string` — IG media ID, FB post ID, etc.
  - `publishedAt: string` (ISO datetime)
  - `permalink: string | null`

---

## Operational topics

### `aura.deadletter`
- Receives any message that exceeded retry budget on any subscription
- Consumed by an alerting worker (built in `15-observability-and-logging.md`)
- 14-day retention

### `aura.audit-log`
- Internal: every cross-tenant admin action, billing change, role change
- Consumed by an audit-log writer that persists to `audit_log` table
- 30-day retention

---

## Subscription map

Format: `<topic>` → `<subscription-name>` (consumer)

| Topic | Subscription | Consumer | Type |
|---|---|---|---|
| `audit.completed` | `audit-completed--strategy` | strategy-service | push |
| `audit.completed` | `audit-completed--notification` | notification-service | push |
| `competitor.report.ready` | `competitor-ready--strategy` | strategy-service | push |
| `competitor.report.ready` | `competitor-ready--notification` | notification-service | push |
| `strategy.generated` | `strategy-generated--content` | content-service | push |
| `strategy.generated` | `strategy-generated--sheets` | sheets-service | push |
| `strategy.generated` | `strategy-generated--notification` | notification-service | push |
| `post.ready` | `post-ready--review` | review-service | push |
| `post.ready` | `post-ready--notification` | notification-service | push |
| `post.approved` | `post-approved--publish` | publish-service | push |
| `post.published` | `post-published--analytics` | analytics-service | push |
| `post.published` | `post-published--sheets` | sheets-service | push |
| `post.published` | `post-published--notification` | notification-service | push |
| (any DLQ) | `deadletter--alerts` | a small worker in notification-service | pull |

> Push subscriptions point at HTTPS endpoints on Cloud Run. Pub/Sub signs the request; we verify the OIDC token at the endpoint.

---

## Retry policy

For every push subscription:
- Minimum backoff: 10s
- Maximum backoff: 600s
- Max delivery attempts: 5
- Ack deadline: 60s (extend dynamically for long handlers)
- Dead-letter topic: `aura.deadletter`

For the dead-letter subscription:
- Max delivery attempts: 10 (alert-only worker)

---

## Idempotency

Every consumer must:
1. Read `eventId` from the payload envelope
2. Look up `processed_events` table with `(consumerName, eventId)` unique constraint
3. If row exists → ack immediately (no-op)
4. Else → run handler in a DB transaction that also inserts the `processed_events` row
5. On exception → don't insert, transaction rolls back, Pub/Sub will retry

This is enforced by the `subscribeEvent` helper in `packages/queue` (see `05-shared-packages.md`).

---

## Transactional outbox

Publishers do **not** call Pub/Sub directly from request handlers. Instead:

1. Handler writes domain row(s) + an `outbox_events` row in the same Prisma transaction
2. A relay worker (small process inside `publish-service` for MVP simplicity, or its own process post-MVP) polls `outbox_events` every 2s, ships pending events to Pub/Sub, marks them sent
3. If Pub/Sub publish fails, the row stays pending → retried on next tick

This is the canonical way to avoid "DB committed but event not sent" bugs that destroy event-driven pipelines.

---

## Local dev: Pub/Sub emulator

In `docker-compose.yml`, the `pubsub-emulator` service exposes port 8085. Services check `PUBSUB_EMULATOR_HOST` env var and connect to emulator when set.

A bootstrap script (`scripts/pubsub-bootstrap.sh`) creates all 8 topics + their subscriptions against the emulator on first `pnpm dev:local`.

---

## Diagrams

A Mermaid diagram lives in `docs/architecture/event-flow.md` (created during build). It mirrors the table above. Update it any time a subscription is added or removed.

---

## Definition of done

- [ ] All 8 topics created via Terraform in both staging and prod
- [ ] All 14 subscriptions created via Terraform with correct push endpoints
- [ ] DLQ topic + subscription wired up
- [ ] Push endpoints verify OIDC tokens
- [ ] `packages/queue` exposes typed publisher + subscriber for every topic
- [ ] Outbox relay worker exists and is deployed
- [ ] Pub/Sub emulator works locally; events flow end-to-end on `pnpm dev:local`
- [ ] An end-to-end test publishes `audit.completed` and verifies `strategy-service` receives it

---

## AI Agent Prompt Template

```
You are wiring the AURA event bus.

CONTEXT:
- Read .planning/06-event-bus-pubsub-map.md
- Read .planning/05-shared-packages.md
- Read DOSC/AURA_Architecture_CodeStructure.md §1.2 + §1.3

DELIVERABLES:
1. Implement packages/queue/events.ts with all 6 pipeline events typed as discriminated unions
2. Implement packages/queue/pubsub.ts:
   - publishEvent (uses transactional outbox)
   - subscribeEvent (handles idempotency via processed_events)
   - relayOutbox (worker loop reading outbox_events → Pub/Sub)
3. Add OIDC token verification middleware in packages/utils/http.ts (for push subscription endpoints)
4. Write scripts/pubsub-bootstrap.sh — creates topics + subs in the emulator
5. Update docker-compose.yml to include the pubsub-emulator service
6. Write an end-to-end test: publish audit.completed → verify strategy-service subscriber receives it
7. PR titled "feat(queue): event bus with outbox and idempotency"

CONSTRAINTS:
- All event payloads have eventId, eventType, tenantId, occurredAt, version, payload
- All consumers idempotent via processed_events table
- No direct pubsub.publish() calls from handlers — only via outbox
- Push subscriptions reject requests without valid OIDC token

ASK FIRST:
- Should the outbox relay be its own service or a worker inside publish-service for MVP? (I recommend: dedicated `outbox-relay` cron Job on Cloud Run Jobs, runs every 30s, but tell me if you have a better idea)
- Polling interval for the relay — 2s or 5s? Tradeoff is publish latency vs. DB load
```
