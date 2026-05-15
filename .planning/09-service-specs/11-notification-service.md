# 09.11 — notification-service

**Language:** Node.js + Express
**Build order:** #11
**Module mapping:** PRD §5 (user flows trigger notifications)

---

## Responsibilities

1. Send transactional emails for major user-visible events
2. In-app notification persistence (a `notifications` table for the bell-icon list)
3. Subscribe to every major pipeline event
4. Provide unsubscribe + preferences API

**MVP scope:** Email + in-app only. No push, no WhatsApp, no SMS.

---

## Notifications catalog

| Event consumed | Email sent | In-app notif |
|---|---|---|
| `user.created` (internal from auth-service signup) | Welcome email | Yes |
| `social.connected` | "✓ Instagram connected" | Yes |
| `onboarding.completed` | "Onboarding done — your audit is being prepared" | Yes |
| `audit.completed` | "Your audit report is ready" + PDF link | Yes |
| `competitor.report.ready` | "Competitor analysis ready" | Yes |
| `strategy.generated` | "Your 30-day plan is live — review your content queue" | Yes |
| `post.ready` | (digest, not per-post) — daily 9am IST digest with count of pending reviews | Yes (per post in-app) |
| `post.approved` | (silent) | No |
| `post.published` | "Post published on Instagram" (digest at end of day) | Yes |
| `publish.failed` | "Post failed to publish — needs attention" | Yes (urgent) |
| `subscription.payment_failed` (from billing) | "Your payment failed — please update card" | Yes (urgent) |
| `subscription.canceled` | "Your subscription was canceled" | Yes |
| `token.expiring_soon` (cron) | "Reconnect your Instagram before it expires" | Yes |

---

## Public API

| Method | Path | Purpose |
|---|---|---|
| GET | `/notifications` | Paginated list of in-app notifications |
| POST | `/notifications/mark-read` | Mark IDs as read |
| GET | `/notifications/preferences` | Current preferences (which categories to email) |
| PUT | `/notifications/preferences` | Update preferences |
| GET | `/notifications/unread-count` | Bell-icon counter |

Internal:
| Multiple | `/_pubsub/<event>` | One handler per consumed topic |

Public (unauth):
| GET | `/notifications/unsubscribe?token=...` | One-click unsubscribe from email categories |

---

## Email templates

`src/templates/` — MJML files compiled to HTML at build time. One per notification type. Use a shared layout (header logo, footer with unsubscribe + brand).

Subjects are personalized: "Ravi, your audit report is ready" reads better than generic. Pull `users.first_name` (add to schema if missing).

---

## Sending

- Provider: Resend (or SendGrid). Adapter at `src/email/provider.ts`.
- Track every send in `email_log` table: `{tenantId, userId, type, status, providerMessageId, sentAt}`.
- Bounces + complaints handled via provider webhook → `/webhooks/email`.

---

## Digest emails

For high-frequency events (`post.ready`, `post.published`), batch into daily digests:
- 9:00 AM IST — "X posts pending your review"
- 6:00 PM IST — "Today's published posts" summary

Cloud Scheduler triggers `/internal/send-digests` twice daily; service iterates tenants and sends one email per tenant with non-zero counts.

---

## In-app notifications

A `notifications` table (add to schema if missing):
```text
notifications
  id UUID PK
  tenant_id UUID FK
  user_id UUID FK  -- target user; can be null for "all owners in tenant"
  type VARCHAR
  payload JSONB
  read BOOLEAN
  created_at TIMESTAMPTZ
```

Frontend polls `/notifications/unread-count` every 60s (or uses WebSocket in Phase 1.5).

---

## Events consumed

All major pipeline events (see catalog above).

---

## Events published

None.

---

## DB tables touched

- `notifications` — insert/update
- `email_log` — insert
- `notification_preferences` — read/update
- `users`, `tenants` — read for personalization

---

## Configuration

- `DATABASE_URL`, `JWT_PUBLIC_KEY`
- `RESEND_API_KEY` (or `SENDGRID_API_KEY`)
- `FROM_EMAIL` — e.g., `hello@aura.app`
- `FRONTEND_ORIGIN` — for links

---

## Testing

Unit:
- Each template renders for sample data without missing variables
- Digest aggregation produces correct counts

Integration:
- Trigger `audit.completed` → email arrives at test mailbox (or check provider's API log)
- Unsubscribe link works

---

## Definition of done

- [ ] Skeleton green
- [ ] All 14 notification types covered
- [ ] Templates render correctly across Gmail + Outlook + Apple Mail (manual QA)
- [ ] Digest emails fire on schedule
- [ ] Preferences API works
- [ ] In-app feed populated
- [ ] Unsubscribe works
- [ ] Coverage > 80%

---

## AI Agent Prompt Template

```
Build notification-service per .planning/09-service-specs/11-notification-service.md.

Read first:
- This spec
- DOSC/AURA_PRD.md §5 (user flows define when emails go out)
- .planning/06-event-bus-pubsub-map.md (every event you subscribe to)

Skeleton first; ping me. Then build templates one at a time, with a screenshot for each.

Confirm:
- Resend vs. SendGrid for transactional? (Recommend Resend — better DX, India works fine)
- MJML vs. React Email? (Recommend MJML — language-agnostic, good ecosystem, no React deps in this Node service)
- Should we add WhatsApp Business templates as stubs for Phase 1.5? (Recommend NO — out of MVP entirely; build interface only when WA is on the roadmap)
```
