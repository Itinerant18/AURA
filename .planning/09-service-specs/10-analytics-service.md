# 09.10 — analytics-service

**Language:** Python + FastAPI
**Build order:** #10
**Module mapping:** PRD §4.7

---

## Responsibilities

1. Consume `post.published` → schedule analytics polling at +1h, +24h, +7d
2. Fetch impressions, reach, likes, comments, shares, saves, clicks per post
3. Persist to `post_analytics`
4. Aggregate monthly performance vs. 30-day strategy KPIs
5. Expose dashboard endpoints for the frontend

---

## Polling schedule

For each published post, three snapshot polls:
- T+1 hour — early signal
- T+24 hours — primary KPI
- T+7 days — final number

Use Cloud Tasks delayed dispatch. Each snapshot writes a `post_analytics` row with `recorded_at`.

After T+7 days, no more polling unless the dashboard requests a manual refresh.

---

## Public API

| Method | Path | Purpose |
|---|---|---|
| GET | `/analytics/posts/:id` | Latest analytics for a single post |
| GET | `/analytics/posts/:id/history` | All snapshots for a post (3 rows typical) |
| GET | `/analytics/dashboard` | Monthly summary for current month |
| GET | `/analytics/dashboard?month=YYYY-MM` | Specific month |
| GET | `/analytics/top-posts` | Top 5 posts by ER for current month |
| GET | `/analytics/comparison` | Before vs. after audit comparison |
| POST | `/analytics/refresh/:postId` | Manual snapshot trigger |

Internal:
| POST | `/_pubsub/post-published` | Schedule the 3 polls |
| POST | `/internal/poll-snapshot` | Cloud Tasks worker — does one snapshot |

---

## Dashboard payload shape

```text
{
  monthStart: "2026-05-01",
  totalPosts: 22,
  totalImpressions: 145000,
  totalEngagement: 9800,
  avgEngagementRate: 6.8,
  followerGrowth: { ig: 142, fb: 87 },
  topPosts: [...],
  vsLastMonth: { impressions: +12%, ER: -2% },
  vsTargets: { impressions: 80%, ER: 110% }
}
```

`vsTargets` reads KPIs from `content_calendars.strategy_summary.kpis`.

---

## Audit comparison (PRD §4.7 — "Before vs. After")

Pull the latest two `audit_reports` for the tenant and diff the 9 dimension scores. Surface as a simple "+X / -X" grid.

---

## Events consumed

- `post.published` — schedule polling

---

## Events published

- (none required for MVP — sheets-service polls our endpoint or we push directly; we chose push in `09-sheets-service.md`, so we make an HTTP call to sheets-service after each snapshot)

---

## DB tables touched

- `post_analytics` — insert
- `content_posts` — read
- `audit_reports` — read for comparison
- `content_calendars` — read KPIs

---

## Configuration

- `DATABASE_URL`, `JWT_PUBLIC_KEY`
- `META_APP_SECRET`, `DB_ENCRYPTION_KEY`
- `CLOUD_TASKS_QUEUE_PATH` (separate queue: `analytics-poll-queue`)
- `SHEETS_SERVICE_URL` — for push notifications after each snapshot

---

## Testing

Unit:
- Polling scheduler logic (3 jobs at correct delays)
- Dashboard aggregation math
- Audit comparison handles missing prior audit gracefully

Integration:
- Publish a sandbox post → wait → verify T+1h snapshot row appears
- Dashboard returns correct totals for fixture data

---

## Definition of done

- [ ] Skeleton green
- [ ] All 7 routes implemented
- [ ] 3 polling snapshots per published post
- [ ] Dashboard endpoint serves a complete monthly summary
- [ ] Audit comparison endpoint works
- [ ] Coverage > 70%

---

## AI Agent Prompt Template

```
Build analytics-service per .planning/09-service-specs/10-analytics-service.md.

Read first:
- This spec
- DOSC/AURA_PRD.md §4.7
- .planning/09-service-specs/08-publish-service.md (you consume its event)
- Meta Graph API docs for /{ig-media-id}/insights and /{post-id}/insights

Skeleton first; then implement.

Confirm:
- 3 snapshots (1h, 24h, 7d) — sufficient for MVP, or also a 30-day final? (Recommend 3 for MVP; add 30d in Phase 1.5 when we have BigQuery)
- Push to sheets-service on every snapshot, or only on the 24h snapshot? (Recommend 24h only — keeps Sheets clean, 1h is too noisy)
```
