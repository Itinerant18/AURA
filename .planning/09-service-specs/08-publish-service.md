# 09.08 — publish-service

**Language:** Node.js + Express
**Build order:** #9
**Module mapping:** PRD §4.6.2

---

## Responsibilities

1. Consume `post.approved` → schedule a publish at `scheduled_for`
2. At trigger time, publish to Instagram or Facebook
3. Handle retries, platform errors, rate limits
4. Publish `post.published` on success; flag failures
5. Run the transactional outbox relay for the entire system

**MVP scope:** Instagram + Facebook only. LinkedIn / Twitter publishers are stubbed (throw "not implemented" — review can still approve but publishing for those platforms is a no-op).

---

## Scheduling

BullMQ delayed jobs:
- On `post.approved` consume, enqueue a job with `delay = scheduled_for - now`
- Job processor at scheduled time triggers publish
- Cloud Scheduler hits `/internal/sweep-overdue` every 5 min to recover any missed jobs (defense in depth)

For posts scheduled <5 min from now, publish immediately without the queue.

---

## Public API

| Method | Path | Purpose |
|---|---|---|
| GET | `/publish/status/:postId` | Current publish status + last attempt detail |
| POST | `/publish/retry/:postId` | Manual retry trigger (admin / failed-publish recovery) |
| GET | `/publish/queue` | Tenant view: upcoming scheduled publishes |
| POST | `/publish/cancel/:postId` | Cancel a scheduled publish (status → cancelled) |

Internal:
| POST | `/_pubsub/post-approved` | Subscription handler |
| POST | `/internal/sweep-overdue` | Cloud Scheduler watchdog |
| POST | `/internal/relay-outbox` | Cloud Scheduler hits this every 30s; relays outbox_events to Pub/Sub |

---

## Publishers

`src/publishers/instagram.ts` and `src/publishers/facebook.ts` (also stubs for LinkedIn, Twitter).

### Instagram Business publisher (Meta Graph API v20)

Two-step API:
1. `POST /{ig-user-id}/media` with `image_url`, `caption` → returns `creation_id`
2. `POST /{ig-user-id}/media_publish` with `creation_id` → returns `media_id`

For carousel/reel, additional steps documented in Meta's docs — agent should read latest at build time.

Caption length: 2200 chars max. Hashtags counted in the limit. Truncate gracefully if over.

### Facebook Page publisher

`POST /{page-id}/photos` or `/feed` depending on content type:
- Image: `POST /{page-id}/photos` with `url`, `message`
- Multi-image: build album
- Link post: `POST /{page-id}/feed` with `link`, `message`

---

## Error handling

Per attempt:
- Insert `publish_attempts` row before call
- Update row with platform response + duration after call
- If error retryable (429, 5xx, transient): backoff + retry up to 3 times
- If error permanent (auth invalid, image rejected, content policy): mark `content_posts.status='publish_failed'`, alert via notification-service

Token expiry: if `social_accounts.token_expires_at` is in the past, attempt refresh via auth-service first. If refresh fails: mark social_account inactive, notify tenant to reconnect.

---

## Optimal-time enforcement

Even though review-service already computed `scheduled_for`, if the platform's discovery patterns shift (Instagram Reels best time differs by category), we may update `data/optimal_times.json` and want existing scheduled posts to pick up the new time *before* execution. A small adjustment: at job execution time, if `now - scheduled_for < 15 min` AND a more optimal slot is available in the next 30 min, defer once. Optional polish — not required for MVP.

---

## Outbox relay

This service hosts the outbox relay (shared workload, but lives here for MVP simplicity):
- Cloud Scheduler triggers `/internal/relay-outbox` every 30 seconds
- Reads up to 100 pending rows from `outbox_events`
- Publishes each to Pub/Sub
- Marks each row as sent on success

This is shared infrastructure; the relay processes events from **all** services' transactions.

---

## Events published

- `post.published` — on successful platform confirmation

---

## Events consumed

- `post.approved`

---

## DB tables touched

- `content_posts` — update status, published_at, platform_post_id
- `publish_attempts` — insert per attempt
- `outbox_events` — read + update (sent_at)
- `social_accounts` — read tokens, update last_synced_at

---

## Configuration

- `DATABASE_URL`, `REDIS_URL`, `JWT_PUBLIC_KEY`
- `META_APP_SECRET`, `DB_ENCRYPTION_KEY`
- `PUBSUB_TOPIC_POST_PUBLISHED`

---

## Testing

Unit:
- Caption truncation at 2200 chars
- Retry backoff math
- Image URL validation (must be HTTPS, GCS-hosted)

Integration:
- Sandbox publish to a test Instagram Business account
- Sandbox publish to a test Facebook Page
- Permanent failure → status flips correctly + notification fires

Load:
- 100 simultaneously-scheduled posts execute in <2 min wall clock

---

## Definition of done

- [ ] Skeleton green
- [ ] IG + FB publishers work end-to-end on sandbox apps
- [ ] Retry logic verified with simulated transient failures
- [ ] Token refresh flow exercised
- [ ] Outbox relay deployed and ticking
- [ ] All MVP-deferred publishers (LinkedIn, Twitter) return a clear "not implemented in MVP" status
- [ ] Coverage > 80% on Node code

---

## AI Agent Prompt Template

```
Build publish-service per .planning/09-service-specs/08-publish-service.md.

Read first:
- This spec
- DOSC/AURA_PRD.md §4.6
- .planning/06-event-bus-pubsub-map.md (transactional outbox)
- Latest Meta Graph API docs for IG content publishing (it changes — re-check at build time)

Skeleton first; ping me. Then implement IG publisher fully, then FB, then stub LinkedIn/Twitter.

Confirm:
- Should the outbox relay live here or be its own Cloud Run Job? (Recommend here for MVP; split out if it ever causes contention)
- Reel publishing supported in MVP, or images/carousels only? (Recommend images + carousels for MVP — reels add a 2-step video processing dance)
- For repeated transient failures (3 retries exhausted), should we auto-rescheduled to +1 hour? (Recommend NO; surface as "publish_failed", let reviewer retry manually — keeps state explicit)
```
