# 09.07 — review-service

**Language:** Node.js + Express
**Build order:** #8
**Module mapping:** PRD §4.6

---

## Responsibilities

1. Consume `post.ready` → enqueue into reviewer queue (BullMQ on Redis)
2. Expose review queue API for the frontend reviewer dashboard
3. Handle approve / reject / modify decisions
4. On modify: call content-service `/content/posts/:id/regenerate`
5. On approve: publish `post.approved`
6. On reject: mark `content_posts.status='rejected'`, notify owner
7. Bulk publish: "Approve all" for the dashboard

---

## Public API

| Method | Path | Purpose |
|---|---|---|
| GET | `/review/queue` | Paginated list of pending posts (status='pending_review') |
| GET | `/review/queue/count` | Quick counter for the navbar badge |
| GET | `/review/posts/:id` | Full post details for preview |
| POST | `/review/posts/:id/approve` | Approve single post |
| POST | `/review/posts/:id/reject` | Reject single post (with optional reason) |
| POST | `/review/posts/:id/modify` | Request modification with reviewerNotes |
| POST | `/review/posts/bulk-approve` | Bulk approve (body: `{ postIds: string[] }`) |
| GET | `/review/history` | Past review actions for the tenant |

Internal:
| POST | `/_pubsub/post-ready` | Subscription handler — enqueue post |

---

## Tier-based review modes

PRD §7 differentiates:
- **Starter** — self-review (the tenant owner *is* the reviewer)
- **Growth** — dedicated reviewer (assigned by AURA team manually for MVP)
- **Agency** — dedicated team (multiple reviewers can be assigned to a tenant)

For MVP, the difference is just *who* sees the queue. Implementation:
- Starter: queue visible only to user with `role='owner'`
- Growth/Agency: queue visible to users with `role='reviewer'`
- Anyone with role `viewer` can see the queue but cannot approve

This is enforced in middleware before route handlers run.

---

## BullMQ queue layout

Single queue `review-queue` on Redis. Job per post:
```text
job.id = postId
job.data = { postId, tenantId, addedAt }
```

Jobs sit until a reviewer acts. We're not using BullMQ for *processing* — it's a durable list with TTLs and easy admin tooling. Could alternatively be a Postgres view; BullMQ is chosen because Redis is already in the stack and the admin UI is free.

---

## Approval flow

```
POST /review/posts/:id/approve
1. Verify reviewer is authorized (role + tenant match)
2. UPDATE content_posts SET status='approved', scheduled_for=<computed>
3. INSERT review_actions { postId, reviewerId, action='approve', at=now }
4. INSERT outbox_events for post.approved
5. Remove BullMQ job
6. Return updated post
```

### Scheduled time computation

`scheduled_for` is computed from:
- `content_posts.calendar_date` (the day the strategy planned this post)
- The platform's optimal time-of-day for that category (load from `data/optimal_times.json`)
- Tenant timezone (default Asia/Kolkata if not set on tenant; offer override in settings)
- If `calendar_date` is in the past (because the reviewer was slow), schedule for the next available slot the same day, or push to tomorrow if all today's slots are passed

---

## Modify flow

```
POST /review/posts/:id/modify  { reviewerNotes }
1. UPDATE content_posts SET status='regenerating', reviewer_notes=$notes
2. Call content-service: POST /content/posts/:id/regenerate with the notes
3. content-service responds 202 Accepted
4. content-service eventually publishes post.ready again
5. Our subscription handler picks it up, re-enqueues in BullMQ
6. UI shows the regenerated version
```

Modifying does **not** reset the calendar date — only the content changes.

---

## Bulk approve

```
POST /review/posts/bulk-approve  { postIds }
1. Validate every post belongs to caller's tenant + status='pending_review'
2. In a single transaction: update all rows + insert all review_actions + outbox events
3. Return summary { approved: N, failed: [{postId, reason}] }
```

Limit: 100 posts per call (UI shows pagination).

---

## Events published

- `post.approved` per individual post

---

## Events consumed

- `post.ready`

---

## DB tables touched

- `content_posts` — update status, reviewer_notes
- `review_actions` — insert
- `outbox_events` — insert

---

## Dependencies

- Redis (BullMQ)
- content-service (for regenerate calls — internal HTTP)
- `packages/db`, `packages/utils`, `packages/queue`

---

## Configuration

- `DATABASE_URL`, `REDIS_URL`, `JWT_PUBLIC_KEY`
- `CONTENT_SERVICE_URL` — internal DNS for content-service
- `PUBSUB_TOPIC_POST_APPROVED`

---

## Testing

Unit:
- Tier-based authorization
- Scheduled-time computation edge cases (past dates, no optimal slots left today)
- Bulk approve partial failure handling

Integration:
- Full approve flow → post.approved arrives at publish-service stub
- Modify flow → content-service regen → new post.ready → re-enqueued

---

## Definition of done

- [ ] Skeleton green
- [ ] All routes implemented + tier-gated
- [ ] Approval publishes event with correct scheduled_for
- [ ] Modify round-trip works end-to-end in staging
- [ ] Bulk approve handles 100 posts in <2 sec
- [ ] Coverage > 80%

---

## AI Agent Prompt Template

```
Build review-service per .planning/09-service-specs/07-review-service.md.

Read first:
- This spec
- DOSC/AURA_PRD.md §4.6
- .planning/09-service-specs/06-content-service.md (you call its regenerate endpoint)
- .planning/09-service-specs/09-publish-service.md (it consumes your events)

Skeleton first; then implement.

Confirm:
- BullMQ vs. plain Postgres view for queue? (Recommend BullMQ — admin UI useful for debugging)
- Optimal posting times defaults — should we hardcode or load from a JSON config file? (Recommend JSON config, editable in admin tool later)
- Should "modify" preserve the original caption/image as a version history row? (Recommend YES — add post_versions table)
```
