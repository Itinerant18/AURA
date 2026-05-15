# 09.12 — billing-service

**Language:** Node.js + Express
**Build order:** #12
**Module mapping:** PRD §7

---

## Responsibilities

1. Stripe Checkout session creation for new subscriptions
2. Subscription lifecycle (created, updated, canceled, payment_failed, payment_succeeded)
3. Webhook handler for Stripe events
4. Plan enforcement: expose `canUseFeature(tenantId, feature)` for other services
5. Customer portal redirect for self-service plan changes
6. Invoice history

---

## Public API

| Method | Path | Purpose |
|---|---|---|
| POST | `/billing/checkout` | Start a checkout session (returns Stripe URL) |
| GET | `/billing/subscription` | Current subscription state for tenant |
| POST | `/billing/portal` | Redirect URL to Stripe customer portal |
| GET | `/billing/invoices` | List historical invoices |
| GET | `/billing/usage` | Current month usage vs. plan limits |

Internal:
| POST | `/internal/canUseFeature` | Cross-service call: `{tenantId, feature}` → `{allowed, reason, limitRemaining}` |
| POST | `/webhooks/stripe` | Stripe webhook handler |

---

## Stripe products & pricing (mirror PRD §7)

| Product | Price | Stripe Product ID (to be created) |
|---|---|---|
| AURA Starter | Rs. 1,999/mo | `prod_starter` |
| AURA Growth | Rs. 4,999/mo | `prod_growth` |
| AURA Agency | Rs. 14,999/mo | `prod_agency` |

All recurring monthly. Currency: INR. India-issued cards + UPI accepted.

---

## Plan enforcement matrix

| Feature | Starter | Growth | Agency |
|---|---|---|---|
| Social accounts | 2 | 5 | unlimited |
| Posts/month (generation budget) | 20 | 60 | unlimited |
| Competitors tracked | 3 | 10 | unlimited |
| Audit cadence | monthly | monthly + on-demand | weekly + on-demand |
| Image gen (per post) | Stability Core | Stability Ultra | Ultra + DALL-E option |
| Reviewers | self | 1 dedicated | team |
| Clients per account | 1 | 3 | unlimited |
| Google Sheets export | yes | yes | yes + API access |

`canUseFeature` looks up `tenants.plan` and returns allow/deny + remaining counts for quota-style features.

Service-specific enforcement points:
- onboarding-service: social account count, competitor count
- content-service: posts/month budget
- analytics-service: API access for Agency

---

## Webhook handler

Endpoint `/webhooks/stripe` accepts events. Required handling:

| Event | Action |
|---|---|
| `checkout.session.completed` | Activate subscription, set `tenants.plan`, send welcome notification |
| `customer.subscription.updated` | Update `tenants.plan` if price changed |
| `customer.subscription.deleted` | Set `tenants.is_active=false`, send canceled notification |
| `invoice.payment_succeeded` | Log to `subscription_events`, send receipt |
| `invoice.payment_failed` | Mark `payment_grace_until=now+7d`, send urgent notification |
| `customer.subscription.trial_will_end` | (not used in MVP — no trials) |

Webhook verification: `stripe.webhooks.constructEvent` with `stripe-webhook-secret`. Reject otherwise.

Idempotency: every Stripe event has a unique `id`; we record it in `webhook_events` table and skip duplicates.

---

## Grace period

When a payment fails:
- 7 days grace, service still works
- Day 4: reminder email
- Day 7: subscription canceled, tenant set inactive
- Read endpoints (existing data) still accessible for 30 days; write endpoints return 402 Payment Required

---

## Customer portal

Stripe-hosted. Configure in Stripe dashboard:
- Allow customers to: cancel, update payment method, view invoices, switch between AURA plans
- Branding: AURA logo + colors
- Return URL: `https://app.aura.app/settings/billing?status=success`

---

## Events published

- `subscription.created`, `subscription.canceled`, `subscription.payment_failed`, `subscription.payment_succeeded`
  - Consumed by notification-service (for emails) and analytics (for revenue dashboards later)

Add these to `06-event-bus-pubsub-map.md` when implementing.

---

## Events consumed

None.

---

## DB tables touched

- `tenants` — update plan, stripe_customer_id, is_active
- `subscription_events` — insert
- `webhook_events` — insert (idempotency record)

---

## Configuration

- `DATABASE_URL`, `JWT_PUBLIC_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `FRONTEND_ORIGIN` — for redirect URLs after checkout

---

## Testing

Unit:
- Plan limits matrix
- canUseFeature edge cases (over quota, near quota, grace period)
- Webhook signature verification

Integration:
- Full checkout flow with Stripe test mode → subscription active → invoice paid → tenant.plan correct
- Failed payment → grace period → cancellation lifecycle
- Webhook replay (same event twice) handled idempotently

---

## Security

- Webhook secret rotates — must support old + new for 24h after rotation
- Never log Stripe customer details (PCI)
- Webhook endpoint not behind auth (Stripe doesn't auth) — verification via signature

---

## Definition of done

- [ ] Skeleton green
- [ ] Test mode: full subscribe → cancel → resubscribe cycle works
- [ ] Plan limits enforced via canUseFeature in at least content-service and onboarding-service
- [ ] Grace period behavior verified
- [ ] Customer portal redirect works
- [ ] Live mode: one real test transaction in INR
- [ ] Coverage > 85% (this is a money path — high bar)

---

## AI Agent Prompt Template

```
Build billing-service per .planning/09-service-specs/12-billing-service.md.

Read first:
- This spec
- DOSC/AURA_PRD.md §7
- Stripe India docs for product/price setup with INR + UPI

Skeleton first; ping me. Then implement.

Confirm:
- For Agency tier, do we support per-seat add-ons in MVP? (Recommend NO — flat rate; per-seat later)
- For mid-cycle upgrades (Starter → Growth on day 15), how should proration be handled? (Recommend Stripe default proration — they manage the math)
- Should canUseFeature be a sync HTTP call from other services, or should we cache results in Redis with short TTL? (Recommend Redis cache 60s TTL — content-service might call this thousands of times during a batch)
```
